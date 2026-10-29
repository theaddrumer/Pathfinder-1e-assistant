/** V3.17: encounter-independent game clock and chronological event stepping.
 * The GM selects activities and can schedule narrative decision points. This
 * engine only advances time and resolves explicitly registered mechanics.
 */
import {DefenseGame} from './defense.mjs';
import {clone} from './core.mjs';
import {toRounds} from './ailments.mjs';
import {clockDeadlines,unresolvedActions,unresolvedDecisions} from './lifecycle.mjs';
const timeInt=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
const eventId=id=>typeof id==='string'&&/^[a-z][a-z0-9_-]{0,63}$/i.test(id);
const HOUR=600, DAY=14400;
export function describeGameClock(worldRounds,offset=0){
 const t=worldRounds+offset,day=Math.floor(t/DAY)+1,within=((t%DAY)+DAY)%DAY;
 const hour=Math.floor(within/HOUR),minute=Math.floor(within%HOUR/10),seconds=(within%10)*6;
 return {worldRounds,elapsedSeconds:worldRounds*6,day,hour,minute,second:seconds,
  label:`Day ${day}, ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`};
}
export class TimeGame extends DefenseGame{
 constructor(state){
  super(state);this.s.scheduledTimeEvents ||= [];this.s.pendingTimeEvent ||= null;
  this.s.clockOffsetRounds ??= 0;this.s.timeEventSeq ||= 0;
 }
 gameTime(){return describeGameClock(this.s.worldRounds,this.s.clockOffsetRounds);}
 assertTimeIdle(){this.assert(unresolvedActions(this.s).length===0,'Finish the current combat action before advancing time');}
 // One AI-facing view across timing owners: useful for diagnosis and host adapters.
 lifecycleStatus(){
  const effectIds=new Set((this.s.effects||[]).map(e=>e.id));
  return {clock:this.gameTime(),combatRound:this.s.round,initiativeActive:!!this.s.initiative?.enabled,
   deadlines:clockDeadlines(this.s),initiativeDeadlines:clone(this.s.initiativeEvents||[]),
   pendingEvents:clone((this.s.pendingEvents||[]).map(e=>({id:e.id,label:e.label,status:e.status,duration:e.duration}))),
   unresolvedActions:unresolvedActions(this.s),unresolvedDecisions:unresolvedDecisions(this.s),
   orphanInitiativeExpiries:(this.s.initiativeEvents||[]).filter(e=>e.expireEffectId&&!effectIds.has(e.expireEffectId)).map(e=>e.id)};
 }
 eventTimes(){return clockDeadlines(this.s).map(e=>e.at);}
 nextTimeEvent(){
  const times=this.eventTimes();const due=times.length?Math.max(this.s.worldRounds,Math.min(...times)):null;
  if(due===null)return null;
  const first=this.s.scheduledTimeEvents.filter(x=>x.at===due).map(x=>({kind:'gm_event',id:x.id,label:x.label,requiresInput:x.requiresInput}));
  return {at:due,inRounds:due-this.s.worldRounds,clock:describeGameClock(due,this.s.clockOffsetRounds),scheduled:first};
 }
 scheduleTimeEvent({id,label,after,requiresInput=true}={}){
  this.assert(eventId(id)&&typeof label==='string'&&label.length>0&&label.length<=150,'Invalid event identity');
  this.assert(typeof requiresInput==='boolean','Invalid event decision flag');
  this.assert(!this.s.scheduledTimeEvents.some(e=>e.id===id)&&this.s.pendingTimeEvent?.id!==id,'Duplicate event ID');
  const rounds=toRounds(after);const at=this.s.worldRounds+rounds;
  this.assert(Number.isSafeInteger(at),'Event exceeds supported clock range');
  this.s.scheduledTimeEvents.push({id,label,at,requiresInput});
  this.s.scheduledTimeEvents.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
  this.note(`GM schedules ${label} at ${describeGameClock(at,this.s.clockOffsetRounds).label}.`);
  return {id,at,clock:describeGameClock(at,this.s.clockOffsetRounds),requiresInput};
 }
 // Exactly one abstract event step per deadline. There is never a six-second-round loop.
 advanceTime({count,unit,stopAtNext=false}={}){
  this.assertTimeIdle();this.assert(!this.s.pendingTimeEvent,'A scheduled GM decision is pending; acknowledge it first');
  let requested;
  if(stopAtNext){const next=this.nextTimeEvent();this.assert(!!next,'No scheduled mechanical events');requested=next.inRounds;}
  else requested=toRounds({count,unit});
  this.assert(timeInt(requested,0,100000000),'Invalid downtime interval');
  const start=this.s.worldRounds,end=start+requested;
  this.assert(Number.isSafeInteger(end),'Clock overflow');
  const log=[],ticks=[],negativeLevelSaves=[],expiredEffects=[],expiredTempHp=[],scheduled=[];
  let iterations=0;
  while(this.s.worldRounds<end || (stopAtNext&&this.eventTimes().some(t=>t<=this.s.worldRounds))){
   this.assert(++iterations<=20000,'Too many scheduled events: advance time in smaller intervals');
   const now=this.s.worldRounds;
   const times=this.eventTimes().filter(t=>t<=end);
   const at=times.length?Math.max(now,Math.min(...times)):end;
   const diff=at-now;
   this.s.worldRounds=at;
   if(diff){
    for(const e of this.s.effects)if(e.remaining!==null)e.remaining=Math.max(0,e.remaining-diff);
    // Legacy automation marks use combat-round relative expiries; shift their
    // remaining lifespan without altering the combat turn or round counter.
    for(const mark of this.s.marks||[])mark.expiresRound-=diff;
    this.s.marks=(this.s.marks||[]).filter(m=>m.expiresRound>this.s.round);
   }
   const moment=this.gameTime();
   this.onClockExpirations?.();
   // Deterministic simultaneous-event order: expiry, affliction, recovery,
   // explicit GM events. Expired penalties must not modify later saves.
   for(const e of [...this.s.effects])if(e.remaining===0){
    expiredEffects.push({id:e.id,name:e.name,target:e.target,at});this.removeEffect(e.id,{countAsAction:false});
   }
   for(const [target,pools] of Object.entries(this.s.energyTempHp||{}))for(const p of pools)
    if(p.amount>0&&p.expiresAt<=at)expiredTempHp.push({target,amount:p.amount,at});
   this.expireEnergyTempHp();
   const ailments=this.processDueAilments({maxIterations:20000});
   for(const t of ailments)ticks.push({...t,at});
   const saves=this.processNegativeLevelSaves();
   for(const s of saves)negativeLevelSaves.push({...s,at});
   // Calculator-owned timers resolve even if a different GM event at this
   // instant requires acknowledgement; do not batch them at round start.
   const pendingEvents=this.onPendingClockAdvanced?.()||[];
   const pendingDecision=this.s.pendingEventDecisions?.[0];
   if(pendingDecision){
    this.note('Fast Forward stops for Pending Event adjudication: '+pendingDecision.label);
    return {status:'needs_gm',clock:moment,advancedRounds:at-start,remainingRounds:end-at,
     pending:clone(pendingDecision),ticks,negativeLevelSaves,expiredEffects,expiredTempHp,scheduled,pendingEvents};
   }
   const checkpoint=this.timeCheckpoint?.();
   if(checkpoint)return {status:'needs_gm',clock:moment,advancedRounds:at-start,remainingRounds:end-at,
    pending:checkpoint,ticks,negativeLevelSaves,expiredEffects,expiredTempHp,scheduled,pendingEvents};
   const due=this.s.scheduledTimeEvents.filter(e=>e.at<=at);
   this.s.scheduledTimeEvents=this.s.scheduledTimeEvents.filter(e=>e.at>at);
   for(const e of due){
    const record={id:e.id,label:e.label,at,clock:moment,requiresInput:e.requiresInput};
    scheduled.push(record);this.note(`Scheduled event: ${e.label} (${moment.label}).`);
    if(e.requiresInput){
     this.s.pendingTimeEvent=record;
     // All events at the same instant must be retained for subsequent review.
     for(const other of due.slice(due.indexOf(e)+1))this.s.scheduledTimeEvents.push(other);
     this.s.scheduledTimeEvents.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
     this.note(`Time advancement stops for GM input: ${e.label}.`);
     return {status:'needs_gm',clock:moment,advancedRounds:at-start,remainingRounds:end-at,
      pending:clone(record),ticks,negativeLevelSaves,expiredEffects,expiredTempHp,scheduled};
    }
   }
   if(at===end)break;
  }
  this.note(`GM advances time by ${this.s.worldRounds-start} round(s) to ${this.gameTime().label}; resolved ${ticks.length} ailment tick(s), ${negativeLevelSaves.length} negative-level save(s), ${expiredEffects.length} expired effect(s).`);
  return {status:'done',clock:this.gameTime(),advancedRounds:this.s.worldRounds-start,remainingRounds:0,
   ticks,negativeLevelSaves,expiredEffects,expiredTempHp,scheduled};
 }
 // Drain due noninteractive events and expose one decision at a time.
 // Called before turn effects; acknowledgement resumes the same turn-start path.
 processDueTimeEvents(){
  const resolved=[];
  while(!this.s.pendingTimeEvent){
   const event=this.s.scheduledTimeEvents.find(e=>e.at<=this.s.worldRounds);
   if(!event)break;
   this.s.scheduledTimeEvents=this.s.scheduledTimeEvents.filter(e=>e!==event);
   const record={...event,clock:this.gameTime()};resolved.push(record);
   if(event.requiresInput)this.s.pendingTimeEvent=record;
   this.note(`Scheduled event ${event.label} occurs at ${this.gameTime().label}${event.requiresInput?' (GM input required)':''}.`);
  }
  return resolved;
 }
 inspect(){return {...super.inspect(),gameClock:this.gameTime(),scheduledTimeEvents:clone(this.s.scheduledTimeEvents),pendingTimeEvent:clone(this.s.pendingTimeEvent),nextTimeEvent:this.nextTimeEvent()};}
 dispatch(command,role='actor'){
  const op=command?.op;
  if(!['gm_advance_time','gm_advance_to_event','gm_get_lifecycle','gm_get_game_clock','gm_set_game_clock','gm_schedule_time_event','gm_cancel_time_event','gm_acknowledge_time_event'].includes(op))return super.dispatch(command,role);
  this.assert(role==='gm','Only GM may manage time');
  if(op==='gm_get_lifecycle')return this.lifecycleStatus();
  if(op==='gm_get_game_clock')return {clock:this.gameTime(),next:this.nextTimeEvent(),pending:clone(this.s.pendingTimeEvent)};
  return this.transaction(()=>{
   if(op==='gm_advance_time')return this.advanceTime(command);
   if(op==='gm_advance_to_event')return this.advanceTime({stopAtNext:true,confirmPendingEvents:command.confirmPendingEvents===true,maintainConcentration:command.maintainConcentration});
   if(op==='gm_set_game_clock'){
    const {day,hour=0,minute=0}=command;
    this.assert(timeInt(day,1,10000000)&&timeInt(hour,0,23)&&timeInt(minute,0,59),'Invalid game calendar date or time');
    const offset=(day-1)*DAY+hour*HOUR+minute*10-this.s.worldRounds;
    this.s.clockOffsetRounds=offset;this.note(`GM sets calendar display to ${this.gameTime().label} without advancing elapsed time.`);
    return {clock:this.gameTime()};
   }
   if(op==='gm_schedule_time_event')return this.scheduleTimeEvent(command);
   if(op==='gm_cancel_time_event'){
    const prev=this.s.scheduledTimeEvents.length;
    this.s.scheduledTimeEvents=this.s.scheduledTimeEvents.filter(x=>x.id!==command.id);
    this.assert(this.s.scheduledTimeEvents.length!==prev,'Unknown scheduled event');
    this.note(`GM cancels scheduled event ${command.id}.`);return {cancelled:command.id};
   }
   this.assert(op==='gm_acknowledge_time_event','Unknown time command');
   this.assert(!!this.s.pendingTimeEvent,'No pending GM time event');
   this.assert(typeof command.reason==='string'&&command.reason.trim().length>0&&command.reason.length<=500,'GM must supply the event resolution or acknowledgement');
   const p=this.s.pendingTimeEvent;this.s.pendingTimeEvent=null;
   if(this.s.deferredTurnStart)this.processDueTimeEvents();
   this.note(`GM resolves time event ${p.label}: ${command.reason.trim()}`);
   return {resolved:p.id,clock:this.gameTime()};
  });
 }
}
