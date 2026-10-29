import assert from 'node:assert/strict';
import {RegistryGame} from './registry.mjs';
import {initialState} from './core.mjs';

const creature={id:'marsh-raider-v1',name:'Marsh Raider',source:'Fictional demo creature, not a published PF statblock',
  stats:{maxHp:26,hp:26,size:1,reach:1,speed:30,str:16,dex:12,con:14,int:9,wis:10,cha:8,
    bab:3,damageDie:6,damageOther:0,statTotals:{ac:18,touchAc:11,flatFootedAc:17,initiative:1,attack:7,damage:4,fort:5,ref:2,will:1},
    abilityLinks:{attack:['str'],damage:['str'],fort:['con'],ref:['dex'],will:['wis'],ac:['dex'],touchAc:['dex'],initiative:['dex']},
    skills:{Perception:6,Intimidate:4},
    attacks:[{label:'Club',attackOffset:0,damageDie:6}]}};
const shaken={id:'shaken',name:'Shaken',source:'PF1e shaken penalty (duration adjudicated by GM)',
  mods:[{stat:'attack',value:-2},{stat:'saves',value:-2},
        {stat:'skill_checks',value:-2},{stat:'ability_checks',value:-2}]};
const state=initialState();state.tiles={};state.creatures=state.creatures.slice(0,1);
state.creatures[0].x=0;state.creatures[0].y=4;
const build=()=>new RegistryGame(state);
let count=0;
const test=(name,fn)=>{fn();console.log('PASS',name);count++};

test('GM registers and reuses creature definitions without affecting creature instances',()=>{
  const g=build();g.dispatch({op:'register_creature',definition:creature},'gm');
  g.dispatch({op:'spawn_creature',definition:creature.id,id:'raider-a',team:'enemy',x:4,y:4},'gm');
  g.dispatch({op:'spawn_creature',definition:creature.id,id:'raider-b',team:'enemy',x:5,y:5},'gm');
  assert.equal(g.s.creatures.length,3);
  assert.equal(g.stat('raider-a','ac'),18);assert.equal(g.stat('raider-b','attack'),7);
  g.find('raider-a').hp=5;
  assert.equal(g.find('raider-b').hp,26);
  assert.equal(g.s.creatureCatalog[creature.id].stats.maxHp,26);
});

test('Rejected registrations, illegal positions, and duplicate instances are atomic',()=>{
  const g=build();g.dispatch({op:'register_creature',definition:creature},'gm');
  const before=JSON.stringify(g.exportState());
  assert.throws(()=>g.dispatch({op:'spawn_creature',definition:creature.id,id:'blocked',x:0,y:4},'gm'),/blocked/);
  assert.equal(JSON.stringify(g.exportState()),before);
  assert.throws(()=>g.dispatch({op:'register_creature',definition:{...creature,id:'other',stats:{...creature.stats,immunityToEverything:true}}},'gm'),/Unsupported creature field/);
  assert.equal(JSON.stringify(g.exportState()),before);
});

test('Only GM can register, spawn, or inject effects; viewing the state is safe',()=>{
  const g=build();const snapshot=JSON.stringify(g.exportState());
  assert.throws(()=>g.dispatch({op:'register_creature',definition:creature},'actor'),/GM-only/);
  assert.throws(()=>g.dispatch({op:'register_effect',definition:shaken},'player'),/GM-only/);
  assert.equal(JSON.stringify(g.exportState()),snapshot);
  assert.equal(g.dispatch({op:'inspect'},'actor').creatures[0].name,'Explorer');
  assert.throws(()=>g.dispatch({op:'inspect'},'player'),/hidden GM state/);
  assert.throws(()=>g.dispatch({op:'inspect'},'anonymous'),/Unknown role/);
});

