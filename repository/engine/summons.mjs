/** V3.28: Summon is an instance marker. Pending Events owns its only timer.
 * Removal waits for the current atomic resolution to unwind, so a lethal hit
 * can still finish its damage report before the target leaves the encounter.
 */
import {SpellResourcesGame} from './spell_resources.mjs';
import {clone,newTurnActions} from './core.mjs';
import {toRounds} from './ailments.mjs';
import {unresolvedActions} from './lifecycle.mjs';
const summonObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const summonReason=x=>typeof x==='string'&&x.trim().length>0&&x.length<=500;
export class SummonsGame extends SpellResourcesGame {
 summonEvent(target){return this.s.pendingEvents.find(e=>e.kind==='summon'&&e.actor===target&&e.status==='active');}
 summonsOverview(){
  return this.s.pendingEvents.filter(e=>e.kind==='summon').map(e=>({target:e.actor,name:this.find(e.actor).name,
   marker:'Summon',eventId:e.id,source:e.payload.source,duration:clone(e.duration),
   remainingRounds:e.duration.type==='time'?Math.max(0,e.duration.at-this.s.worldRounds):Math.max(0,e.duration.round-this.s.round)}));
 }
 validateSummonEvent({actor,payload,duration,requiresInput}){
  this.assert(this._registeringSummon,'Use gm_mark_summon or spawn_creature.summon to create a Summon timer');
  this.find(actor);
  this.assert(summonObject(payload)&&Object.keys(payload).every(k=>k==='source')&&
   !requiresInput&&['time','initiative'].includes(duration?.type)&&duration.onExpire==='expire','Invalid Summon timer');
 }
 markSummon({target,duration,source=null,reason}={}){
  const creature=this.find(target);
  this.assert(summonReason(reason),'Summon setup requires a reason');
  this.assert(!this.summonEvent(target)&&!creature.summonDeparture,'Creature already has a Summon timer');
  this.assert(creature.hp>0&&!this.hasCondition(target,'dead'),'Cannot summon a defeated creature');
  this.assert(summonObject(duration)&&Object.keys(duration).every(k=>['count','unit','atScore'].includes(k)),'Supply Summon duration count/unit and optional initiative atScore');
  const rounds=toRounds(duration);
  this.assert(Number.isInteger(rounds)&&rounds>=1&&rounds<=100000,'Summon duration must be 1–100000 rounds');
  if(source!==null)this.find(source);
  const init=this.s.initiative.enabled;
  this.assert(init||duration.atScore===undefined,'atScore requires active initiative');
  const score=duration.atScore??this.s.initiative.entries.find(e=>e.id===(source||this.active()?.id))?.score;
  this.assert(!init||Number.isInteger(score),'Summon source needs an initiative position or explicit atScore');
  const timing=init?{type:'initiative',afterRounds:rounds,atScore:score,onExpire:'expire'}:
   {type:'time',count:rounds,unit:'round',onExpire:'expire'};
  let id;do{id=`summon_${++this.s.registeredSeq}`;}while(this.s.pendingEvents.some(e=>e.id===id)||this.s.pendingEventHistory.some(e=>e.id===id));
  let event;this._registeringSummon=true;
  try{event=this.registerPendingEvent({id,label:`Summon: ${creature.name}`.slice(0,150),kind:'summon',actor:target,
   trigger:'Automatically remove when the duration ends or the creature is defeated.',requiresInput:false,duration:timing,payload:{source}});}
  finally{this._registeringSummon=false;}
  creature.subtypes=[...new Set([...(creature.subtypes||[]),'summon'])];
  this.s.actions.activity++;
  this.note(`GM marks ${creature.name} as Summon: ${reason.trim()}`);
  return {target,marker:'Summon',eventId:event.id,duration:event.duration};
 }
 onCreatureSpawned(creature,command){
  const out=super.onCreatureSpawned(creature,command);
  if(command.summon!==undefined||creature.subtypes?.includes('summon')){
   const spec=command.summon;
   this.assert(summonObject(spec)&&Object.keys(spec).every(k=>['duration','source'].includes(k)),'Summon instances require summon:{duration,source?}');
   out.summon=this.markSummon({target:command.id,...spec,reason:'GM spawns a summoned creature'});
  }
  return out;
 }
 concludePendingEvent(event,outcome,reason){
  const result=super.concludePendingEvent(event,outcome,reason);
  if(event.kind==='summon'){
   const c=this.find(event.actor);
   c.summonDeparture={reason:reason||outcome,eventId:event.id};c.hp=0;
   // Prevent automatic turn-start/aura rules from firing while removal unwinds.
   this.s.automationRules=this.s.automationRules.filter(r=>r.owner!==c.id);
  }
  return result;
 }
 onCreatureDuplicated(original,copy){
  const event=this.summonEvent(original.id);
  if(!event&&!original.summonDeparture)return;
  if(original.summonDeparture||copy.hp<=0){
   copy.summonDeparture=clone(original.summonDeparture||{reason:'summon defeated',eventId:event.id});copy.hp=0;return;
  }
  const rounds=event.duration.type==='time'?event.duration.at-this.s.worldRounds:event.duration.round-this.s.round;
  const added=this.markSummon({target:copy.id,duration:{count:Math.max(1,rounds),unit:'round',
   ...(event.duration.type==='initiative'?{atScore:event.duration.score}:{})},reason:'Copy inherits original Summon expiry'});
  const timer=this.s.pendingEvents.find(e=>e.id===added.eventId);
  timer.duration=clone(event.duration);timer.payload=clone(event.payload);
 }
 checkSummonFalls(){
  for(const e of [...(this.s.pendingEvents||[])].filter(e=>e.kind==='summon')){
   const c=this.find(e.actor);
   if(c.hp<=0||this.hasCondition(c.id,'dead'))this.concludePendingEvent(e,'resolved','summon defeated');
  }
 }
 damage(...args){const result=super.damage(...args);this.checkSummonFalls();return result;}
 resolvePacket(...args){const result=super.resolvePacket(...args);this.checkSummonFalls();return result;}
 applyCondition(...args){const result=super.applyCondition(...args);this.checkSummonFalls();return result;}
 doActions(...args){const result=super.doActions(...args);this.checkSummonFalls();return result;}
 emit(name,payload={}){
  if(name==='turn_start'&&this.s.creatures.find(c=>c.id===payload.actor)?.summonDeparture)return;
  return super.emit(name,payload);
 }
 onPendingClockAdvanced(){
  const result=super.onPendingClockAdvanced();
  // During Fast Forward, remove at this deadline, before later ailment ticks.
  if(this._advancingCastTime)this.flushSummons({downtime:true});
  return result;
 }
 endTurn(){
  const result=super.endTurn();
  this.flushSummons({turnBoundary:true});return result;
 }
 flushSummons({downtime=false,turnBoundary=false}={}){
  if(this._flushingSummons)return;
  this.checkSummonFalls();
  if(!this.s.creatures.some(c=>c.summonDeparture))return;
  this._flushingSummons=true;
  try{
   const departed=()=>this.s.creatures.filter(c=>c.summonDeparture);
   const clean=()=>{
    for(const c of departed()){
     const id=c.id;
     for(const g of [...this.s.grapples])if(g.holder===id||g.target===id)this.releaseGrapple(g.holder,'loses hold as a summon departs:');
     for(const cast of [...(this.s.activeSpellCasts||[])])if(cast.actor===id)this.loseCasting(cast,'summon departed');
     // Keep living parent counterspell contexts; discard only the departed caster.
     const prune=cast=>{
      if(!cast)return null;
      cast.parentCasting=prune(cast.parentCasting);
      if(cast.actor===id||cast.counterEventId&&!cast.parentCasting){
       this.loseCasting(cast,'summon departed');
       const ready=this.s.pendingEvents.find(e=>e.id===cast.counterEventId);
       if(ready)this.concludePendingEvent(ready,'cancelled','counterspell casting no longer exists');
       return cast.parentCasting||null;
      }
      cast.threats=(cast.threats||[]).filter(x=>x!==id);
      cast.handled=(cast.handled||[]).filter(x=>x!==id);return cast;
     };
     if(this.s.pendingSpellCast)this.s.pendingSpellCast=prune(this.s.pendingSpellCast);
     if(this.s.pendingSpellCast?.counterEventId){
      const cast=this.s.pendingSpellCast,e=this.s.pendingEvents.find(e=>e.id===cast.counterEventId);
      if(e)this.s.pendingReadyAction={id:e.id,actor:e.actor,action:e.action,interrupting:cast.parentCasting.actor};
     }
     for(const e of [...this.s.pendingEvents])if(e.actor===id||e.duration?.actor===id)this.concludePendingEvent(e,'cancelled','summon departed');
     for(const e of [...this.s.effects]){
      if(e.target===id||e.spellSource?.actor===id&&!e.persistentAreaSource)this.removeEffect(e.id);
      else if(e.source===id){e.departedSource=id;e.source=null;}
     }
     for(const condition of this.s.conditionInstances)if(condition.source===id){condition.departedSource=id;condition.source=null;}
     this.s.activeAilments=this.s.activeAilments.filter(a=>a.target!==id);
     for(const a of this.s.activeAilments)if(a.source===id)a.source=null;
     this.s.negativeLevels=this.s.negativeLevels.filter(a=>a.target!==id);
     for(const a of this.s.negativeLevels)if(a.source===id)a.source=null;
     this.s.marks=this.s.marks.filter(m=>m.source!==id&&m.target!==id);
     this.s.spellResources=this.s.spellResources.filter(b=>b.actor!==id);
     for(const key of ['abilityDamage','abilityDrain','conHpAdjustments','energyTempHp','nonlethalDamage','riderBleed','aooUsed'])delete this.s[key][id];
     for(const key of ['pendingMove','pendingCharge','pendingManeuver','pendingOverrun','pendingRider','pendingReplacement','pendingRangedAction']){
      const p=this.s[key];if(p&&(p.actor===id||p.target===id))this.s[key]=null;
      else if(p?.reactors)p.reactors=p.reactors.filter(x=>x!==id);
     }
     // A living full attacker retains unspent strikes and may choose a new target.
     if(this.s.pendingFullAttack?.actor===id)this.s.pendingFullAttack=null;
     this.s.pendingRiderQueue=this.s.pendingRiderQueue.filter(p=>p.actor!==id&&p.target!==id);
     const interrupt=this.s.interrupt;
     if(interrupt&&(interrupt.target===id||interrupt.reactor===id||interrupt.actor===id)){
      this.s.interrupt=null;
      if(this.s.pendingRangedAction)this.createRangedCheckpoint(this.s.pendingRangedAction);
      else if(this.s.pendingMove)this.continueMove();
      else if(this.s.pendingManeuver){this.s.pendingManeuver=null;this.note('Maneuver stopped because its reaction participant departed; spent actions remain spent.');}
     }
     if(this.s.deferredTurnStart?.actor===id)this.s.deferredTurnStart=null;
     c.hp=0;
    }
   };
   clean();
   if(this.s.initiative.enabled&&!this.s.initiative.entries.some(e=>this.s.creatures.some(c=>c.id===e.id&&!c.summonDeparture))){
    this.finishInitiative();downtime=true;
   }
   // Finish a removed active creature's turn through the existing cursor, so
   // empty initiative counts and their deadlines are still processed in order.
   let skips=0;
   while(!downtime&&this.active()?.summonDeparture&&this.s.creatures.some(c=>!c.summonDeparture)){
    this.assert(++skips<=this.s.creatures.length+1,'Could not select a remaining creature after summon removal');
    super.endTurn();this.checkSummonFalls();clean();
   }
   clean();
   const active=this.active()?.id,oldTurn=this.s.turn,removed=departed();
   const ids=new Set(removed.map(c=>c.id));
   const init=this.s.initiative;
   init.entries=init.entries.filter(e=>!ids.has(e.id));
   init.acted=init.acted.filter(id=>!ids.has(id));init.delayed=init.delayed.filter(id=>!ids.has(id));
   if(ids.has(init.queuedResume))init.queuedResume=null;
   this.s.creatures=this.s.creatures.filter(c=>!ids.has(c.id));
   this.s.turn=this.s.creatures.findIndex(c=>c.id===active);
   if(this.s.turn<0){this.s.turn=Math.min(oldTurn,Math.max(0,this.s.creatures.length-1));this.s.actions=newTurnActions();}
   if(!this.s.creatures.length){init.enabled=false;this.s.turn=0;this.s.deferredTurnStart=null;}
   for(const key of Object.keys(this.s.zonePresence))if(ids.has(key.split('|')[1])||!this.s.automationRules.some(r=>r.id===key.split('|')[0]))delete this.s.zonePresence[key];
   for(const c of removed)this.note(`${c.name} removed (Summon: ${c.summonDeparture.reason}).`);
   this.s.actions.activity++;
   if(turnBoundary){this.turnStart=clone(this.s);if(this.s.round!==this.roundStart.round)this.roundStart=clone(this.s);}
  }finally{this._flushingSummons=false;}
 }
 inspect(){return {...super.inspect(),summons:this.summonsOverview()};}
 lifecycleStatus(){return {...super.lifecycleStatus(),summons:this.summonsOverview()};}
 dispatch(command,role='actor'){
  if(!['gm_mark_summon','gm_dismiss_summon','gm_get_summons'].includes(command?.op))return super.dispatch(command,role);
  this.assert(role==='gm','Summon administration requires GM authority');
  if(command.op==='gm_get_summons')return this.summonsOverview();
  this.assert(summonReason(command.reason),'Summon changes require a reason');
  this.assert(unresolvedActions(this.s).length===0,'Finish unresolved action before changing summons');
  if(command.op==='gm_mark_summon')return this.markSummon(command);
  const e=this.summonEvent(command.target);this.assert(e,'No active Summon timer for this creature');
  return this.concludePendingEvent(e,'cancelled',command.reason);
 }
}
