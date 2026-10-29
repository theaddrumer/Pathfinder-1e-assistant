import assert from 'node:assert/strict';
import {createScenario} from './scenarios.mjs';
const gm=(game,command)=>game.dispatch(command,'gm');
const fresh=({hitDiceCount}={})=>{
 const game=createScenario('registry');
 gm(game,{op:'register_creature',definition:{id:'loss_target',name:'Loss target',stats:{
  maxHp:80,hp:80,str:14,dex:12,con:14,wis:12,bab:3,
  ...(hitDiceCount?{hitDiceCount}:{}),
  statTotals:{ac:17,touchAc:11,flatFootedAc:16,attack:5,damage:3,fort:4,ref:2,will:1},
  abilityLinks:{attack:['str'],damage:['str'],ac:['dex'],touchAc:['dex'],fort:['con'],ref:['dex'],will:['wis']},
  skills:{Climb:6,Perception:5}
 }}});
 gm(game,{op:'spawn_creature',definition:'loss_target',id:'test',x:4,y:4});
 return game;
};
let count=0;
const test=(name,fn)=>{fn();console.log(`PASS ${name}`);count++;};
test('Ability damage accumulates; penalty advances only per two points',()=>{
 const g=fresh();gm(g,{op:'apply_ability_damage',target:'test',ability:'str',amount:1});
 assert.equal(g.stat('test','str'),14);assert.equal(g.stat('test','attack'),5);
 gm(g,{op:'apply_ability_damage',target:'test',ability:'str',amount:2});
 assert.equal(g.s.abilityDamage.test.str,3);assert.equal(g.stat('test','attack'),4);
 gm(g,{op:'apply_ability_damage',target:'test',ability:'str',amount:1});
 assert.equal(g.stat('test','attack'),3);assert.equal(g.skillBonus('test','Climb'),4);
});
test('Drain lowers actual score and follows modifier breakpoints',()=>{
 const g=fresh();const x=gm(g,{op:'apply_ability_drain',target:'test',ability:'str',amount:1});
 assert.equal(x.score,13);assert.equal(g.stat('test','attack'),4);assert.equal(g.stat('test','str'),13);
 gm(g,{op:'apply_ability_drain',target:'test',ability:'str',amount:1});
 assert.equal(g.stat('test','str'),12);assert.equal(g.stat('test','attack'),4);
 gm(g,{op:'restore_ability_drain',target:'test',ability:'str',amount:1});
 assert.equal(g.stat('test','str'),13);assert.equal(g.s.abilityDrain.test.str,1);
});
test('Damage, drain, and timed modifier occupy separate tracks',()=>{
 const g=fresh();gm(g,{op:'apply_ability_damage',target:'test',ability:'str',amount:4});
 gm(g,{op:'apply_ability_drain',target:'test',ability:'str',amount:1});
 const effects=gm(g,{op:'gm_modifier',target:'test',stat:'str',value:4,type:'enhancement',rounds:2});
 assert.equal(g.stat('test','str'),17); // 14 +4 enhancement -1 drain; damage does not change score.
 assert.equal(g.stat('test','attack'),4); // printed 5 +1 score delta -2 damage
 const entry=g.inspect().abilityScores.test.str;
 assert.equal(entry.damage,4);assert.equal(entry.drain,1);assert.equal(entry.score,17);
 assert.ok(entry.temporaryAdjustments.length);
 gm(g,{op:'remove_effect',id:effects.effectId});
 assert.equal(g.stat('test','str'),13);assert.equal(g.stat('test','attack'),2);
 gm(g,{op:'heal_ability_damage',target:'test',ability:'str',amount:4});
 assert.equal(g.stat('test','str'),13);assert.equal(g.stat('test','attack'),4);
 gm(g,{op:'restore_ability_drain',target:'test',ability:'str',amount:1});
 assert.equal(g.stat('test','str'),14);assert.equal(g.stat('test','attack'),5);
});
test('Con damage and drain adjust current/max HP when HD known, preserving injuries',()=>{
 const g=fresh({hitDiceCount:5});
 gm(g,{op:'apply_ability_damage',target:'test',ability:'con',amount:3});
 assert.equal(g.find('test').maxHp,75);assert.equal(g.find('test').hp,75);
 gm(g,{op:'apply_ability_drain',target:'test',ability:'con',amount:1});
 assert.equal(g.stat('test','con'),13);assert.equal(g.find('test').maxHp,70);assert.equal(g.find('test').hp,70);
 g.find('test').hp=63;
 gm(g,{op:'heal_ability_damage',target:'test',ability:'con',amount:3});
 assert.equal(g.find('test').maxHp,75);assert.equal(g.find('test').hp,68);
 gm(g,{op:'restore_ability_drain',target:'test',ability:'con',amount:1});
 assert.equal(g.find('test').maxHp,80);assert.equal(g.find('test').hp,73);
});
test('Constitution effects also refresh HP when applied and removed',()=>{
 const g=fresh({hitDiceCount:5});const applied=gm(g,{op:'gm_modifier',target:'test',stat:'con',value:4,type:'enhancement'});
 assert.equal(g.stat('test','con'),18);assert.equal(g.find('test').maxHp,90);
 gm(g,{op:'remove_effect',id:applied.effectId});assert.equal(g.find('test').maxHp,80);
});
test('Con damage without HD returns explicit warning instead of guessing HP',()=>{
 const g=fresh();const x=gm(g,{op:'apply_ability_damage',target:'test',ability:'con',amount:4});
 assert.equal(g.find('test').maxHp,80);assert.equal(x.hp.adjusted,false);
 assert.ok(x.advisories.some(v=>v.includes('hitDiceCount')));
});
test('Ailments can deal drain while their cure does not restore it',()=>{
 const g=fresh();const def={id:'rotting-curse',name:'Fictional draining disease',kind:'disease',
  save:{type:'fort',dc:25},frequency:{every:{count:1,unit:'day'},maxTicks:2},
  cure:{successes:1,consecutive:true},effects:[{kind:'ability_drain',ability:'str',dice:{count:1,sides:4}}]};
 gm(g,{op:'register_ailment',definition:def});g.s.testRolls=[1,2];
 const result=gm(g,{op:'expose_ailment',definition:def.id,target:'test'});
 assert.equal(result.effects[0].kind,'ability_drain');assert.equal(g.s.abilityDrain.test.str,2);
 g.s.testRolls=[20];gm(g,{op:'gm_advance_time',count:1,unit:'day'});
 assert.equal(g.s.activeAilments.length,0);assert.equal(g.stat('test','str'),12);
});
test('Damage plus drain from one ailment remain independent',()=>{
 const g=fresh();const def={id:'dual-ailment',name:'Dual ailment',kind:'dot',effects:[
  {kind:'ability_damage',ability:'dex',dice:{count:1,sides:4}},
  {kind:'ability_drain',ability:'dex',dice:{count:1,sides:4}}]};
 gm(g,{op:'register_ailment',definition:def});g.s.testRolls=[2,1];
 gm(g,{op:'expose_ailment',definition:def.id,target:'test'});
 assert.equal(g.s.abilityDamage.test.dex,2);assert.equal(g.s.abilityDrain.test.dex,1);
 assert.equal(g.stat('test','dex'),11);assert.equal(g.stat('test','ref'),0);
});
test('Temporary ability penalty alone cannot reduce an ability below 1',()=>{
 const g=fresh();gm(g,{op:'gm_modifier',target:'test',stat:'str',value:-100,type:'untyped'});
 assert.equal(g.stat('test','str'),1);
 assert.equal(g.s.abilityDrain.test?.str||0,0);
});
test('Zero ability score and lethal ability damage are flagged',()=>{
 const g=fresh();const x=gm(g,{op:'apply_ability_drain',target:'test',ability:'str',amount:99});
 assert.equal(x.amount,14);assert.equal(g.stat('test','str'),0);
 assert.ok(x.advisories.some(v=>v.includes('incapacitation')));
 const h=fresh();const y=gm(h,{op:'apply_ability_damage',target:'test',ability:'con',amount:14});
 assert.ok(y.advisories.some(v=>v.includes('dies')));
});
test('Direct ability mutations reject actor role and rollback on bad commands',()=>{
 const g=fresh(),state=JSON.stringify(g.exportState());
 for(const op of ['apply_ability_damage','apply_ability_drain','restore_ability_drain','heal_ability_damage']){
  assert.throws(()=>g.dispatch({op,target:'test',ability:'str',amount:2}),/GM/);
 }
 assert.throws(()=>gm(g,{op:'apply_ability_drain',target:'test',ability:'banana',amount:3}),/Invalid ability/);
 assert.equal(JSON.stringify(g.exportState()),state);
});
test('Undo and save/reload preserve separate reservoirs and HP adjustment',()=>{
 const g=fresh({hitDiceCount:6});
 g.turnStart=structuredClone(g.s);g.roundStart=structuredClone(g.s);
 gm(g,{op:'apply_ability_damage',target:'test',ability:'con',amount:4});
 gm(g,{op:'apply_ability_drain',target:'test',ability:'con',amount:1});
 const saved=g.exportState();const h=new g.constructor(saved);
 assert.equal(h.stat('test','con'),13);assert.equal(h.s.abilityDamage.test.con,4);
 assert.equal(h.s.abilityDrain.test.con,1);assert.equal(h.find('test').maxHp,62);
 gm(g,{op:'undo_turn'});assert.equal(g.s.abilityDamage.test?.con||0,0);
 assert.equal(g.s.abilityDrain.test?.con||0,0);assert.equal(g.find('test').maxHp,80);
});
test('Ailment validator rejects malformed drain fields',()=>{
 const g=fresh();const def={id:'bad-drain',name:'Bad drain',kind:'disease',effects:[{kind:'ability_drain',ability:'life',dice:{count:1,sides:4}}]};
 assert.throws(()=>gm(g,{op:'register_ailment',definition:def}),/Invalid ability damage/);
});
console.log(`Total V3.6.1 ability loss tests: ${count}`);
