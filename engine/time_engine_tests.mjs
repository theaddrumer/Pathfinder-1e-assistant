import assert from 'node:assert/strict';
import {createScenario} from './scenarios.mjs';
import {clone} from './core.mjs';
let count=0;
const test=(label,fn)=>{try{fn();console.log('PASS',label);count++;}catch(err){process.exitCode=1;console.error('FAIL',label,err.stack);}};
const game=()=>createScenario('registry');
const gm=(g,command)=>g.dispatch(command,'gm');
test('game clock starts at Day 1 00:00:00; elapsed time advances without combat turns or activity',()=>{
 const g=game(),state=clone(g.s.actions),round=g.s.round,turn=g.s.turn;
 const r=gm(g,{op:'gm_advance_time',count:1,unit:'day'});
 assert.equal(r.clock.label,'Day 2, 00:00:00');assert.equal(g.s.round,round);assert.equal(g.s.turn,turn);assert.deepEqual(g.s.actions,state);
});
test('GM sets an in-world clock display without triggering mechanical time',()=>{
 const g=game();gm(g,{op:'gm_set_game_clock',day:8,hour:19,minute:40});
 assert.equal(gm(g,{op:'gm_get_game_clock'}).clock.label,'Day 8, 19:40:00');assert.equal(g.s.worldRounds,0);
 gm(g,{op:'gm_advance_time',count:25,unit:'minute'});assert.equal(g.gameTime().label,'Day 8, 20:05:00');
});
test('GM events schedule without character tactics, stop before continuing, and require an explicit GM resolution',()=>{
 const g=game();gm(g,{op:'gm_schedule_time_event',id:'river_crossing',label:'Bridge watch changes',after:{count:3,unit:'hour'}});
 let r=gm(g,{op:'gm_advance_time',count:1,unit:'day'});
 assert.equal(r.status,'needs_gm');assert.equal(r.advancedRounds,1800);assert.equal(r.remainingRounds,12600);assert.equal(g.gameTime().label,'Day 1, 03:00:00');
 assert.throws(()=>gm(g,{op:'gm_advance_time',count:1,unit:'hour'}),/pending/);
 assert.throws(()=>g.dispatch({op:'gm_acknowledge_time_event',reason:'Done'},'actor'),/GM/);
 gm(g,{op:'gm_acknowledge_time_event',reason:'The AI GM adjudicated the changing watch.'});
 assert.equal(gm(g,{op:'gm_advance_time',count:r.remainingRounds,unit:'round'}).clock.label,'Day 2, 00:00:00');
});
test('Advance to next event handles noninteractive and interactive scheduled events',()=>{
 const g=game();gm(g,{op:'gm_schedule_time_event',id:'dawn',label:'Sunrise',after:{count:6,unit:'hour'},requiresInput:false});
 gm(g,{op:'gm_schedule_time_event',id:'meeting',label:'Council meeting',after:{count:7,unit:'hour'}});
 let r=gm(g,{op:'gm_advance_to_event'});assert.equal(r.status,'done');assert.equal(r.clock.hour,6);assert.equal(r.scheduled[0].id,'dawn');
 r=gm(g,{op:'gm_advance_to_event'});assert.equal(r.status,'needs_gm');assert.equal(r.pending.id,'meeting');
});
test('Ailment ticks and cure checks occur at exact deadlines rather than only at end',()=>{
 const g=game();gm(g,{op:'register_ailment',definition:{id:'clock_poison',name:'Clock Poison',kind:'poison',delivery:'contact',save:{type:'fort',dc:12,initial:false},frequency:{every:{count:1,unit:'hour'},maxTicks:4},effects:[{kind:'hp',dice:{count:1,sides:2},damageType:'untyped'}]}});
 gm(g,{op:'expose_ailment',definition:'clock_poison',target:'hero'});
 const hp=g.find('hero').hp;g.s.testRolls=[1,2,1,2,1,2,1,2];
 const r=gm(g,{op:'gm_advance_time',count:4,unit:'hour'});
 assert.deepEqual(r.ticks.map(x=>x.at),[600,1200,1800,2400]);assert.equal(g.s.activeAilments.length,0);
 assert.equal(g.find('hero').hp,hp-8);
});
test('Timed effects expire in chronological order, including conditions, before later saves',()=>{
 const g=game();gm(g,{op:'apply_effect',effect:{id:'fort_bonus',name:'Fortification spell',target:'hero',source:null,mods:[{stat:'fort',value:20,type:'untyped'}],rounds:600}});
 gm(g,{op:'apply_condition',condition:'shaken',target:'hero',rounds:50});
 g.applyNegativeLevels({target:'hero',levels:1,dc:30});
 assert.equal(g.hasCondition('hero','shaken'),true);
 g.s.testRolls=[18];const r=gm(g,{op:'gm_advance_time',count:24,unit:'hour'});
 assert.equal(r.expiredEffects.length,2);assert.equal(g.s.effects.some(e=>e.id==='fort_bonus'),false);
 assert.equal(g.hasCondition('hero','shaken'),false);assert.equal(r.negativeLevelSaves.length,1);
 assert.equal(r.negativeLevelSaves[0].save.success,false);
});
test('Temporary HP expiration uses its own one-hour deadline even across multiple days',()=>{
 const g=game();g.grantEnergyTempHp('hero',5);const r=gm(g,{op:'gm_advance_time',count:2,unit:'day'});
 assert.equal((g.s.energyTempHp.hero||[]).length,0);assert.deepEqual(r.expiredTempHp.map(e=>e.at),[600]);
});
test('Multiple same-time events are retained and each can require GM input',()=>{
 const g=game();for(const id of ['alpha','beta'])gm(g,{op:'gm_schedule_time_event',id,label:id,after:{count:1,unit:'hour'}});
 let r=gm(g,{op:'gm_advance_to_event'});assert.equal(r.status,'needs_gm');gm(g,{op:'gm_acknowledge_time_event',reason:'Resolved alpha'});
 r=gm(g,{op:'gm_advance_to_event'});assert.equal(r.status,'needs_gm');assert.equal(r.advancedRounds,0);gm(g,{op:'gm_acknowledge_time_event',reason:'Resolved beta'});
 assert.equal(g.s.scheduledTimeEvents.length,0);
});
test('Broken input and too many scheduled events roll back state atomically',()=>{
 const g=game();const before=clone(g.s);assert.throws(()=>gm(g,{op:'gm_advance_time',count:-1,unit:'day'}),/Invalid/);
 assert.deepEqual(g.s,before);
 assert.throws(()=>gm(g,{op:'gm_schedule_time_event',id:'bad',label:'Wrong',after:{count:0,unit:'minute'}}),/Invalid/);
 assert.deepEqual(g.s,before);
});
test('Advancing elapsed time does not imply rest or natural healing',()=>{
 const g=game();g.find('hero').hp=12;gm(g,{op:'gm_advance_time',count:3,unit:'day'});assert.equal(g.find('hero').hp,12);
});
test('Existing undo snapshots can revert the clock after a downtime command',()=>{
 const g=game();gm(g,{op:'gm_advance_time',count:1,unit:'day'});gm(g,{op:'undo_turn'});assert.equal(g.s.worldRounds,0);
});
if(!process.exitCode)console.log(`${count} time engine tests passed`);
