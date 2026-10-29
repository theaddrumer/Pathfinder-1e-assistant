import assert from 'node:assert/strict';
import {AutomationGame} from './automation.mjs';
import {initialState} from './core.mjs';
import {createScenario,startScenario,auraOfMenace,blackPuddingSplit,alienPresence} from './scenarios.mjs';
let count=0;
function test(label,fn){try{fn();count++;console.log('PASS',label);}catch(e){console.error('FAIL',label);throw e;}}

test('entering an aura automatically rolls once and changes derived stats',()=>{
  const g=createScenario('archon');g.s.testRolls=[2,19];
  startScenario(g);assert.equal(g.s.effects.length,0);
  const prior=g.stat('hero','ac');
  g.dispatch({op:'move',actor:'hero',path:[{x:1,y:4}]});
  assert.equal(g.s.effects.length,1);assert.equal(g.stat('hero','ac'),prior-2);
  assert.equal(g.s.testRolls.length,1,'only one save was consumed');
});
test('remaining in aura does not repeatedly request saving throws',()=>{
  const g=createScenario('archon');g.s.testRolls=[2,17];startScenario(g);
  g.dispatch({op:'move',actor:'hero',path:[{x:1,y:4},{x:2,y:4}]});
  assert.equal(g.s.effects.length,1);assert.equal(g.s.testRolls.length,1);
});
test('successful aura save creates 24-hour immunity marker for this source',()=>{
  const g=createScenario('archon');g.s.testRolls=[20,1];startScenario(g);
  g.dispatch({op:'move',actor:'hero',path:[{x:1,y:4}]});
  assert.equal(g.s.effects.length,0);
  assert.equal(g.marker('warden','hero','menace-immune'),true);
  // Move out and back: no additional save. Simulate external relocation to isolate triggering.
  g.teleport('hero',0,4);g.teleport('hero',1,4);
  assert.equal(g.s.testRolls.length,1);
});
test('an affected creature hitting its own archon ends penalty and marks immunity',()=>{
  const g=createScenario('archon');g.s.testRolls=[1];startScenario(g);
  g.dispatch({op:'move',actor:'hero',path:[{x:1,y:4}]});
  assert.equal(g.s.effects.length,1);
  g.emit('hit',{actor:'hero',target:'warden'});
  assert.equal(g.s.effects.length,0);
  assert.equal(g.marker('warden','hero','menace-immune'),true);
});
test('automatic split cancels slashing damage and places a second pudding',()=>{
  const g=createScenario('pudding');startScenario(g);
  const result=g.dispatch({op:'deal_damage',target:'warden',source:'hero',amount:16,damageType:'slashing'},'gm');
  assert.equal(result.cancelled,true);
  assert.equal(g.find('warden').hp,52);
  const copy=g.s.creatures.find(c=>c.id.startsWith('warden-copy-'));
  assert.ok(copy);assert.equal(copy.hp,52);
  assert.equal(g.legalPosition(copy.id,copy.x,copy.y),true);
  assert.ok(g.s.automationRules.some(r=>r.owner===copy.id),'clone retains declarative split rule');
});
test('pudding takes normal fire damage',()=>{
  const g=createScenario('pudding');startScenario(g);
  const res=g.dispatch({op:'deal_damage',target:'warden',amount:16,damageType:'fire'},'gm');
  assert.equal(res.cancelled,false);assert.equal(g.find('warden').hp,89);assert.equal(g.s.creatures.length,2);
});
test('pudding at 10 or less HP cannot split',()=>{
  const g=createScenario('pudding');startScenario(g);g.find('warden').hp=10;
  const result=g.dispatch({op:'deal_damage',target:'warden',amount:6,damageType:'piercing'},'gm');
  assert.equal(result.cancelled,false);assert.equal(g.find('warden').hp,4);
});
test('Vienna aura automatically makes Fort save and teleports to legal square',()=>{
  const g=createScenario('vienna');g.s.testRolls=[1,1,19];const start={x:g.find('hero').x,y:g.find('hero').y};
  startScenario(g);const after=g.find('hero');
  assert.ok(after.x!==start.x||after.y!==start.y);
  assert.equal(g.legalPosition('hero',after.x,after.y),true);
  assert.ok(g.s.log.some(l=>l.includes('proposed')));
});
test('Undo round restores aura exposure history, effects, and coordinates',()=>{
  const g=createScenario('archon');g.s.testRolls=[1,2];startScenario(g);
  const before=g.exportState();
  g.dispatch({op:'move',actor:'hero',path:[{x:1,y:4}]});
  assert.equal(g.s.effects.length,1);
  g.dispatch({op:'undo_round'},'gm');
  assert.equal(g.find('hero').x,before.creatures[0].x);
  assert.equal(g.s.effects.length,0);
  assert.deepEqual(g.s.zonePresence,before.zonePresence);
  assert.deepEqual(g.s.testRolls,before.testRolls);
  g.dispatch({op:'move',actor:'hero',path:[{x:1,y:4}]});
  assert.equal(g.s.effects.length,1);
});
test('rejected automation is atomic across HP, rule state and RNG',()=>{
  const g=createScenario('pudding');startScenario(g);
  const bad={id:'failure-after-save',on:'ping',owner:'warden',when:[],actions:[
    {op:'set_hp',target:'hero',hp:1},
    {op:'random_relocate',target:'hero',die:20,squaresPerDie:2}
  ]};
  g.installRule(bad);g.s.testRolls=[5,5];
  const before=g.exportState();
  // Force impossible landing square by enclosing map entirely.
  g.s.tiles=Object.fromEntries(Array.from({length:80},(_,i)=>[`${i%10},${Math.floor(i/10)}`,'wall']));
  const snapshot=g.exportState();
  assert.throws(()=>g.dispatch({op:'deal_damage',target:'warden',amount:-2,damageType:'fire'},'gm'));
  assert.deepEqual(g.exportState(),snapshot);
  assert.equal(before.creatures[0].hp,40);
});
test('unknown operation is blocked when registering a rule',()=>{
  const g=createScenario('archon');
  assert.throws(()=>g.installRule({id:'evil',owner:'warden',on:'ping',when:[],actions:[{op:'execute_javascript'}]}),/Unsupported/);
});
test('optional rule can pause and be explicitly accepted or declined',()=>{
  const g=createScenario('archon');g.installRule({id:'offer',owner:'warden',on:'turn_start',when:[],actions:[
    {op:'offer_interrupt',actor:{ref:'rule.owner'},text:'Test opportunity',accept:[{op:'set_hp',target:'hero',hp:30}]}
  ]});
  g.dispatch({op:'end_turn'});
  assert.equal(g.s.interrupt.type,'rule_offer');
  g.dispatch({op:'resolve_interrupt',take:false});assert.equal(g.find('hero').hp,40);
  g.dispatch({op:'end_turn'});assert.equal(g.s.interrupt.type,'rule_offer');
  g.dispatch({op:'resolve_interrupt',take:true});assert.equal(g.find('hero').hp,30);
});
test('mid-damage optional interrupt is rejected until a resumable scheduler exists',()=>{
  const g=createScenario('pudding');
  assert.throws(()=>g.installRule({id:'unsafe-offer',owner:'warden',on:'damage_before',when:[],
    actions:[{op:'offer_interrupt',actor:{ref:'rule.owner'},text:'Decide now'}]}),/not yet supported/);
});
test('failed automatic split rolls back all earlier mutations and RNG',()=>{
  const g=createScenario('pudding');startScenario(g);
  // Make a copy impossible to place: every square except existing positions blocked.
  for(let y=0;y<g.s.height;y++)for(let x=0;x<g.s.width;x++)g.s.tiles[`${x},${y}`]='wall';
  const before=g.exportState();
  assert.throws(()=>g.dispatch({op:'deal_damage',target:'warden',source:'hero',amount:12,damageType:'slashing',cause:'weapon'},'gm'),/No legal location/);
  assert.deepEqual(g.exportState(),before);
});
test('non-weapon slashing effect does not cause black pudding split',()=>{
  const g=createScenario('pudding');startScenario(g);
  const event=g.dispatch({op:'deal_damage',target:'warden',amount:12,damageType:'slashing',cause:'spell'},'gm');
  assert.equal(event.cancelled,false);assert.equal(g.find('warden').hp,93);assert.equal(g.s.creatures.length,2);
});
test('automation engine includes rule state in turn rollback',()=>{
  const g=createScenario('pudding');startScenario(g);
  g.dispatch({op:'deal_damage',target:'warden',amount:16,damageType:'slashing'},'gm');
  assert.equal(g.s.creatures.length,3);
  g.undoTurn();
  assert.equal(g.s.creatures.length,2);
  assert.equal(g.s.automationRules.length,1);
});
test('a terrain hazard subscribes to tile-enter and deals automatic damage',()=>{
  const s=initialState();s.tiles={'2,4':'hazard'};
  const g=new AutomationGame(s);
  g.installRule({id:'world-hazard',on:'tile_enter',when:[
    {op:'eq',left:{ref:'event.tile'},right:'hazard'}],actions:[
      {op:'deal_damage',target:{ref:'event.actor'},die:4,damageType:'fire'}]});
  g.s.testRolls=[3];
  g.dispatch({op:'move',actor:'hero',path:[{x:2,y:4}]});
  assert.equal(g.find('hero').hp,37);
  assert.ok(g.s.log.some(x=>x.includes('3 fire damage')));
  g.undoTurn();assert.equal(g.find('hero').hp,40);
  assert.equal(g.find('hero').x,1);
});
console.log(`\n${count} integrated automation tests passed`);
