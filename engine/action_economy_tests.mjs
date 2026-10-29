import assert from 'node:assert/strict';
import {Game,initialState} from './core.mjs';
import {AutomationGame} from './automation.mjs';
import {createScenario,startScenario,chokerQuickness} from './scenarios.mjs';
let count=0;
function test(name,fn){try{fn();console.log('PASS',name);count++;}catch(e){console.error('FAIL',name);throw e;}}
const action=(g,actor,type)=>g.dispatch({op:'use_action',actor,type,label:'action-budget test'});
test('normal action pool: one standard, one move, one swift',()=>{
 const g=new Game();assert.deepEqual(g.s.actions.resources,{standard:1,move:1,swift:1});
 action(g,'hero','move');action(g,'hero','standard');action(g,'hero','swift');
 assert.deepEqual(g.s.actions.resources,{standard:0,move:0,swift:0});
 assert.throws(()=>action(g,'hero','standard'),/unavailable/);
 assert.throws(()=>action(g,'hero','swift'),/unavailable/);
});
test('a standard can substitute for a second move, never the reverse',()=>{
 const g=new Game();action(g,'hero','move');action(g,'hero','move');
 assert.deepEqual(g.s.actions.resources,{standard:0,move:0,swift:1});
 assert.throws(()=>action(g,'hero','move'),/No move or standard/);
 assert.throws(()=>g.dispatch({op:'attack',actor:'hero',target:'warden'}),/unavailable/);
});
test('third normal movement denied transactionally',()=>{
 const g=new Game();
 g.dispatch({op:'move',actor:'hero',path:[{x:2,y:4}]});
 g.dispatch({op:'move',actor:'hero',path:[{x:1,y:4}]});
 const snapshot=g.exportState();
 assert.throws(()=>g.dispatch({op:'move',actor:'hero',path:[{x:2,y:4}]}),/No move or standard/);
 assert.deepEqual(g.exportState(),snapshot);
});
test('normal move followed by attack consumes the separate standard',()=>{
 const s=initialState();s.creatures[0].x=4;
 const duel=new Game(s);duel.dispatch({op:'use_action',actor:'hero',type:'move',label:'draw weapon'});
 duel.dispatch({op:'attack',actor:'hero',target:'warden'});
 assert.deepEqual(duel.s.actions.resources,{standard:0,move:0,swift:1});
 assert.throws(()=>duel.dispatch({op:'attack',actor:'hero',target:'warden'}),/unavailable/);
});
test('five-foot step uses no move action, but disallows other actual movement',()=>{
 const g=new Game();g.dispatch({op:'use_action',actor:'hero',type:'move',label:'draw weapon'});
 g.dispatch({op:'move',actor:'hero',step:true,path:[{x:2,y:4}]});
 assert.equal(g.s.actions.resources.standard,1);
 assert.throws(()=>g.dispatch({op:'move',actor:'hero',path:[{x:1,y:4}]}),/Already made/);
});
test('ordinary movement precludes later five-foot step',()=>{
 const g=new Game();g.dispatch({op:'move',actor:'hero',path:[{x:2,y:4}]});
 assert.throws(()=>g.dispatch({op:'move',actor:'hero',step:true,path:[{x:1,y:4}]}),/unavailable/);
});
test('full-round action costs standard and move, but leaves swift and step available',()=>{
 const g=new Game();action(g,'hero','full_round');
 assert.deepEqual(g.s.actions.resources,{standard:0,move:0,swift:1});
 action(g,'hero','swift');
 g.dispatch({op:'move',actor:'hero',step:true,path:[{x:2,y:4}]});
 assert.throws(()=>action(g,'hero','full_round'),/unavailable/);
});
test('invalid attack does not consume standard and does not advance the RNG',()=>{
 const g=new Game();const saved=g.exportState();
 assert.throws(()=>g.dispatch({op:'attack',actor:'hero',target:'warden'}),/out of reach/);
 assert.deepEqual(g.exportState(),saved);
});
test('AoO reactions do not consume active actor standard action',()=>{
 const g=new Game();g.find('hero').x=4;
 g.dispatch({op:'end_turn'}); // warden now active
 const status=g.dispatch({op:'move',actor:'warden',path:[{x:6,y:3}]});
 assert.equal(status.status,'interrupt');
 assert.equal(status.interrupt.reactor,'hero');
 g.dispatch({op:'resolve_interrupt',take:true},'player');
 assert.equal(g.s.aooUsed.hero,1);
 assert.equal(g.s.actions.resources.standard,1);
});
test('AI actor role can take actions, but cannot use GM-only effects or action grants',()=>{
 const g=new Game();g.dispatch({op:'use_action',actor:'hero',type:'move',label:'ordinary move equivalent'},'actor');
 assert.equal(g.s.actions.resources.move,0);
 assert.throws(()=>g.dispatch({op:'admin_grant_action',actor:'hero',type:'move'},'actor'),/not authorized/);
 assert.throws(()=>g.dispatch({op:'admin_attack',actor:'hero',target:'warden'},'actor'),/not authorized/);
 const auto=createScenario('pudding');startScenario(auto);
 assert.throws(()=>auto.dispatch({op:'deal_damage',target:'warden',amount:16},'actor'),/Only GM/);
 assert.throws(()=>auto.dispatch({op:'admin_damage',target:'warden',amount:16},'actor'),/Only GM/);
});
test('omitted role defaults to restricted actor, not administrator',()=>{
 const g=new Game();
 assert.throws(()=>g.dispatch({op:'apply_effect',effect:{id:'priv',name:'Privileged',target:'hero',mods:[]}}),/not authorized/);
 assert.throws(()=>g.dispatch({op:'admin_grant_action',actor:'hero',type:'move'}),/not authorized/);
});
test('GM-only override attacks do not spend creature actions',()=>{
 const s=initialState();s.creatures[0].x=4;const g=new Game(s);
 action(g,'hero','standard');
 const before=structuredClone(g.s.actions.resources);
 g.dispatch({op:'admin_attack',actor:'hero',target:'warden'},'gm');
 assert.deepEqual(g.s.actions.resources,before);
 assert.ok(g.s.log.some(x=>x.includes('GM override attack')));
});
test('GM direct damage cannot be used by a player; explicit admin damage remains action-free',()=>{
 const g=createScenario('pudding');startScenario(g);
 assert.throws(()=>g.dispatch({op:'admin_damage',target:'warden',amount:4},'player'),/Only GM/);
 const initial=structuredClone(g.s.actions.resources);
 g.dispatch({op:'admin_damage',target:'warden',amount:4,damageType:'fire'},'gm');
 g.dispatch({op:'admin_damage',target:'warden',amount:4,damageType:'fire'},'gm');
 assert.deepEqual(g.s.actions.resources,initial);
 assert.equal(g.find('warden').hp,97);
});
test('player cannot decide an enemy interrupt or manipulate grants',()=>{
 const g=new Game();g.find('hero').x=3;
 g.dispatch({op:'move',actor:'hero',path:[{x:4,y:4}]});
 assert.equal(g.s.interrupt.type,'aoo');
 assert.throws(()=>g.dispatch({op:'resolve_interrupt',take:true},'player'),/Player may only decide Explorer/);
 assert.throws(()=>g.dispatch({op:'admin_grant_action',actor:'hero',type:'move'},'player'),/not authorized/);
});
test('Choker Quickness is declarative, grants 1 extra move on turn start',()=>{
 const g=createScenario('choker');startScenario(g);
 assert.equal(g.s.actions.resources.move,1,'Hero does not get Choker ability');
 g.dispatch({op:'end_turn'});
 assert.equal(g.active().id,'warden');
 assert.deepEqual(g.s.actions.resources,{standard:1,move:2,swift:1});
 assert.deepEqual(g.s.actions.grants.map(x=>x.source),['choker-quickness']);
 action(g,'warden','move');action(g,'warden','move');
 assert.equal(g.s.actions.resources.standard,1,'extra move does not consume standard');
 action(g,'warden','standard');
 assert.throws(()=>action(g,'warden','move'),/No move or standard/);
});
test('Choker third actual movement is legal; fourth is rejected',()=>{
 const g=createScenario('choker');startScenario(g);g.dispatch({op:'end_turn'});
 g.dispatch({op:'move',actor:'warden',path:[{x:8,y:3}]});
 g.dispatch({op:'move',actor:'warden',path:[{x:9,y:3}]});
 g.dispatch({op:'move',actor:'warden',path:[{x:8,y:3}]});
 assert.deepEqual(g.s.actions.resources,{standard:0,move:0,swift:1});
 assert.throws(()=>g.dispatch({op:'move',actor:'warden',path:[{x:9,y:3}]}),/No move or standard/);
});
test('Choker can full-round act and still spend bonus move action',()=>{
 const g=createScenario('choker');startScenario(g);g.dispatch({op:'end_turn'});
 action(g,'warden','full_round');assert.equal(g.s.actions.resources.move,1);
 action(g,'warden','move');assert.equal(g.s.actions.resources.move,0);
});
test('Choker gets only one extra move each turn, including later rounds',()=>{
 const g=createScenario('choker');startScenario(g);g.dispatch({op:'end_turn'});
 action(g,'warden','move');g.dispatch({op:'end_turn'});
 assert.deepEqual(g.s.actions.resources,{standard:1,move:1,swift:1});
 g.dispatch({op:'end_turn'});
 assert.deepEqual(g.s.actions.resources,{standard:1,move:2,swift:1});
 assert.equal(g.s.actions.grants.length,1);
});
test('undo turn restores Choker Quickness pool and GM-grant source audit',()=>{
 const g=createScenario('choker');startScenario(g);g.dispatch({op:'end_turn'});
 action(g,'warden','move');
 g.dispatch({op:'admin_grant_action',actor:'warden',type:'swift',source:'test override'},'gm');
 assert.equal(g.s.actions.resources.swift,2);
 g.dispatch({op:'undo_turn'},'gm');
 assert.deepEqual(g.s.actions.resources,{standard:1,move:2,swift:1});
 assert.deepEqual(g.s.actions.grants.map(x=>x.source),['choker-quickness']);
});
test('failed grant command leaves action pool and activity unchanged',()=>{
 const g=new Game(),before=g.exportState();
 assert.throws(()=>g.dispatch({op:'admin_grant_action',actor:'hero',type:'full_round'},'gm'),/Unsupported/);
 assert.deepEqual(g.exportState(),before);
});
test('registered action grant validates types and does not allow fake commands',()=>{
 const g=new AutomationGame(initialState());
 assert.throws(()=>g.installRule({id:'bad-grant',on:'turn_start',when:[],actions:[{op:'grant_action',target:'hero',type:'full_round'}]}),/Invalid/);
 assert.equal(g.s.automationRules.length,0);
 assert.ok(chokerQuickness.actions[0].op==='grant_action');
});
console.log(`\n${count} action economy tests passed`);
