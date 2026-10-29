/** Swarms and troops use the existing damage, vitality, movement and action owners. */
import {CombatMechanicsGame} from './combat_mechanics.mjs';
import {clone} from './core.mjs';
import {unresolvedActions,unresolvedDecisions} from './lifecycle.mjs';
const collectiveObj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const collectiveSizes=['fine','diminutive','tiny','small','medium','large','huge','gargantuan','colossal'];
export class CollectiveGame extends CombatMechanicsGame {
 collectiveKind(id){return (this.find(id).subtypes||[]).find(s=>s==='swarm'||s==='troop')||null;}
 collectiveSize(id){const c=this.find(id);return c.collective?.componentSize||c.sizeCategory||null;}
 validateCollective(p,kind,stats={}){
  this.assert(collectiveObj(p)&&Object.keys(p).every(k=>['componentSize','hiveMind','attack','distractionDC'].includes(k)),'Invalid collective profile');
  this.assert(kind==='swarm'||kind==='troop','collective requires the swarm or troop subtype');
  this.assert(collectiveSizes.includes(p.componentSize),'collective.componentSize requires the size of the individuals, not the footprint');
  this.assert(kind!=='swarm'||collectiveSizes.slice(0,3).includes(p.componentSize),'Swarm individuals must be Fine, Diminutive or Tiny');
  this.assert(stats.sizeCategory===undefined||stats.sizeCategory===p.componentSize,'sizeCategory and collective.componentSize must agree');
  if(p.hiveMind!==undefined)this.assert(kind==='swarm'&&typeof p.hiveMind==='boolean','hiveMind is a swarm boolean');
  if(p.distractionDC!==undefined)this.assert(kind==='swarm'&&Number.isInteger(p.distractionDC)&&p.distractionDC>=0&&p.distractionDC<=10000,'Invalid swarm distractionDC');
  if(p.attack!==undefined){
   this.assert(collectiveObj(p.attack)&&Object.keys(p.attack).every(k=>['components','metadata'].includes(k)),'Invalid collective.attack');
   this.validatePacketComponents(p.attack.components);
   this.assert(p.attack.components.every(c=>!c.precision),'Automatic collective damage cannot carry precision dice');
   this.validateDamageMetadata(p.attack.metadata||{});
   this.assert(!p.attack.metadata?.areaEffect&&!p.attack.metadata?.targeting,'Collective attacks are weapon damage, not area effects or targeted spells');
  }
 }
 validateCreature(def){
  const safe=clone(def);delete safe.collective;super.validateCreature(safe);
  const kinds=(def.subtypes||[]).filter(s=>['swarm','troop'].includes(s));
  this.assert(kinds.length<=1,'A creature cannot be both a swarm and a troop');
  if(def.collective!==undefined){this.assert(!def.objectProfile,'Objects cannot be collectives');this.validateCollective(def.collective,kinds[0],def.stats);}
 }
 initializeCreature(c,def){
  super.initializeCreature(c,def);
  if(def.collective){
   c.collective=clone(def.collective);c.sizeCategory=def.collective.componentSize;
   if(def.stats.size===undefined)c.size=def.subtypes.includes('swarm')?2:4;
   if(def.stats.reach===undefined&&def.subtypes.includes('swarm'))c.reach=0;
  }
 }
 traits(id){
  const result=super.traits(id),kind=this.collectiveKind(id);
  if(kind){
   const c=this.find(id);
   result.collective={kind,componentSize:this.collectiveSize(id),attackConfigured:!!c.collective?.attack};
   if(!c.collective?.attack)result.notes.push('Collective automatic damage is not configured. Supply collective.attack before taking ordinary turns.');
   if(kind==='swarm'&&c.collective?.distractionDC===undefined)result.notes.push('Swarm distraction DC is not configured; adjudicate its published save separately.');
   if(kind==='swarm'&&!collectiveSizes.slice(0,3).includes(this.collectiveSize(id)))result.notes.push('Swarm component size is missing: weapon damage cannot be resolved safely.');
  }
  return result;
 }
 evaluateEffect(spec={}){
  const result=super.evaluateEffect(spec),kind=this.collectiveKind(spec.target);
  this.assert(spec.targeting===undefined||['creatures','area','unrestricted'].includes(spec.targeting),'Invalid effect targeting');
  if(kind&&spec.targeting==='creatures'){
   const c=this.find(spec.target),mind=(spec.tags||[]).some(t=>['mind_affecting','charm','compulsion'].includes(t));
   const exception=kind==='swarm'&&c.collective?.hiveMind===true&&c.int!=null&&!c.mindless&&mind;
   if(!exception){result.blocked=true;result.blockedBy.push(`${kind}: effects targeting a specific number of creatures`);}
  }
  return result;
 }
 resolveProtection(target,amount,type,cause,metadata={},source=null,skipDR=false){
  const kind=this.collectiveKind(target);if(!kind)return super.resolveProtection(target,amount,type,cause,metadata,source,skipDR);
  const targeting=this.evaluateEffect({target,tags:metadata.tags||[],targeting:metadata.targeting});
  if(targeting.blocked)return {applied:0,prevented:amount,steps:targeting.blockedBy,advisories:targeting.advisories};
  const steps=[];let scaled=amount;
  const area=metadata.areaEffect||metadata.targeting==='area';
  if(area){scaled=Math.floor(scaled*1.5);steps.push(`${kind}: area damage ×1.5`);}
  if(kind==='swarm'&&cause==='weapon'&&!area){
   const size=this.collectiveSize(target);
   this.assert(collectiveSizes.slice(0,3).includes(size),'Swarm weapon defense needs a Fine, Diminutive or Tiny componentSize');
   if(size!=='tiny')return {applied:0,prevented:amount,steps:['Swarm: immune to weapon damage'],advisories:targeting.advisories};
   const types=metadata.damageTypes||[type];
   if(types.some(t=>['slashing','piercing'].includes(t))&&!types.includes('bludgeoning')){scaled=Math.floor(scaled/2);steps.push('Tiny swarm: slashing/piercing weapon damage ×0.5');}
  }
  const result=super.resolveProtection(target,scaled,type,cause,metadata,source,skipDR);
  return {...result,prevented:Math.max(0,amount-result.applied),amplified:Math.max(0,scaled-amount),steps:[...steps,...result.steps]};
 }
 healthState(id){
  const result=super.healthState(id);if(!this.collectiveKind(id))return result;
  const c=this.find(id),nl=this.s.nonlethalDamage?.[id]||0;
  const dead=result.status==='dead'||c.hp<=0;
  const dispersed=!dead&&(nl>c.hp||c.vitality?.collectiveDispersed&&nl>=c.hp);
  return {...result,status:dead?'dead':dispersed?'dispersed':'healthy',deathThreshold:0,collective:true,dispersed:dead||!!dispersed};
 }
 syncVitality(id){
  const c=this.find(id);
  if(this.collectiveKind(id)){
   c.vitality ||= {};const nl=this.s.nonlethalDamage?.[id]||0;
   if(nl>c.hp&&c.hp>0)c.vitality.collectiveDispersed=true;
   if(c.hp>nl)delete c.vitality.collectiveDispersed;
  }
  return super.syncVitality(id);
 }
 nonlethalState(id){
  const r=super.nonlethalState(id);if(!this.collectiveKind(id))return r;
  return {...r,status:r.damage>r.hp||this.find(id).vitality?.collectiveDispersed&&r.damage>=r.hp?'unconscious':'none'};
 }
 damage(...args){const r=super.damage(...args);if(this.collectiveKind(args[0]))this.syncVitality(args[0]);return r;}
 healNonlethal(cmd){const r=super.healNonlethal(cmd);this.syncVitality(cmd.target);return r;}
 occupiesSpace(c){return this.collectiveKind(c.id)&&this.healthState(c.id).dispersed?false:super.occupiesSpace(c);}
 canBeAttacked(id){return this.collectiveKind(id)&&this.healthState(id).dispersed?false:super.canBeAttacked(id);}
 policy(id,tag){
  if(this.collectiveKind(id)&&this.healthState(id).dispersed&&['no_actions','no_movement','no_aoo'].includes(tag))return true;
  return super.policy(id,tag);
 }
 blocksOccupancy(c,o,x,y){
  if(!c.objectProfile&&!o.objectProfile&&(this.collectiveKind(c.id)||this.collectiveKind(o.id)))return false;
  return super.blocksOccupancy(c,o,x,y);
 }
 movementThreatens(reactor,mover,from,to){
  if(super.movementThreatens(reactor,mover,from,to))return true;
  if(!this.collectiveKind(mover))return false;
  const a=this.find(reactor),b=this.find(mover);
  return this.occupancyLayer(a)===this.occupancyLayer(b)&&
   this.footprint(b,to.x,to.y).some(p=>this.footprint(a).some(q=>p.x===q.x&&p.y===q.y))&&this.threatens(reactor,mover,to.x,to.y);
 }
 aooLimit(id){return this.collectiveKind(id)==='swarm'?0:super.aooLimit(id);}
 threatens(actor,target,vx,vy){
  const kind=this.collectiveKind(actor);if(kind==='swarm')return false;
  if(kind==='troop'){
   const a=this.find(actor),b=this.find(target);
   return !!a.collective?.attack&&this.canAct(actor)&&!this.policy(actor,'no_aoo')&&!this.policy(actor,'one_move_only')&&a.team!==b.team&&this.canBeAttacked(target)&&this.occupancyLayer(a)===this.occupancyLayer(b)&&!this.wallAttackGeometry(actor,target).blocked&&this.threatGeometry(a,b,vx,vy);
  }
  return super.threatens(actor,target,vx,vy);
 }
 flankingInfo(actor,target,profile={}){
  if(this.traits(target).immunities.includes('flanking'))return {flanking:false,reason:'Target is immune to flanking'};
  return super.flankingInfo(actor,target,profile);
 }
 collectiveManeuverBlocked(actor,target,kind){
  const a=this.collectiveKind(actor),b=this.collectiveKind(target);
  return a==='swarm'&&kind==='grapple'||b==='swarm'&&['trip','grapple','bull_rush'].includes(kind)||b==='troop'&&['bull_rush','dirty_trick','disarm','drag','grapple','reposition','trip'].includes(kind);
 }
 validateManeuver(cmd,options){
  this.assert(!this.collectiveManeuverBlocked(cmd.actor,cmd.target,cmd.kind),'Swarm/troop traits prohibit this combat maneuver');
  return super.validateManeuver(cmd,options);
 }
 collectiveInReach(actor,target){
  const a=this.find(actor),b=this.find(target);
  if(b.objectProfile||this.occupancyLayer(a)!==this.occupancyLayer(b)||!this.canBeAttacked(target)||actor===target)return false;
  if(this.geometryRuling(actor,target)?.meleeReach===false)return false;
  if(this.wallAttackGeometry(actor,target).blocked)return false;
  return this.collectiveKind(actor)==='swarm'?this.distance(a,b)===0:this.meleeReach(actor,target);
 }
 collectiveDamage(actor,target){
  const c=this.find(actor),p=c.collective;this.assert(p?.attack,'Configure collective.attack before resolving automatic damage');
  this.assert(this.canAct(actor)&&this.collectiveInReach(actor,target),'Target outside active collective reach');
  const packet=this.resolvePacket({source:actor,target,cause:'weapon',metadata:p.attack.metadata||{},components:p.attack.components});
  let distraction=null;
  if(this.collectiveKind(actor)==='swarm'&&packet.applied+packet.tempHpAbsorbed>0&&p.distractionDC!==undefined&&this.canBeAttacked(target)&&!['construct','undead'].includes(this.find(target).creatureType)){
   distraction=this.savingThrow(target,'fort',p.distractionDC);
   if(!distraction.success)this.applyCondition({target,condition:'nauseated',rounds:1,source:actor});
  }
  return {target,hit:true,automatic:true,packet,distraction};
 }
 resolveAttack(actor,target,label='Attack',profile=null,defense='ac'){
  if(this.collectiveKind(actor)==='troop'&&/AoO/.test(label))return this.collectiveDamage(actor,target);
  const mode=profile?.attackMode||this.find(actor).attackMode||'melee';
  this.assert(!this.collectiveKind(actor)||!['melee','melee_touch'].includes(mode),'Use collective_attack or movement for automatic swarm/troop damage; ordinary melee attacks are unsupported');
  return super.resolveAttack(actor,target,label,profile,defense);
 }
 resolveCollectiveTurnDamage(actor){
  if(!this.collectiveKind(actor)||!this.canAct(actor)||this.policy(actor,'one_move_only')||this.s.actions.collectiveDamageDone)return null;
  this.assert(this.find(actor).collective?.attack,'Configure collective.attack before taking a swarm/troop turn');
  const targets=this.s.creatures.filter(c=>this.collectiveInReach(actor,c.id)).map(c=>c.id);
  if(!targets.length)return {actor,targets:[]};
  this.s.actions.collectiveDamageDone=true;
  const results=[];for(const target of targets)if(this.canAct(actor)&&this.collectiveInReach(actor,target))results.push(this.collectiveDamage(actor,target));
  this.note(`${this.find(actor).name}: automatic collective damage resolved for ${results.length} creature(s).`);
  return {actor,targets:results};
 }
 continueMove(){
  const move=this.s.pendingMove;const result=super.continueMove();
  if(move&&!this.s.pendingMove&&move.index>0&&['done','stopped'].includes(result.status)&&move.action!=='gm_free'&&this.active()?.id===move.actor){
   const collective=this.resolveCollectiveTurnDamage(move.actor);if(collective)result.collective=collective;
  }
  return result;
 }
 onPendingTurnEnd(actor){
  this.resolveCollectiveTurnDamage(actor);
  return super.onPendingTurnEnd(actor);
 }
 collectiveCastingCheck(actor,spell){
  const sources=this.s.creatures.filter(c=>c.id!==actor&&this.collectiveKind(c.id)&&this.canAct(c.id)&&this.collectiveInReach(c.id,actor)).map(c=>c.id);
  if(!sources.length)return null;
  const d20=this.rollDie(20),total=d20+spell.casterLevel,dc=20+spell.level;
  const check={sources,d20,total,dc,success:total>=dc};
  this.note(`Collective casting distraction: caster level check ${total} vs DC ${dc}.`);return check;
 }
 combatOverview(target){
  return super.combatOverview(target).map(row=>({...row,collective:this.collectiveKind(row.target)?{
   kind:this.collectiveKind(row.target),componentSize:this.collectiveSize(row.target),profile:clone(this.find(row.target).collective||null),
   damageResolvedThisTurn:this.active()?.id===row.target&&!!this.s.actions.collectiveDamageDone
  }:null}));
 }
 dispatch(cmd,role='actor'){
  if(cmd?.op==='gm_set_collective'){
   this.assert(role==='gm','GM authority required');
   return this.transaction(()=>{
    this.assert(!unresolvedActions(this.s).length&&!unresolvedDecisions(this.s).length,'Resolve pending operations before collective setup');
    const c=this.find(cmd.target);this.validateCollective(cmd.profile,this.collectiveKind(c.id));
    c.collective=clone(cmd.profile);c.sizeCategory=cmd.profile.componentSize;this.syncVitality(c.id);
    return {target:c.id,profile:clone(c.collective)};
   });
  }
  if(cmd?.op==='collective_attack')return this.transaction(()=>{
   this.assert(this.active()?.id===cmd.actor&&this.collectiveKind(cmd.actor),'Only the active swarm/troop can use collective_attack');
   this.assert(!unresolvedActions(this.s).length&&!unresolvedDecisions(this.s).length,'Resolve pending operations first');
   this.assert(!this.s.actions.collectiveDamageDone,'Automatic collective damage already resolved this turn');
   this.assert(this.canAct(cmd.actor)&&!this.policy(cmd.actor,'one_move_only'),'Creature cannot attack');
   this.spendAction(cmd.actor,'move','Stationary collective attack');
   return this.resolveCollectiveTurnDamage(cmd.actor);
  });
  return super.dispatch(cmd,role);
 }
}
