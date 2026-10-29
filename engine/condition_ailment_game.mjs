/** V3.6: conservative PF1 condition library + reusable timed affliction engine.
 * GM interprets contexts. Automatic parts are explicit, unsupported parts are visible advisories.
 */
import {RegistryGame} from './registry.mjs';
import {clone,abilityMod} from './core.mjs';
import {ABILITIES,DEFENSES,skillAbility} from './stats.mjs';
import {STANDARD_CONDITIONS,STANDARD_CONDITION_IDS} from './conditions.mjs';
import {validateAilment,toRounds,TIME_UNITS} from './ailments.mjs';
const validId=x=>typeof x==='string'&&/^[a-z][a-z0-9_-]{0,63}$/i.test(x);
const int=(x,lo,hi)=>Number.isInteger(x)&&x>=lo&&x<=hi;
export class ConditionAilmentGame extends RegistryGame {
 constructor(state){
  super(state);
  this.s.conditionInstances ||= [];
  this.s.ailmentCatalog ||= {};
  this.s.activeAilments ||= [];
  this.s.abilityDamage ||= {};
  this.s.abilityDrain ||= {};
  this.s.conHpAdjustments ||= {};
  this.s.worldRounds ??= (this.s.round-1);
  this.s.registeredSeq ||= 0;
  this.turnStart=clone(this.s);this.roundStart=clone(this.s);
 }
 hasCondition(target,condition){return (this.s.conditionInstances||[]).some(c=>c.target===target&&c.condition===condition);}
 getConditions(target){return (this.s.conditionInstances||[]).filter(c=>c.target===target).map(c=>({
   ...clone(c),coverage:STANDARD_CONDITIONS[c.condition].coverage,
   advisories:STANDARD_CONDITIONS[c.condition].advisories}));}
 policy(target,tag){return this.getConditions(target).some(c=>STANDARD_CONDITIONS[c.condition].policies.includes(tag));}
 effectsFor(id,stat){
  // Independent source lifetimes; one set of numeric modifiers per condition.
  // Stronger fear/fatigue suppress modifiers without destroying weaker sources.
  const instances=(this.s.conditionInstances||[]).filter(c=>c.target===id),chosen=new Map();
  if(instances.length<2)return super.effectsFor(id,stat);
  for(const c of instances){
   const family=['shaken','frightened','panicked'].includes(c.condition)?['shaken','frightened','panicked']:
    ['fatigued','exhausted'].includes(c.condition)?['fatigued','exhausted']:[c.condition];
   const key=family[0],old=chosen.get(key);
   if(!old||family.indexOf(c.condition)>family.indexOf(old.condition))chosen.set(key,c);
  }
  const native=new Set(instances.map(c=>c.effectId)),effective=new Set([...chosen.values()].map(c=>c.effectId));
  return super.effectsFor(id,stat).filter(m=>!native.has(m.effectId)||effective.has(m.effectId));
 }
 syncConditions(){this.s.conditionInstances=this.s.conditionInstances.filter(c=>this.s.effects.some(e=>e.id===c.effectId));}
 applyCondition({condition,target,source=null,rounds=null}={}){
  const applicationKey=this._spellConditionApplication;
  this.assert(applicationKey||!this.s.interrupt&&!this.s.pendingMove&&(!this.s.pendingFullAttack||this._resolvingAttackReplacement||this._resolvingGrab||this._resolvingAttackRider)&&!this.s.pendingCharge,'Finish pending operation first');
  this.find(target);if(source!==null)this.find(source);
  this.assert(Object.hasOwn(STANDARD_CONDITIONS,condition),'Unknown standard condition');
  this.assert(rounds===null||int(rounds,1,100000),'Invalid condition duration');
  const fear=['shaken','frightened','panicked'];
  const power=fear.indexOf(condition);
  const owned=x=>x.target===target&&(x.applicationKey||null)===(applicationKey||null);
  // Manual applications keep their historical escalation rules. Spells declare
  // the resulting condition, so repeated pulses do not infer escalation.
  if(!applicationKey&&power>=0){
   const other=this.s.conditionInstances.filter(x=>owned(x)&&fear.includes(x.condition));
   const stronger=other.find(x=>fear.indexOf(x.condition)>power);
   if(stronger){this.note(`Ignored ${condition}: stronger ${stronger.condition} already active.`);return {retained:stronger.condition};}
   for(const x of other)if(x.condition!==condition)this.removeEffect(x.effectId);
  }
  if(!applicationKey){
   const fatigue=this.s.conditionInstances.filter(x=>owned(x)&&['fatigued','exhausted'].includes(x.condition));
   if(condition==='fatigued'&&fatigue.some(x=>x.condition==='exhausted'))return {retained:'exhausted'};
   if(condition==='fatigued'&&fatigue.some(x=>x.condition==='fatigued'))condition='exhausted';
   if(condition==='exhausted')for(const x of fatigue)if(x.condition==='fatigued')this.removeEffect(x.effectId);
  }
  let existing=this.s.conditionInstances.find(x=>owned(x)&&x.condition===condition);
  if(existing){
   const e=this.s.effects.find(e=>e.id===existing.effectId);this.assert(!!e,'Condition effect is missing');
   e.remaining=rounds;e.source=source;existing.source=source;
   this.note(`${condition} refreshed on ${this.find(target).name}.`);
   return {condition,refreshed:true,effectId:e.id};
  }
  const def=STANDARD_CONDITIONS[condition],id=`condition_${++this.s.registeredSeq}`;
  this.addEffect({id,name:def.name,source,target,mods:clone(def.mods),rounds});
  this.s.conditionInstances.push({condition,target,source,effectId:id,...(applicationKey?{applicationKey}:{})});
  if(def.coverage!=='automatic')this.note(`${def.name}: ${def.coverage} support; see advisories for remaining consequences.`);
  return {condition,applied:true,effectId:id,coverage:def.coverage,advisories:clone(def.advisories)};
 }
 removeCondition({condition,target}={}){
  this.find(target);
  this.assert(Object.hasOwn(STANDARD_CONDITIONS,condition),'Unknown standard condition');
  const cs=this.s.conditionInstances.filter(x=>x.target===target&&x.condition===condition);
  for(const c of cs)this.removeEffect(c.effectId);
  this.syncConditions();
  return {removed:cs.length,condition};
 }
 addEffect(effect){
  const result=super.addEffect(effect);
  // Constitution-affecting temporary bonuses/penalties also modify HP if HD is known.
  this.syncConHp(effect.target);
  return result;
 }
 removeEffect(id,options){
  const target=this.s.effects.find(e=>e.id===id)?.target;
  const result=super.removeEffect(id,options);
  if(target)this.syncConHp(target);
  if(this.s.conditionInstances)this.syncConditions();
  return result;
 }
 aooLimit(id){return this.policy(id,'no_aoo')?0:super.aooLimit(id);}
 attackPostureAllowed(actorId,profile=null){
  const mode=profile?.attackMode||this.find(actorId).attackMode||'melee';
  return !this.hasCondition(actorId,'prone')||!['ranged','ranged_touch'].includes(mode)||
   profile?.usableWhileProne===true||(mode==='ranged_touch'&&profile?.rangedKind==='ray');
 }
 validateAttackPosture(actorId,profile=null){
  this.assert(this.attackPostureAllowed(actorId,profile),
   'Prone: this ranged weapon cannot be used. Declare usableWhileProne:true on its attack entry only for a rules-supported exception (crossbow, firearm, shuriken, or a specific ability).');
 }
 resolveAttackCheck(actorId,targetId,label='Attack',profile=null,defense='ac',options={}){
  this.validateAttackPosture(actorId,profile);
  const previous=this._attackContext;this._attackContext={actor:actorId,target:targetId,mode:profile?.attackMode||this.find(actorId).attackMode||'melee'};
  try{return super.resolveAttackCheck(actorId,targetId,label,profile,defense,options);}finally{this._attackContext=previous;}
 }
 spendAction(actorId,type,label){
  this.assert(!this.policy(actorId,'no_actions'),'Creature cannot take actions under its condition');
  this.assert(!(this.policy(actorId,'one_move_only')&&type!=='move'),'Nauseated: only one move action permitted');
  if(this.policy(actorId,'one_move_only'))this.assert(!this.s.actions.statusActionSpent,'Nauseated: move already used');
  if(this.policy(actorId,'one_standard_or_move')){
    if(type!=='swift')this.assert(!this.s.actions.fullRound&&!this.s.actions.statusActionSpent,'Staggered: action already taken');
    this.assert(['standard','move','swift'].includes(type),'Staggered: no full-round action');
  }
  const result=super.spendAction(actorId,type,label);
  if(type!=='swift')this.s.actions.statusActionSpent=true;
  return result;
 }
 startMove(actorId,path,options={}){
  this.assert(!this.policy(actorId,'no_movement'),'Condition prohibits movement');
  this.assert(!this.policy(actorId,'no_actions'),'Condition prohibits actions including five-foot steps');
  if(this.policy(actorId,'one_move_only'))this.assert(!this.s.actions.statusActionSpent&&!options.step,'Nauseated: at most one move action');
  const factor=options.action!=='crawl'&&this.policy(actorId,'half_speed')?0.5:1;
  if(factor===1)return super.startMove(actorId,path,options);
  // V3.6 half-speed is checked against actual path cost; do not alter the creature's printed speed.
  const c=this.find(actorId);let x=c.x,y=c.y,cost=0,diag=0;
  for(const p of path){const dx=Math.abs(p.x-x),dy=Math.abs(p.y-y);if(dx&&dy)diag++;cost+=this.moveCost(actorId,p.x,p.y,diag,!!(dx&&dy),{x,y});x=p.x;y=p.y;}
  this.assert(cost*5 <= c.speed*factor*(options.action==='double'||options.action==='charge'?2:1),'Movement exceeds condition-adjusted speed');
  return super.startMove(actorId,path,options);
 }
 charge(actorId,targetId,defense){this.assert(!this.policy(actorId,'no_charge')&&!this.policy(actorId,'half_speed'),'Condition prohibits charging');return super.charge(actorId,targetId,defense);}
 canContinueMovement(id){return super.canContinueMovement(id)&&!this.policy(id,'no_movement')&&!this.policy(id,'no_actions');}
 statusWarnings({op,actor,path,target}={}){
  const warnings=[];
  const conditions=this.getConditions(actor);
  for(const c of conditions){
   if(['move','double_move','charge'].includes(op)&&['frightened','panicked'].includes(c.condition)&&c.source){
    const origin=this.find(actor),fear=this.find(c.source);
    const dest=op==='charge'?this.find(target):Array.isArray(path)&&path.length?path[path.length-1]:null;
    if(dest && this.distance(origin,fear,dest.x,dest.y)<this.distance(origin,fear))
      warnings.push(`${c.condition}: movement decreases distance from the source of fear (${fear.name}). Review the escape route; this is not automatically illegal.`);
   }
  }
  return warnings;
 }
 damagePenalty(target,ability){return -Math.floor((this.s.abilityDamage?.[target]?.[ability]||0)/2);}
 stat(id,stat){
  let total=super.stat(id,stat);
  if(this._attackContext && this._attackContext.actor===id && stat==='attack' &&
    ['melee','melee_touch'].includes(this._attackContext.mode)&&this.hasCondition(id,'prone'))total-=4;
  if(this._attackContext && this._attackContext.target===id && DEFENSES.includes(stat)){
    if(stat==='ac'&&this.hasCondition(id,'flat_footed'))total=super.stat(id,'flatFootedAc');
    if(this.hasCondition(id,'prone'))total+=['ranged','ranged_touch'].includes(this._attackContext.mode)?4:-4;
  }
  if(ABILITIES.includes(stat)){
    const drain=this.s.abilityDrain?.[id]?.[stat]||0;
    const reduced=total-drain;
    // PF1 temporary penalties cannot by themselves push an ability below 1.
    // Actual drain can reach 0; ability damage leaves the score unchanged.
    const undisturbed=(this.find(id)[stat]??10)-drain;
    return undisturbed>0?Math.max(1,reduced):Math.max(0,reduced);
  }
  const c=this.find(id);
  const ordinary={fort:['con'],ref:['dex'],will:['wis'],initiative:['dex'],ac:['dex'],touchAc:['dex'],flatFootedAc:['dex'],attack:['str'],damage:['str'],cmb:['str'],cmd:['str','dex']};
  const deps=(c.statTotals&&Object.hasOwn(c.statTotals,stat))?(c.abilityLinks?.[stat]||[]):(ordinary[stat]||[]);
  for(const ability of deps)total+=this.damagePenalty(id,ability);
  return total;
 }
 skillBonus(id,skill){
  let total=super.skillBonus(id,skill);const c=this.find(id);
  const a=c.skillAbilityLinks?.[skill]??skillAbility(skill);
  if(a)total+=this.damagePenalty(id,a);
  return total;
 }
 abilityCheckBonus(id,ability){return super.abilityCheckBonus(id,ability)+this.damagePenalty(id,ability);}
 // Independent damage, drain and temporary-penalty tracks. Do not merge them.
 abilityBreakdown(target,ability){
  const creature=this.find(target);this.assert(ABILITIES.includes(ability),'Invalid ability');
  const damaged=this.s.abilityDamage?.[target]?.[ability]||0;
  const drained=this.s.abilityDrain?.[target]?.[ability]||0;
  const abilityEffects=this.effectsFor(target,ability);
  return {ability,printed:creature[ability]??10,damage:damaged,drain:drained,
    temporaryAdjustments:clone(abilityEffects),score:this.stat(target,ability),
    damageModifier:-Math.floor(damaged/2)};
 }
 // Reconcile changes in Constitution modifier and Constitution damage. Without
 // a supplied HD count, don't fabricate an HP adjustment. Store what was
 // applied so reversing the condition restores the right number of HP.
 syncConHp(target){
  const creature=this.find(target),hd=creature.hitDiceCount;
  if(!Number.isInteger(hd)||hd<1)return {adjusted:false,reason:'hitDiceCount not registered'};
  const base=abilityMod(creature.con??10),current=abilityMod(this.stat(target,'con'));
  const desired=(current-base+this.damagePenalty(target,'con'))*hd;
  const previous=this.s.conHpAdjustments?.[target]||0;
  const delta=desired-previous;
  if(delta){
    creature.maxHp=Math.max(0,creature.maxHp+delta);
    creature.hp=this.adjustedHp(creature,creature.hp+delta);
    this.s.conHpAdjustments ||= {};
    this.s.conHpAdjustments[target]=desired;
    this.note(`${creature.name}: Constitution change modifies HP by ${delta} (HD ${hd}).`);
  }
  return {adjusted:true,delta,maxHp:creature.maxHp,hp:creature.hp};
 }
 abilityWarnings(target,ability){
  const score=this.stat(target,ability),damage=this.s.abilityDamage?.[target]?.[ability]||0;
  const notices=[];
  if(score===0)notices.push(ability==='con'?'Constitution score 0: creature dies.':'Ability score 0: GM must resolve incapacitation.');
  if(damage>=score && score>0)notices.push(ability==='con'?'Constitution damage reaches score: creature dies.':'Ability damage reaches score: creature unconscious.');
  if(ability==='con'&&!Number.isInteger(this.find(target).hitDiceCount))notices.push('Constitution affects HP, but hitDiceCount is not registered; HP adjustment requires GM adjudication.');
  return notices;
 }
 applyAbilityDamage(target,ability,amount){
  this.find(target);this.assert(ABILITIES.includes(ability)&&int(amount,1,10000),'Invalid ability damage');
  this.s.abilityDamage[target] ||= {};
  this.s.abilityDamage[target][ability]=(this.s.abilityDamage[target][ability]||0)+amount;
  this.note(`${this.find(target).name} takes ${amount} ${ability.toUpperCase()} ability damage (total ${this.s.abilityDamage[target][ability]}).`);
  const hp=ability==='con'?this.syncConHp(target):null;
  const advisories=this.abilityWarnings(target,ability);
  for(const warning of advisories)this.note(`WARNING: ${warning}`);
  return {ability,amount,total:this.s.abilityDamage[target][ability],hp,advisories};
 }
 healAbilityDamage({target,ability,amount}){
  this.find(target);this.assert(ABILITIES.includes(ability)&&int(amount,1,10000),'Invalid ability healing');
  const old=this.s.abilityDamage[target]?.[ability]||0;
  this.s.abilityDamage[target] ||= {};
  this.s.abilityDamage[target][ability]=Math.max(0,old-amount);
  const hp=ability==='con'?this.syncConHp(target):null;
  return {healed:old-this.s.abilityDamage[target][ability],remaining:this.s.abilityDamage[target][ability],...(hp?{hp}:{})};
 }
 applyAbilityDrain({target,ability,amount}){
  this.find(target);this.assert(ABILITIES.includes(ability)&&int(amount,1,10000),'Invalid ability drain');
  const available=this.stat(target,ability),applied=Math.min(amount,available);
  this.s.abilityDrain[target] ||= {};
  this.s.abilityDrain[target][ability]=(this.s.abilityDrain[target][ability]||0)+applied;
  this.note(`${this.find(target).name} suffers ${applied} ${ability.toUpperCase()} ability drain (total ${this.s.abilityDrain[target][ability]}).`);
  const hp=ability==='con'?this.syncConHp(target):null;
  const advisories=this.abilityWarnings(target,ability);
  for(const warning of advisories)this.note(`WARNING: ${warning}`);
  return {ability,amount:applied,total:this.s.abilityDrain[target][ability],score:this.stat(target,ability),hp,advisories};
 }
 restoreAbilityDrain({target,ability,amount}){
  this.find(target);this.assert(ABILITIES.includes(ability)&&int(amount,1,10000),'Invalid restoration amount');
  const old=this.s.abilityDrain[target]?.[ability]||0;
  this.s.abilityDrain[target] ||= {};
  this.s.abilityDrain[target][ability]=Math.max(0,old-amount);
  const hp=ability==='con'?this.syncConHp(target):null;
  return {restored:old-this.s.abilityDrain[target][ability],remaining:this.s.abilityDrain[target][ability],score:this.stat(target,ability),hp};
 }
 registerAilment(def){
  validateAilment(def);
  this.assert(Object.keys(this.s.ailmentCatalog).length<500,'Ailment catalog full');
  this.assert(!Object.hasOwn(this.s.ailmentCatalog,def.id),'Ailment definition already exists');
  for(const e of def.effects)if(e.kind==='condition')this.assert(Object.hasOwn(STANDARD_CONDITIONS,e.condition),'Ailment refers to unsupported condition');
  this.s.ailmentCatalog[def.id]=clone(def);
  this.note(`Registered ${def.kind} definition ${def.id}.`);
  return {registered:def.id};
 }
 dice(d){let amount=d.bonus??0;for(let i=0;i<d.count;i++)amount+=this.rollDie(d.sides);return Math.max(0,amount);}
 applyAilmentEffects(a,def){
  const out=[];
  for(const e of def.effects){
   if(e.kind==='hp'){
     const amount=this.dice(e.dice);const damage=this.damage(a.target,amount,e.damageType||'untyped',a.source,'ailment');
     out.push({kind:'hp',amount,applied:damage.applied});
   }else if(e.kind==='ability_damage'){
     const amount=this.dice(e.dice);if(amount>0)out.push({kind:'ability_damage',...this.applyAbilityDamage(a.target,e.ability,amount)});
   }else if(e.kind==='ability_drain'){
     const amount=this.dice(e.dice);if(amount>0)out.push({kind:'ability_drain',...this.applyAbilityDrain({target:a.target,ability:e.ability,amount})});
   }else if(e.kind==='condition'){
     out.push({kind:'condition',...this.applyCondition({condition:e.condition,target:a.target,source:a.source,rounds:e.rounds??null})});
   }
  }
  return out;
 }
 exposeAilment({definition,target,source=null}={}){
  this.assert((!this.s.interrupt&&!this.s.pendingMove&&!this.s.pendingFullAttack&&!this.s.pendingCharge)||this._resolvingAttackRider,'Finish pending operation first');
  const def=this.s.ailmentCatalog[definition];this.assert(!!def,'Unknown ailment definition');
  this.find(target);if(source!==null)this.find(source);
  if(def.save&&def.save.initial!==false){
   const save=this.savingThrow(target,def.save.type,def.save.dc);
   if(save.success){this.note(`${this.find(target).name} resists ${def.name} exposure.`);return {resisted:true,save};}
  }
  const every=def.frequency?toRounds(def.frequency.every):null;
  const onset=def.onset?toRounds(def.onset,true):0;
  const instance={id:`ailment_${++this.s.registeredSeq}`,definition,target,source,
    nextAt:every===null?null:this.s.worldRounds+(onset||every),
    onsetAt:this.s.worldRounds+onset,processed:0,successes:0,consecutive:0,active:true};
  this.s.activeAilments.push(instance);
  let effects=[];
  // No onset: initial failed exposure save ordinarily inflicts the effect immediately.
  if(onset===0 && def.initialEffect!==false){effects=this.applyAilmentEffects(instance,def);}
  if(every===null){
   if(onset===0){this.s.activeAilments=this.s.activeAilments.filter(x=>x.id!==instance.id);instance.active=false;}
   else instance.nextAt=instance.onsetAt;
  }
  this.note(`${def.name} contracted by ${this.find(target).name}${onset?` (onset in ${onset} rounds)`:''}.`);
  return {ailmentId:instance.id,resisted:false,onsetRounds:onset,effects};
 }
 cureAilment({id}={}){
  const a=this.s.activeAilments.find(a=>a.id===id);this.assert(!!a,'Unknown active ailment');
  this.s.activeAilments=this.s.activeAilments.filter(x=>x.id!==id);
  this.note(`${this.s.ailmentCatalog[a.definition].name} ends on ${this.find(a.target).name}; existing damage remains.`);
  return {cured:id};
 }
 resolveAilmentTick(a){
  const def=this.s.ailmentCatalog[a.definition],out={id:a.id,definition:a.definition};
  if(!def.frequency){out.effects=this.applyAilmentEffects(a,def);this.cureAilment({id:a.id});return out;}
  let success=false;
  if(def.save&&def.save.periodic!==false){
   out.save=this.savingThrow(a.target,def.save.type,def.save.dc);
   success=out.save.success;
  }
  a.processed++;
  if(success){a.successes++;a.consecutive++;}else a.consecutive=0;
  if(success && def.cure && (def.cure.consecutive?a.consecutive:a.successes)>=def.cure.successes){
   this.cureAilment({id:a.id});out.cured=true;return out;
  }
  if(!success){out.effects=this.applyAilmentEffects(a,def);}
  const max=def.frequency.maxTicks;
  if(max!==undefined&&a.processed>=max){this.cureAilment({id:a.id});out.expired=true;}
  else a.nextAt+=toRounds(def.frequency.every);
  return out;
 }
 processDueAilments({target=null,maxIterations=500}={}){
  const output=[];let iterations=0;
  for(const a of [...this.s.activeAilments]){
    if(target!==null&&a.target!==target)continue;
    while(this.s.activeAilments.some(v=>v.id===a.id)&&a.nextAt!==null&&a.nextAt<=this.s.worldRounds){
      this.assert(++iterations<=maxIterations,'Too many affliction checks: advance time in smaller increments');
      output.push(this.resolveAilmentTick(a));
    }
  }
  return output;
 }
 advanceTime({count,unit}={}){
  const rounds=toRounds({count,unit});this.assert(rounds<=10000000,'Excessive downtime interval');
  this.assert(!this.s.pendingCharge&&!this.s.pendingMove&&!this.s.interrupt&&!this.s.pendingFullAttack,'Cannot advance time mid-action');
  this.s.worldRounds+=rounds;
  const ticks=this.processDueAilments();
  this.note(`GM advances elapsed time by ${count} ${unit}(s); ${ticks.length} ailment tick(s).`);
  return {worldRounds:this.s.worldRounds,ticks};
 }
 advanceTurnClock(rounds){
  this.s.worldRounds+=rounds;
  super.advanceTurnClock(rounds);
  if(rounds)this.onPendingClockAdvanced?.();
 }
 beginTurnEffects(context){
  const result=super.beginTurnEffects(context);this.syncConditions();
  const ailmentTicks=this.find(context.actor).summonDeparture?[]:this.processDueAilments({target:context.actor});
  for(const creature of this.s.creatures)this.syncConHp(creature.id);
  return {...result,ailmentTicks};
 }
 inspect(){
  return {...super.inspect(),conditions:clone(this.s.conditionInstances),
    conditionCatalog:STANDARD_CONDITION_IDS.map(id=>({id,coverage:STANDARD_CONDITIONS[id].coverage})),
    ailmentDefinitions:Object.keys(this.s.ailmentCatalog),activeAilments:clone(this.s.activeAilments),
    abilityDamage:clone(this.s.abilityDamage),abilityDrain:clone(this.s.abilityDrain),
    abilityScores:Object.fromEntries(this.s.creatures.map(c=>[c.id,Object.fromEntries(ABILITIES.map(a=>[a,this.abilityBreakdown(c.id,a)]))])),worldRounds:this.s.worldRounds};
 }
 dispatch(command,role='actor'){
  const ops=['apply_condition','remove_condition','register_ailment','expose_ailment','cure_ailment','heal_ability_damage','apply_ability_damage','apply_ability_drain','restore_ability_drain','gm_advance_time','list_conditions'];
  if(!ops.includes(command?.op)){
    const warnings=command?.actor?this.statusWarnings(command):[];
    const result=super.dispatch(command,role);
    if(warnings.length)return result&&typeof result==='object'?{...result,advisories:warnings}:{result,advisories:warnings};
    return result;
  }
  if(command.op==='list_conditions')return clone(STANDARD_CONDITIONS);
  this.assert(role==='gm','Only the GM may register/apply conditions and ailments');
  if(['apply_ability_damage','heal_ability_damage','apply_ability_drain','restore_ability_drain'].includes(command.op))
   this.assert(!this.s.interrupt&&!this.s.pendingMove&&!this.s.pendingFullAttack&&!this.s.pendingCharge,'Finish pending operation before GM ability adjustment');
  return this.transaction(()=>{
   let result;
   switch(command.op){
    case 'apply_condition':result=this.applyCondition(command);break;
    case 'remove_condition':result=this.removeCondition(command);break;
    case 'register_ailment':result=this.registerAilment(command.definition);break;
    case 'expose_ailment':result=this.exposeAilment(command);break;
    case 'cure_ailment':result=this.cureAilment(command);break;
    case 'heal_ability_damage':result=this.healAbilityDamage(command);break;
    case 'apply_ability_damage':result=this.applyAbilityDamage(command.target,command.ability,command.amount);break;
    case 'apply_ability_drain':result=this.applyAbilityDrain(command);break;
    case 'restore_ability_drain':result=this.restoreAbilityDrain(command);break;
    case 'gm_advance_time':result=this.advanceTime(command);break;
   }
   if(command.op==='register_ailment'){
    for(const key of ['turnStart','roundStart','previousTurnStart'])if(this[key])this[key].ailmentCatalog=clone(this.s.ailmentCatalog);
   }
   return result;
  });
 }
}
