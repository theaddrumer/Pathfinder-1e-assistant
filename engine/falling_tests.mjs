import assert from 'node:assert/strict';
import {Kernel,initialState} from './kernel.mjs';
import {fallingPlan} from './falling_rules.mjs';
import {clone} from './core.mjs';
const gm=(g,c)=>g.dispatch(c,'gm');
const make=()=>{const s=initialState();s.tiles={};Object.assign(s.creatures[0],{x:1,y:3,hp:200,maxHp:200});Object.assign(s.creatures[1],{x:7,y:3,size:1,hp:200,maxHp:200});return new Kernel(s);};
const cmd=(fall={},extra={})=>({op:'gm_resolve_fall',target:'hero',fall:{distanceFeet:30,...fall},reason:'Declared landing',...extra});
const plan=(fall={})=>fallingPlan({distanceFeet:30,...fall});
let count=0;const test=(name,fn)=>{fn();count++;console.log('PASS',name);};
test('ordinary fall increments and 20-die cap',()=>{
 for(const [feet,dice] of [[0,0],[9,0],[10,1],[19.9,1],[30,3],[200,20],[100000,20]])assert.equal(plan({distanceFeet:feet}).lethal.count,dice);
});
test('deliberate jump, Acrobatics and yielding surface compose without double conversion',()=>{
 for(const [extra,lethal,nonlethal] of [[{},3,0],[{deliberate:true},2,1],[{surface:'yielding'},2,1],[{deliberate:true,surface:'yielding'},1,2],
  [{deliberate:true,acrobaticsTotal:15},1,1],[{deliberate:true,acrobaticsTotal:14},2,1],[{deliberate:true,acrobaticsTotal:15,surface:'yielding'},0,2],
  [{distanceFeet:10,deliberate:true,acrobaticsTotal:15},0,0]]){const r=plan(extra);assert.equal(r.lethal.count,lethal);assert.equal(r.nonlethal.count,nonlethal);}
 assert.equal(plan({distanceFeet:100000,deliberate:true,acrobaticsTotal:15}).lethal.count,19);
});
test('water uses d3 nonlethal bands and d6 lethal beyond 40 feet',()=>{
 for(const [feet,lethal,nonlethal] of [[10,0,0],[20,0,0],[30,0,1],[40,0,2],[50,1,2],[100000,20,2]]){
  const r=plan({distanceFeet:feet,surface:'water',waterDepthFeet:10});assert.equal(r.lethal.count,lethal);assert.deepEqual(r.nonlethal,{count:nonlethal,sides:3});
 }
});
test('dive success depends on actual distance, DC and water depth',()=>{
 const dive={distanceFeet:60,surface:'water',deliberate:true,waterDepthFeet:20,diveTotal:20};
 assert(plan(dive).check.success);assert.equal(plan(dive).lethal.count,0);
 assert(!plan({...dive,diveTotal:19}).check.success);assert.equal(plan({...dive,waterDepthFeet:10}).lethal.count,2);
 assert.equal(plan({...dive,distanceFeet:50}).check.dc,20);assert.equal(plan({...dive,distanceFeet:100}).check.dc,25);
 assert.equal(plan({...dive,reduceFeet:60}).check.requiredDepthFeet,20);
});
test('special distance reduction and explicit damage/prone overrides',()=>{
 assert.equal(plan({reduceFeet:20}).lethal.count,1);assert.equal(plan({reduceFeet:100}).lethal.count,0);
 const r=plan({override:{lethal:0,nonlethal:0,prone:false,reason:'Feather fall'}});assert.deepEqual(r.lethal,{amount:0});
 assert.throws(()=>plan({surface:'water',waterDepthFeet:5}),/Shallow/);
 assert.equal(plan({surface:'water',waterDepthFeet:5,override:{lethal:3,nonlethal:0,reason:'Bottom impact'}}).lethal.amount,3);
});
test('preview preserves state, RNG, checkpoints and availability during pending decisions',()=>{
 const g=make();g.s.testRolls=[4];g.s.pendingTimeEvent={id:'test'};const before=g.exportState(),checkpoint=clone(g.turnStart);
 const r=gm(g,{...cmd(),op:'gm_preview_fall',landing:{feet:0,grounded:true,layer:'ground'}});assert.equal(r.lethal.count,3);
 assert.deepEqual(g.exportState(),before);assert.deepEqual(g.turnStart,checkpoint);assert.throws(()=>gm(g,cmd()),/pending/);
});
test('GM authority, strict input validation and failed landing are atomic',()=>{
 const g=make();g.s.testRolls=[5,5,5];const before=g.exportState();
 assert.throws(()=>g.dispatch(cmd(),'actor'),/GM/);
 for(const fall of [{distanceFeet:-1},{distanceFeet:Infinity},{surface:'lava'},{deliberate:'yes'},{acrobaticsTotal:20},
  {diveTotal:20},{deliberate:true,acrobaticsTotal:1.5},{waterDepthFeet:20},{reduceFeet:-1},{unexpected:true},
  {override:{lethal:0,nonlethal:0}},{override:{lethal:-1,nonlethal:0,reason:'Invalid'}}])assert.throws(()=>gm(g,cmd(fall)));
 assert.throws(()=>gm(g,cmd({}, {landing:{feet:0,grounded:'yes'}})));
 gm(g,{op:'gm_set_elevation',target:'hero',elevation:{feet:30,grounded:false,layer:'air'},reason:'Above other token'});
 g.find('warden').x=1;const occupied=g.exportState();assert.throws(()=>gm(g,cmd({}, {landing:{feet:0,grounded:true,layer:'ground'}})),/occupancy/);assert.deepEqual(g.exportState(),occupied);
 // Invalid edits before the intentional setup did not consume the scripted dice.
 assert.deepEqual(g.s.testRolls,before.testRolls);
});
test('ordinary impact uses environmental damage, bypasses weapon DR and applies prone',()=>{
 const g=make();g.find('hero').protections={dr:[{amount:100,bypass:[]}]};g.s.testRolls=[4,4,4];const r=gm(g,cmd());
 assert.equal(r.lethal.raw,12);assert.equal(g.find('hero').hp,188);assert(g.hasCondition('hero','prone'));assert.deepEqual(g.s.testRolls,[]);
});
test('mixed damage uses native nonlethal ledger; plain nonlethal fall and Acrobatics prone differ',()=>{
 const g=make();g.s.testRolls=[4,3];const r=gm(g,cmd({deliberate:true,acrobaticsTotal:15}));assert.equal(r.lethal.raw,4);assert.equal(g.find('hero').hp,196);assert.equal(g.nonlethalTotal('hero'),3);assert(r.prone);
 for(const acrobatics of [false,true]){const h=make();h.s.testRolls=[4];const r=gm(h,cmd({distanceFeet:acrobatics?20:10,deliberate:true,...(acrobatics?{acrobaticsTotal:15}:{})}));assert.equal(h.nonlethalTotal('hero'),4);assert.equal(r.prone,acrobatics);}
});
test('nonlethal immunity and temporary HP stay in their existing owners',()=>{
 const g=make();g.find('hero').creatureType='undead';g.s.testRolls=[5];const r=gm(g,cmd({distanceFeet:10,deliberate:true}));assert.equal(g.nonlethalTotal('hero'),0);assert.equal(r.nonlethal.result.immune,true);assert(!r.prone);
 const h=make();h.s.energyTempHp.hero=[{amount:10,expiresAt:100}];h.s.testRolls=[4];const t=gm(h,cmd({distanceFeet:10}));assert.equal(h.find('hero').hp,200);assert.equal(t.lethal.result.tempHpAbsorbed,4);assert(t.prone);
});
test('safe landing rolls nothing and does not remove a pre-existing prone condition',()=>{
 const g=make();g.applyCondition({target:'hero',condition:'prone'});g.s.testRolls=[5];const r=gm(g,cmd({override:{lethal:0,nonlethal:0,prone:false,reason:'Feather fall'}}));assert(r.prone);assert.deepEqual(g.s.testRolls,[5]);assert.equal(g.find('hero').hp,200);
});
test('landing updates contact and triggers surface hazard once after impact',()=>{
 const g=make();g.installRule({id:'spikes',on:'tile_enter',when:[{op:'eq',a:{ref:'event.tile'},b:'hazard'}],actions:[{op:'deal_damage',target:{ref:'event.actor'},amount:4,damageType:'piercing'}]});
 gm(g,{op:'gm_set_tile',x:1,y:3,kind:'hazard'});gm(g,{op:'gm_set_elevation',target:'hero',elevation:{feet:30,grounded:false,layer:'air'},reason:'Falling'});
 g.s.testRolls=[2,2,2];const r=gm(g,cmd({}, {landing:{feet:0,grounded:true,layer:'ground'}}));assert.equal(r.health.hp,190);assert.equal(g.find('hero').elevation.feet,0);
 gm(g,{op:'gm_set_elevation',target:'hero',elevation:{feet:0,grounded:true,layer:'ground'},reason:'Same contact'});assert.equal(g.find('hero').hp,190);
});
test('water landing can retain non-surface contact and height changes alone never roll damage',()=>{
 const g=make();g.s.testRolls=[2];gm(g,{op:'gm_set_elevation',target:'hero',elevation:{feet:100,grounded:false,layer:'air'},reason:'Start'});
 gm(g,{op:'gm_set_elevation',target:'hero',elevation:{feet:0,grounded:true,layer:'ground'},reason:'Safe descent'});assert.equal(g.find('hero').hp,200);assert.deepEqual(g.s.testRolls,[2]);
 gm(g,cmd({distanceFeet:20,surface:'water',waterDepthFeet:20},{landing:{feet:-5,grounded:false,layer:'water'}}));assert.equal(g.find('hero').elevation.feet,-5);assert(!g.groundContact(g.find('hero')));assert.deepEqual(g.s.testRolls,[2]);
});
test('undo restores impact, elevation, conditions, nonlethal and RNG together',()=>{
 const g=make();g.s.testRolls=[4,3];g.turnStart=clone(g.s);const before=g.exportState();gm(g,cmd({deliberate:true,acrobaticsTotal:15},{landing:{feet:-30,grounded:true}}));gm(g,{op:'undo_turn'});
 assert.equal(g.find('hero').hp,200);assert.equal(g.nonlethalTotal('hero'),0);assert(!g.hasCondition('hero','prone'));assert.equal(g.find('hero').elevation,undefined);assert.deepEqual(g.s.testRolls,before.testRolls);
});
test('one mixed impact makes one concentration check for the complete damage',()=>{
 const g=make();g.dispatch({op:'cast_spell',actor:'hero',spell:{name:'Test focus',level:2,casterLevel:5,concentrationBonus:100,targets:['warden'],concentration:{},effect:{conditions:['dazzled']}}});
 g.s.testRolls=[4,3,10];const r=gm(g,cmd({deliberate:true,acrobaticsTotal:15}));assert.equal(r.casting.concentration.dc,19);assert.equal(g.concentrationFor('hero').payload.injuries.length,1);assert.deepEqual(g.s.testRolls,[]);assert.equal(g._castingHit,undefined);
});
test('no object-impact rules or hidden fall timers are introduced',()=>{
 const g=make();gm(g,{op:'gm_spawn_object',id:'rock',name:'Rock',x:4,y:4,material:'stone',thicknessInches:1});assert.throws(()=>gm(g,cmd({}, {target:'rock'})),/falling-object/);
 const events=clone(g.s.pendingEvents);g.s.testRolls=[1,1,1];gm(g,cmd());assert.deepEqual(g.s.pendingEvents,events);
});
console.log(`${count} falling groups passed`);
