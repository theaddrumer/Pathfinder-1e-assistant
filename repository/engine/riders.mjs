/** V3.12 attack-sequence reactions. Keep tactical choices outside the rules engine.
 * A qualifying hit creates an optional decision; Grab runs a free grapple check
 * and Constrict is attached to successful checks, not an independent attack.
 */
import {ManeuverGame,COMBAT_SIZES} from './maneuvers.mjs';
import {clone} from './core.mjs';
import {attackDescription} from './attack_library.mjs';
import {validateAilment} from './ailments.mjs';

const SIZES=Object.keys(COMBAT_SIZES);
export class RiderGame extends ManeuverGame {
 constructor(state){
  super(state);
  this.s.pendingRider ||= null;
  this.s.pendingReplacement ||= null;
  this.s.pendingRiderQueue ||= [];
  this.s.riderBleed ||= {};
  this.turnStart=clone(this.s);this.roundStart=clone(this.s);
 }
 validateCreature(def){
  super.validateCreature(def);
  for(const attack of def.stats.attacks||[]){
   if(attack.constrictDie!==undefined){
    this.assert(attack.riders?.includes('constrict')&&Number.isInteger(attack.constrictDie)&&attack.constrictDie>=2&&attack.constrictDie<=100,
      'Constrict dice require constrict rider and valid die');
    this.assert(Number.isInteger(attack.constrictBonus)&&Math.abs(attack.constrictBonus)<=200,
      'Constrict requires a printed flat damage bonus');
   }
   if(attack.riders?.includes('constrict'))this.assert(attack.constrictDie!==undefined,'Constrict rider requires explicit damage dice and bonus');
   if(attack.grabSizeAllowance!==undefined)this.assert(attack.riders?.includes('grab')&&Number.isInteger(attack.grabSizeAllowance)&&attack.grabSizeAllowance>=0&&attack.grabSizeAllowance<=5,
    'Grab size exception must be a valid allowance on a grab attack');
  }
 }
 inspect(){return {...super.inspect(),pendingRider:clone(this.s.pendingRider),pendingRiderQueue:clone(this.s.pendingRiderQueue),riderBleed:clone(this.s.riderBleed),pendingReplacement:clone(this.s.pendingReplacement)};}
 // The base grapple relationship supports a normal hold or an appendage-only hold.
 syncGrappleConditions(g,add){
  if(!g.appendageOnly)return super.syncGrappleConditions(g,add);
  if(add){
   g.conditionEffects=[];
   if(!this.hasCondition(g.target,'grappled')){
    const applied=this.applyCondition({condition:'grappled',target:g.target});
    g.conditionEffects.push({target:g.target,effectId:applied.effectId});
   }
  } else {
   if(g.pinnedEffect)this.removeEffect(g.pinnedEffect);
   for(const effect of g.conditionEffects||[])this.removeEffect(effect.effectId);
  }
 }
 checkManeuver(actor,target,kind,{bonus=0,penalty=0}={}){
  const g=this.s.grapples?.find(g=>g.holder===actor&&g.target===target);
  if(kind==='grapple'&&g?.fromGrab)bonus+=4-(g.appendageOnly?20:0);
  return super.checkManeuver(actor,target,kind,{bonus,penalty});
 }
 // Ordinary damage resolves once; these on-hit effects never spend a second action.
 // GM-imported afflictions must exist before attacking, so a missing definition
 // never turns an attack roll into an accidental half-applied poison exposure.
 validateAttackAilment(profile){
  if(!profile?.riders?.includes('poison'))return;
  const def=this.s.ailmentCatalog[profile.poisonId];
  this.assert(def?.kind==='poison'&&def.delivery==='injury','Attack poisonId must reference a registered injury poison');
 }
 applyDirectRiders(actor,target,profile,result){
  const outcomes=[];this._resolvingAttackRider=true;
  try{
   if(profile.riders.includes('poison')){
    if((result.damage?.applied||0)>0){
     const applied=this.exposeAilment({definition:profile.poisonId,target,source:actor});
     outcomes.push({rider:'poison',...applied});
    }else outcomes.push({rider:'poison',skipped:'Injury poison requires weapon damage penetrating defenses'});
   }
   if(profile.riders.includes('bleed')){
    const immunity=this.evaluateEffect({target,tags:['bleed']});
    if(immunity.blocked)outcomes.push({rider:'bleed',immune:true,blockedBy:immunity.blockedBy});
    else{
     const old=this.s.riderBleed[target];
     if(old&&old.amount>=profile.bleedAmount)outcomes.push({rider:'bleed',retained:old.amount});
     else{
      if(old){this.cureAilment({id:old.ailmentId});}
      const amount=profile.bleedAmount,definition=`rider_bleed_hp_${amount}`;
      if(!this.s.ailmentCatalog[definition]){
       const def={id:definition,name:`Bleed (${amount} HP)`,kind:'dot',initialEffect:false,
        frequency:{every:{count:1,unit:'round'}},effects:[{kind:'hp',dice:{count:0,sides:2,bonus:amount},damageType:'untyped'}]};
       validateAilment(def);this.s.ailmentCatalog[definition]=def;
      }
      const applied=this.exposeAilment({definition,target,source:actor});
      const active=this.s.activeAilments.find(a=>a.id===applied.ailmentId);
      this.assert(!!active,'Bleed ailment did not register');
      // The next start of this victim's turn, even later in the same round.
      active.nextAt=this.s.worldRounds;
      this.s.riderBleed[target]={amount,ailmentId:active.id};
      const condition=this.applyCondition({condition:'bleed',target,source:actor});
      outcomes.push({rider:'bleed',amount,ailmentId:active.id,conditionEffectId:condition.effectId});
     }
    }
   }
   if(profile.riders.includes('paralysis')){
    const immune=this.evaluateEffect({target,tags:['paralysis'],save:'fort'});
    if(immune.blocked)outcomes.push({rider:'paralysis',immune:true,blockedBy:immune.blockedBy});
    else{
     const save=this.savingThrow(target,'fort',profile.paralysisDC);
     if(save.success)outcomes.push({rider:'paralysis',resisted:true,save});
     else{
      const condition=this.applyCondition({condition:'paralyzed',target,source:actor,rounds:profile.paralysisRounds});
      outcomes.push({rider:'paralysis',resisted:false,save,condition});
     }
    }
   }
  }finally{this._resolvingAttackRider=false;}
  return outcomes;
 }
 cureAilment(command){
  const result=super.cureAilment(command);
  for(const [target,info] of Object.entries(this.s.riderBleed||{}))if(info.ailmentId===command.id){
   delete this.s.riderBleed[target];
   if(this.hasCondition(target,'bleed'))this.removeCondition({target,condition:'bleed'});
  }
  return result;
 }
 removeCondition(command){
  if(command?.condition==='bleed'){
   const tracked=this.s.riderBleed?.[command.target];
   if(tracked)this.cureAilment({id:tracked.ailmentId});
  }
  return super.removeCondition(command);
 }
 nextHitRider(){
  if(!this.s.pendingRiderQueue?.length)return null;
  const pending=this.s.pendingRiderQueue.shift();
  this.s.pendingRider=pending;
  const trip=pending.kind==='trip';
  this.s.interrupt={type:'rider_choice',reactor:pending.actor,target:pending.target,
   rider:pending.kind,modes:trip?['decline','trip']:['decline','normal','appendage']};
  this.note(`${this.find(pending.actor).name} may attempt a free ${trip?'Trip':'Grab'} after hitting ${this.find(pending.target).name}.`);
  return clone(this.s.interrupt);
 }
 resolveAttack(actorId,targetId,label='Attack',profile=null,defense='ac'){
  this.validateAttackAilment(profile);
  const result=super.resolveAttack(actorId,targetId,label,profile,defense);
  if(!result.hit||this.find(targetId).hp<=0||!profile?.riders?.length)return result;
  const riders=this.applyDirectRiders(actorId,targetId,profile,result);
  const optional=profile.riders.filter(id=>id==='grab'||id==='trip');
  for(const kind of optional){
   if(this.collectiveManeuverBlocked?.(actorId,targetId,kind==='grab'?'grapple':kind)){riders.push({rider:kind,skipped:'Swarm/troop maneuver immunity'});continue;}
   if(kind==='grab'){
    const allowance=profile.grabSizeAllowance??0;
    if(SIZES.indexOf(this.sizeCategory(targetId))>SIZES.indexOf(this.sizeCategory(actorId))+allowance){
     riders.push({rider:'grab',skipped:'Target too large'});continue;
    }
    if(this.grappleFor(actorId)||this.grappleFor(targetId)){
     riders.push({rider:'grab',skipped:'Existing grapple requires GM adjudication'});continue;
    }
   }
   if(kind==='trip'){
    const b=this.find(targetId);
    if(b.tripImmune||b.flying||b.legs===0||
       SIZES.indexOf(this.sizeCategory(targetId))>SIZES.indexOf(this.sizeCategory(actorId))+1){
      riders.push({rider:'trip',skipped:'Target not eligible for Trip'});continue;
    }
   }
   this.s.pendingRiderQueue.push({kind,actor:actorId,target:targetId,attack:clone(profile),label});
  }
  if(this.s.interrupt){
   if(this.s.pendingRiderQueue.length)this.note('On-hit optional riders deferred until existing reaction resolves; GM may adjudicate.');
   return {...result,riders,advisory:this.s.pendingRiderQueue.length?'Optional on-hit reaction requires GM adjudication after prior interrupt':undefined};
  }
  const interrupt=this.nextHitRider();
  const advisory=riders.find(x=>x.skipped)?.skipped;
  return interrupt?{...result,riders,status:'interrupt',interrupt,advisory}:{...result,riders,advisory};
 }
 constrict(g){
  if(!g.constrict)return null;
  const amount=Math.max(0,this.rollDie(g.constrict.die)+g.constrict.bonus);
  const hit=this.damage(g.target,amount,'bludgeoning',g.holder,'weapon');
  this.note(`${this.find(g.holder).name} constricts ${this.find(g.target).name} for ${hit.applied??0} damage.`);
  return {roll:amount,damage:hit};
 }
 resolveRider(mode='normal'){
  const pending=this.s.pendingRider;
  this.assert(pending&&this.s.interrupt?.type==='rider_choice','No pending optional rider');
  const kind=pending.kind||'grab';
  this.assert(kind==='grab'?['normal','appendage','decline'].includes(mode):['normal','trip','decline'].includes(mode),'Unknown rider choice');
  this.s.pendingRider=null;this.s.interrupt=null;
  let result;
  if(mode==='decline'){
   this.note(`${this.find(pending.actor).name} declines ${kind}.`);
   result={status:'done',rider:kind,declined:true};
  }else if(this.find(pending.actor).hp<=0||this.find(pending.target).hp<=0){
   result={status:'stopped',reason:'combatant down',rider:kind};
  }else if(kind==='trip'){
   const {actor,target}=pending;
   const b=this.find(target);
   if(b.tripImmune||b.flying||b.legs===0||
      SIZES.indexOf(this.sizeCategory(target))>SIZES.indexOf(this.sizeCategory(actor))+1){
    result={status:'advisory',rider:'trip',reason:'Target cannot be tripped'};
   }else{
    // The universal monster special attack does not provoke and cannot counter-trip.
    const check=this.checkManeuver(actor,target,'trip');
    let condition=null;
    if(check.success){this._resolvingAttackRider=true;try{condition=this.applyCondition({condition:'prone',target,source:actor});}finally{this._resolvingAttackRider=false;}}
    result={...check,status:'done',rider:'trip',prone:!!condition?.effectId,condition};
   }
  }else{
   const {actor,target,attack}=pending;
   this.assert(!this.grappleFor(actor)&&!this.grappleFor(target),'Cannot begin another grapple');
   const check=this.checkManeuver(actor,target,'grapple',{bonus:4-(mode==='appendage'?20:0)});
   if(!check.success)result={...check,status:'done',rider:'grab',mode,grappled:false};
   else{
    const placement=this.adjacentPlacement(actor,target);
    if(!placement){
     this.note('Grab succeeds by check but no legal adjacent placement exists; GM must resolve location.');
     result={...check,status:'advisory',rider:'grab',grappled:false,advisory:'No legal grapple placement'};
    }else{
     const g={holder:actor,target,createdRound:this.s.round,maintainedRound:null,
      conditionEffects:[],fromGrab:true,appendageOnly:mode==='appendage',sourceAttack:clone(attack),
      constrict:attack.riders.includes('constrict')?{die:attack.constrictDie,bonus:attack.constrictBonus}:null};
     this.s.grapples.push(g);
     this._resolvingGrab=true;
     try{this.syncGrappleConditions(g,true);}finally{this._resolvingGrab=false;}
     const constrict=this.constrict(g);
     this.note(`${this.find(actor).name} establishes a ${mode==='appendage'?'limb-only':'normal'} Grab on ${this.find(target).name}.`);
     result={...check,status:'done',rider:'grab',mode,grappled:true,constrict,grapple:clone(g)};
    }
   }
  }
  const next=this.nextHitRider();
  return next?{...result,status:'interrupt',interrupt:next,previous:result}:{...result};
 }
 // Grab's maintenance check also deals its establishing attack's damage.
 grabHoldDamage(g){
  const profile=g.sourceAttack,actor=g.holder;
  const dice=profile.damageDie??this.find(actor).damageDie;
  const raw=Math.max(0,this.rollDie(dice)+this.stat(actor,'damage')+(profile.damageOffset||0));
  const types=attackDescription({...this.find(actor),...profile}).damageTypes;
  const applied=this.damage(g.target,raw,types[0],actor,'weapon',{damageTypes:types});
  this.note(`${this.find(actor).name} deals ${applied.applied??0} damage from maintaining Grab's establishing attack.`);
  return {roll:raw,damage:applied};
 }
 fullAttack(actor,target,defense='ac'){
  this.assert(!this.hasCondition(actor,'grappled'),'Cannot begin a full attack while grappled');
  return super.fullAttack(actor,target,defense);
 }
 nextFullAttack(actor,target,defense='ac'){
  if(this.s.pendingFullAttack?.actor===actor&&this.s.pendingFullAttack.index>0)
   this.assert(!this.hasCondition(actor,'grappled'),'A normal Grab has grappled this attacker; finish or end the full attack before any further strikes');
  return super.nextFullAttack(actor,target,defense);
 }
 grappleAction(command){
  const g=this.grappleFor(command.actor);
  if(command.kind==='reverse'&&g?.appendageOnly)throw Error('Appendage-only reverse is not automated; use GM adjudication');
  const prior=g&&{holder:g.holder,target:g.target};
  const result=super.grappleAction(command);
  if(command.kind==='maintain'&&result.success&&prior?.holder===command.actor){
   const current=this.grappleFor(command.actor);
   const grabDamage=current?.fromGrab?this.grabHoldDamage(current):null;
   const constrict=current?.constrict?this.constrict(current):null;
   return {...result,grabDamage,constrict};
  }
  return result;
 }
 // Maneuver substitutes for one melee full-attack slot; standard maneuver
 // command continues to spend its normal standard action.
 replaceAttack(command){
  const {actor,target,kind}=command;
  this.assert(['trip','disarm','sunder'].includes(kind),'Only Trip, Disarm, or Sunder can replace a melee strike');
  const f=this.s.pendingFullAttack;
  this.assert(f&&f.actor===actor,'No pending full attack to replace');
  this.assert(!this.s.interrupt&&!this.s.pendingMove&&!this.s.pendingReplacement,'Resolve previous action first');
  const slot=f.slots[f.index];
  this.assert(!['ranged','ranged_touch'].includes(slot.attackMode),'Cannot replace a ranged attack');
  this.assert(this.active().id===actor,'Not this creature’s turn');
  this.validateManeuver({...command}, {allowFullAttack:true});
  this.s.pendingReplacement={actor,index:f.index,slotLabel:slot.label};
  // The maneuver check can pause for its own provoked AoO.
  return this.maneuver({...command},{replaceFullAttack:true});
 }
 completeManeuver(command,penalty=0){
  const isReplacement=!!this.s.pendingReplacement;
  this._resolvingAttackReplacement=isReplacement;
  let result;
  try{result=super.completeManeuver(command,penalty);}finally{this._resolvingAttackReplacement=false;}
  const replacement=this.s.pendingReplacement;
  if(!replacement)return result;
  if(result.status==='interrupt')return result;
  this.s.pendingReplacement=null;
  const f=this.s.pendingFullAttack;
  this.assert(f&&f.actor===replacement.actor&&f.index===replacement.index,'Full-attack replacement state invalid');
  f.index++;
  if(f.index===f.slots.length){this.s.pendingFullAttack=null;this.note('Full attack completed after maneuver replacement.');
   return {status:'done',maneuver:result,remaining:0};}
  return {status:'awaiting_attack',maneuver:result,remaining:f.slots.length-f.index,next:f.slots[f.index].label};
 }
 resolveInterrupt(take){
  if(this.s.interrupt?.type==='rider_choice')return this.resolveRider(take?'normal':'decline');
  return super.resolveInterrupt(take);
 }
 dispatch(command,role='actor'){
  if(!['resolve_rider','replace_attack'].includes(command?.op))return super.dispatch(command,role);
  this.assert(['actor','player','gm'].includes(role),'Invalid role');
  if(role==='player')this.assert((command.actor||this.s.pendingRider?.actor)==='hero'&&
   (command.op!=='resolve_rider'||this.s.pendingRider?.actor==='hero'),'Player may only control Explorer');
  if(command.op==='resolve_rider'){
   this.assert(role==='gm'||this.s.pendingRider?.actor===command.actor,'Only reacting creature controller may decide Grab');
  } else {
   if(role!=='gm')this.assert(!['bonus','damage','destroy','noProvoke'].some(k=>Object.hasOwn(command,k)), 'Manual maneuver modifiers require GM authorization');
  }
  return this.transaction(()=>{return command.op==='resolve_rider'?this.resolveRider(command.mode):this.replaceAttack(command);});
 }
}
