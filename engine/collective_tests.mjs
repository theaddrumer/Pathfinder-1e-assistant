import assert from 'node:assert/strict';
import {Kernel,initialState} from './kernel.mjs';
import {AIAdapter} from './ai_adapter.mjs';
const gm=(g,c)=>g.dispatch(c,'gm'),act=(g,c)=>g.dispatch(c,'actor');
let passed=0;const test=(name,fn)=>{try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}};
function fixture(kind='swarm',size='tiny',profile={}){
 const s=initialState();s.tiles={};s.creatures=s.creatures.slice(0,1);Object.assign(s.creatures[0],{x:0,y:0,hp:500,maxHp:500});
 const g=new Kernel(s);
 const d={id:'group',name:'Synthetic collective',creatureType:'animal',subtypes:[kind],stats:{maxHp:500,size:kind==='swarm'?2:4,reach:kind==='swarm'?0:1,hitDiceCount:6,int:4,con:14},collective:{componentSize:size,attack:{components:[{damageType:'piercing',amount:10}]},...profile}};
 gm(g,{op:'register_creature',definition:d});gm(g,{op:'spawn_creature',definition:'group',id:'group',x:3,y:3});return g;
}
function hit(g,type='slashing',amount=20,metadata={},cause='weapon'){return gm(g,{op:'gm_resolve_damage',target:'group',damageType:type,amount,cause,metadata});}
function spell(g,extra={}){return gm(g,{op:'gm_resolve_spell',actor:'hero',spell:{name:'Synthetic test',level:1,casterLevel:10,targets:['group'],components:[{damageType:'fire',amount:20}],...extra}});}
function turn(g){g.s.turn=1;}
function unchanged(g,cmd,re){const before=g.exportState();assert.throws(()=>gm(g,cmd),re);assert.deepEqual(g.exportState(),before);}
test('component size is validated separately from occupied footprint',()=>{
 const g=fixture('swarm','fine');assert.equal(g.find('group').size,2);assert.equal(g.sizeCategory('group'),'fine');
 unchanged(g,{op:'gm_set_collective',target:'group',profile:{componentSize:'medium'}},/Fine/);
 unchanged(g,{op:'gm_set_collective',target:'hero',profile:{componentSize:'tiny'}},/subtype/);
 const restored=new Kernel(g.exportState());assert.equal(restored.find('group').collective.componentSize,'fine');
});
test('Fine and Diminutive weapon immunity includes magical weapons and energy riders; splash bypasses it',()=>{
 for(const size of ['fine','diminutive']){const g=fixture('swarm',size);
  assert.equal(hit(g).applied,0);assert.equal(hit(g,'slashing',20,{magical:true,ghostTouch:true}).applied,0);
  assert.equal(hit(g,'fire',20,{magical:true}).applied,0);
  assert.equal(hit(g,'fire',20,{areaEffect:true}).applied,30);
 }
});
test('Tiny physical type combinations, ordinary spell energy and troop weapon damage',()=>{
 const g=fixture();assert.equal(hit(g,'slashing',21).applied,10);assert.equal(hit(g,'piercing').applied,10);assert.equal(hit(g,'bludgeoning').applied,20);
 assert.equal(hit(g,'piercing',20,{damageTypes:['piercing','bludgeoning']}).applied,20);
 assert.equal(hit(g,'fire').applied,20);assert.equal(hit(g,'fire',20,{},'spell').applied,20);
 assert.equal(hit(fixture('troop','medium')).applied,20);
});
test('critical, precision and flank immunity distinguish troop from swarm',()=>{
 const swarm=fixture(),troop=fixture('troop','medium');assert(swarm.criticalDefenses('group').criticalImmune);assert(swarm.criticalDefenses('group').precisionImmune);
 assert(!troop.criticalDefenses('group').criticalImmune);assert(!troop.criticalDefenses('group').precisionImmune);
 for(const g of [swarm,troop])assert.equal(g.flankingInfo('hero','group',{_flanking:true}).flanking,false);
});
test('area amplification is automatic once, after saves and before energy resistance',()=>{
 const g=fixture();g.find('group').protections={resistances:{fire:5}};g.s.testRolls=[20];
 const r=spell(g,{targets:undefined,area:{shape:'sphere',origin:{x:3,y:3},sizeFeet:10},save:{type:'ref',dc:1,onSuccess:'half'}});
 const row=r.targets.find(r=>r.target==='group');assert.equal(row.packet.applied,10);assert.equal(g.find('group').hp,490);
 assert.equal(row.packet.components[0].steps.filter(x=>x.includes('×1.5')).length,1);
});
test('single/fixed-count spells including healing are blocked; explicit unrestricted effects work',()=>{
 for(const kind of ['swarm','troop']){const g=fixture(kind,kind==='swarm'?'tiny':'medium');
  const r=spell(g);assert(r.targets[0].effectImmunity.blocked);assert.equal(g.find('group').hp,500);
  hit(g,'fire',20,{},'environment');spell(g,{components:undefined,healing:{amount:20}});assert.equal(g.find('group').hp,480);
  spell(g,{targeting:'unrestricted'});assert.equal(g.find('group').hp,460);
 }
});
test('hive mind targeting exception does not erase other immunity',()=>{
 const g=fixture('swarm','tiny',{hiveMind:true});
 const e={components:undefined,effect:{rounds:2,conditions:['shaken'],tags:['mind_affecting']}};
 spell(g,e);assert(g.hasCondition('group','shaken'));
 const h=fixture('swarm','tiny',{hiveMind:true});h.find('group').mindless=true;spell(h,e);assert(!h.hasCondition('group','shaken'));
});
test('0 HP disperses immediately; healing cannot resurrect; nonlethal dispersal can recover',()=>{
 const g=fixture('troop','medium');hit(g,'fire',500,{},'environment');assert.equal(g.healthState('group').status,'dead');assert(!g.canAct('group'));assert(!g.occupiesSpace(g.find('group')));
 gm(g,{op:'gm_heal_hp',target:'group',amount:100});assert.equal(g.find('group').hp,0);
 const h=fixture('troop','medium');gm(h,{op:'gm_apply_nonlethal',target:'group',amount:500});assert.equal(h.nonlethalState('group').status,'none');
 // A single initial hit can exceed max HP without the subsequent-hit conversion rule.
 const j=fixture('troop','medium');gm(j,{op:'gm_apply_nonlethal',target:'group',amount:501});assert.equal(j.healthState('group').status,'dispersed');assert(!j.canAct('group'));
 gm(j,{op:'gm_heal_nonlethal',target:'group',amount:1});assert.equal(j.healthState('group').status,'dispersed');
 gm(j,{op:'gm_heal_nonlethal',target:'group',amount:1});assert.equal(j.healthState('group').status,'healthy');assert(j.canAct('group'));
});
test('shared occupancy both ways, swarm no AoOs, troop automatic AoO honors uses',()=>{
 const g=fixture();assert(g.legalPosition('hero',3,3));assert(g.legalPosition('group',0,0));assert.equal(g.aooLimit('group'),0);
 const h=fixture('troop','medium');Object.assign(h.find('hero'),{x:2,y:3});assert(h.threatens('group','hero'));
 const r=act(h,{op:'move',actor:'hero',path:[{x:1,y:3}]});assert.equal(r.status,'interrupt');
 const result=act(h,{op:'resolve_interrupt',take:true});assert.equal(h.find('hero').hp,490);assert.equal(h.s.aooUsed.group,1);assert.equal(result.status,'done');
});
test('completed movement deals damage once; replay and extra movement cannot multiply it',()=>{
 const g=fixture();Object.assign(g.find('hero'),{x:2,y:3});turn(g);g.find('hero').flags.combatReflexes=false;
 let r=act(g,{op:'move',actor:'group',path:[{x:2,y:3}]});
 while(r.status==='interrupt')r=act(g,{op:'resolve_interrupt',take:false});
 assert.equal(g.find('hero').hp,490);assert(g.s.actions.collectiveDamageDone);assert.equal(g.s.actions.resources.move,0);
 assert.throws(()=>act(g,{op:'collective_attack',actor:'group'}),/already/);
 act(g,{op:'end_turn'});assert.equal(g.find('hero').hp,490);
});
test('stationary turn and explicit stationary action have the same automatic damage',()=>{
 for(const explicit of [false,true]){const g=fixture('troop','medium');Object.assign(g.find('hero'),{x:2,y:3});turn(g);
  if(explicit)act(g,{op:'collective_attack',actor:'group'});act(g,{op:'end_turn'});assert.equal(g.find('hero').hp,490);
 }
});
test('automatic damage uses DR, hits allies, ignores concealment, stops at walls',()=>{
 const g=fixture('troop','medium');Object.assign(g.find('hero'),{x:2,y:3,team:'enemy',protections:{dr:[{amount:4,bypass:[]}]},defenseProfile:{concealment:50}});turn(g);
 act(g,{op:'collective_attack',actor:'group'});assert.equal(g.find('hero').hp,494);
 const h=fixture('troop','medium');Object.assign(h.find('hero'),{x:1,y:3});h.s.tiles['2,3']='wall';assert(!h.collectiveInReach('group','hero'));
});
test('swarm distraction uses save/condition pipeline and no damage means no save',()=>{
 const g=fixture('swarm','tiny',{distractionDC:20});Object.assign(g.find('hero'),{x:3,y:3});turn(g);g.s.testRolls=[1];
 act(g,{op:'collective_attack',actor:'group'});assert(g.hasCondition('hero','nauseated'));
 const h=fixture('swarm','tiny',{distractionDC:20});Object.assign(h.find('hero'),{x:3,y:3,protections:{dr:[{amount:99,bypass:[]}]}});turn(h);h.s.testRolls=[1];
 act(h,{op:'collective_attack',actor:'group'});assert(!h.hasCondition('hero','nauseated'));assert.deepEqual(h.s.testRolls,[1]);
});
test('maneuver immunity is enforced without spending actions',()=>{
 const g=fixture('troop','medium');Object.assign(g.find('hero'),{x:2,y:3});
 unchanged(g,{op:'maneuver',actor:'hero',target:'group',kind:'trip'},/traits prohibit/);
 const h=fixture();turn(h);unchanged(h,{op:'maneuver',actor:'group',target:'hero',kind:'grapple'},/traits prohibit/);
});
test('casting pressure uses caster level rather than concentration and spends the attempted action',()=>{
 const g=fixture('swarm','tiny');Object.assign(g.find('hero'),{x:3,y:3,concentrationBonus:99});g.s.testRolls=[1];
 const r=act(g,{op:'cast_spell',actor:'hero',spell:{name:'Synthetic buff',level:1,casterLevel:1,defensive:true,targets:['hero'],effect:{rounds:1,mods:[{stat:'ac',value:1,type:'luck'}]}}});
 assert.equal(r.status,'lost');assert.equal(r.collectiveCheck.total,2);assert.equal(g.s.actions.resources.standard,0);
});
test('incapacitating movement AoO prevents entry and automatic damage',()=>{
 const g=fixture();Object.assign(g.find('hero'),{x:2,y:3});g.find('group').hp=1;turn(g);
 let r=act(g,{op:'move',actor:'group',path:[{x:2,y:3}]});assert.equal(r.status,'interrupt');assert.equal(g.find('hero').hp,500);
 g.s.testRolls=[20,6];r=act(g,{op:'resolve_interrupt',take:true});assert.equal(r.status,'stopped');assert.equal(g.find('group').x,3);assert.equal(g.find('hero').hp,500);assert(!g.s.pendingMove);
});
test('pending movement survives restart and adapter retry without duplicate damage',()=>{
 const g=fixture();Object.assign(g.find('hero'),{x:2,y:3});turn(g);
 const adapter=new AIAdapter({game:g});
 const args={command:{op:'move',actor:'group',path:[{x:2,y:3}]},requestId:'collective_move',expectedRevision:adapter.revision};
 adapter.execute('action',args);assert(g.s.interrupt);assert.equal(g.find('hero').hp,500);
 const restored=new AIAdapter({saved:adapter.snapshot()});assert(restored.execute('action',args).replayed);
 const resume={command:{op:'resolve_interrupt',take:false},requestId:'collective_resume',expectedRevision:restored.revision};
 restored.execute('action',resume);assert.equal(restored.game.find('hero').hp,490);
 assert(restored.execute('action',resume).replayed);assert.equal(restored.game.find('hero').hp,490);
 assert.equal(new AIAdapter({saved:restored.snapshot()}).game.s.actions.collectiveDamageDone,true);
});
test('teleport and GM-free repositioning do not inflict automatic damage',()=>{
 const g=fixture();Object.assign(g.find('hero'),{x:1,y:1});turn(g);
 gm(g,{op:'teleport',target:'group',x:1,y:1,reason:'Synthetic forced displacement'});assert.equal(g.find('hero').hp,500);assert(!g.s.actions.collectiveDamageDone);
});
test('ordinary melee rejection rolls back actions and RNG; valid ranged profiles remain available',()=>{
 const g=fixture('troop','medium');Object.assign(g.find('hero'),{x:2,y:3});turn(g);
 unchanged(g,{op:'attack',actor:'group',target:'hero'},/collective_attack/);
 g.find('hero').x=0;g.find('group').attacks=[{label:'Synthetic bow',attackMode:'ranged',rangeIncrementFeet:30,damageDie:6,attackOffset:0}];g.s.testRolls=[1];
 const r=act(g,{op:'attack',actor:'group',target:'hero'});assert.equal(r.hit,false);assert.equal(g.s.actions.resources.standard,0);
});
test('a swarm entering a zero-reach occupant can provoke, but cannot retaliate with an AoO',()=>{
 const g=fixture();Object.assign(g.find('hero'),{x:2,y:3,reach:0});turn(g);
 const r=act(g,{op:'move',actor:'group',path:[{x:2,y:3}]});assert.equal(r.status,'interrupt');
 act(g,{op:'resolve_interrupt',take:false});assert.equal(g.find('hero').hp,490);assert.equal(g.aooLimit('group'),0);
});
test('generic targeted packets are immune and area packet accounting stays nonnegative',()=>{
 const g=fixture('troop','medium');const packet=metadata=>gm(g,{op:'gm_resolve_packet',target:'group',cause:'spell',metadata,components:[{damageType:'force',amount:20}]});
 assert.equal(packet({targeting:'creatures'}).applied,0);
 const r=packet({targeting:'area'});assert.equal(r.applied,30);assert.equal(r.scaled,30);assert.equal(r.amplified,10);assert.equal(r.prevented,0);
});
test('automatic creature damage does not silently target objects or other occupancy layers',()=>{
 const g=fixture('troop','medium');Object.assign(g.find('hero'),{x:2,y:3,objectProfile:{hardness:0}});assert(!g.collectiveInReach('group','hero'));
 delete g.find('hero').objectProfile;g.find('hero').elevation={feet:10,layer:'air',grounded:false};assert(!g.collectiveInReach('group','hero'));assert(!g.threatens('group','hero'));
});
test('an empty first move does not consume damage before a second move reaches a victim',()=>{
 const g=fixture();Object.assign(g.find('hero'),{x:0,y:3});turn(g);
 act(g,{op:'move',actor:'group',path:[{x:2,y:3}]});assert(!g.s.actions.collectiveDamageDone);
 let r=act(g,{op:'move',actor:'group',path:[{x:1,y:3},{x:0,y:3}]});
 while(r.status==='interrupt')r=act(g,{op:'resolve_interrupt',take:false});
 assert.equal(g.find('hero').hp,490);assert(g.s.actions.collectiveDamageDone);
});
console.log(`${passed} collective groups passed`);
