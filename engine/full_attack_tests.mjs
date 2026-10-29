import assert from 'node:assert/strict';
import {Game,initialState} from './core.mjs';
import {createScenario,startScenario} from './scenarios.mjs';
let count=0;
function test(name,fn){try{fn();count++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}}
const choker=()=>{const g=createScenario('choker');startScenario(g);g.find('hero').x=5;g.dispatch({op:'end_turn'});return g;};
const full=(g,target='hero')=>g.dispatch({op:'full_attack',actor:g.active().id,target});
const next=(g,target='hero')=>g.dispatch({op:'full_attack_next',actor:g.active().id,target});
test('Choker has two equal-bonus primary tentacles and correct damage profile',()=>{
 const g=choker();const slots=g.attackRoutine('warden');
 assert.deepEqual(slots.map(s=>[s.label,g.stat('warden','attack')+s.attackOffset,s.damageDie,g.stat('warden','damage')+s.damageOffset]),
 [['Tentacle 1',6,4,3],['Tentacle 2',6,4,3]]);
});
test('full attack rolls separately and consumes standard plus regular move',()=>{
 const g=choker();g.s.testRolls=[13,2,15,3];
 const first=full(g);assert.equal(first.status,'awaiting_attack');assert.equal(first.remaining,1);
 assert.deepEqual(g.s.actions.resources,{standard:0,move:1,swift:1});
 assert.equal(g.s.pendingFullAttack.index,1);
 const second=next(g);assert.equal(second.status,'done');assert.equal(second.remaining,0);
 assert.equal(g.s.pendingFullAttack,null);
 assert.equal(g.find('hero').hp,40-(2+3)-(3+3));
 assert.equal(g.s.testRolls.length,0);
 assert.ok(g.s.log.some(l=>l.includes('Tentacle 1')));
 assert.ok(g.s.log.some(l=>l.includes('Tentacle 2')));
});
test('full attack is incomplete until all strikes resolved or explicitly forfeited',()=>{
 const g=choker();full(g);
 assert.throws(()=>g.dispatch({op:'end_turn'}),/pending/);
 assert.throws(()=>g.dispatch({op:'move',actor:'warden',path:[{x:8,y:3}]}),/Finish the full attack/);
 assert.throws(()=>g.dispatch({op:'attack',actor:'warden',target:'hero'}),/Resolve pending/);
 const r=g.dispatch({op:'finish_full_attack',actor:'warden'});
 assert.equal(r.skipped,1);assert.equal(g.s.pendingFullAttack,null);
 g.dispatch({op:'move',actor:'warden',path:[{x:8,y:3}]});
 assert.equal(g.find('warden').x,8);
});
test('Choker may spend bonus move before and after full attack, as appropriate',()=>{
 const g=choker();g.dispatch({op:'move',actor:'warden',path:[{x:6,y:3}]});
 assert.deepEqual(g.s.actions.resources,{standard:1,move:1,swift:1});
 full(g);next(g);
 assert.deepEqual(g.s.actions.resources,{standard:0,move:0,swift:1});
 const other=choker();full(other);next(other);
 assert.deepEqual(other.s.actions.resources,{standard:0,move:1,swift:1});
 other.dispatch({op:'move',actor:'warden',path:[{x:8,y:3}]});
 assert.equal(other.find('warden').x,8);
});
test('ordinary move before full attack makes full-round action unavailable without special grant',()=>{
 const s=initialState();s.creatures[0].x=4;s.creatures[0].y=3;
 const g=new Game(s);g.dispatch({op:'use_action',actor:'hero',type:'move',label:'drawing equipment'});
 const state=g.exportState();
 assert.throws(()=>full(g,'warden'),/Full-round action unavailable/);
 assert.deepEqual(g.exportState(),state);
});
test('five-foot step between natural attacks is legal and does not provoke',()=>{
 const g=choker();full(g);
 const r=g.dispatch({op:'move',actor:'warden',step:true,path:[{x:6,y:3}]});
 assert.equal(r.status,'done');assert.equal(g.s.interrupt,null);
 assert.equal(g.s.pendingFullAttack.index,1);
 assert.equal(g.s.actions.step,true);
 assert.equal(next(g).status,'done');
 assert.throws(()=>g.dispatch({op:'move',actor:'warden',path:[{x:7,y:3}]}),/Already made a five-foot step/);
});
test('target for second natural attack can be different after observing first',()=>{
 const g=choker();
 const copy=structuredClone(g.find('hero'));copy.id='ally';copy.name='Another Explorer';copy.x=5;copy.y=3;copy.hp=20;copy.maxHp=20;
 g.s.creatures.push(copy);
 g.s.testRolls=[2,20,1]; // first miss; second auto-hit different target
 const first=full(g);assert.equal(first.status,'awaiting_attack');
 const second=next(g,'ally');assert.equal(second.status,'done');
 assert.equal(g.find('hero').hp,40);assert.equal(g.find('ally').hp,16);
});
test('invalid pending attack cannot consume a strike or die roll',()=>{
 const g=choker();full(g);g.find('hero').x=0;
 const snapshot=g.exportState();
 assert.throws(()=>next(g),/out of reach/);assert.deepEqual(g.exportState(),snapshot);
 g.find('hero').x=5;
 assert.equal(next(g).status,'done');
});
test('a full attack cannot be initiated a second time with a pending sequence',()=>{
 const g=choker();full(g);assert.throws(()=>full(g),/Resolve pending action/);
});
test('BAB iterative attacks generated at successively lower bonuses',()=>{
 const g=new Game();assert.deepEqual(g.attackRoutine('warden').map(s=>s.attackOffset),[0,-5]);
 g.find('warden').bab=16;assert.deepEqual(g.attackRoutine('warden').map(s=>s.attackOffset),[0,-5,-10,-15]);
});
test('single standard attack still only rolls once even with 2 natural weapons',()=>{
 const g=choker();g.s.testRolls=[17,2,17,2];
 g.dispatch({op:'attack',actor:'warden',target:'hero'});
 assert.deepEqual(g.s.testRolls,[17,2]);
});
test('actor cannot use GM override while their full attack remains unresolved',()=>{
 const g=choker();full(g);assert.throws(()=>g.dispatch({op:'admin_attack',actor:'warden',target:'hero'},'gm'),/Resolve pending/);
 assert.throws(()=>g.dispatch({op:'admin_grant_action',actor:'warden',type:'move',count:1},'actor'),/not authorized/);
});
test('undo current turn restores unused Choker full attack and Quickness grant',()=>{
 const g=choker();full(g);g.dispatch({op:'undo_turn'},'gm');
 assert.equal(g.s.pendingFullAttack,null);
 assert.deepEqual(g.s.actions.resources,{standard:1,move:2,swift:1});
});
test('full attack followed by Quickness movement still pauses for Explorer AoO',()=>{
 const g=choker();g.find('hero').x=6;g.find('hero').y=4;
 full(g);next(g);
 const m=g.dispatch({op:'move',actor:'warden',path:[{x:8,y:3}]});
 assert.equal(m.status,'interrupt');assert.equal(m.interrupt.reactor,'hero');
 assert.equal(g.find('warden').x,7,'AoO pauses in departure square');
 const r=g.dispatch({op:'resolve_interrupt',take:false},'actor');
 assert.equal(r.status,'done');assert.equal(g.find('warden').x,8);
 assert.deepEqual(g.s.actions.resources,{standard:0,move:0,swift:1});
});
test('five-foot step before full attack preserves the full-round action',()=>{
 const g=choker();g.dispatch({op:'move',actor:'warden',step:true,path:[{x:6,y:3}]});
 assert.equal(full(g).status,'awaiting_attack');
 assert.equal(next(g).status,'done');
});
console.log(`\n${count} full-attack tests passed`);
