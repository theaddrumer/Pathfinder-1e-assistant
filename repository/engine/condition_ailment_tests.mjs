import assert from 'node:assert/strict';
import {createScenario} from './scenarios.mjs';
import {STANDARD_CONDITION_IDS,STANDARD_CONDITIONS} from './conditions.mjs';
const gm=(g,c)=>g.dispatch(c,'gm');
const fresh=()=>createScenario('registry');
let n=0;const test=(label,fn)=>{try{fn();n++;console.log(`PASS ${label}`);}catch(e){console.error(`FAIL ${label}`);throw e;}};
const raider={id:'test-monster',name:'Test Monster',stats:{maxHp:80,hp:80,str:14,dex:12,con:14,wis:12,bab:3,speed:30,
  statTotals:{ac:17,touchAc:11,flatFootedAc:16,attack:5,damage:3,fort:4,ref:2,will:1},
  abilityLinks:{attack:['str'],damage:['str'],ac:['dex'],touchAc:['dex'],fort:['con'],ref:['dex'],will:['wis']},skills:{Perception:5}}};
const setup=()=>{const g=fresh();gm(g,{op:'register_creature',definition:raider});gm(g,{op:'spawn_creature',definition:'test-monster',id:'test',x:4,y:4});return g;};
const ail={id:'test-venom',name:'Test Venom',kind:'poison',delivery:'injury',save:{type:'fort',dc:15},frequency:{every:{count:1,unit:'round'},maxTicks:6},cure:{successes:2,consecutive:true},effects:[{kind:'ability_damage',ability:'str',dice:{count:1,sides:4}}]};
test('34 condition definitions and statuses',()=>{
 assert.ok(STANDARD_CONDITION_IDS.length>=30);
 assert.equal(STANDARD_CONDITIONS.shaken.coverage,'automatic');
 assert.ok(STANDARD_CONDITIONS.frightened.advisories[0].includes('flee'));
});
test('shaken penalty affects attack, saves and skills',()=>{
 const g=setup(),a=g.stat('test','attack'),save=g.stat('test','fort'),skill=g.skillBonus('test','Perception');
 gm(g,{op:'apply_condition',condition:'shaken',target:'test',rounds:2});
 assert.equal(g.stat('test','attack'),a-2);assert.equal(g.stat('test','fort'),save-2);assert.equal(g.skillBonus('test','Perception'),skill-2);
 assert.equal(g.getConditions('test').length,1);
});
test('condition refresh does not stack',()=>{
 const g=setup();gm(g,{op:'apply_condition',condition:'shaken',target:'test',rounds:2});
 gm(g,{op:'apply_condition',condition:'shaken',target:'test',rounds:3});
 assert.equal(g.getConditions('test').length,1);assert.equal(g.stat('test','attack'),3);
});
test('fear escalation suppresses weaker instead of doubling',()=>{
 const g=setup();gm(g,{op:'apply_condition',condition:'shaken',target:'test'});
 gm(g,{op:'apply_condition',condition:'frightened',target:'test',source:'hero'});
 assert.equal(g.getConditions('test').length,1);assert.equal(g.stat('test','attack'),3);
 assert.deepEqual(g.getConditions('test').map(c=>c.condition),['frightened']);
});
test('frightened proximity advisory does not reject legal move',()=>{
 const g=setup();gm(g,{op:'apply_condition',condition:'frightened',target:'hero',source:'test'});
 const response=g.dispatch({op:'move',actor:'hero',path:[{x:1,y:4}]});
 assert.ok(response.advisories?.some(a=>a.includes('fear')));
});
test('dazed blocks creature actions without blocking GM override',()=>{
 const g=setup();gm(g,{op:'apply_condition',condition:'dazed',target:'hero'});
 assert.throws(()=>g.dispatch({op:'attack',actor:'hero',target:'test'}),/cannot take actions/i);
 assert.equal(g.active().id,'hero');
});
test('fatigued escalates to exhausted rather than stacking penalties',()=>{
 const g=setup();gm(g,{op:'apply_condition',condition:'fatigued',target:'hero'});
 gm(g,{op:'apply_condition',condition:'fatigued',target:'hero'});
 assert.deepEqual(g.getConditions('hero').map(c=>c.condition),['exhausted']);
 assert.throws(()=>g.dispatch({op:'charge',actor:'hero',target:'test'}),/charging/);
});
test('prone contextual AC only during melee attack',()=>{
 const g=setup();const ac=g.stat('test','ac');gm(g,{op:'apply_condition',condition:'prone',target:'test'});
 assert.equal(g.stat('test','ac'),ac);
 g._attackContext={actor:'hero',target:'test'};assert.equal(g.stat('test','ac'),ac-4);delete g._attackContext;
});
test('flat-footed attack defense uses published value',()=>{
 const g=setup();gm(g,{op:'apply_condition',condition:'flat_footed',target:'test'});
 g._attackContext={actor:'hero',target:'test'};assert.equal(g.stat('test','ac'),16);delete g._attackContext;
 assert.equal(g.aooLimit('test'),0);
});
test('standard conditions expire on target turns',()=>{
 const g=setup();gm(g,{op:'apply_condition',condition:'shaken',target:'hero',rounds:2});
 g.dispatch({op:'end_turn'});assert.ok(g.hasCondition('hero','shaken'));
 g.dispatch({op:'end_turn'});assert.ok(g.hasCondition('hero','shaken'));
 g.dispatch({op:'end_turn'});assert.ok(!g.hasCondition('hero','shaken'));
});
test('unauthorized GM commands reject actor',()=>{
 const g=setup();assert.throws(()=>g.dispatch({op:'apply_condition',condition:'shaken',target:'hero'}),/GM/i);
 assert.throws(()=>g.dispatch({op:'register_ailment',definition:ail}),/GM/i);
});
test('initial saved exposure avoids ailment',()=>{
 const g=setup();gm(g,{op:'register_ailment',definition:ail});g.s.testRolls=[20];
 const out=gm(g,{op:'expose_ailment',definition:'test-venom',target:'test'});
 assert.equal(out.resisted,true);assert.equal(g.s.activeAilments.length,0);
});
test('failed exposure deals ability damage, not a changed base score',()=>{
 const g=setup();gm(g,{op:'register_ailment',definition:ail});g.s.testRolls=[1,4];
 const out=gm(g,{op:'expose_ailment',definition:'test-venom',target:'test'});
 assert.equal(out.resisted,false);assert.equal(g.stat('test','str'),14);
 assert.equal(g.s.abilityDamage.test.str,4);assert.equal(g.stat('test','attack'),3);
 assert.equal(g.skillBonus('test','Perception'),5);
});
test('two consecutive successful saves cure, failures reset streak',()=>{
 const g=setup();gm(g,{op:'register_ailment',definition:ail});g.s.testRolls=[1,1];
 const out=gm(g,{op:'expose_ailment',definition:'test-venom',target:'test'});
 assert.ok(out.ailmentId);
 g.s.testRolls=[20];gm(g,{op:'gm_advance_time',count:1,unit:'round'});assert.equal(g.s.activeAilments[0].consecutive,1);
 g.s.testRolls=[1,1];gm(g,{op:'gm_advance_time',count:1,unit:'round'});assert.equal(g.s.activeAilments[0].consecutive,0);
 g.s.testRolls=[20,20];gm(g,{op:'gm_advance_time',count:2,unit:'round'});assert.equal(g.s.activeAilments.length,0);
 assert.ok(g.s.abilityDamage.test.str>0,'Cure does not heal accumulated ability damage');
});
test('nonconsecutive cure succeeds across failures',()=>{
 const g=setup();const d=structuredClone(ail);d.id='other';d.cure.consecutive=false;
 gm(g,{op:'register_ailment',definition:d});g.s.testRolls=[1,1];gm(g,{op:'expose_ailment',definition:'other',target:'test'});
 g.s.testRolls=[20,1,1,20];gm(g,{op:'gm_advance_time',count:3,unit:'round'});
 assert.equal(g.s.activeAilments.length,0);
});
test('limited poison expires after maxTicks, no recurring saves',()=>{
 const g=setup();let d=structuredClone(ail);d.id='short';d.save={type:'fort',dc:15,periodic:false};delete d.cure;d.frequency.maxTicks=2;
 gm(g,{op:'register_ailment',definition:d});g.s.testRolls=[1,1];gm(g,{op:'expose_ailment',definition:'short',target:'test'});
 g.s.testRolls=[1,1];gm(g,{op:'gm_advance_time',count:2,unit:'round'});assert.equal(g.s.activeAilments.length,0);
});
test('disease onset and day frequency',()=>{
 const g=setup();let d=structuredClone(ail);d.id='plague';d.kind='disease';d.onset={count:1,unit:'day'};d.frequency={every:{count:1,unit:'day'}};
 gm(g,{op:'register_ailment',definition:d});g.s.testRolls=[1];gm(g,{op:'expose_ailment',definition:'plague',target:'test'});
 assert.equal(g.s.abilityDamage.test,undefined);
 g.s.testRolls=[1,2];gm(g,{op:'gm_advance_time',count:1,unit:'day'});
 assert.equal(g.s.abilityDamage.test.str,2);
});
test('HP DOT auto-ticks without save and expires',()=>{
 const g=setup(),d={id:'burn',name:'Persistent fire',kind:'dot',save:{type:'ref',dc:12,initial:false,periodic:false},frequency:{every:{count:1,unit:'round'},maxTicks:2},effects:[{kind:'hp',damageType:'fire',dice:{count:1,sides:6}}]};
 gm(g,{op:'register_ailment',definition:d});g.s.testRolls=[3];gm(g,{op:'expose_ailment',definition:'burn',target:'test'});
 assert.equal(g.find('test').hp,77);
 g.s.testRolls=[2,4];gm(g,{op:'gm_advance_time',count:2,unit:'round'});
 assert.equal(g.find('test').hp,71);assert.equal(g.s.activeAilments.length,0);
});
test('strict validator rejects injected code / unknown effects',()=>{
 const g=setup();const d=structuredClone(ail);d.code='console.log("hack")';
 assert.throws(()=>gm(g,{op:'register_ailment',definition:d}),/Unsupported ailment/);
 const e=structuredClone(ail);e.effects=[{kind:'code',code:'bad'}];e.id='evil';
 assert.throws(()=>gm(g,{op:'register_ailment',definition:e}),/Unknown recurring/);
});
test('GM can heal ability damage without curing poison',()=>{
 const g=setup();gm(g,{op:'register_ailment',definition:ail});g.s.testRolls=[1,3];gm(g,{op:'expose_ailment',definition:'test-venom',target:'test'});
 assert.deepEqual(gm(g,{op:'heal_ability_damage',target:'test',ability:'str',amount:2}),{healed:2,remaining:1});
 assert.equal(g.s.activeAilments.length,1);
});
test('registered ailments persist undo; applications roll back',()=>{
 const g=setup();gm(g,{op:'register_ailment',definition:ail});
 g.s.testRolls=[1,4];gm(g,{op:'expose_ailment',definition:'test-venom',target:'test'});
 assert.equal(g.s.activeAilments.length,1);g.dispatch({op:'undo_turn'},'gm');
 assert.equal(g.s.activeAilments.length,0);assert.ok(g.s.ailmentCatalog['test-venom']);
});
test('multiple concurrent independent target instances',()=>{
 const g=setup();gm(g,{op:'spawn_creature',definition:'test-monster',id:'test2',x:6,y:6});
 gm(g,{op:'register_ailment',definition:ail});g.s.testRolls=[1,1,1,1];
 gm(g,{op:'expose_ailment',definition:'test-venom',target:'test'});
 gm(g,{op:'expose_ailment',definition:'test-venom',target:'test2'});
 assert.equal(g.s.activeAilments.length,2);assert.equal(g.s.abilityDamage.test.str,1);assert.equal(g.s.abilityDamage.test2.str,1);
});

