/** V3.18: ordinary attack completion. Does not make tactical choices for the GM. */
import {TimeGame} from './time_engine.mjs';
import {clone,abilityMod} from './core.mjs';
import {weaponSizeDice,strengthDamageModifier} from './attack_completion_rules.mjs';
const ok=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
export class AttackCompletionGame extends TimeGame{
 constructor(state){
  super(state);this.s.nonlethalDamage ||= {};
  this.turnStart=clone(this.s);this.roundStart=clone(this.s);
 }
 nonlethalTotal(target){this.find(target);return this.s.nonlethalDamage[target]||0;}
 nonlethalState(target){
  const c=this.find(target),damage=this.nonlethalTotal(target);
  const immune=this.evaluateEffect({target,tags:['nonlethal']}).blocked;
  const status=damage>0&&damage>c.hp?'unconscious':damage>0&&damage===c.hp?'staggered':'none';
  return {damage,hp:c.hp,maxHp:c.maxHp,status,immune};
 }
 hasCondition(target,condition){
  if(['unconscious','staggered'].includes(condition)&&this.nonlethalState(target).status===condition)return true;
  return super.hasCondition(target,condition);
 }
 policy(target,tag){
  const status=this.nonlethalState(target).status;
  if(status==='unconscious'&&['no_actions','no_movement','no_aoo'].includes(tag))return true;
  if(status==='staggered'&&tag==='one_standard_or_move')return true;
  return super.policy(target,tag);
 }
 attackDealsNonlethal(actor,profile){
  return (profile?.damageIntent??this.find(actor).damageIntent??(profile?.attackKind==='unarmed'?'nonlethal':'lethal'))==='nonlethal';
 }
 nonlethalAttackPenalty(profile,description){
  const intent=profile?.damageIntent??(profile?.attackKind==='unarmed'?'nonlethal':'lethal');
  const normal=profile?.attackKind==='unarmed'?'nonlethal':'lethal';
  return intent!==normal&&!profile?.nonlethalProficient?-4:0;
 }
 validateAttackReach(actor,target,profile={}){
  this.validateAttackPosture(actor,profile);
  const mode=profile?.attackMode||this.find(actor).attackMode||'melee';
  if(['ranged','ranged_touch'].includes(mode))return this.attackRangeInfo(actor,target,profile,{attackMode:mode});
  const distance=this.distance(this.find(actor),this.find(target));
  this.assert(this.meleeReach(actor,target),'Target out of reach');
  return null;
 }
 weaponDamageDice(actor,profile){return weaponSizeDice(profile?.damageDiceCount??1,profile?.damageDie??this.find(actor).damageDie,profile?.damageSizeSteps??0);}
 completedAttackBonus(actorId,profile,description){
  const c=this.find(actorId),base=this.stat(actorId,'attack');
  const preferred=profile?.attackAbility??(['ranged','ranged_touch'].includes(description.attackMode)?'dex':'str');
  // Imported printed attack totals are authoritative. The imported attackOffset
  // (not an inferred ability dependency) carries individual weapon modifiers.
  if(c.statTotals&&Object.hasOwn(c.statTotals,'attack'))return base;
  if(preferred==='str')return base;
  const str=abilityMod(this.stat(actorId,'str'))+this.damagePenalty(actorId,'str');
  return base-str+(preferred==='dex'?abilityMod(this.stat(actorId,'dex'))+this.damagePenalty(actorId,'dex'):0);
 }
 completedDamageBonus(actorId,profile,description){
  const c=this.find(actorId),base=this.stat(actorId,'damage');
  if(c.statTotals&&Object.hasOwn(c.statTotals,'damage'))return base;
  const ability=profile?.damageAbility??(['ranged','ranged_touch'].includes(description.attackMode)?(profile?.rangedKind==='thrown'?'str':'none'):'str');
  const str=abilityMod(this.stat(actorId,'str'));
  return base-str+strengthDamageModifier(str,ability)-(ability==='none'?this.damagePenalty(actorId,'str'):0);
 }
 attackRangeInfo(actorId,targetId,profile,description){
  if(!['ranged','ranged_touch'].includes(description.attackMode))return null;
  const actor=this.find(actorId),target=this.find(targetId);
  const distanceFeet=this.distance(actor,target)*5;
  const kind=profile?.rangedKind??(description.attackMode==='ranged_touch'?'ray':'projectile');
  const increment=profile?.rangeIncrementFeet;
  const spellRange=profile?.rangeFeet;
  this.assert(kind==='ray'||Number.isInteger(increment),'A projectile/thrown attack needs an explicit range increment');
  const rangeNumber=increment?Math.max(1,Math.ceil(distanceFeet/increment)):1;
  const maxRange=spellRange??(increment*(kind==='thrown'?5:10));
  this.assert(actorId!==targetId&&distanceFeet>=0&&distanceFeet<=maxRange,`Ranged target beyond maximum range (${maxRange} ft)`);
  const targetEngaged=(this.s.creatures||[]).some(c=>c.id!==actorId&&c.id!==targetId&&c.team===actor.team&&
    c.hp>0&&(this.threatens(c.id,targetId)||this.threatens(targetId,c.id)));
  const firingIntoMelee=profile?.firingIntoMelee??targetEngaged;
  const preciseShot=!!(actor.preciseShot||actor.flags?.preciseShot);
  const meleePenalty=firingIntoMelee&&!preciseShot?-4:0;
  return {kind,distanceFeet,rangeIncrementFeet:increment??null,increment:rangeNumber,maxRange,
    rangePenalty:increment?-2*(rangeNumber-1):0,firingIntoMelee,meleePenalty,
    advisory:'Automatic 5-ft grid distance; ammunition/reload uses configured stores. Cover and concealment use registered defense context; soft-cover geometry requires GM input.'};
 }
 damage(targetId,amount,damageType='bludgeoning',sourceId=null,cause='weapon',metadata={}){
  if(!metadata?.nonlethal)return super.damage(targetId,amount,damageType,sourceId,cause,metadata);
  const c=this.find(targetId);if(sourceId!==null)this.find(sourceId);
  this.assert(ok(amount,0,100000),'Invalid nonlethal damage amount');
  this.assert(['bludgeoning','piercing','slashing'].includes(damageType),'Nonlethal weapon damage must have a physical type');
  const safe={...metadata};delete safe.nonlethal;
  this.validateDamageMetadata(safe);
  const evt=this.emit('damage_before',{target:targetId,source:sourceId,amount,damageType,damageTypes:safe.damageTypes||[damageType],cause});
  if(evt.cancelled)return {cancelled:true,raw:amount,applied:0,nonlethal:true};
  const immune=this.evaluateEffect({target:targetId,tags:['nonlethal']});
  if(immune.blocked){this.note(`${c.name}: immune to nonlethal damage.`);return {raw:amount,applied:0,nonlethal:true,immune:true};}
  const mitigated=this.resolveProtection(targetId,amount,damageType,cause,safe,sourceId);
  const applied=mitigated.applied;
  const already=this.nonlethalTotal(targetId);
  // PF1e converts subsequent nonlethal hits to lethal once accrued nonlethal
  // damage has reached maximum HP (regenerating creatures keep accruing nonlethal damage).
  const lethalOverflow=already>=c.maxHp&&!c.recovery?.regeneration?applied:0;
  const nonlethal=applied-lethalOverflow;
  if(nonlethal)this.s.nonlethalDamage[targetId]=already+nonlethal;
  if(lethalOverflow){
   const tempHp=typeof this.absorbTemporaryHp==='function'?this.absorbTemporaryHp(targetId,lethalOverflow):0;
   this.applyHpLoss(targetId,lethalOverflow-tempHp,{damageType,metadata:safe,source:sourceId,cause});
  }
  this.note(`${c.name}: ${amount} raw nonlethal / ${applied} after protection; ${nonlethal} accumulated, ${lethalOverflow} converted to lethal (total ${this.nonlethalTotal(targetId)}, status ${this.nonlethalState(targetId).status}).`);
  this.syncZones();
  return {cancelled:false,raw:amount,applied,nonlethal:true,accumulated:nonlethal,lethalOverflow,status:this.nonlethalState(targetId).status,steps:mitigated.steps};
 }
 healHitPoints({target,amount}={}){
  this.find(target);this.assert(ok(amount,0,100000),'Invalid HP healing');
  const before=this.nonlethalTotal(target);
  this.s.nonlethalDamage[target]=Math.max(0,before-amount);
  const result=super.healHitPoints({target,amount});
  this.note(`${this.find(target).name}: removes ${before-this.nonlethalTotal(target)} nonlethal damage.`);
  return {...result,nonlethalHealed:before-this.nonlethalTotal(target),state:this.nonlethalState(target)};
 }
 healNonlethal({target,amount}={}){
  this.find(target);this.assert(ok(amount,0,100000),'Invalid nonlethal healing');
  const before=this.nonlethalTotal(target);this.s.nonlethalDamage[target]=Math.max(0,before-amount);
  this.s.actions.activity++;
  this.note(`${this.find(target).name}: restores ${before-this.nonlethalTotal(target)} nonlethal damage.`);
  return {target,healed:before-this.nonlethalTotal(target),state:this.nonlethalState(target)};
 }
 inspect(){return {...super.inspect(),nonlethalDamage:clone(this.s.nonlethalDamage),nonlethalStatus:Object.fromEntries(this.s.creatures.map(c=>[c.id,this.nonlethalState(c.id)]))};}
 dispatch(cmd,role='actor'){
  const ops=['gm_apply_nonlethal','gm_heal_hp','gm_heal_nonlethal'];
  if(!ops.includes(cmd?.op))return super.dispatch(cmd,role);
  this.assert(role==='gm','Healing and GM nonlethal adjustments require GM authority');
  this.assert(!this.s.interrupt&&!this.s.pendingMove&&!this.s.pendingFullAttack&&!this.s.pendingRider,'Finish pending resolution first');
  return this.transaction(()=>{
   if(cmd.op==='gm_heal_hp')return this.healHitPoints(cmd);
   if(cmd.op==='gm_heal_nonlethal')return this.healNonlethal(cmd);
   return this.damage(cmd.target,cmd.amount,cmd.damageType||'bludgeoning',cmd.source||null,cmd.cause||'environment',{...(cmd.metadata||{}),nonlethal:true});
  });
 }
}
