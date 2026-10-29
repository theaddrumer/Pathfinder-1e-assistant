import assert from 'node:assert/strict';
import {CriticalGame} from './critical.mjs';
import {clone} from './core.mjs';
let passed=0;
function test(label,fn){try{fn();passed++;console.log('PASS',label);}catch(e){console.error('FAIL',label,e.stack);process.exitCode=1;}}
const venom={id:'venom_sting',name:'Venom Sting',kind:'poison',delivery:'injury',save:{type:'fort',dc:18},
 frequency:{every:{count:1,unit:'round'},maxTicks:4},cure:{successes:2,consecutive:true},
 effects:[{kind:'ability_damage',ability:'str',dice:{count:1,sides:4}}]};
function scene(riders,other={}){const g=new CriticalGame();g.s.tiles={};g.s.width=12;g.s.height=10;
 Object.assign(g.find('hero'),{x:2,y:4,reach:1,hp:100,maxHp:100,damageDie:6,attacks:[{label:'Bite',naturalAttack:'bite',attackKind:'natural',damageDie:6,riders,...other}]});
 Object.assign(g.find('warden'),{x:3,y:4,hp:100,maxHp:100,reach:1,size:1});return g;
}
function strike(g,rolls,kind='attack'){g.s.testRolls=rolls;return g.dispatch({op:kind,actor:'hero',target:'warden'});}
test('Free Trip appears after successful hit and never consumes another standard action',()=>{
 const g=scene(['trip']);const result=strike(g,[18,3]);assert.equal(result.status,'interrupt');assert.equal(result.interrupt.rider,'trip');
 const before=g.s.actions.resources.standard;g.s.testRolls=[20];const t=g.dispatch({op:'resolve_rider',actor:'hero',mode:'normal'});
 assert.equal(t.success,true);assert.equal(t.prone,true);assert.equal(g.hasCondition('warden','prone'),true);assert.equal(g.s.actions.resources.standard,before);
});
test('Failed special Trip does not trip the attacker or provoke an AoO',()=>{
 const g=scene(['trip']);strike(g,[18,4]);g.s.testRolls=[1];const r=g.dispatch({op:'resolve_rider',actor:'hero',mode:'trip'});
 assert.equal(r.success,false);assert.equal(g.hasCondition('hero','prone'),false);assert.equal(g.s.interrupt,null);
});
test('Trip and Grab share a serial decision queue without repeating attack damage',()=>{
 const g=scene(['trip','grab']);let r=strike(g,[15,3]);const hp=g.find('warden').hp;
 assert.equal(r.interrupt.rider,'trip');r=g.dispatch({op:'resolve_rider',actor:'hero',mode:'decline'});
 assert.equal(r.status,'interrupt');assert.equal(r.interrupt.rider,'grab');
 r=g.dispatch({op:'resolve_rider',actor:'hero',mode:'decline'});
 assert.equal(g.find('warden').hp,hp);assert.equal(g.s.interrupt,null);
});
test('Trip on hit during full attack applies prone without charging a second action',()=>{
 const g=scene(['trip']);g.find('hero').attacks.push({label:'Claw',damageDie:4});
 let r=strike(g,[18,3],'full_attack');assert.equal(r.attack.status,'interrupt');
 g.s.testRolls=[20];r=g.dispatch({op:'resolve_rider',actor:'hero',mode:'normal'});
 assert.equal(r.prone,true);assert.equal(g.s.pendingFullAttack.index,1);
 g.s.testRolls=[18,3];r=g.dispatch({op:'full_attack_next',actor:'hero',target:'warden'});assert.equal(r.status,'done');
});
test('Injury poison uses registered ailment and its initial Fortitude saving throw',()=>{
 const g=scene(['poison'],{poisonId:'venom_sting'});g.dispatch({op:'register_ailment',definition:venom},'gm');
 const r=strike(g,[18,3,1,3]);assert.equal(r.riders[0].rider,'poison');assert.equal(r.riders[0].resisted,false);
 assert.equal(g.s.abilityDamage.warden.str,3);assert.equal(g.s.activeAilments.length,1);
});
test('Injury poison does not apply when DR prevents all weapon damage',()=>{
 const g=scene(['poison'],{poisonId:'venom_sting'});g.dispatch({op:'register_ailment',definition:venom},'gm');
 g.find('warden').protections={dr:[{amount:100,bypass:[]}]};const r=strike(g,[18,3]);
 assert.equal(r.damage.applied,0);assert.match(r.riders[0].skipped,/penetrating/);assert.equal(g.s.activeAilments.length,0);
});
test('Poison immunity from type/subtype stops injury rider',()=>{
 const g=scene(['poison'],{poisonId:'venom_sting'});g.dispatch({op:'register_ailment',definition:venom},'gm');
 g.find('warden').creatureType='undead';const r=strike(g,[18,3]);assert.equal(r.riders[0].immune,true);
 assert.equal(g.s.activeAilments.length,0);
});
test('Missing poison definition errors before rolling and restores state',()=>{
 const g=scene(['poison'],{poisonId:'venom_sting'});g.s.testRolls=[18,3];const before=clone(g.s);
 assert.throws(()=>g.dispatch({op:'attack',actor:'hero',target:'warden'}),/registered injury poison/);
 assert.deepEqual(g.s,before);
});
test('Bleed applies as a recurring ailment, ticking at next target turn start',()=>{
 const g=scene(['bleed'],{bleedAmount:3});const r=strike(g,[18,4]);assert.equal(r.riders[0].rider,'bleed');
 assert.equal(g.hasCondition('warden','bleed'),true);const hp=g.find('warden').hp;
 g.dispatch({op:'end_turn'});assert.equal(g.find('warden').hp,hp-3);
});
test('Bleed same damage kind uses worse amount rather than stacking, and curing clears condition',()=>{
 const g=scene(['bleed'],{bleedAmount:3});strike(g,[18,4]);
 const first=g.s.riderBleed.warden.ailmentId;g.find('hero').attacks[0].bleedAmount=2;
 g.s.testRolls=[18,3];g.resolveAttack('hero','warden','Test follow-up',g.find('hero').attacks[0]);
 assert.equal(g.s.riderBleed.warden.amount,3);assert.equal(g.s.activeAilments.length,1);
 g.find('hero').attacks[0].bleedAmount=5;g.s.testRolls=[18,3];g.resolveAttack('hero','warden','Test follow-up',g.find('hero').attacks[0]);
 assert.equal(g.s.riderBleed.warden.amount,5);assert.equal(g.s.activeAilments.length,1);
 assert.notEqual(g.s.riderBleed.warden.ailmentId,first);
 const id=g.s.riderBleed.warden.ailmentId;g.dispatch({op:'cure_ailment',id},'gm');
 assert.equal(g.hasCondition('warden','bleed'),false);assert.equal(g.s.riderBleed.warden,undefined);
});
test('Bleed immunity from elemental subtype does not create affliction',()=>{
 const g=scene(['bleed'],{bleedAmount:3});g.find('warden').subtypes=['elemental'];
 const r=strike(g,[18,3]);assert.equal(r.riders[0].immune,true);assert.equal(g.s.activeAilments.length,0);
});
test('Paralysis Fort save failure applies timed condition, success does not',()=>{
 const g=scene(['paralysis'],{paralysisDC:18,paralysisRounds:3});
 let r=strike(g,[18,3,1]);assert.equal(r.riders[0].resisted,false);assert.equal(g.hasCondition('warden','paralyzed'),true);
 const h=scene(['paralysis'],{paralysisDC:18,paralysisRounds:3});r=strike(h,[18,3,20]);
 assert.equal(r.riders[0].resisted,true);assert.equal(h.hasCondition('warden','paralyzed'),false);
});
test('Paralysis immunity suppresses saving throw',()=>{
 const g=scene(['paralysis'],{paralysisDC:18,paralysisRounds:3});g.find('warden').creatureType='undead';
 const r=strike(g,[18,3]);assert.equal(r.riders[0].immune,true);assert.equal(g.hasCondition('warden','paralyzed'),false);
});
test('Malformed rider parameter validation is strict',()=>{
 const g=scene([]);const base={id:'wrong',name:'Invalid',stats:{maxHp:30,attacks:[{label:'Fang'}]}};
 for(const a of [{riders:['poison']},{riders:['bleed']},{riders:['paralysis'],paralysisDC:17},{riders:['trip'],bleedAmount:5}]){
  base.stats.attacks=[{label:'Fang',...a}];assert.throws(()=>g.dispatch({op:'register_creature',definition:base},'gm'));
 }
});
console.log(`${passed} V3.14 offensive rider tests passed`);
