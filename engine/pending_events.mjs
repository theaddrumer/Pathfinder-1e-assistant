/** V3.21: GM-owned Pending Events.  Arbitrary triggers are never evaluated by
 * the calculator.  Mechanical expiration is deterministic and is not held up
 * merely because other events still need narrative adjudication.
 */
import {InitiativeGame} from './initiative.mjs';
import {clone} from './core.mjs';
import {toRounds} from './ailments.mjs';
import {crossedInitiative,isReadOnlyCommand} from './lifecycle.mjs';
const pendingEventIdOK=x=>typeof x==='string'&&/^[a-z][a-z0-9_-]{0,63}$/i.test(x);
const pendingEventLabelOK=x=>typeof x==='string'&&x.trim().length>0&&x.length<=150;
const pendingEventTextOK=x=>typeof x==='string'&&x.trim().length>0&&x.length<=500;
const pendingEventScoreOK=x=>Number.isInteger(x)&&Math.abs(x)<=1000000;
export class PendingEventsGame extends InitiativeGame {
 constructor(state){
  super(state);
  this.s.pendingEvents ||= [];
  this.s.pendingEventDecisions ||= [];
  this.s.pendingEventHistory ||= [];
  this.turnStart=clone(this.s);this.roundStart=clone(this.s);
 }
 pendingEventsOverview(){
  return {active:clone(this.s.pendingEvents.filter(e=>e.status==='active')),
   triggered:clone(this.s.pendingEvents.filter(e=>e.status==='triggered')),
   decisions:clone(this.s.pendingEventDecisions),history:clone(this.s.pendingEventHistory.slice(-30)),
   fastForwardWarning:this.pendingEventsWarning()};
 }
 pendingEventsWarning(){
  const live=this.s.pendingEvents.filter(e=>e.status==='active'&&!['summon','persistent_area','concentration','cooldown','immediate','regeneration_suppressed','combat_mode','source_immunity'].includes(e.kind));
  if(!live.length)return null;
  return {count:live.length,ids:live.map(e=>e.id),message:`${live.length} Pending Event(s) are active. Check triggers before advancing time; conditions are adjudicated by the GM.`};
 }
 registerPendingEvent({id,label,trigger,kind='conditional',actor=null,action=null,duration={type:'indefinite'},requiresInput=true,payload=null}={}){
  this.assert(pendingEventIdOK(id)&&pendingEventLabelOK(label)&&pendingEventTextOK(trigger),'Invalid Pending Event id, label or trigger');
  this.assert(!this.s.pendingEvents.some(e=>e.id===id)&&!this.s.pendingEventHistory.some(e=>e.id===id),'Duplicate Pending Event ID');
  this.assert(['conditional','ready','held_spell','summon','persistent_area','concentration','cooldown','immediate','regeneration_suppressed','combat_mode','source_immunity'].includes(kind),'Unknown Pending Event kind');
  if(['combat_mode','source_immunity'].includes(kind)){
   this.assert(!!this.validateCombatEvent,'Combat events require combat mechanics');
   this.validateCombatEvent({kind,actor,payload,duration,requiresInput});
  }else if(kind==='concentration'){
   this.assert(!!this.validateConcentrationEvent,'Concentration requires the magic engine');
   this.validateConcentrationEvent({actor,payload,duration,requiresInput});
  }else if(['cooldown','immediate','regeneration_suppressed'].includes(kind)){
   this.validateBasicEvent?.({kind,actor,payload,duration,requiresInput});
   this.assert(!!this.validateBasicEvent,'Native event requires the encounter mechanics');
  }else if(kind==='persistent_area'){
   this.assert(typeof this.validatePersistentAreaEvent==='function','Persistent areas require the area lifecycle');
   this.validatePersistentAreaEvent({actor,payload,duration,requiresInput});
  }else if(kind==='summon'){
   this.assert(typeof this.validateSummonEvent==='function','Summons require the summon lifecycle');
   this.validateSummonEvent({actor,payload,duration,requiresInput});
  }else if(kind==='held_spell'){
   this.assert(typeof this.validateHeldSpellEvent==='function','Held spells require the magic engine');
   this.validateHeldSpellEvent({actor,payload,duration,requiresInput});
  }else if(kind==='ready'&&payload!==null){
   this.assert(typeof this.validateCounterspellEvent==='function','Counterspells require the magic engine');
   this.validateCounterspellEvent({actor,payload});
  }else this.assert(payload===null,'Only native mechanical events accept a payload');
  this.assert(typeof requiresInput==='boolean','Invalid GM input flag');
  this.assert(duration&&typeof duration==='object'&&!Array.isArray(duration),'Invalid duration');
  const d=clone(duration);
  this.assert(['indefinite','encounter','turn_start','turn_end','time','initiative'].includes(d.type),'Unsupported Pending Event duration');
  if(kind==='ready'){
   this.assert(this.s.initiative.enabled,'Readied actions require active initiative');
   this.assert(actor===this.active()?.id,'Only the active creature may Ready');
   this.assert(pendingEventTextOK(action),'Describe the readied action');
   this.assert(requiresInput,'Readied Actions must have a GM resolution checkpoint');
   this.assert(d.type==='turn_start'&&(d.actor===undefined||d.actor===actor),'Readied actions expire at the actor’s next turn');
   this.assert(!this.s.pendingEvents.some(e=>e.status==='active'&&e.kind==='ready'&&e.actor===actor),'Actor already has a Readied Action');
   this.assertSafeInitiativeEdit();
   this.assert(!this.s.pendingInitiativeEvent&&!this.s.pendingEventDecisions.length,'Resolve current GM decision first');
  }
  if(['turn_start','turn_end'].includes(d.type)){
   d.actor=d.actor||actor;
   this.find(d.actor);
  }
  if(d.type==='time'){
   const rounds=toRounds({count:d.count,unit:d.unit});
   this.assert(Number.isSafeInteger(rounds)&&rounds>=1&&rounds<=100000000,'Invalid clock duration');
   d.at=this.s.worldRounds+rounds;
   this.assert(Number.isSafeInteger(d.at),'Clock duration overflow');
  }
  if(d.type==='initiative'){
   this.assert(this.s.initiative.enabled,'Initiative duration requires active initiative');
   this.assert(Number.isInteger(d.afterRounds)&&d.afterRounds>=1&&d.afterRounds<=100000,'Invalid round duration');
   d.round=this.s.round+d.afterRounds;
   d.score=d.atScore??this.s.initiative.entries.find(e=>e.id===this.active().id)?.score;
   this.assert(pendingEventScoreOK(d.score),'Invalid initiative count');
   delete d.afterRounds;delete d.atScore;
  }
  if(['time','initiative'].includes(d.type)){
   d.onExpire ||= 'expire';
   this.assert(['expire','trigger'].includes(d.onExpire),'Invalid timer outcome');
  }
  if(kind==='ready')this.spendAction(actor,'standard','Ready: '+action.slice(0,70));
  const e={id,label:label.trim(),trigger:trigger.trim(),kind,actor,action,requiresInput,
   duration:d,status:'active',createdAt:{round:this.s.round,worldRounds:this.s.worldRounds},...(payload===null?{}:{payload:clone(payload)})};
  this.s.pendingEvents.push(e);
  this.note(`Pending Event registered: ${label} (${d.type}).`);
  return clone(e);
 }
 recordPendingHistory(event,outcome,reason=null){
  const record={id:event.id,label:event.label,kind:event.kind,outcome,reason,
   round:this.s.round,worldRounds:this.s.worldRounds};
  this.s.pendingEventHistory.push(record);
  if(this.s.pendingEventHistory.length>100)this.s.pendingEventHistory.shift();
  return record;
 }
 concludePendingEvent(event,outcome,reason){
  this.assert(this.s.pendingEvents.includes(event),'Unknown Pending Event');
  this.s.pendingEvents=this.s.pendingEvents.filter(e=>e!==event);
  this.s.pendingEventDecisions=this.s.pendingEventDecisions.filter(e=>e.id!==event.id);
  if(this.s.pendingReadyAction?.id===event.id)this.s.pendingReadyAction=null;
  const record=this.recordPendingHistory(event,outcome,reason);
  this.note(`Pending Event ${event.id}: ${outcome} (${reason||event.label}).`);
  return record;
 }
 // 'trigger' activates the *record*. It never interprets text or executes an
 // attack, spell, trap or other fictional effect.
 activatePendingEvent(e,source='gm',interrupting=this.active()?.id){
  this.assert(e?.status==='active','Pending Event is not active');
  this.assert(e.kind!=='concentration','Use maintain_concentration or stop_concentration; generic triggering is not allowed');
  this.assert(!['cooldown','immediate','regeneration_suppressed','combat_mode','source_immunity'].includes(e.kind),'This native timer expires automatically');
  this.assert(e.kind!=='persistent_area','Persistent areas trigger mechanically; cancel the event to remove the area');
  this.assert(e.kind!=='summon','Summon timers expire automatically; use GM dismissal to end one early');
  this.assert(e.kind!=='held_spell','Use spell delivery or explicit contact to discharge a held spell');
  this.assert(!e.payload?.counterspell||source==='counterspell','Use the counterspell casting checkpoint to trigger this Ready');
  e.status='triggered';e.activatedBy=source;e.triggeredAt={round:this.s.round,worldRounds:this.s.worldRounds};
  if(e.kind==='ready'){
   const init=this.s.initiative;this.assert(init.enabled,'Readied action needs initiative');
   const anchor=init.entries.find(x=>x.id===interrupting);
   const entry=init.entries.find(x=>x.id===e.actor);
   this.assert(entry&&anchor,'Readied actor and triggering creature require initiative');
   // The readied action interrupts immediately before the triggering actor's
   // activity, but is NOT a new full turn or a refreshed action budget.
   if(entry.id!==anchor.id){
    entry.score=anchor.score;
    const atScore=init.entries.filter(x=>x.score===anchor.score&&x.id!==entry.id).sort((a,b)=>a.tie-b.tie);
    const idx=atScore.findIndex(x=>x.id===anchor.id);
    atScore.splice(Math.max(0,idx),0,entry);
    atScore.forEach((x,i)=>x.tie=i);
   }
   if(!init.acted.includes(e.actor))init.acted.push(e.actor);
   this.s.pendingReadyAction={id:e.id,actor:e.actor,action:e.action,interrupting:anchor.id};
   this.note(`${e.actor}'s Readied Action triggers before ${anchor.id}; resolve the declared action by GM adjudication. Initiative position updated without granting a full turn.`);
  }else this.note(`Pending Event triggered (${source}): ${e.label}. GM adjudicates the description.`);
  if(e.requiresInput)this.s.pendingEventDecisions.push({id:e.id,label:e.label,kind:e.kind,trigger:e.trigger,action:e.action,source});
  else {this.recordPendingHistory(e,'triggered');this.s.pendingEvents=this.s.pendingEvents.filter(x=>x!==e);}
  return clone(e);
 }
 expirePendingEvent(e,reason='duration expired'){
  this.assert(e?.status==='active','Pending Event is not active');
  this.concludePendingEvent(e,'expired',reason);
  return {expired:e.id,reason};
 }
 finishPendingEvent({id,reason}={}){
  this.assert(pendingEventTextOK(reason),'GM must describe event resolution');
  const e=this.s.pendingEvents.find(x=>x.id===id&&x.status==='triggered');
  this.assert(!!e,'No triggered Pending Event by that ID');
  this.assert(!e.payload?.counterspell,'Resolve the counterspell casting checkpoint first');
  this.concludePendingEvent(e,'resolved',reason.trim());
  return {resolved:id};
 }
 // The core calls this once, at the start of the specific actor's next turn.
 onPendingTurnStart(actor){
  for(const e of [...this.s.pendingEvents]){
   if(e.status==='active'&&e.duration.type==='turn_start'&&e.duration.actor===actor)
    this.expirePendingEvent(e,'beginning of '+actor+'’s next turn');
  }
 }
 onPendingEncounterEnd(){
  for(const e of [...this.s.pendingEvents]){
   if(e.status==='active'&&(e.duration.type==='encounter'||e.kind==='ready'))this.expirePendingEvent(e,'encounter ended');
   else if(e.status==='active'&&e.duration.type==='initiative'){
    // Preserve a timed countdown outside combat, with six-second resolution.
    const remaining=Math.max(1,e.duration.round-this.s.round);
    e.duration={type:'time',at:this.s.worldRounds+remaining,onExpire:e.duration.onExpire};
    this.note(`Pending Event ${e.id} migrates to the world clock (${remaining} round(s)).`);
   }
  }
 }
 onPendingInitiativeCrossed(round,upper,lower,includeUpper){
  const due=this.s.pendingEvents.filter(e=>e.status==='active'&&e.duration.type==='initiative'&&e.duration.round===round&&
    crossedInitiative(e.duration.score,upper,lower,includeUpper))
    .sort((a,b)=>b.duration.score-a.duration.score||a.id.localeCompare(b.id));
  for(const e of due){
   if(e.duration.onExpire==='trigger')this.activatePendingEvent(e,'initiative timer');
   else this.expirePendingEvent(e,'initiative deadline');
  }
 }
 onPendingClockAdvanced(){
  const due=this.s.pendingEvents.filter(e=>e.status==='active'&&e.duration.type==='time'&&e.duration.at<=this.s.worldRounds)
   .sort((a,b)=>a.duration.at-b.duration.at||a.id.localeCompare(b.id));
  for(const e of due){if(e.duration.onExpire==='trigger')this.activatePendingEvent(e,'clock timer');
   else this.expirePendingEvent(e,'clock deadline');}
  return due.map(e=>({id:e.id,label:e.label,at:this.s.worldRounds,status:e.status}));
 }
 resumeDeferredTurnStart(){
  const context=this.s.deferredTurnStart;
  if(!context||this.turnStartBlocked())return null;
  this.assert(this.active().id===context.actor,'Deferred actor changed before resolution');
  this.s.deferredTurnStart=null;
  return {actor:context.actor,...this.finishTurnStart(context)};
 }
 // No independent six-second simulation: callbacks are invoked at existing
 // world-clock and initiative crossings.
 advanceTime(options={}){
  const warning=this.pendingEventsWarning();
  this.assert(this.s.pendingEventDecisions.length===0,'Resolve activated Pending Events before Fast Forward');
  if(warning&&!options.confirmPendingEvents){
   // Soft preflight: no time or mechanical state advances until the AI GM has
   // seen the warning.  A second, explicitly confirmed call proceeds normally.
   return {status:'pending_events_warning',clock:this.gameTime(),advancedRounds:0,
    warning,confirmation:'Repeat this Fast Forward command with confirmPendingEvents:true to proceed.'};
  }
  const result=super.advanceTime(options);
  if(warning){result.warning=warning;result.advisories=[...(result.advisories||[]),warning.message];}
  return result;
 }
 inspect(){return {...super.inspect(),pendingEvents:this.pendingEventsOverview()};}
 dispatch(command,role='actor'){
  const op=command?.op;
  const ops=['gm_get_pending_events','gm_register_pending_event','gm_trigger_pending_event','gm_resolve_pending_event','gm_cancel_pending_event'];
  if(!ops.includes(op)){
   if(op==='end_turn'&&this.s.pendingReadyAction)this.assert(false,'Resolve the triggered Readied Action before ending the interrupted turn');
   if(op==='end_turn'&&this.s.pendingEventDecisions.length)this.assert(false,'Resolve the Pending Event GM checkpoint before ending this turn');
   if(this.s.deferredTurnStart&&!isReadOnlyCommand(op)&&!['gm_acknowledge_initiative_event','gm_acknowledge_time_event','undo_turn','undo_round'].includes(op)&&
      !(op==='resolve_interrupt'&&this.s.pendingRangedAction?.kind==='spell'))
    this.assert(false,'A pre-turn Pending Event requires GM acknowledgement');
   const result=super.dispatch(command,role);
   if(['gm_acknowledge_initiative_event','gm_acknowledge_time_event'].includes(op))this.resumeDeferredTurnStart();
   return result;
  }
  this.assert(role==='gm','Only GM may administer Pending Events');
  if(op==='gm_get_pending_events')return this.pendingEventsOverview();
  return this.transaction(()=>{
   if(op==='gm_register_pending_event')return this.registerPendingEvent(command);
   if(op==='gm_trigger_pending_event'){
    const e=this.s.pendingEvents.find(x=>x.id===command.id&&x.status==='active');
    this.assert(!!e,'Unknown or inactive Pending Event');
    return this.activatePendingEvent(e,'GM trigger');
   }
   if(op==='gm_resolve_pending_event'){
    const resolved=this.finishPendingEvent(command);
    this.resumeDeferredTurnStart();return resolved;
   }
   if(op==='gm_cancel_pending_event'){
    const e=this.s.pendingEvents.find(x=>x.id===command.id);
    this.assert(!!e,'Unknown Pending Event');
    this.assert(!e.payload?.counterspell||e.status==='active','Finish the triggered counterspell before cancelling its Ready');
    const record=this.concludePendingEvent(e,'cancelled',command.reason||'GM cancellation');
    this.resumeDeferredTurnStart();return record;
   }
  });
 }
}
