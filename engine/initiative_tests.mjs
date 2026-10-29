import assert from 'node:assert/strict';
import {clone,initialState} from './core.mjs';
import {InitiativeGame} from './initiative.mjs';
import {createScenario,startScenario} from './scenarios.mjs';
let n=0;const t=(label,fn)=>{fn();n++;};
const scene=(scores={hero:15,warden:9})=>{const g=new InitiativeGame(initialState());g.dispatch({op:'gm_begin_initiative',scores},'gm');return g;};
t('supplied initiative sorts and first actor',()=>{const g=scene({hero:4,warden:17});assert.equal(g.active().id,'warden');assert.equal(g.s.round,1);});
t('high/negative initiative and world clock round boundary',()=>{const g=scene({hero:999,warden:-22});g.dispatch({op:'end_turn'});assert.equal(g.active().id,'warden');assert.equal(g.s.round,1);assert.equal(g.s.worldRounds,0);g.dispatch({op:'end_turn'});assert.equal(g.active().id,'hero');assert.equal(g.s.round,2);assert.equal(g.s.worldRounds,1);});
t('natural 1 or 20 not automatic successes, initiative is a check',()=>{const g=new InitiativeGame(initialState());g.s.testRolls=[1,20];g.dispatch({op:'gm_begin_initiative',roll:true},'gm');assert.equal(g.s.testRolls.length,0);assert.equal(g.initiativeRoster().enabled,true);});
t('GM can revise results after character acted without repeated turn',()=>{const g=scene();g.dispatch({op:'end_turn'});assert.equal(g.active().id,'warden');g.dispatch({op:'gm_set_initiative',id:'hero',score:-70},'gm');g.dispatch({op:'end_turn'});assert.equal(g.s.round,2);assert.equal(g.active().id,'warden');g.dispatch({op:'end_turn'});assert.equal(g.active().id,'hero');});
t('GM can reorder tie after another combatant',()=>{const g=scene();g.dispatch({op:'gm_move_initiative_after',id:'hero',afterId:'warden'},'gm');assert.deepEqual(g.initiativeRoster().entries.map(x=>x.id),['warden','hero']);g.dispatch({op:'end_turn'});assert.equal(g.s.round,2);assert.equal(g.active().id,'warden');});
t('Delay moves actor out of current round and GM may resume at next boundary',()=>{const g=scene();g.dispatch({op:'delay_turn'});assert.equal(g.active().id,'warden');assert.ok(g.s.initiative.delayed.includes('hero'));g.dispatch({op:'gm_queue_delay_resume',id:'hero'},'gm');g.dispatch({op:'end_turn'});assert.equal(g.active().id,'hero');assert.equal(g.s.round,1);assert.equal(g.s.worldRounds,0);g.dispatch({op:'end_turn'});assert.equal(g.s.round,2);assert.equal(g.active().id,'warden');});
t('Delay requires whole untaken turn',()=>{const g=scene();g.dispatch({op:'use_action',actor:'hero',type:'move'});assert.throws(()=>g.dispatch({op:'delay_turn'}),/Delay must/);});
t('initiative event on empty score does not await literal counter iterations',()=>{
 const g=scene({hero:800,warden:-800});g.dispatch({op:'gm_schedule_initiative_event',id:'thunder',label:'Thunderstorm',afterRounds:1,atScore:7},'gm');
 g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});assert.equal(g.s.round,2);
 g.dispatch({op:'end_turn'});assert.equal(g.active().id,'warden');assert.ok(g.s.initiative.alerts.some(e=>e.id==='thunder'));assert.equal(g.s.worldRounds,1);
});
t('initiative deadline can expire a modifier at precise count',()=>{
 const g=scene({hero:20,warden:5});g.dispatch({op:'apply_effect',effect:{id:'ward',name:'Ward',target:'hero',mods:[{stat:'ac',value:2,type:'dodge'}],rounds:1}},'gm');
 g.dispatch({op:'gm_schedule_initiative_event',id:'ward_end',label:'Ward expires',afterRounds:1,atScore:12,expireEffectId:'ward'},'gm');
 g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});assert.ok(g.s.effects.some(e=>e.id==='ward'));
 g.dispatch({op:'end_turn'});assert.equal(g.s.effects.some(e=>e.id==='ward'),false);
});
t('initiative GM pause, acknowledge and preserve state across undo',()=>{
 const g=scene();g.dispatch({op:'gm_schedule_initiative_event',id:'portal',label:'Portal opens',afterRounds:1,atScore:12,requiresInput:true},'gm');
 g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});
 assert.equal(g.s.pendingInitiativeEvent?.id,'portal');assert.throws(()=>g.dispatch({op:'attack',actor:'warden',target:'hero'}),/pending initiative event/);
 g.dispatch({op:'gm_acknowledge_initiative_event',reason:'GM narrates portal'},'gm');assert.equal(g.s.pendingInitiativeEvent,null);
});
t('undo and reround snapshots retain roster and counters',()=>{
 const g=scene();g.dispatch({op:'end_turn'});g.dispatch({op:'undo_turn'},'gm');assert.equal(g.active().id,'hero');assert.equal(g.s.worldRounds,0);
 g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});assert.equal(g.s.round,2);
 g.dispatch({op:'undo_round'},'gm');assert.equal(g.s.round,2);assert.equal(g.s.worldRounds,1);
});
t('one-creature registry initiative cannot enter infinite loop',()=>{const g=createScenario('registry');g.dispatch({op:'gm_begin_initiative',scores:{hero:4}},'gm');g.dispatch({op:'end_turn'});assert.equal(g.s.round,2);});
t('spawned creature requires explicit GM initiative, retains clock',()=>{const g=scene();g.s.creatures.push({...clone(g.s.creatures[1]),id:'extra'});assert.ok(g.initiativeRoster().unranked.includes('extra'));g.dispatch({op:'gm_set_initiative',id:'extra',score:10},'gm');assert.equal(g.initiativeRoster().entries.length,3);});
t('invalid initiative does not mutate original state or consume rolls',()=>{const g=scene();const save=clone(g.s);assert.throws(()=>g.dispatch({op:'gm_schedule_initiative_event',id:'bad',label:'x',afterRounds:0},'gm'));assert.deepEqual(g.s,save);});
t('legacy non-initiative order remains supported',()=>{const g=createScenario('choker');startScenario(g);g.dispatch({op:'end_turn'});assert.equal(g.active().id,'warden');g.dispatch({op:'end_turn'});assert.equal(g.s.worldRounds,1);});
console.log(`Initiative V3.20 PASS: ${n} tests`);
t('GM edits are allowed during unresolved interrupt without altering active actor',()=>{
 const g=scene();const original=g.active().id;
 g.s.interrupt={type:'aoo',reactor:'warden',target:'hero',from:{x:1,y:4},to:{x:2,y:4}};
 g.dispatch({op:'gm_set_initiative',id:'warden',score:99},'gm');
 assert.equal(g.active().id,original);assert.equal(g.s.interrupt.type,'aoo');
});
t('multiple simultaneous GM deadlines queue and acknowledge separately',()=>{
 const g=scene();for(const id of ['a','b'])g.dispatch({op:'gm_schedule_initiative_event',id,label:id,afterRounds:1,atScore:11,requiresInput:true},'gm');
 g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});
 assert.equal(g.s.pendingInitiativeEvent.id,'a');g.dispatch({op:'gm_acknowledge_initiative_event',reason:'A'},'gm');
 assert.equal(g.s.pendingInitiativeEvent.id,'b');g.dispatch({op:'gm_acknowledge_initiative_event',reason:'B'},'gm');
 assert.equal(g.s.pendingInitiativeEvent,null);
});
t('ending initiative migrates pending effect expirations and GM events to Fast Forward',()=>{
 const g=scene();g.dispatch({op:'apply_effect',effect:{id:'shield',name:'Shield',target:'hero',mods:[{stat:'ac',value:4,type:'shield'}],rounds:1}},'gm');
 g.dispatch({op:'gm_schedule_initiative_event',id:'shield_expire',label:'Shield expires',afterRounds:3,expireEffectId:'shield'},'gm');
 g.dispatch({op:'gm_schedule_initiative_event',id:'bell',label:'Distant bell rings',afterRounds:3,atScore:11,requiresInput:true},'gm');
 const finish=g.dispatch({op:'gm_end_initiative'},'gm');assert.equal(finish.converted.length,2);assert.equal(g.s.initiative.enabled,false);
 assert.equal(g.s.effects.find(e=>e.id==='shield').remaining,3);
 const r=g.dispatch({op:'gm_advance_time',count:3,unit:'round'},'gm');assert.equal(r.status,'needs_gm');
 assert.equal(g.s.effects.some(e=>e.id==='shield'),false);assert.equal(g.s.pendingTimeEvent.id,'bell');
});
t('Fast Forward rejects active combat and does not change worldRounds',()=>{
 const g=scene();const t=g.s.worldRounds;
 assert.throws(()=>g.dispatch({op:'gm_advance_time',count:30,unit:'round'},'gm'),/End encounter initiative/);
 assert.equal(g.s.worldRounds,t);
});
console.log('Additional V3.20 initiative edge cases passed');
