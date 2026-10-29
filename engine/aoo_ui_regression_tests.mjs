import assert from 'node:assert/strict';
import {createScenario,startScenario} from './scenarios.mjs';
import {Game,initialState} from './core.mjs';
let count=0;
function test(name,fn){try{fn();count++;console.log('PASS',name)}catch(e){console.error('FAIL',name);throw e}}
const move=(g,actor,path,step=false)=>g.dispatch({op:'move',actor,path,step});
test('published PF1e Choker: 10-foot reach, 20-foot move speed',()=>{
 const g=createScenario('choker');
 assert.equal(g.find('warden').reach,2);
 assert.equal(g.find('warden').speed,20);
 assert.equal(g.find('warden').size,1);
});
test('entering Choker 10-foot threat from outside produces no AoO',()=>{
 const g=createScenario('choker');startScenario(g);
 const r=move(g,'hero',[{x:4,y:4},{x:5,y:4}]);
 assert.equal(r.status,'done');assert.equal(g.s.interrupt,null);
 assert.equal(g.find('hero').x,5);
});
test('leaving Choker 10-foot threatened square to approach adjacent provokes BEFORE entry',()=>{
 const g=createScenario('choker');startScenario(g);
 move(g,'hero',[{x:4,y:4},{x:5,y:4}]);
 const r=move(g,'hero',[{x:6,y:4}]);
 assert.equal(r.status,'interrupt');assert.equal(r.interrupt.reactor,'warden');
 assert.deepEqual(r.interrupt.from,{x:5,y:4});
 assert.deepEqual(r.interrupt.to,{x:6,y:4});
 assert.equal(g.find('hero').x,5,'movement must not have executed yet');
 g.dispatch({op:'resolve_interrupt',take:false});
 assert.equal(g.find('hero').x,6);
});
test('entering a 5-foot-only threat does not provoke even when the actor ends adjacent',()=>{
 const s=initialState();s.creatures[0].x=5;s.creatures[0].y=4;
 s.creatures[1].x=7;s.creatures[1].y=3;s.creatures[1].size=1;s.creatures[1].reach=1;
 const g=new Game(s);
 const r=move(g,'hero',[{x:6,y:4}]);
 assert.equal(r.status,'done');assert.equal(g.s.interrupt,null);
});
test('leaving a 5-foot threat provokes even when moving farther away',()=>{
 const s=initialState();s.creatures[0].x=6;s.creatures[0].y=4;
 s.creatures[1].x=7;s.creatures[1].y=3;s.creatures[1].size=1;s.creatures[1].reach=1;
 const g=new Game(s);
 const r=move(g,'hero',[{x:5,y:4}]);
 assert.equal(r.status,'interrupt');assert.deepEqual(r.interrupt.from,{x:6,y:4});
});
test('five-foot step never provokes when leaving Choker natural reach',()=>{
 const g=createScenario('choker');startScenario(g);g.find('hero').x=5;
 const r=move(g,'hero',[{x:6,y:4}],true);
 assert.equal(r.status,'done');assert.equal(g.s.interrupt,null);
});
test('Choker can move towards Explorer and make a real standard attack',()=>{
 const g=createScenario('choker');startScenario(g);g.dispatch({op:'end_turn'});
 assert.deepEqual(g.s.actions.resources,{standard:1,move:2,swift:1});
 const result=move(g,'warden',[{x:6,y:3},{x:5,y:3}]);
 assert.equal(result.status,'done');
 assert.equal(g.find('warden').x,5);
 const attack=g.dispatch({op:'attack',actor:'warden',target:'hero'});
 assert.equal(typeof attack.hit,'boolean');
 assert.deepEqual(g.s.actions.resources,{standard:0,move:1,swift:1});
});
console.log(`\n${count} AoO / UI-activity regression tests passed`);
