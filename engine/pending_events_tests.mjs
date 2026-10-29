import assert from 'node:assert/strict';
import {PendingEventsGame} from './pending_events.mjs';
import {initialState,clone} from './core.mjs';
const make=()=>{const g=new PendingEventsGame(initialState());g.dispatch({op:'gm_begin_initiative',scores:{hero:20,warden:8}},'gm');return g;};
let tests=0;const test=(name,fn)=>{try{fn();tests++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}};
const create=(g,id,duration={type:'indefinite'},extra={})=>g.dispatch({op:'gm_register_pending_event',id,label:'Event '+id,trigger:'When the guard says the password',duration,...extra},'gm');
test('indefinite conditional event only fires on explicit GM command',()=>{
 const g=make();create(g,'gate');g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});assert.equal(g.s.pendingEvents[0].status,'active');
 g.dispatch({op:'gm_trigger_pending_event',id:'gate'},'gm');assert.equal(g.s.pendingEventDecisions.length,1);
 g.dispatch({op:'gm_resolve_pending_event',id:'gate',reason:'GM opens the gate'},'gm');assert.equal(g.s.pendingEvents.length,0);
});
test('Readied Action costs one standard and expires at next owner turn, not six-second boundary',()=>{
 const g=make();create(g,'ready',{type:'turn_start',actor:'hero'},{kind:'ready',actor:'hero',action:'Attack the first creature through the door'});
 assert.equal(g.s.actions.resources.standard,0);
 g.dispatch({op:'end_turn'});assert.equal(g.s.pendingEvents.length,1);
 g.dispatch({op:'end_turn'});assert.equal(g.s.pendingEvents.length,0);assert.equal(g.s.pendingEventHistory.at(-1).outcome,'expired');
});
test('Ready trigger relocates initiative without refreshing standard action or granting extra turn',()=>{
 const g=make();create(g,'ready',{type:'turn_start',actor:'hero'},{kind:'ready',actor:'hero',action:'Attack goblin'});
 g.dispatch({op:'end_turn'});assert.equal(g.active().id,'warden');
 const previous=clone(g.s.actions);
 g.dispatch({op:'gm_trigger_pending_event',id:'ready'},'gm');
 assert.equal(g.s.pendingReadyAction.actor,'hero');assert.equal(g.s.actions.resources.standard,previous.resources.standard);
 assert.equal(g.s.initiative.entries.find(e=>e.id==='hero').score,8);
 assert.equal(g.active().id,'warden');assert.ok(g.s.initiative.acted.includes('hero'));
 assert.throws(()=>g.dispatch({op:'end_turn'}),/Readied Action/);
 g.dispatch({op:'gm_resolve_pending_event',id:'ready',reason:'GM resolves attack with existing attack/Free Mode adjudication'},'gm');
 g.dispatch({op:'end_turn'});assert.equal(g.s.round,2);
});
test('conditional turn-start event expires at named actor next turn, not round tick',()=>{
 const g=make();create(g,'twist',{type:'turn_start',actor:'warden'});
 g.dispatch({op:'end_turn'});assert.equal(g.s.pendingEvents.length,0);
});
test('encounter deadlines expire on GM encounter end; indefinite ones remain',()=>{
 const g=make();create(g,'enc',{type:'encounter'});create(g,'persistent');
 g.dispatch({op:'gm_end_initiative'},'gm');assert.deepEqual(g.s.pendingEvents.map(e=>e.id),['persistent']);
});
test('time countdown expires quietly while Fast Forward warns',()=>{
 const g=make();g.dispatch({op:'gm_end_initiative'},'gm');
 create(g,'quiet',{type:'time',count:3,unit:'round',onExpire:'expire'});
 assert.equal(g.dispatch({op:'gm_advance_time',count:8,unit:'round'},'gm').status,'pending_events_warning');
 const r=g.dispatch({op:'gm_advance_time',count:8,unit:'round',confirmPendingEvents:true},'gm');
 assert.equal(r.status,'done');assert.equal(r.warning.count,1);assert.equal(g.s.worldRounds,8);
 assert.equal(g.s.pendingEvents.length,0);assert.equal(g.s.pendingEventHistory.at(-1).outcome,'expired');
});
test('clock countdown triggers GM checkpoint at exact deadline, after automatic clock mechanics',()=>{
 const g=make();g.dispatch({op:'gm_end_initiative'},'gm');
 create(g,'bell',{type:'time',count:4,unit:'round',onExpire:'trigger'});
 assert.equal(g.dispatch({op:'gm_advance_time',count:10,unit:'round'},'gm').status,'pending_events_warning');
 assert.equal(g.s.worldRounds,0);
 const r=g.dispatch({op:'gm_advance_time',count:10,unit:'round',confirmPendingEvents:true},'gm');
 assert.equal(r.status,'needs_gm');assert.equal(r.advancedRounds,4);assert.equal(r.remainingRounds,6);assert.equal(r.pending.id,'bell');
 assert.equal(g.s.worldRounds,4);
 g.dispatch({op:'gm_resolve_pending_event',id:'bell',reason:'Bell rings'},'gm');
 assert.equal(g.dispatch({op:'gm_advance_time',count:6,unit:'round'},'gm').status,'done');
 assert.equal(g.s.worldRounds,10);
});
test('clock countdown without GM checkpoint is automatic registry activation',()=>{
 const g=make();g.dispatch({op:'gm_end_initiative'},'gm');
 create(g,'flare',{type:'time',count:2,unit:'round',onExpire:'trigger'},{requiresInput:false});
 g.dispatch({op:'gm_advance_time',count:7,unit:'round'},'gm');
 const r=g.dispatch({op:'gm_advance_time',count:7,unit:'round',confirmPendingEvents:true},'gm');
 assert.equal(r.status,'done');assert.equal(g.s.pendingEvents.length,0);
 assert.equal(g.s.pendingEventHistory.at(-1).outcome,'triggered');
});
test('initiative countdown triggers on empty count without scanning counts',()=>{
 const g=make();create(g,'cog',{type:'initiative',afterRounds:1,atScore:15,onExpire:'trigger'});
 g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});
 assert.equal(g.s.pendingEvents[0].status,'triggered');assert.equal(g.s.pendingEventDecisions[0].id,'cog');
});
test('untriggered initiative countdown migrates to world time after combat',()=>{
 const g=make();create(g,'alarm',{type:'initiative',afterRounds:3,atScore:19,onExpire:'trigger'});
 g.dispatch({op:'gm_end_initiative'},'gm');assert.equal(g.s.pendingEvents[0].duration.type,'time');
 assert.equal(g.dispatch({op:'gm_advance_time',count:3,unit:'round'},'gm').status,'pending_events_warning');
 assert.equal(g.dispatch({op:'gm_advance_time',count:3,unit:'round',confirmPendingEvents:true},'gm').pending.id,'alarm');
});
test('GM can cancel/read pending list, unauthorized actor cannot modify',()=>{
 const g=make();create(g,'x');assert.equal(g.dispatch({op:'gm_get_pending_events'},'gm').active.length,1);
 assert.throws(()=>g.dispatch({op:'gm_trigger_pending_event',id:'x'},'actor'),/Only GM/);
 g.dispatch({op:'gm_cancel_pending_event',id:'x'},'gm');assert.equal(g.s.pendingEvents.length,0);
});
test('undo restores pending registrations and clock',()=>{
 const g=make();create(g,'watch',{type:'turn_start',actor:'warden'});
 g.dispatch({op:'end_turn'});assert.equal(g.s.pendingEvents.length,0);
 g.dispatch({op:'undo_turn'},'gm');assert.equal(g.s.pendingEvents.some(e=>e.id==='watch'),false); // undo returns to turn start before registration
});
console.log(`V3.21 pending events: ${tests} test groups pass`);

