/** V3.20: GM-controlled encounter initiative, not a tactical decision system.
 * Combat timestamps use round + initiative score; empty scores are skipped.
 */
import {AttackRoutinesGame} from './attack_routines.mjs';
import {clone,newTurnActions} from './core.mjs';
import {crossedInitiative,unresolvedActions,isReadOnlyCommand} from './lifecycle.mjs';
const initiativeId=x=>typeof x==='string'&&/^[a-z][a-z0-9_-]{0,63}$/i.test(x);
const validScore=x=>Number.isInteger(x)&&Math.abs(x)<=1000000;
const priority=(a,b)=>b.score-a.score||a.tie-b.tie||a.id.localeCompare(b.id);
const before=(a,b)=>priority(a,b)<0;

export class InitiativeGame extends AttackRoutinesGame {
 constructor(state){
  super(state);
  this.s.initiative ||= {enabled:false,entries:[],acted:[],delayed:[],queuedResume:null,alerts:[],pendingQueue:[]};
  this.s.initiativeEvents ||= [];
  this.s.pendingInitiativeEvent ||= null;
  this.turnStart=clone(this.s);this.roundStart=clone(this.s);
 }
 sortedInitiative(){return [...this.s.initiative.entries].sort(priority);}
 initiativeRoster(){
  const i=this.s.initiative;
  return {enabled:i.enabled,round:this.s.round,current:this.active()?.id,
   entries:this.sortedInitiative().map(e=>({...clone(e),acted:i.acted.includes(e.id),delayed:i.delayed.includes(e.id),active:this.active()?.id===e.id})),
   unranked:this.s.creatures.filter(c=>!i.entries.some(e=>e.id===c.id)).map(c=>c.id),
   queuedResume:i.queuedResume,alerts:clone(i.alerts),pending:clone(this.s.pendingInitiativeEvent),
   deadlines:clone(this.s.initiativeEvents)};
 }
 assertSafeInitiativeEdit(){
  this.assert(unresolvedActions(this.s).length===0,'Finish unresolved action before editing initiative');
 }
 beginInitiative({scores,roll=false}={}){
  this.assertSafeInitiativeEdit();
  this.assert(!this.s.initiative.enabled,'Initiative already started; use GM edits rather than restarting');
  this.assert(this.s.actions.resources.standard>=1&&this.s.actions.resources.move>=1&&this.s.actions.resources.swift>=1&&!this.s.actions.moved&&!this.s.actions.step,'Start initiative before the active creature has taken gameplay actions');
  this.assert(scores===undefined||scores!==null&&typeof scores==='object'&&!Array.isArray(scores),'Scores must map creature IDs to initiative results');
  const known=this.s.creatures.map(c=>c.id);
  if(scores)for(const id of Object.keys(scores))this.assert(known.includes(id),'Unknown initiative participant '+id);
  const entries=this.s.creatures.filter(c=>this.takesTurns(c)).map((c,idx)=>{
   let score;
   if(scores&&Object.hasOwn(scores,c.id)){score=scores[c.id];}
   else if(roll){score=this.rollDie(20)+this.stat(c.id,'initiative');}
   else throw new Error('Supply a result for each creature or use roll:true');
   this.assert(validScore(score),'Initiative result must be an integer');
   return {id:c.id,score,tie:idx,modifier:this.stat(c.id,'initiative')};
  });
  // Tie-breaker uses initiative modifier; if still tied, the GM may reorder.
  entries.sort((a,b)=>b.score-a.score||b.modifier-a.modifier||a.tie-b.tie);
  entries.forEach((e,idx)=>e.tie=idx);
  const previousActor=this.active()?.id;
  this.s.initiative={enabled:true,entries,acted:[],delayed:[],queuedResume:null,alerts:[],pendingQueue:[]};
  this.s.turn=this.s.creatures.findIndex(c=>c.id===entries[0].id);
  this.s.actions=newTurnActions();
  if(this.s.encounterStarted&&previousActor!==this.active().id){
   this.emit('turn_start',{actor:this.active().id});this.syncZones();
   this.note('GM advisory: initiative started after encounter activation; review start-of-turn effects on the previous actor.');
  }
  this.note(`Initiative established: ${entries.map(e=>`${e.id} ${e.score}`).join(', ')}. ${this.active().name} acts.`);
  this.turnStart=clone(this.s);this.roundStart=clone(this.s);
  return this.initiativeRoster();
 }
 setInitiative({id,score}={}){
  this.assert(this.takesTurns(this.find(id)),'Objects do not take turns');this.assert(validScore(score),'Invalid initiative score');
  const init=this.s.initiative;this.assert(init.enabled,'Begin initiative first');
  let entry=init.entries.find(e=>e.id===id);
  if(!entry){entry={id,score,tie:Math.max(0,...init.entries.map(e=>e.tie))+1};init.entries.push(entry);}
  else entry.score=score;
  this.note(`GM sets ${this.find(id).name}'s initiative to ${score} (no retroactive extra turn).`);
  return this.initiativeRoster();
 }
 moveInitiativeAfter({id,afterId}={}){
  this.assert(id!==afterId,'Cannot position combatant after themselves');
  const init=this.s.initiative;this.assert(init.enabled,'Begin initiative first');
  const entry=init.entries.find(e=>e.id===id),anchor=init.entries.find(e=>e.id===afterId);
  this.assert(entry&&anchor,'Both combatants need initiative entries');
  const sorted=this.sortedInitiative().filter(e=>e.id!==id);
  const pos=sorted.findIndex(e=>e.id===afterId);
  const next=sorted[pos+1];
  entry.score=anchor.score;
  // Normalize tie indices to avoid fractional precision erosion on repeated edits.
  const reordered=sorted.slice();reordered.splice(pos+1,0,entry);
  let tie=0;
  for(const e of reordered){if(e.score===entry.score)e.tie=tie++;}
  this.note(`GM positions ${id} immediately after ${afterId} on initiative ${entry.score}.`);
  return this.initiativeRoster();
 }
 delayTurn(){
  const init=this.s.initiative;this.assert(init.enabled,'Begin initiative first');
  this.assert(this.s.actions.resources.standard===1&&this.s.actions.resources.move===1&&
   this.s.actions.resources.swift===1&&!this.s.actions.moved&&!this.s.actions.step,
   'Delay must be declared before taking actions');
  const id=this.active().id;
  this.assert(!init.delayed.includes(id),'Creature already delaying');
  init.delayed.push(id);
  this.note(`${this.active().name} delays; GM may queue resumption after a later turn.`);
  return this.endTurn();
 }
 queueDelayedResume(id){
  const init=this.s.initiative;this.assert(init.enabled&&init.delayed.includes(id),'Only a delaying creature can resume');
  this.assert(id!==this.active().id,'Delayed creature cannot resume into its current turn');
  init.queuedResume=id;
  this.note(`GM queues ${id} to resume immediately after the current turn ends.`);
  return this.initiativeRoster();
 }
 // Process crossings in descending initiative order, including empty initiative counts.
 processInitiativeEvents(round,upper,lower,includeUpper=false){
  const triggered=[];
  this.onPendingInitiativeCrossed?.(round,upper,lower,includeUpper);
  for(const e of [...this.s.initiativeEvents]){
   if(e.round!==round || !crossedInitiative(e.score,upper,lower,includeUpper))continue;
   triggered.push(e);
   this.s.initiativeEvents=this.s.initiativeEvents.filter(v=>v.id!==e.id);
  }
  triggered.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  for(const e of triggered){
   const notice={id:e.id,label:e.label,round:e.round,score:e.score,requiresInput:e.requiresInput};
   if(e.expireEffectId){
    if(this.s.effects.some(effect=>effect.id===e.expireEffectId))this.removeEffect(e.expireEffectId,{countAsAction:false});
    notice.expiredEffect=e.expireEffectId;
   }
   this.s.initiative.alerts.push(notice);
   this.note(`Initiative ${e.score} (round ${e.round}): ${e.label}${e.requiresInput?' [GM decision required]':''}.`);
   if(e.requiresInput){
    if(!this.s.pendingInitiativeEvent)this.s.pendingInitiativeEvent=clone(notice);
    else this.s.initiative.pendingQueue.push(clone(notice));
   }
  }
  return triggered;
 }
 advanceInitiativeCursor(){
  const init=this.s.initiative;
  const current=this.active().id;
  const old=init.entries.find(e=>e.id===current);
  this.assert(!!old,'Current creature is not on initiative roster');
  if(!init.delayed.includes(current)&&!init.acted.includes(current))init.acted.push(current);
  let next=null;
  if(init.queuedResume){
   const id=init.queuedResume;init.queuedResume=null;
   next=init.entries.find(e=>e.id===id);
   this.assert(!!next&&init.delayed.includes(id),'Queued delay is invalid');
   init.delayed=init.delayed.filter(x=>x!==id);
   init.acted=init.acted.filter(x=>x!==id);
   // Delay changes initiative permanently to the resumed place in the sequence.
   const sorted=this.sortedInitiative().filter(e=>e.id!==id);
   const idx=sorted.findIndex(e=>e.id===current);
   const revised=[...sorted];revised.splice(idx+1,0,next);
   next.score=old.score;
   let tie=0;for(const e of revised)if(e.score===old.score)e.tie=tie++;
  }
  if(!next){
   next=this.sortedInitiative().find(e=>!init.acted.includes(e.id)&&!init.delayed.includes(e.id)&&before(old,e));
  }
  init.alerts=[];
  if(next){
   this.processInitiativeEvents(this.s.round,old.score,next.score);
  } else {
   // No unacted combatant below the current position: close this round and
   // process any remaining deadlines, without walking through empty counts.
   this.processInitiativeEvents(this.s.round,old.score,-Infinity);
   this.s.round++;
   init.acted=[];
   next=this.sortedInitiative().find(e=>!init.delayed.includes(e.id));
   // When everyone is delaying, the just-ended creature is allowed to act again
   // next round rather than entering an infinite empty-round loop.
   if(!next){
    next=init.entries.find(e=>e.id===current);
    init.delayed=init.delayed.filter(id=>id!==current);
    this.note('All combatants were delaying; the last actor resumes at the new round (GM may adjudicate).');
   }
   this.processInitiativeEvents(this.s.round,Infinity,next.score,true);
  }
  this.s.turn=this.s.creatures.findIndex(c=>c.id===next.id);
  this.assert(this.s.turn>=0,'Next initiative creature is no longer registered');
 }
 scheduleInitiativeEvent({id,label,afterRounds,atScore=null,requiresInput=false,expireEffectId=null}={}){
  const init=this.s.initiative;this.assert(init.enabled,'Begin initiative first');
  this.assert(initiativeId(id)&&!this.s.initiativeEvents.some(x=>x.id===id),'Invalid or duplicate initiative event ID');
  this.assert(typeof label==='string'&&label.length>=1&&label.length<=150,'Invalid event label');
  this.assert(Number.isInteger(afterRounds)&&afterRounds>=1&&afterRounds<=100000,'Duration must be 1–100000 rounds');
  this.assert(typeof requiresInput==='boolean','Invalid decision flag');
  const at=atScore===null?init.entries.find(e=>e.id===this.active().id)?.score:atScore;
  this.assert(validScore(at),'Invalid initiative event score');
  if(expireEffectId!==null){
   const effect=this.s.effects.find(e=>e.id===expireEffectId);
   this.assert(!!effect,'Unknown effect to expire');
   this.assert(!this.s.initiativeEvents.some(e=>e.expireEffectId===expireEffectId),'Effect already has an initiative deadline');
   effect.remaining=null;effect.initiativeTimed=true;
  }
  const e={id,label,round:this.s.round+afterRounds,score:at,requiresInput,expireEffectId};
  this.s.initiativeEvents.push(e);
  this.note(`GM schedules ${label}: round ${e.round}, before initiative ${at}.`);
  return clone(e);
 }
 // Shared migration also handles the last initiative participant departing.
 finishInitiative(){
    const outstanding=clone(this.s.initiativeEvents),converted=[];
    // Preserve unfinished rounds-long effects and GM events on the world clock.
    // Only initiative sub-round ordering is lost outside combat (six-second precision).
    for(const e of outstanding){
     const remaining=Math.max(1,e.round-this.s.round);
     if(e.expireEffectId){
      const effect=this.s.effects.find(x=>x.id===e.expireEffectId);
      if(effect){effect.initiativeTimed=false;effect.remaining=remaining;}
      converted.push({id:e.id,kind:'timed_effect',remainingRounds:remaining});
     }else{
      let id=e.id,seq=0;
      while(this.s.scheduledTimeEvents.some(x=>x.id===id))id=`init_${e.id}_${++seq}`;
      this.scheduleTimeEvent({id,label:e.label,after:{count:remaining,unit:'round'},requiresInput:e.requiresInput});
      converted.push({id,kind:'world_event',remainingRounds:remaining});
     }
    }
    this.onPendingEncounterEnd?.();
    this.s.initiative.enabled=false;this.s.initiative.delayed=[];this.s.initiative.queuedResume=null;
    this.s.initiativeEvents=[];this.s.actions=newTurnActions();
    this.note(`GM ends initiative; migrated ${converted.length} unresolved deadline(s) to world-clock time.`);
    return {ended:true,converted,clock:this.gameTime()};
 }
 assertTimeIdle(){super.assertTimeIdle();this.assert(!this.s.initiative.enabled,'End encounter initiative before Fast Forward; combat time advances at round boundaries');}
 inspect(){return {...super.inspect(),initiative:this.initiativeRoster()};}
 dispatch(command,role='actor'){
  const op=command?.op;
  const ops=['gm_begin_initiative','gm_get_initiative','gm_set_initiative','gm_move_initiative_after','delay_turn','gm_queue_delay_resume',
   'gm_schedule_initiative_event','gm_cancel_initiative_event','gm_acknowledge_initiative_event','gm_end_initiative'];
  if(!ops.includes(op)){
   if(this.s.pendingInitiativeEvent&&!isReadOnlyCommand(op)&&!['undo_turn','undo_round','gm_acknowledge_time_event'].includes(op))
    this.assert(false,'A pending initiative event requires GM acknowledgement');
   return super.dispatch(command,role);
  }
  this.assert(['gm','actor','player'].includes(role),'Unknown role');
  if(role==='player'&&op==='delay_turn')this.assert(this.active()?.id==='hero','Player may only control Explorer');
  if(op!=='delay_turn')this.assert(role==='gm','Initiative editing requires GM authority');
  if(op==='gm_get_initiative')return this.initiativeRoster();
  if(['gm_begin_initiative','delay_turn','gm_end_initiative'].includes(op))this.assertSafeInitiativeEdit();
  return this.transaction(()=>{
   if(op==='gm_begin_initiative')return this.beginInitiative(command);
   if(op==='gm_end_initiative'){
    this.assert(this.s.initiative.enabled,'Initiative is not active');
    this.assert(!this.s.pendingInitiativeEvent,'Resolve pending initiative decision before ending encounter');
    return this.finishInitiative();
   }
   if(op==='gm_set_initiative')return this.setInitiative(command);
   if(op==='gm_move_initiative_after')return this.moveInitiativeAfter(command);
   if(op==='delay_turn')return this.delayTurn();
   if(op==='gm_queue_delay_resume')return this.queueDelayedResume(command.id);
   if(op==='gm_schedule_initiative_event')return this.scheduleInitiativeEvent(command);
   if(op==='gm_cancel_initiative_event'){
    const e=this.s.initiativeEvents.find(e=>e.id===command.id);
    this.assert(!!e,'Unknown initiative event');
    if(e.expireEffectId){const effect=this.s.effects.find(x=>x.id===e.expireEffectId);if(effect)effect.initiativeTimed=false;}
    this.s.initiativeEvents=this.s.initiativeEvents.filter(x=>x.id!==e.id);
    return {cancelled:e.id};
   }
   if(op==='gm_acknowledge_initiative_event'){
    const e=this.s.pendingInitiativeEvent;this.assert(!!e,'No pending initiative event');
    this.assert(typeof command.reason==='string'&&command.reason.trim().length>0,'GM acknowledgement requires a reason');
    this.s.pendingInitiativeEvent=this.s.initiative.pendingQueue.shift()||null;this.note(`GM resolves initiative event ${e.id}: ${command.reason}`);
    return {resolved:e.id};
   }
   throw new Error('Unsupported initiative command');
  });
 }
}
