import assert from 'node:assert/strict';
import {createScenario,startScenario} from './scenarios.mjs';

function test(label, fn) {
  try {fn();console.log('PASS',label)} catch(e) {console.error('FAIL',label);throw e;}
}

// Reproduce Explorer approaching and attacking, followed by a Choker move
// from adjacency, which must pause for an Explorer AoO rather than fail.
function closeThenAttack() {
  const g=createScenario('choker');startScenario(g);
  // Explorer approaches to a square adjacent to the Choker in one move action.
  const r=g.dispatch({op:'move',actor:'hero',path:[{x:4,y:4},{x:5,y:4},{x:6,y:4}]});
  assert.equal(r.status,'interrupt');
  assert.equal(r.interrupt.reactor,'warden');
  g.dispatch({op:'resolve_interrupt',take:false});
  assert.deepEqual([g.find('hero').x,g.find('hero').y],[6,4]);
  g.dispatch({op:'attack',actor:'hero',target:'warden'});
  assert.ok(g.find('warden').hp>0,'Choker must survive for the test');
  g.dispatch({op:'end_turn'});
  assert.deepEqual(g.s.actions.resources,{standard:1,move:2,swift:1});
  return g;
}

test('Choker movement provokes an Explorer AoO after Explorer approaches and attacks',()=>{
  const g=closeThenAttack();
  const r=g.dispatch({op:'move',actor:'warden',path:[{x:8,y:3}]});
  assert.equal(r.status,'interrupt');
  assert.equal(r.interrupt.reactor,'hero','Explorer has AoO support');
  assert.equal(r.interrupt.target,'warden');
  assert.deepEqual(r.interrupt.from,{x:7,y:3});
  assert.deepEqual(r.interrupt.to,{x:8,y:3});
  assert.deepEqual([g.find('warden').x,g.find('warden').y],[7,3],'still at departure square until choice');
  assert.equal(g.s.actions.resources.move,1,'a move action was spent despite pause');
  g.dispatch({op:'resolve_interrupt',take:false});
  assert.deepEqual([g.find('warden').x,g.find('warden').y],[8,3],'Choker continues after Explorer declines');
  assert.equal(g.s.interrupt,null);
  // The second move action remains usable.
  const r2=g.dispatch({op:'move',actor:'warden',path:[{x:9,y:3}]});
  assert.equal(r2.status,'done');
  assert.equal(g.s.actions.resources.move,0);
});

test('Explorer may take AoO and Choker movement continues if Choker survives',()=>{
  const g=closeThenAttack();
  const r=g.dispatch({op:'move',actor:'warden',path:[{x:8,y:3}]});
  assert.equal(r.status,'interrupt');
  g.dispatch({op:'resolve_interrupt',take:true});
  assert.equal(g.s.aooUsed.hero,1);
  assert.deepEqual([g.find('warden').x,g.find('warden').y],[8,3]);
});

test('Choker extra move does not override the five-foot-step restriction',()=>{
  const g=closeThenAttack();
  const r=g.dispatch({op:'move',actor:'warden',path:[{x:8,y:3}],step:true});
  assert.equal(r.status,'done');
  const budget=JSON.stringify(g.s.actions.resources);
  assert.throws(()=>g.dispatch({op:'move',actor:'warden',path:[{x:9,y:3}]}),/Already made a five-foot step/);
  assert.equal(JSON.stringify(g.s.actions.resources),budget,'illegal attempt must not consume actions');
  assert.equal(g.s.actions.resources.move,2,'Quickness grant is retained but cannot be used to move');
});
