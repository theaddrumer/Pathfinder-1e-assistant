import assert from 'node:assert/strict';
import {Game,initialState} from './core.mjs';
import {RegistryGame} from './registry.mjs';
import {createScenario,startScenario} from './scenarios.mjs';
let passed=0;
function test(name,fn){try{fn();console.log('PASS',name);passed++;}catch(error){console.error('FAIL',name);throw error;}}
function duel({actorX=0,targetX=6,actorY=3,targetY=3,reach=1,enemyReach=1,speed=30}={}){
  const s=initialState();s.tiles={};s.creatures[0].x=actorX;s.creatures[0].y=actorY;
  Object.assign(s.creatures[0],{reach,speed});
  Object.assign(s.creatures[1],{size:1,reach:enemyReach,x:targetX,y:targetY,hp:65,maxHp:65});
  return new RegistryGame(s);
}
test('explicit standard-action move retains available move action',()=>{
 const g=duel();g.dispatch({op:'move',actor:'hero',path:[{x:1,y:3}],asStandard:true});
 assert.deepEqual(g.s.actions.resources,{standard:0,move:1,swift:1});
 g.dispatch({op:'move',actor:'hero',path:[{x:2,y:3}]});assert.equal(g.find('hero').x,2);
});
test('normal move and standard-action move work in either order',()=>{
 const g=duel();g.dispatch({op:'move',actor:'hero',path:[{x:1,y:3}]});
 g.dispatch({op:'move',actor:'hero',path:[{x:2,y:3}],asStandard:true});
 assert.equal(g.s.actions.resources.standard,0);assert.equal(g.s.actions.resources.move,0);
});
test('double movement covers two speed budgets and consumes two move actions',()=>{
 const g=duel({targetX:9});const path=[1,2,3,4,5,6,7,8].map(x=>({x,y:3}));
 // Turn movement 40 ft at 30 ft speed; enemy at (9,3) does not threaten until x=8.
 assert.equal(g.dispatch({op:'double_move',actor:'hero',path}).status,'done');
 assert.equal(g.find('hero').x,8);
 assert.deepEqual(g.s.actions.resources,{standard:0,move:0,swift:1});
});
test('too-long double move fails transactionally',()=>{
 const g=duel({targetX:9,speed:10}); const before=g.exportState();
 assert.throws(()=>g.dispatch({op:'double_move',actor:'hero',path:[{x:1,y:3},{x:2,y:3},{x:3,y:3},{x:4,y:3},{x:5,y:3}]}),/movement speed budget/);
 assert.deepEqual(g.exportState(),before);
});
test('mixed diagonal and orthogonal path has correct 5/10 cost',()=>{
 const g=duel({targetX:9,targetY:7,speed:20});
 const path=[{x:1,y:4},{x:2,y:5},{x:3,y:5}];
 assert.equal(g.dispatch({op:'move',actor:'hero',path}).status,'done');
 assert.equal(g.find('hero').x,3);
});
test('charge moves to closest legal reach square and makes one +2 attack',()=>{
 const g=duel();g.s.testRolls=[10,4];const baselineAttack=g.stat('hero','attack');
 const baselineAC=g.stat('hero','ac'); const res=g.dispatch({op:'charge',actor:'hero',target:'warden'});
 assert.equal(res.status,'done');assert.equal(g.find('hero').x,5);
 assert.equal(res.attack.total,10+baselineAttack+2);
 assert.equal(g.stat('hero','ac'),baselineAC-2);
 assert.deepEqual(g.s.actions.resources,{standard:0,move:0,swift:1});
 assert.equal(g.s.pendingCharge,null);
});
test('charge chooses closest position for reach-10 attacker without approaching adjacent',()=>{
 const g=duel({reach:2,targetX:7,enemyReach:1});g.s.testRolls=[5];
 const res=g.dispatch({op:'charge',actor:'hero',target:'warden'});
 assert.equal(res.status,'done');assert.equal(g.find('hero').x,5);
});
test('charge penalizes normal, touch and flat-footed AC',()=>{
 const g=duel();const defenses=['ac','touchAc','flatFootedAc'].map(k=>g.stat('hero',k));
 g.s.testRolls=[1];g.dispatch({op:'charge',actor:'hero',target:'warden'});
 assert.deepEqual(['ac','touchAc','flatFootedAc'].map(k=>g.stat('hero',k)),defenses.map(v=>v-2));
});
test('charge AC penalty persists through opponent turn, expires at start of next own turn',()=>{
 const g=duel();const original=g.stat('hero','ac');g.s.testRolls=[1];
 g.dispatch({op:'charge',actor:'hero',target:'warden'});g.dispatch({op:'end_turn'});
 assert.equal(g.stat('hero','ac'),original-2);
 g.dispatch({op:'end_turn'});assert.equal(g.stat('hero','ac'),original);
 assert.equal(g.s.actions.activity,0,'turn-start charge effect removal must not count as an action');
});
test('charge attack waits for AoO decision and resolves once',()=>{
 const g=duel({enemyReach:2});g.s.testRolls=[1,1];
 const res=g.dispatch({op:'charge',actor:'hero',target:'warden'});
 assert.equal(res.status,'interrupt');assert.equal(g.find('hero').x,4);
 assert.equal(g.s.pendingCharge.target,'warden');
 assert.equal(g.s.log.filter(l=>l.includes('Charge attack:')).length,0);
 const done=g.dispatch({op:'resolve_interrupt',take:false});
 assert.equal(done.status,'done');assert.equal(done.charge.target,'warden');
 assert.equal(g.find('hero').x,5);
 assert.equal(g.s.log.filter(l=>l.includes('Charge attack:')).length,1);
});
test('taking AoO during charge works in automatic-rule subclass',()=>{
 const g=duel({enemyReach:2});g.s.testRolls=[1,1,1];
 const res=g.dispatch({op:'charge',actor:'hero',target:'warden'});assert.equal(res.status,'interrupt');
 const done=g.dispatch({op:'resolve_interrupt',take:true});
 assert.equal(done.status,'done');assert.equal(g.s.aooUsed.warden,1);
 assert.equal(g.s.log.filter(l=>l.includes('Charge attack:')).length,1);
});
test('charge refuses 5ft too-close target even if farther landing possible',()=>{
 const g=duel({targetX:2});const before=g.exportState();
 assert.throws(()=>g.dispatch({op:'charge',actor:'hero',target:'warden'}),/too close|No legal charge|closest attacking|requires approaching/i);
 assert.deepEqual(g.exportState(),before);
});
test('charge refuses wall-blocked closest attacking square',()=>{
 const g=duel();g.s.tiles['5,3']='wall';const before=g.exportState();
 assert.throws(()=>g.dispatch({op:'charge',actor:'hero',target:'warden'}),/No legal charge/);
 assert.deepEqual(g.exportState(),before);
});
test('charge refuses any difficult square in charging line',()=>{
 const g=duel();g.s.tiles['3,3']='difficult';
 assert.throws(()=>g.dispatch({op:'charge',actor:'hero',target:'warden'}),/No legal charge/);
});
test('charge refuses five foot step first or ordinary move first',()=>{
 const g=duel();g.dispatch({op:'move',actor:'hero',path:[{x:1,y:3}]});
 assert.throws(()=>g.dispatch({op:'charge',actor:'hero',target:'warden'}),/after other movement/);
 const f=duel();f.dispatch({op:'move',actor:'hero',step:true,path:[{x:1,y:3}]});
 assert.throws(()=>f.dispatch({op:'charge',actor:'hero',target:'warden'}),/five-foot step/);
});
test('ordinary actor may charge but cannot supply nonstandard attack defense',()=>{
 const g=duel();assert.throws(()=>g.dispatch({op:'charge',actor:'hero',target:'warden',defense:'touchAc'}),/GM adjudication/);
 assert.equal(g.dispatch({op:'charge',actor:'hero',target:'warden'}).status,'done');
});
test('charge and double move prevent further standard attacks, without removing swift',()=>{
 const g=duel();g.dispatch({op:'charge',actor:'hero',target:'warden'});
 assert.throws(()=>g.dispatch({op:'attack',actor:'hero',target:'warden'}),/unavailable/);
 assert.equal(g.s.actions.resources.swift,1);
});
test('charge into occupied or wall route fails, no RNG/action cost',()=>{
 const g=duel({targetX:7});g.s.creatures.push({...g.s.creatures[1],id:'blocker',x:3,team:'party'});
 const before=g.exportState();assert.throws(()=>g.dispatch({op:'charge',actor:'hero',target:'warden'}),/No legal charge/);
 assert.deepEqual(g.exportState(),before);
});
test('charge AC penalty and movement restore on undo',()=>{
 const g=duel();const before=g.exportState();g.dispatch({op:'charge',actor:'hero',target:'warden'});
 g.dispatch({op:'undo_turn'},'gm');assert.deepEqual(g.s.effects,before.effects);
 assert.equal(g.find('hero').x,before.creatures[0].x);
});
test('printed AC totals receive charge penalty, without rewriting their baseline',()=>{
 const g=duel();const hero=g.find('hero');
 hero.statTotals={ac:29,touchAc:19,flatFootedAc:26};
 g.dispatch({op:'charge',actor:'hero',target:'warden'});
 assert.deepEqual(['ac','touchAc','flatFootedAc'].map(stat=>g.stat('hero',stat)),[27,17,24]);
 assert.deepEqual(hero.statTotals,{ac:29,touchAc:19,flatFootedAc:26});
});
test('charging gives one attack even when an explicit full-attack routine has two',()=>{
 const g=duel();g.find('hero').attacks=[{label:'Claw 1',attackOffset:0},{label:'Claw 2',attackOffset:0}];
 g.dispatch({op:'charge',actor:'hero',target:'warden'});
 assert.equal(g.s.log.filter(l=>l.includes('Charge attack:')).length,1);
});
test('Choker Quickness extra move remains after charge with its full-round resources consumed',()=>{
 const g=createScenario('choker');startScenario(g);
 g.find('hero').x=0;g.find('hero').y=3;g.find('warden').x=7;g.find('warden').y=3;
 g.dispatch({op:'end_turn'});
 // Choker charges back toward Explorer from the far end, stopping 10 feet away.
 assert.equal(g.s.actions.resources.move,2);
 const r=g.dispatch({op:'charge',actor:'warden',target:'hero'});
 assert.ok(['done','interrupt'].includes(r.status));
 if(r.status==='interrupt')g.dispatch({op:'resolve_interrupt',take:false});
 assert.equal(g.s.actions.resources.move,1);
 assert.equal(g.s.actions.resources.standard,0);
});
console.log(`\n${passed} charge/double-movement tests passed`);