test('Shaken applies −2 to attack, saves, skill and ability checks without changing ability scores',()=>{
  const g=build();g.dispatch({op:'register_creature',definition:creature},'gm');
  g.dispatch({op:'register_effect',definition:shaken},'gm');
  g.dispatch({op:'spawn_creature',definition:creature.id,id:'foe',x:4,y:4},'gm');
  const before={atk:g.stat('foe','attack'),will:g.stat('foe','will'),str:g.stat('foe','str')};
  g.dispatch({op:'apply_registered_effect',definition:'shaken',target:'foe',rounds:2},'gm');
  assert.equal(g.stat('foe','attack'),before.atk-2);
  assert.equal(g.stat('foe','will'),before.will-2);
  assert.equal(g.stat('foe','str'),before.str);
  g.s.testRolls=[10,10];
  assert.equal(g.dispatch({op:'check',target:'foe',kind:'skill',subject:'Perception',dc:14},'gm').bonus,4);
  assert.equal(g.dispatch({op:'check',target:'foe',kind:'ability',subject:'str',dc:20},'gm').bonus,1);
});

test('Skill and ability checks have no automatic natural-1 failure or natural-20 success',()=>{
  const g=build();g.dispatch({op:'register_creature',definition:creature},'gm');
  g.dispatch({op:'spawn_creature',definition:creature.id,id:'foe',x:4,y:4},'gm');
  g.s.testRolls=[1,20];
  assert.equal(g.dispatch({op:'check',target:'foe',kind:'skill',subject:'Perception',dc:5},'gm').success,true);
  assert.equal(g.dispatch({op:'check',target:'foe',kind:'ability',subject:'str',dc:99},'gm').success,false);
});

test('Re-applying a condition refreshes instead of double-counting penalties',()=>{
  const g=build();g.dispatch({op:'register_creature',definition:creature},'gm');
  g.dispatch({op:'register_effect',definition:shaken},'gm');
  g.dispatch({op:'spawn_creature',definition:creature.id,id:'foe',x:4,y:4},'gm');
  const first=g.dispatch({op:'apply_registered_effect',definition:'shaken',target:'foe',rounds:1},'gm');
  const second=g.dispatch({op:'apply_registered_effect',definition:'shaken',target:'foe',rounds:4},'gm');
  assert.equal(second.refreshed,true);assert.equal(second.effectId,first.effectId);
  assert.equal(g.s.effects.length,1);assert.equal(g.s.effects[0].remaining,4);
  assert.equal(g.stat('foe','attack'),5);
});

test('Effects expire at end of the affected creature turn and stats return to baseline',()=>{
  const g=build();g.dispatch({op:'register_creature',definition:creature},'gm');
  g.dispatch({op:'register_effect',definition:shaken},'gm');
  g.dispatch({op:'spawn_creature',definition:creature.id,id:'foe',x:4,y:4},'gm');
  g.dispatch({op:'apply_registered_effect',definition:'shaken',target:'foe',rounds:2},'gm');
  g.dispatch({op:'end_turn'},'actor');g.dispatch({op:'end_turn'},'actor');
  assert.equal(g.s.effects[0].remaining,1);
  g.dispatch({op:'end_turn'},'actor');g.dispatch({op:'end_turn'},'actor');
  assert.equal(g.s.effects.length,0);assert.equal(g.stat('foe','attack'),7);
});

test('Imported printed totals and ability dependencies respond to ability penalties',()=>{
  const g=build();g.dispatch({op:'register_creature',definition:creature},'gm');
  g.dispatch({op:'spawn_creature',definition:creature.id,id:'foe',x:4,y:4},'gm');
  g.dispatch({op:'apply_effect',effect:{id:'weakness',name:'Str drain example',target:'foe',mods:[{stat:'str',value:-4}],rounds:2}},'gm');
  assert.equal(g.stat('foe','str'),12);
  assert.equal(g.stat('foe','attack'),5);
  assert.equal(g.stat('foe','damage'),2);
  assert.equal(g.stat('foe','ac'),18);
});

