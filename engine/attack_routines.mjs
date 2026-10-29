/** V3.19: declarative attack plans, ammunition, reloads and ranged AoO checkpoints. */
import {AttackCompletionGame} from './attack_completion.mjs';
import {clone,abilityMod} from './core.mjs';
import {NATURAL_ATTACKS} from './attack_library.mjs';

import {validateAttackPlan,validateAmmo} from './attack_routine_rules.mjs';
import {strengthDamageModifier} from './attack_completion_rules.mjs';
const rangedAmmoKey=v=>typeof v==='string'&&/^[a-z][a-z0-9_-]{0,63}$/i.test(v);
const rangedAmmoInteger=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
export class AttackRoutinesGame extends AttackCompletionGame{
 constructor(state){super(state);this.turnStart=clone(this.s);this.roundStart=clone(this.s);}
 attackRoutine(id){
  const c=this.find(id);if(!c.attackPlan)return super.attackRoutine(id);
  validateAttackPlan(c);
  const p=c.attackPlan,attacks=c.attacks,slots=[];
  const add=(index,label,offset,damageAbility,role,extra={})=>{
   const a=attacks[index];slots.push({...clone(a),label:label||a.label,attackOffset:(a.attackOffset||0)+offset,
    damageAbility:damageAbility||a.damageAbility,role,...extra});
  };
  if(p.mainIndex!==undefined&&p.mainIndex!==null){
   const twf=p.offhandIndex!==undefined;
   const primaryPenalty=twf?(-6+(p.offhandLight?2:0)+(p.twoWeaponFighting?2:0)):0;
   const secondaryPenalty=twf?(-10+(p.offhandLight?2:0)+(p.twoWeaponFighting?6:0)):0;
   const iterations=Math.min(4,p.mainAttackCount||Math.max(1,Math.floor((c.bab-1)/5)+1));
   for(let i=0;i<iterations;i++)add(p.mainIndex,`${attacks[p.mainIndex].label} ${i+1}`,primaryPenalty-5*i,null,'main');
   if(twf){
    const offCount=1+(p.improvedTwoWeaponFighting?1:0)+(p.greaterTwoWeaponFighting?1:0);
    for(let i=0;i<offCount;i++)add(p.offhandIndex,`${attacks[p.offhandIndex].label} ${i+1}`,secondaryPenalty-5*i,'half_str','offhand');
   }
  }
  for(const index of p.naturalIndices||[]){
   const a=attacks[index],natural=NATURAL_ATTACKS[a.naturalAttack],secondary=!!(p.mainIndex!==undefined&&p.mainIndex!==null)||a.naturalRole==='secondary'||(a.naturalRole===undefined&&natural?.primary===false);
   const single=!secondary&&(p.mainIndex===undefined||p.mainIndex===null)&&p.naturalIndices.length===1;
   add(index,a.label,secondary?(p.multiattack?-2:-5):0,secondary?'half_str':single?'one_half_str':null,secondary?'natural_secondary':single?'natural_solo':'natural_primary');
  }
  this.assert(slots.length>=1&&slots.length<=20,'Invalid generated attack routine size');
  return slots;
 }
 completedDamageBonus(actorId,profile,description){
  const base=super.completedDamageBonus(actorId,profile,description);
  // For opt-in derived plans, an imported generic main-hand damage baseline
  // still needs the offhand/secondary natural Strength adjustment. Explicit
  // published attack sequences (without attackPlan) are never modified.
  if(this.find(actorId).attackPlan&&Object.hasOwn(this.find(actorId).statTotals||{},'damage')){
   const str=abilityMod(this.stat(actorId,'str'));
   if(['offhand','natural_secondary'].includes(profile?.role))return base-str+strengthDamageModifier(str,'half_str');
   if(profile?.damageAbility==='one_half_str')return base-str+strengthDamageModifier(str,'one_half_str');
  }
  return base;
 }
 ammoFor(actor,profile){
  if(!profile?.ammoId)return null;
  const store=this.find(actor).ammunition?.[profile.ammoId];
  this.assert(!!store,`No ammo store '${profile.ammoId}' for ${actor}`);return store;
 }
 requireAmmunition(actor,profile){
  const a=this.ammoFor(actor,profile);if(!a)return;
  if(a.type==='loaded')this.assert(a.loaded>0,'Weapon is unloaded; reload before attacking');
  else this.assert((a.drawAction==='move'?a.ready:a.reserve)>0,'No prepared ammunition; draw or replenish it first');
 }
 consumeAmmunition(actor,profile){
  const a=this.ammoFor(actor,profile);if(!a)return null;
  if(a.type==='loaded')a.loaded--;
  else if(a.drawAction==='move')a.ready--;
  else a.reserve--;
  this.note(`${this.find(actor).name} expends ammunition '${profile.ammoId}'.`);
  return {ammoId:profile.ammoId,store:clone(a)};
 }
 rangedAoOReactors(actor){
  return this.s.creatures.filter(c=>c.id!==actor&&c.team!==this.find(actor).team&&this.canAct(c.id)&&
    this.canTakeAoO(c.id,actor)&&this.canAct(c.id)).map(c=>c.id);
 }
 createRangedCheckpoint(pending){
  pending.reactors=pending.reactors.filter(id=>this.canTakeAoO(id,pending.actor));
  const next=pending.reactors.shift();
  if(next){this.s.pendingRangedAction=pending;this.s.interrupt={type:'ranged_action_aoo',reactor:next,target:pending.actor,reason:pending.kind};
   this.note(`${this.find(next).name} may take an AoO before ${pending.kind==='shot'?'a ranged attack':pending.kind==='stand'?'standing up':'a reload'} by ${this.find(pending.actor).name}.`);
   return {status:'interrupt',interrupt:clone(this.s.interrupt)};}
  return this.completeRangedAction(pending);
 }
 canFinishRangedAction(pending){
  return this.canAct(pending.actor)&&!this.policy(pending.actor,'no_actions')&&
   (['reload','stand'].includes(pending.kind)||(!this.policy(pending.actor,'one_move_only')&&this.attackPostureAllowed(pending.actor,pending.profile)));
 }
 completeRangedAction(pending){
  this.s.pendingRangedAction=null;
  if(pending.kind==='spell')return this.finishRangedSpell(pending);
  if(!this.canFinishRangedAction(pending)){
   if(this.s.pendingFullAttack?.actor===pending.actor)this.s.pendingFullAttack=null;
   this.note(`Action interrupted; ${this.find(pending.actor).name} cannot continue.`);
   return {status:'stopped',reason:'attacker incapacitated or attack no longer permitted'};
  }
  if(pending.kind==='reload')return this.performReload(pending.actor,pending.ammoId,pending.amount);
  const ammo=this.consumeAmmunition(pending.actor,pending.profile);
  const shot=super.resolveAttack(pending.actor,pending.target,pending.label,pending.profile,pending.defense);
  if(ammo)shot.ammunition=ammo;
  if(pending.fullAttack){
   const f=this.s.pendingFullAttack;if(!f)return {status:'stopped',attack:shot,reason:'full attack disrupted'};
   f.index++;
   if(f.index===f.slots.length){this.s.pendingFullAttack=null;this.note(`${this.find(pending.actor).name} finishes the full attack.`);return {status:'done',attack:shot,remaining:0};}
   return {status:'awaiting_attack',attack:shot,remaining:f.slots.length-f.index,next:f.slots[f.index].label};
  }
  return shot;
 }
 resolveAttack(actor,target,label='Attack',profile=null,defense='ac'){
  const mode=profile?.attackMode||this.find(actor).attackMode||'melee';
  if(!['ranged','ranged_touch'].includes(mode))return super.resolveAttack(actor,target,label,profile,defense);
  this.assert(!this.s.pendingRangedAction,'Resolve the ranged-action interrupt before firing again');
  this.requireAmmunition(actor,profile);
  // Validate sight/range and cover before imposing action/interrupt bookkeeping.
  this.validateAttackReach(actor,target,profile);
  const defenseInfo=this.attackDefenseContext(actor,target,profile,defense);
  this.assert(!defenseInfo.totalCover,'Target has total cover');
  // Rays provoke for delivery separately from any casting opportunity.
  const reactors=this.rangedAoOReactors(actor);
  if(reactors.length)return this.createRangedCheckpoint({kind:'shot',actor,target,label,profile:clone(profile||{}),defense,
   reactors,fullAttack:!!this.s.pendingFullAttack});
  const ammunition=this.consumeAmmunition(actor,profile);
  const result=super.resolveAttack(actor,target,label,profile,defense);
  if(ammunition)result.ammunition=ammunition;
  return result;
 }
 nextFullAttack(actor,target,defense='ac'){
  this.assert(!this.s.interrupt&&!this.s.pendingMove,'Resolve pending action first');
  const f=this.s.pendingFullAttack;
  this.assert(f&&f.actor===actor,'No pending full attack for this creature');
  this.assert(this.active().id===actor,`Not this creature's turn`);
  const creature=this.find(actor),victim=this.find(target);
  this.assert(this.canAct(creature.id)&&this.canBeAttacked(victim.id),'Target or attacker is down');
  const slot=f.slots[f.index];
  this.validateAttackReach(actor,target,slot);
  const attack=this.resolveAttack(actor,target,`Full attack ${f.index+1}/${f.slots.length} (${slot.label})`,slot,defense);
  // An AoO checkpoint is not an attack. Its full-attack slot remains pending.
  if(attack?.status==='interrupt'&&this.s.pendingRangedAction)return attack;
  f.index++;
  if(f.index===f.slots.length){this.s.pendingFullAttack=null;this.note(`${creature.name} finishes the full attack.`);
   return {status:'done',attack,remaining:0};}
  this.note(`${creature.name} may select another target or five-foot step before strike ${f.index+1}/${f.slots.length}.`);
  return {status:'awaiting_attack',attack,remaining:f.slots.length-f.index,next:f.slots[f.index].label};
 }
 performReload(actor,ammoId,amount){
  const a=this.find(actor).ammunition[ammoId];
  const quantity=Math.min(amount,a.capacity-a.loaded,a.reserve);
  this.assert(quantity>0,'No reloadable ammunition/capacity');
  a.loaded+=quantity;a.reserve-=quantity;
  this.note(`${this.find(actor).name} reloads ${quantity} round(s) into '${ammoId}' (${a.loaded}/${a.capacity} loaded, ${a.reserve} spare).`);
  return {status:'reloaded',actor,ammoId,loaded:a.loaded,reserve:a.reserve};
 }
 reloadWeapon({actor,ammoId,amount=1}={}){
  this.assert(!this.s.interrupt&&!this.s.pendingMove&&!this.s.pendingFullAttack&&!this.s.pendingRangedAction,'Resolve pending action first');
  this.assert(rangedAmmoKey(ammoId)&&rangedAmmoInteger(amount,1,100),'Invalid reload request');
  const c=this.find(actor),a=c.ammunition?.[ammoId];
  this.assert(a?.type==='loaded','A loaded-weapon ammunition store is required');
  this.assert(a.capacity>a.loaded&&a.reserve>=amount&&a.capacity-a.loaded>=amount,'Insufficient ammunition or magazine capacity');
  const action=a.reloadAction||'move';
  if(action!=='free')this.spendAction(actor,action,'reload '+ammoId);
  else this.assert(this.active().id===actor&&this.canAct(actor),'Cannot reload outside actor turn');
  const reactors=a.reloadProvokes===false?[]:this.rangedAoOReactors(actor);
  if(reactors.length)return this.createRangedCheckpoint({kind:'reload',actor,ammoId,amount,reactors});
  return this.performReload(actor,ammoId,amount);
 }
 drawAmmunition({actor,ammoId}={}){
  this.assert(!this.s.interrupt&&!this.s.pendingMove&&!this.s.pendingFullAttack,'Resolve pending action first');
  const c=this.find(actor),a=c.ammunition?.[ammoId];
  this.assert(a?.type==='reserve'&&a.drawAction==='move','Manual draw requires a reserve store with move-action drawing');
  this.assert(a.reserve>0,'No remaining ammunition to draw');
  this.spendAction(actor,'move','draw '+ammoId);a.reserve--;a.ready=(a.ready||0)+1;
  this.note(`${c.name} draws ${ammoId}; ${a.ready} ready.`);
  return {status:'drawn',ammoId,ready:a.ready,reserve:a.reserve};
 }
 resolveRider(mode='normal'){
  const result=super.resolveRider(mode);
  if(this.s.pendingRangedAction&&!this.s.interrupt)return this.createRangedCheckpoint(this.s.pendingRangedAction);
  return result;
 }
 setAmmunition({actor,ammoId,reserve,loaded,ready}={}){
  this.assert(!this.s.interrupt&&!this.s.pendingRangedAction,'Complete pending resolution first');
  const creature=this.find(actor),a=creature.ammunition?.[ammoId];
  this.assert(!!a,'Unknown ammunition store');
  for(const [name,value] of Object.entries({reserve,loaded,ready}))if(value!==undefined){
   this.assert(rangedAmmoInteger(value,0,100000),`Invalid ammunition ${name}`);
   if(name==='loaded')this.assert(a.type==='loaded','Only loaded weapons can set loaded rounds');
   if(name==='ready')this.assert(a.type==='reserve'&&a.drawAction==='move','Ready ammunition requires manual draw');
   a[name]=value;
  }
  validateAmmo(creature);
  this.note(`GM adjusts ${creature.name}'s ammunition '${ammoId}'.`);
  return {status:'adjusted',actor,ammoId,store:clone(a)};
 }
 resolveRangedAoO(take){
  const i=this.s.interrupt,pending=this.s.pendingRangedAction;
  this.assert(i?.type==='ranged_action_aoo'&&pending,'No ranged AoO decision waiting');
  this.s.interrupt=null;
  if(take){
   this.assert(this.canTakeAoO(i.reactor,pending.actor),'AoO is no longer legal');
   this.s.aooUsed[i.reactor]=(this.s.aooUsed[i.reactor]||0)+1;
   this.resolveAttack(i.reactor,pending.actor,'AoO');
  }else this.note(`${this.find(i.reactor).name} declines the AoO.`);
  if(this.s.interrupt){
   // Existing on-hit rider decisions must be resolved before continuing.
   this.note('Resolve the resulting attack rider before resuming the ranged action.');
   return {status:'interrupt',interrupt:clone(this.s.interrupt)};
  }
  return this.createRangedCheckpoint(pending);
 }
 dispatch(cmd,role='actor'){
  const op=cmd?.op;
  if(!['reload_weapon','draw_ammunition','gm_set_ammunition'].includes(op)&&!(op==='resolve_interrupt'&&this.s.interrupt?.type==='ranged_action_aoo'))return super.dispatch(cmd,role);
  this.assert(['gm','actor','player'].includes(role),'Invalid command role');
  if(op==='gm_set_ammunition')this.assert(role==='gm','Only GM may set ammunition stocks');
  if(role==='player')this.assert((cmd.actor||this.s.interrupt?.reactor)==='hero','Player may only control Explorer');
  return this.transaction(()=>{
   if(op==='resolve_interrupt')return this.resolveRangedAoO(!!cmd.take);
   return op==='reload_weapon'?this.reloadWeapon(cmd):op==='draw_ammunition'?this.drawAmmunition(cmd):this.setAmmunition(cmd);
  });
 }
 inspect(){return {...super.inspect(),ammunition:Object.fromEntries(this.s.creatures.filter(c=>c.ammunition).map(c=>[c.id,clone(c.ammunition)])),pendingRangedAction:clone(this.s.pendingRangedAction||null)};}
}