test('status action restrictions block second staggered major action',()=>{
 const g=setup();gm(g,{op:'apply_condition',condition:'staggered',target:'hero'});
 g.dispatch({op:'use_action',actor:'hero',type:'standard',label:'one standard'});
 assert.throws(()=>g.dispatch({op:'use_action',actor:'hero',type:'move',label:'second move'}),/Staggered/i);
});
test('nauseated allows one move but not standard or a second move',()=>{
 const g=setup();gm(g,{op:'apply_condition',condition:'nauseated',target:'hero'});
 assert.throws(()=>g.dispatch({op:'use_action',actor:'hero',type:'standard'}),/Nauseated/i);
 g.dispatch({op:'move',actor:'hero',path:[{x:1,y:4}]});
 assert.throws(()=>g.dispatch({op:'move',actor:'hero',path:[{x:2,y:4}]}),/Nauseated/i);
});
test('stunned suppresses attacks of opportunity',()=>{
 const g=setup();gm(g,{op:'apply_condition',condition:'stunned',target:'test'});
 assert.equal(g.aooLimit('test'),0);
});
test('condition effects survive save/load with distinct instance state',()=>{
 const g=setup();gm(g,{op:'apply_condition',condition:'fatigued',target:'test',rounds:4});
 const copy=structuredClone(g.exportState());
 const h=new g.constructor(copy);
 assert.equal(h.getConditions('test')[0].condition,'fatigued');
 assert.equal(h.stat('test','str'),g.stat('test','str'));
});
test('condition removal does not erase unrelated modifiers',()=>{
 const g=setup();gm(g,{op:'gm_modifier',target:'test',stat:'attack',value:2,type:'circumstance'});
 gm(g,{op:'apply_condition',condition:'shaken',target:'test'});gm(g,{op:'remove_condition',condition:'shaken',target:'test'});
 assert.equal(g.stat('test','attack'),7);
});
test('con ability damage affects Fortitude but does not rewrite the printed score',()=>{
 const g=setup();g.applyAbilityDamage('test','con',3);
 assert.equal(g.stat('test','con'),14);assert.equal(g.stat('test','fort'),3);
});
test('invalid ailment registration is transactional',()=>{
 const g=setup(),prior=JSON.stringify(g.exportState());
 const bad=structuredClone(ail);bad.id='wrong';bad.frequency.every.unit='fortnight';
 assert.throws(()=>gm(g,{op:'register_ailment',definition:bad}),/Invalid time interval/);
 assert.equal(JSON.stringify(g.exportState()),prior);
});
test('onset-delayed damage fires at scheduled time not before',()=>{
 const g=setup();let d={id:'delayed-burn',name:'Delayed Burn',kind:'dot',save:{type:'fort',dc:1,initial:false,periodic:false},onset:{count:2,unit:'round'},effects:[{kind:'hp',dice:{count:1,sides:6}}]};
 gm(g,{op:'register_ailment',definition:d});gm(g,{op:'expose_ailment',definition:d.id,target:'test'});
 assert.equal(g.find('test').hp,80);
 gm(g,{op:'gm_advance_time',count:1,unit:'round'});assert.equal(g.find('test').hp,80);
 g.s.testRolls=[4];gm(g,{op:'gm_advance_time',count:1,unit:'round'});assert.equal(g.find('test').hp,76);
});
test('turn-start ailment tick contributes to checkpoint so undo does not erase it',()=>{
 const g=setup(),d={id:'bleeding',name:'Bleeding',kind:'dot',save:{type:'fort',dc:1,initial:false,periodic:false},
   initialEffect:false,frequency:{every:{count:1,unit:'round'},maxTicks:3},effects:[{kind:'hp',dice:{count:1,sides:6}}]};
 gm(g,{op:'register_ailment',definition:d});gm(g,{op:'expose_ailment',definition:d.id,target:'test'});
 g.dispatch({op:'end_turn'});g.s.testRolls=[3];g.dispatch({op:'end_turn'});
 // Test creature is the final one in the turn order: a new round begins.
 assert.equal(g.find('test').hp,80);
 // New creature's turn next: first tick on its next turn.
 g.dispatch({op:'end_turn'});
 g.s.testRolls=[3];g.dispatch({op:'end_turn'});
 assert.equal(g.find('test').hp,77);
 g.dispatch({op:'undo_turn'},'gm');assert.equal(g.find('test').hp,77);
});
console.log(`Total V3.6 condition/ailment tests: ${n}`);