test('A declaration may attach a reusable declarative Quickness rule to each spawned instance',()=>{
  const g=build();const custom={...creature,id:'swift-raider',rules:[{
    id:'quickness',on:'turn_start',when:[{op:'eq',left:{ref:'event.actor'},right:{ref:'rule.owner'}}],
    actions:[{op:'grant_action',target:{ref:'rule.owner'},type:'move',count:1}]
  }]};
  g.dispatch({op:'register_creature',definition:custom},'gm');
  g.dispatch({op:'spawn_creature',definition:'swift-raider',id:'fast-1',x:4,y:4},'gm');
  g.dispatch({op:'spawn_creature',definition:'swift-raider',id:'fast-2',x:5,y:4},'gm');
  assert.equal(g.s.automationRules.length,2);
  assert.notEqual(g.s.automationRules[0].id,g.s.automationRules[1].id);
  g.dispatch({op:'end_turn'},'actor');
  assert.equal(g.active().id,'fast-1');
  assert.equal(g.s.actions.resources.move,2);
});

test('Undo removes dynamically spawned creatures AND their automation subscriptions',()=>{
  const g=build();const custom={...creature,id:'swift-raider',rules:[{
    id:'quickness',on:'turn_start',when:[{op:'eq',left:{ref:'event.actor'},right:{ref:'rule.owner'}}],
    actions:[{op:'grant_action',target:{ref:'rule.owner'},type:'move',count:1}]
  }]};
  g.dispatch({op:'register_creature',definition:custom},'gm');
  g.dispatch({op:'spawn_creature',definition:'swift-raider',id:'fast-1',x:4,y:4},'gm');
  assert.equal(g.s.automationRules.length,1);
  g.dispatch({op:'undo_turn'},'gm');
  assert.equal(g.s.creatures.length,1);
  assert.equal(g.s.automationRules.length,0);
  assert.equal(Object.hasOwn(g.s.creatureCatalog,'swift-raider'),true);
});

test('Exported state reloads as a working reusable catalog',()=>{
  const g=build();g.dispatch({op:'register_creature',definition:creature},'gm');
  g.dispatch({op:'register_effect',definition:shaken},'gm');
  const saved=JSON.parse(JSON.stringify(g.exportState()));
  const copy=new RegistryGame(saved);
  copy.dispatch({op:'spawn_creature',definition:creature.id,id:'after-reload',x:4,y:4},'gm');
  copy.dispatch({op:'apply_registered_effect',definition:'shaken',target:'after-reload',rounds:1},'gm');
  assert.equal(copy.stat('after-reload','attack'),5);
});

test('Creature definitions survive undoing a subsequent combat action',()=>{
  const g=build();g.dispatch({op:'register_creature',definition:creature},'gm');
  g.dispatch({op:'spawn_creature',definition:creature.id,id:'foe',x:4,y:4},'gm');
  g.dispatch({op:'undo_turn'},'gm');
  assert.equal(g.s.creatureCatalog[creature.id].name,'Marsh Raider');
  assert.equal(g.s.creatures.some(c=>c.id==='foe'),false);
});

test('Unknown effect stats are rejected; original stats never change',()=>{
  const g=build();const original=JSON.stringify(g.exportState());
  assert.throws(()=>g.dispatch({op:'register_effect',definition:{...shaken,mods:[{stat:'plot_armor',value:99}]}},'gm'),/Unsupported modifier/);
  assert.equal(JSON.stringify(g.exportState()),original);
});

test('Authoritative printable attack and AC participate in engine attacks',()=>{
  const g=build();g.dispatch({op:'register_creature',definition:creature},'gm');
  g.dispatch({op:'spawn_creature',definition:creature.id,id:'foe',x:1,y:4},'gm');
  g.s.testRolls=[15,3];
  const r=g.dispatch({op:'attack',actor:'hero',target:'foe'},'actor');
  assert.equal(r.total,23);assert.equal(r.hit,true);
});

console.log(`${count} runtime-registry tests passed`);
