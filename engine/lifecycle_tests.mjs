import assert from 'node:assert/strict';
import {MagicGame} from './magic.mjs';
import {initialState,clone} from './core.mjs';
import {clockDeadlines,crossedInitiative,unresolvedActions,unresolvedDecisions} from './lifecycle.mjs';
let count=0;const test=(label,fn)=>{try{fn();count++;console.log('PASS',label);}catch(e){console.error('FAIL',label);throw e;}};
const make=()=>{const s=initialState();s.tiles={};return new MagicGame(s);};
const gm=(g,cmd)=>g.dispatch(cmd,'gm');
test('unified deadline index orders different sources without changing native records',()=>{
 const g=make();
 gm(g,{op:'apply_effect',effect:{id:'ward',name:'Ward',target:'hero',mods:[{stat:'ac',value:2,type:'dodge'}],rounds:4}});
 gm(g,{op:'gm_schedule_time_event',id:'bell',label:'Bell',after:{count:3,unit:'round'},requiresInput:false});
 gm(g,{op:'gm_register_pending_event',id:'flare',label:'Flare',trigger:'Candle burns down',duration:{type:'time',count:2,unit:'round',onExpire:'expire'}});
 const before=clone(g.s);const deadlines=clockDeadlines(g.s);
 assert.deepEqual(deadlines.filter(x=>['modifier','gm_event','pending_event'].includes(x.kind)).map(x=>[x.kind,x.id,x.at]),
  [['pending_event','flare',2],['gm_event','bell',3],['modifier','ward',4]]);
 assert.deepEqual(g.eventTimes(),deadlines.map(x=>x.at));assert.deepEqual(clone(g.s),before);
 const status=gm(g,{op:'gm_get_lifecycle'});
 assert.deepEqual(status.deadlines,deadlines);assert.equal(status.orphanInitiativeExpiries.length,0);
});
test('GM lifecycle inspection is read-only and never advances the clock',()=>{
 const g=make(),before=clone(g.s);const view=gm(g,{op:'gm_get_lifecycle'});
 assert.equal(view.clock.worldRounds,0);assert.deepEqual(view.unresolvedActions,[]);assert.deepEqual(view.unresolvedDecisions,[]);
 assert.deepEqual(clone(g.s),before);assert.throws(()=>g.dispatch({op:'gm_get_lifecycle'},'actor'),/Only GM/);
});
test('ending a spell modifier unlinks its initiative expiry but not other deadlines',()=>{
 const g=make();gm(g,{op:'gm_begin_initiative',scores:{hero:15,warden:5}});
 gm(g,{op:'apply_effect',effect:{id:'ward',name:'Ward',target:'hero',mods:[],rounds:3}});
 gm(g,{op:'gm_schedule_initiative_event',id:'expire_ward',label:'Ward ends',afterRounds:3,expireEffectId:'ward'});
 gm(g,{op:'gm_schedule_initiative_event',id:'other',label:'Other event',afterRounds:3,requiresInput:false});
 assert.equal(g.s.initiativeEvents.length,2);
 const r=gm(g,{op:'remove_effect',id:'ward'});
 assert.equal(r,true);assert.deepEqual(g.s.initiativeEvents.map(e=>e.id),['other']);
 assert.equal(gm(g,{op:'gm_get_lifecycle'}).orphanInitiativeExpiries.length,0);
});
test('expiration at its initiative count never leaves an orphan entry',()=>{
 const g=make();gm(g,{op:'gm_begin_initiative',scores:{hero:15,warden:5}});
 gm(g,{op:'apply_effect',effect:{id:'ward',name:'Ward',target:'warden',mods:[],rounds:1}});
 gm(g,{op:'gm_schedule_initiative_event',id:'expire_ward',label:'Ward ends',afterRounds:1,expireEffectId:'ward'});
 g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});
 assert.equal(g.s.effects.length,0);assert.equal(g.s.initiativeEvents.length,0);
});
test('common interrupt preflight sees pending casting while GM initiative corrections remain possible',()=>{
 const g=make();gm(g,{op:'gm_begin_initiative',scores:{hero:15,warden:5}});
 const spell={name:'Alert ray',level:0,casterLevel:1,castingTime:'standard',targets:['warden'],healing:{amount:1}};
 g.find('warden').x=2;g.find('warden').y=4;
 const result=g.dispatch({op:'cast_spell',actor:'hero',spell},'actor');
 assert.equal(result.status,'needs_gm');assert(unresolvedActions(g.s).includes('pendingSpellCast'));
 gm(g,{op:'gm_set_initiative',id:'warden',score:23}); // authorized GM edits remain legal during interruption
 assert.equal(g.active().id,'hero');
 assert.throws(()=>g.assertTimeIdle(),/Finish the current combat action/);
 assert(gm(g,{op:'gm_get_lifecycle'}).unresolvedActions.includes('pendingSpellCast'));
 gm(g,{op:'gm_continue_spell',aooResolved:true,damageTaken:0});
 assert(!unresolvedActions(g.s).includes('pendingSpellCast'));
});
test('pending event decision and deferred turn are distinguished from automatic timers',()=>{
 const g=make();gm(g,{op:'gm_register_pending_event',id:'bell',label:'Bell',trigger:'At dawn'});
 gm(g,{op:'gm_trigger_pending_event',id:'bell'});
 assert.deepEqual(unresolvedDecisions(g.s),['pending_event']);
 const view=gm(g,{op:'gm_get_lifecycle'});assert.deepEqual(view.unresolvedDecisions,['pending_event']);
 assert.equal(view.unresolvedActions.length,0);
 gm(g,{op:'gm_resolve_pending_event',id:'bell',reason:'Rings'});assert.deepEqual(unresolvedDecisions(g.s),[]);
});
test('initiative crossing boundary predicate shared across consumers',()=>{
 assert.equal(crossedInitiative(13,20,10),true);
 assert.equal(crossedInitiative(20,20,10),false);
 assert.equal(crossedInitiative(20,20,10,true),true);
 assert.equal(crossedInitiative(9,20,10),false);
});
console.log(`V3.23 lifecycle: ${count} regression groups passed`);