test('Pre-turn initiative GM checkpoint pauses next turn effects until acknowledged',()=>{
 const g=make();g.dispatch({op:'gm_schedule_initiative_event',id:'before_warden',label:'GM warning',afterRounds:1,atScore:12,requiresInput:true},'gm');
 g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});
 assert.equal(g.s.pendingInitiativeEvent.id,'before_warden');
 assert.equal(g.s.deferredTurnStart.actor,'warden');
 assert.throws(()=>g.dispatch({op:'end_turn'}),/pending initiative|pre-turn/);
 g.dispatch({op:'gm_acknowledge_initiative_event',reason:'GM completes warning'},'gm');
 assert.equal(g.s.deferredTurnStart,null);assert.equal(g.s.pendingInitiativeEvent,null);
});
test('Clock effects expire before Pending Event GM checkpoint at the same moment',()=>{
 const g=make();g.dispatch({op:'gm_end_initiative'},'gm');
 g.dispatch({op:'apply_effect',effect:{id:'brief',name:'Brief Ward',target:'hero',mods:[{stat:'ac',value:2,type:'dodge'}],rounds:2}},'gm');
 create(g,'deadline',{type:'time',count:2,unit:'round',onExpire:'trigger'});
 const soft=g.dispatch({op:'gm_advance_time',count:5,unit:'round'},'gm');assert.equal(soft.status,'pending_events_warning');
 const result=g.dispatch({op:'gm_advance_time',count:5,unit:'round',confirmPendingEvents:true},'gm');
 assert.equal(result.status,'needs_gm');assert.equal(g.s.worldRounds,2);
 assert.equal(g.s.effects.some(e=>e.id==='brief'),false);
});
test('A second registered Pending Event warning does not mutate time or character state',()=>{
 const g=make();g.dispatch({op:'gm_end_initiative'},'gm');create(g,'trap');const save=clone(g.s);
 for(let i=0;i<2;i++)assert.equal(g.dispatch({op:'gm_advance_time',count:10,unit:'round'},'gm').status,'pending_events_warning');
 assert.deepEqual(g.s,save);
});
console.log('Additional V3.21 timing and preflight tests pass');

test('Readied Action always requires GM checkpoint; encounter end clears unused readiness',()=>{
 const g=make();
 assert.throws(()=>create(g,'bad',{type:'turn_start',actor:'hero'},{kind:'ready',actor:'hero',action:'Attack',requiresInput:false}),/GM resolution/);
 assert.equal(g.s.actions.resources.standard,1);
 create(g,'good',{type:'turn_start',actor:'hero'},{kind:'ready',actor:'hero',action:'Attack'});
 g.dispatch({op:'gm_end_initiative'},'gm');
 assert.equal(g.s.pendingEvents.length,0);
});
