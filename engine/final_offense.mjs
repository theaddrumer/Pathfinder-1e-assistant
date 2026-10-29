/** V3.15: executable Pull, Push and Energy Drain. GM chooses optional riders.
 * Negative levels remain separate from ability damage/drain and printed HD.
 */
import {CriticalGame} from './critical.mjs';
import {clone} from './core.mjs';
import {ATTACK_RIDERS} from './attack_library.mjs';
const ROUNDS_DAY=14400,ROUNDS_HOUR=600;
const isInt=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi;
export class FinalOffenseGame extends CriticalGame {
 constructor(state){super(state);this.s.negativeLevels ||= [];this.s.negativeLevelSeq ||= 0;this.s.energyTempHp ||= {};this.turnStart=clone(this.s);this.roundStart=clone(this.s);}
 negativeCount(target){return (this.s.negativeLevels||[]).filter(v=>v.target===target).length;}
 stat(id,key){const v=super.stat(id,key);return ['attack','cmb','cmd','fort','ref','will'].includes(key)?v-this.negativeCount(id):v;}
 skillBonus(id,skill){return super.skillBonus(id,skill)-this.negativeCount(id);}
 abilityCheckBonus(id,ability){return super.abilityCheckBonus(id,ability)-this.negativeCount(id);}
 applyNegativeLevels({target,source=null,levels,dc,permanent=false}={}){
  const victim=this.find(target);if(source!==null)this.find(source);
  this.assert(isInt(levels,1,100)&&isInt(dc,0,1000)&&typeof permanent==='boolean','Invalid negative-level application');
  const immunity=this.evaluateEffect({target,tags:['energy_drain']});
  if(immunity.blocked)return {immune:true,blockedBy:immunity.blockedBy,applied:0};
  const dueAt=permanent?null:this.s.worldRounds+ROUNDS_DAY;
  for(let i=0;i<levels;i++)this.s.negativeLevels.push({id:++this.s.negativeLevelSeq,target,source,permanent,dc,dueAt});
  victim.maxHp=Math.max(0,victim.maxHp-5*levels);
  victim.hp=this.adjustedHp(victim,victim.hp-5*levels);
  const total=this.negativeCount(target),hd=victim.hitDiceCount;
  if(Number.isInteger(hd)&&total>=hd){victim.hp=0;victim.slainByEnergyDrain=true;this.note(`${victim.name} dies: ${total} negative levels meet or exceed ${hd} Hit Dice.`);}
  else if(!Number.isInteger(hd))this.note(`ADVISORY: ${victim.name} has no hitDiceCount; negative-level death threshold needs GM review.`);
  this.note(`${victim.name} gains ${levels} ${permanent?'permanent':'temporary'} negative level(s), total ${total}; HP and max HP reduced by ${5*levels}.`);
  return {applied:levels,total,dueAt,permanent,dead:!!victim.slainByEnergyDrain,hp:victim.hp,maxHp:victim.maxHp};
 }
 removeNegativeLevels({target,count=1,permanentOnly=false}={}){
  const creature=this.find(target);this.assert(isInt(count,1,1000),'Invalid number of negative levels to remove');
  const removed=[];
  for(let i=this.s.negativeLevels.length-1;i>=0&&removed.length<count;i--){
   const v=this.s.negativeLevels[i];if(v.target!==target||(permanentOnly&&!v.permanent))continue;
   removed.push(v);this.s.negativeLevels.splice(i,1);
  }
  if(removed.length){creature.maxHp+=5*removed.length;
   if(!creature.slainByEnergyDrain)creature.hp=Math.min(creature.maxHp,creature.hp+5*removed.length);
   this.note(`${creature.name}: removed ${removed.length} negative level(s); total ${this.negativeCount(target)}.`);
  }
  return {removed:removed.length,remaining:this.negativeCount(target),hp:creature.hp,maxHp:creature.maxHp};
 }
 processNegativeLevelSaves(){
  const outcomes=[];
  for(const record of [...this.s.negativeLevels]){
   if(record.permanent||record.dueAt===null||record.dueAt>this.s.worldRounds)continue;
   const save=this.savingThrow(record.target,'fort',record.dc);
   if(save.success){
    const creature=this.find(record.target),at=this.s.negativeLevels.findIndex(r=>r.id===record.id);
    if(at!==-1){this.s.negativeLevels.splice(at,1);creature.maxHp+=5;
     if(!creature.slainByEnergyDrain)creature.hp=Math.min(creature.maxHp,creature.hp+5);}
   }else record.permanent=true,record.dueAt=null;
   this.note(`Negative level ${record.id}: ${save.success?'removed':'becomes permanent'} after Fortitude save.`);
   outcomes.push({id:record.id,target:record.target,save,removed:save.success,permanent:!save.success});
  }
  return outcomes;
 }
 grantEnergyTempHp(target,amount){
  this.find(target);this.assert(isInt(amount,1,10000),'Invalid Energy Drain temporary HP');
  this.s.energyTempHp[target] ||= [];
  // Paizo FAQ: repeated applications from the same energy-drain ability do not stack.
  const existing=this.s.energyTempHp[target].find(p=>p.source==='energy_drain');
  const expiresAt=this.s.worldRounds+ROUNDS_HOUR;
  if(existing){if(amount>existing.amount){existing.amount=amount;existing.expiresAt=expiresAt;}}
  else this.s.energyTempHp[target].push({source:'energy_drain',amount,expiresAt});
  this.note(`${this.find(target).name}'s Energy Drain temporary HP is ${existing?existing.amount:amount}; same-source grants do not stack.`);
 }
 expireEnergyTempHp(){
  for(const [target,pools] of Object.entries(this.s.energyTempHp)){
   const keep=pools.filter(p=>p.amount>0&&p.expiresAt>this.s.worldRounds);
   this.s.energyTempHp[target]=keep;
  }
 }
 absorbTemporaryHp(targetId,amount){
  const pools=this.s.energyTempHp?.[targetId]||[];let remaining=amount,absorbed=0;
  if(remaining&&pools.length){
   for(const pool of pools){const take=Math.min(pool.amount,remaining);pool.amount-=take;remaining-=take;absorbed+=take;if(!remaining)break;}
   this.s.energyTempHp[targetId]=pools.filter(p=>p.amount>0);
   if(absorbed)this.note(`${this.find(targetId).name}'s Energy Drain temporary HP absorbs ${absorbed} damage.`);
  }
  return absorbed;
 }
 // A negative-level application is attached to the hit, not to the amount of HP damage.
 resolveAttack(actor,target,label='Attack',profile=null,defense='ac'){
  const result=super.resolveAttack(actor,target,label,profile,defense);
  if(!result.hit||!profile?.riders?.length||this.find(target).hp<=0)return result;
  const outcomes=[...(result.riders||[])];
  if(profile.riders.includes('energy_drain')){
   const levels=profile.energyDrainLevels*(result.criticalHit?2:1);
   const applied=this.applyNegativeLevels({target,source:actor,levels,dc:profile.energyDrainDC});
   let tempHp=0;
   if(applied.applied&&profile.energyDrainTempHp!==false){tempHp=5*applied.applied;this.grantEnergyTempHp(actor,tempHp);}
   outcomes.push({rider:'energy_drain',...applied,tempHpGranted:tempHp});
  }
  for(const kind of ['pull','push'])if(profile.riders.includes(kind)&&this.find(target).hp>0){
   const name=kind==='pull'?'pullFeet':'pushFeet';
   const sizes=Object.keys({fine:1,diminutive:1,tiny:1,small:1,medium:1,large:1,huge:1,gargantuan:1,colossal:1});
   if(sizes.indexOf(this.sizeCategory(target))>sizes.indexOf(this.sizeCategory(actor))){outcomes.push({rider:kind,skipped:'Target exceeds attacker size'});continue;}
   this.s.pendingRiderQueue.push({kind,actor,target,feet:profile[name],label,attack:clone(profile)});
  }
  if(!this.s.interrupt&&this.s.pendingRiderQueue.length){
   const interrupt=this.nextHitRider();return {...result,riders:outcomes,status:'interrupt',interrupt};
  }
  return {...result,riders:outcomes};
 }
 nextHitRider(){
  const pending=this.s.pendingRiderQueue?.[0];
  if(!pending||!['push','pull'].includes(pending.kind))return super.nextHitRider();
  this.s.pendingRider=this.s.pendingRiderQueue.shift();
  this.s.interrupt={type:'rider_choice',reactor:pending.actor,target:pending.target,rider:pending.kind,modes:['decline',pending.kind]};
  this.note(`${this.find(pending.actor).name} may choose a free ${pending.kind.toUpperCase()} maneuver after the hit.`);
  return clone(this.s.interrupt);
 }
 resolveRider(mode='normal'){
  const pending=this.s.pendingRider;
  if(!pending||!['push','pull'].includes(pending.kind))return super.resolveRider(mode);
  this.assert(mode==='decline'||mode===pending.kind||mode==='normal','Invalid Pull/Push decision');
  this.s.pendingRider=null;this.s.interrupt=null;
  let outcome;
  if(mode==='decline')outcome={status:'done',rider:pending.kind,declined:true};
  else if(this.find(pending.actor).hp<=0||this.find(pending.target).hp<=0)outcome={status:'stopped',reason:'combatant down'};
  else{
   const {actor,target,kind,feet}=pending;
   const check=this.checkManeuver(actor,target,kind);
   let moved=0,blocked=false;
   if(check.success){
    const a=this.find(actor),b=this.find(target),dir=kind==='push'?1:-1;
    const dx=Math.sign(b.x-a.x)*dir,dy=Math.sign(b.y-a.y)*dir;
    if(dx===0&&dy===0)blocked=true;
    else for(let i=0;i<feet/5;i++){
     const nx=b.x+dx,ny=b.y+dy;
     if(!this.legalPosition(target,nx,ny)||!this.canTraverse(target,b,{x:nx,y:ny})){blocked=true;break;}
     const previous={x:b.x,y:b.y};b.x=nx;b.y=ny;this.onSpatialMovement(b,previous);moved+=5;
     this.note(`${b.name} is ${kind==='pull'?'pulled':'pushed'} into (${nx},${ny}).`);
     this.emit('tile_enter',{actor:target,x:nx,y:ny,tile:this.tileKind(nx,ny)});
     this.syncZones();
     if(this.s.interrupt||b.hp<=0){blocked=true;break;}
    }
   }
   outcome={...check,status:'done',rider:kind,movedFeet:moved,blocked};
  }
  const next=this.s.interrupt||this.nextHitRider();
  return next?{...outcome,status:'interrupt',interrupt:clone(next),previous:outcome}:outcome;
 }
 advanceTime(command){const base=super.advanceTime(command);this.expireEnergyTempHp();return {...base,negativeLevelSaves:this.processNegativeLevelSaves()};}
 beginTurnEffects(context){const result=super.beginTurnEffects(context);this.expireEnergyTempHp();return {...result,negativeLevelSaves:this.processNegativeLevelSaves()};}
 inspect(){return {...super.inspect(),negativeLevels:clone(this.s.negativeLevels),energyTempHp:clone(this.s.energyTempHp),negativeLevelTotals:Object.fromEntries(this.s.creatures.map(c=>[c.id,this.negativeCount(c.id)]))};}
 dispatch(command,role='actor'){
  if(!['gm_apply_negative_levels','gm_restore_negative_levels'].includes(command?.op))return super.dispatch(command,role);
  this.assert(role==='gm','Negative-level manual adjustments are GM-only');
  return this.transaction(()=>{return command.op==='gm_apply_negative_levels'?this.applyNegativeLevels(command):this.removeNegativeLevels(command);});
 }
}
