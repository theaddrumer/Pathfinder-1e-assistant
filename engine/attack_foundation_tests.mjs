import assert from 'node:assert/strict';
import {FoundationsGame} from './foundations.mjs';
import {attackDescription, ATTACK_RIDERS} from './attack_library.mjs';
import {createScenario,startScenario} from './scenarios.mjs';
const results=[];
function test(name,fn){try{fn();console.log('PASS',name);results.push(name);}catch(e){console.error('FAIL',name,e);process.exitCode=1;}}
function duel(){const g=new FoundationsGame();g.s.tiles={};g.find('hero').x=2;g.find('hero').y=2;g.find('warden').x=3;g.find('warden').y=2;return g;}
function register(g,stats,extras={}){return g.dispatch({op:'register_creature',definition:{id:'predator',name:'Experimental Predator',stats:{maxHp:38,hitDiceCount:5,damageDie:6,bab:5,str:18,reach:2, ...stats},...extras}},'gm');}
function install(g,stats,extras={}){const s={...stats};delete s.ac;register(g,s,extras);g.dispatch({op:'spawn_creature',definition:'predator',id:'predator_1',x:5,y:4},'gm');return g;}
test('a single natural attack does not gain manufactured BAB iterative strikes',()=>{
 const g=duel();g.find('hero').bab=17;g.find('hero').naturalAttack='bite';g.find('hero').attackKind='natural';
 assert.equal(g.attackRoutine('hero').length,1);
});
test('standard attack uses the selected imported attack slot, including its named rider',()=>{
 const g=duel();g.find('hero').attacks=[
  {label:'Slam',naturalAttack:'slam',attackKind:'natural',damageDie:6},
  {label:'Bite + Grab',naturalAttack:'bite',attackKind:'natural',damageDie:6,riders:['grab']}];
 g.find('warden').protections={dr:[{amount:10,bypass:['piercing']}]};
 g.s.testRolls=[18,6];const r=g.dispatch({op:'attack',actor:'hero',target:'warden',index:1},'actor');
 assert.equal(r.hit,true);assert.equal(r.damage.prevented,0);
 assert.ok(g.s.log.some(s=>s.includes('optional riders grab')));
});
test('natural bite defaults to one simultaneous B/P/S damage roll',()=>{
 const profile=attackDescription({naturalAttack:'bite',attackKind:'natural',riders:['grab']});
 assert.deepEqual(profile.damageTypes,['bludgeoning','piercing','slashing']);
 assert.equal(profile.riders[0].status,'implemented_via_rider_game');
});
test('natural claw and sting have the Bestiary default damage types',()=>{
 assert.deepEqual(attackDescription({naturalAttack:'claw'}).damageTypes,['bludgeoning','slashing']);
 assert.deepEqual(attackDescription({naturalAttack:'sting'}).damageTypes,['piercing']);
});
test('multi-typed bite still triggers Black Pudding Split from piercing/slashing',()=>{
 const g=createScenario('pudding');startScenario(g);
 g.find('hero').naturalAttack='bite';g.find('hero').attackKind='natural';g.s.testRolls=[18,6];
 const result=g.dispatch({op:'attack',actor:'hero',target:'warden'},'actor');
 assert.equal(result.hit,true);assert.equal(result.damage.cancelled,true);
 assert.ok(g.s.creatures.some(c=>c.id.startsWith('warden-copy-')));
});
test('grab is defined independently of bite, including +4, -20 and optional action',()=>{
 const grab=ATTACK_RIDERS.grab;
 assert.match(grab.action,/\+4/);assert.match(grab.modes[1],/−20|-20/);assert.match(grab.activation,/optional/);
 assert.ok(!attackDescription({naturalAttack:'bite'}).riders.length);
});
test('multi-type bite bypasses either DR/slashing or DR/piercing',()=>{
 for(const type of ['slashing','piercing','bludgeoning']){
  const g=duel();g.find('hero').naturalAttack='bite';g.find('warden').protections={dr:[{amount:10,bypass:[type]}]};
  g.s.testRolls=[15,6];const hp=g.find('warden').hp;
  const r=g.dispatch({op:'attack',actor:'hero',target:'warden'},'actor');
  assert.equal(r.hit,true);assert.equal(r.damage.applied,hp-g.find('warden').hp);
  assert.equal(r.damage.prevented,0,`${type} should bypass DR`);
 }
});
test('mixed damage types do not create multiple damage rolls or multiple DR reductions',()=>{
 const g=duel();g.find('hero').naturalAttack='bite';g.find('warden').protections={dr:[{amount:3,bypass:['silver']}]};
 g.s.testRolls=[15,6];const r=g.dispatch({op:'attack',actor:'hero',target:'warden'},'actor');
 assert.equal(r.damage.prevented,3);assert.equal(r.damage.raw,r.damage.applied+3);
});
test('imported creature attack descriptors survive registration, instantiation and readback',()=>{
 const g=duel();install(g,{attacks:[{label:'Bite + Grab',naturalAttack:'bite',attackKind:'natural',damageDie:6,riders:['grab']}],damageDie:6});
 const out=g.dispatch({op:'gm_describe_attack',actor:'predator_1',index:0},'gm');
 assert.deepEqual(out.damageTypes,['bludgeoning','piercing','slashing']);assert.equal(out.riders[0].id,'grab');
 assert.equal(out.riders[0].status,'implemented_via_rider_game');
});
test('weapon profiles can independently declare simultaneous B/P damage',()=>{
 const g=duel();install(g,{attacks:[{label:'War Pick',attackKind:'manufactured',damageTypes:['bludgeoning','piercing']}],damageDie:6});
 const info=g.dispatch({op:'gm_describe_attack',actor:'predator_1',index:0},'gm');
 assert.deepEqual(info.damageTypes,['bludgeoning','piercing']);
});
test('multi-type packet component uses one amount and may bypass slash-based DR',()=>{
 const g=duel();g.find('warden').protections={dr:[{amount:12,bypass:['slashing']}]};
 const r=g.dispatch({op:'gm_resolve_packet',target:'warden',source:'hero',cause:'weapon',components:[{damageType:'bludgeoning',damageTypes:['bludgeoning','slashing'],amount:14}]},'gm');
 assert.equal(r.applied,14);assert.equal(r.components.length,1);assert.equal(r.drPrevented,0);
});
test('separate fire component is not merged with bite physical DR or rolled three times',()=>{
 const g=duel();g.find('warden').protections={dr:[{amount:6,bypass:['silver']}],resistances:{fire:5}};
 const r=g.dispatch({op:'gm_resolve_packet',target:'warden',source:'hero',cause:'weapon',components:[{damageType:'bludgeoning',damageTypes:['bludgeoning','piercing','slashing'],amount:10},{damageType:'fire',amount:8}]},'gm');
 assert.equal(r.applied,7);assert.equal(r.drPrevented,6);
});
test('malformed imported attack records and unknown riders fail atomically',()=>{
 const g=duel();const before=g.s.creatureCatalog;
 assert.throws(()=>register(g,{attacks:[{label:'Bite',naturalAttack:'bite',riders:['made_up']}]}),/rider/i);
 assert.throws(()=>register(g,{attacks:[{label:'Bite',naturalAttack:'bite',damageTypes:['fire']}]}),/physical/i);
 assert.deepEqual(g.s.creatureCatalog,before);
});
test('ranged profiles without a specified range cannot execute',()=>{
 const g=duel();g.find('hero').attacks=[{label:'Bow',attackKind:'manufactured',attackMode:'ranged',damageTypes:['piercing']}];
 const before=g.s.seed;g.s.testRolls=[16];
 assert.throws(()=>g.dispatch({op:'full_attack',actor:'hero',target:'warden'},'actor'),/require a range increment/i);
 assert.equal(g.s.seed,before);assert.deepEqual(g.s.testRolls,[16]);
});
test('attack rider does not automatically grapple or deal Constrict damage',()=>{
 const g=duel();g.find('hero').naturalAttack='bite';g.find('hero').riders=['grab'];g.s.testRolls=[15,6];
 const r=g.dispatch({op:'attack',actor:'hero',target:'warden'},'actor');
 assert.equal(r.hit,true);assert.equal(g.s.log.at(-1)?.includes('grab'),true);assert.equal(g.s.conditionInstances?.length||0,0);
});
if(!process.exitCode)console.log(`${results.length} attack foundation tests passed`);
