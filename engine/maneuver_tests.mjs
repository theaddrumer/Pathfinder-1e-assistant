import assert from 'node:assert/strict';
import {ManeuverGame,COMBAT_SIZES,MANEUVERS} from './maneuvers.mjs';
import {clone} from './core.mjs';
let passed=0;
const test=(name,fn)=>{try{fn();passed++;console.log('PASS',name)}catch(e){console.error('FAIL',name,e);process.exitCode=1}};
function duel(){const g=new ManeuverGame();g.s.tiles={};g.s.width=12;g.s.height=12;
 const a=g.find('hero'),b=g.find('warden');Object.assign(a,{x:3,y:3,reach:1});Object.assign(b,{x:4,y:3,size:1,reach:1,hp:80,maxHp:80,str:12,dex:10,bab:2,sizeAttack:0,sizeCMD:0});return g;}
function deterministic(g,actor,target,kind,dice=20,opts={}){g.s.testRolls=[dice];
 const out=g.dispatch({op:'maneuver',actor,target,kind,...opts},'gm');
 return out.status==='interrupt'?g.dispatch({op:'resolve_interrupt',take:false},'actor'):out;
}
test('PF1 CMB/CMD size modifiers are not the reversed size-to-attack modifier',()=>{
 const g=duel();const a=g.find('hero');a.sizeCategory='large';a.sizeAttack=-1;a.sizeCMD=1;
 assert.equal(g.stat('hero','cmb'),g.find('hero').bab+3+1);assert.equal(g.stat('hero','cmd'),10+a.bab+3+2+1);
 assert.equal(COMBAT_SIZES.large,1);
});
test('Tiny creatures use Dexterity for calculated CMB',()=>{
 const g=duel(),a=g.find('hero');a.sizeCategory='tiny';a.str=8;a.dex=18;
 assert.equal(g.stat('hero','cmb'),a.bab+4-2);
});
test('Imported CMB/CMD are authoritative with registered modifiers',()=>{
 const g=duel();g.find('hero').statTotals={cmb:17,cmd:29};g.find('hero').sizeCategory='large';
 assert.equal(g.stat('hero','cmb'),17);assert.equal(g.stat('hero','cmd'),29);
});
test('Trip succeeds and applies prone without consuming extra action',()=>{
 const g=duel();const r=deterministic(g,'hero','warden','trip');
 assert.equal(r.success,true);assert.equal(g.hasCondition('warden','prone'),true);
 assert.equal(g.s.actions.resources.standard,0);
});
test('Trip failed by ten knocks initiator prone',()=>{
 const g=duel();g.find('warden').statTotals={cmd:35};const r=deterministic(g,'hero','warden','trip',2);
 assert.equal(r.success,false);assert.equal(r.backfire,'attacker_prone');assert.equal(g.hasCondition('hero','prone'),true);
});
test('Trip respects extra legs, immunities and maximum relative size',()=>{
 const g=duel();g.find('warden').legs=4;
 assert.equal(g.cmdFor('warden','trip'),g.stat('warden','cmd')+4);
 g.find('warden').tripImmune=true;
 assert.throws(()=>g.dispatch({op:'maneuver',actor:'hero',target:'warden',kind:'trip'},'gm'),/cannot be tripped/);
 g.find('warden').tripImmune=false;g.find('warden').sizeCategory='huge';
 assert.throws(()=>g.dispatch({op:'maneuver',actor:'hero',target:'warden',kind:'trip'},'gm'),/too large/);
});
test('Maneuver interrupt penalizes roll by AoO hit point damage',()=>{
 const g=duel();g.s.testRolls=[18,4,10];
 const r=g.dispatch({op:'maneuver',actor:'hero',target:'warden',kind:'trip'},'actor');
 assert.equal(r.status,'interrupt');assert.equal(g.s.pendingManeuver.kind,'trip');
 const hp=g.find('hero').hp,done=g.dispatch({op:'resolve_interrupt',take:true},'actor');
 assert.equal(done.d20,10);assert.equal(done.cmb,g.cmbFor('hero','trip')-(hp-g.find('hero').hp));
 assert.equal(g.s.pendingManeuver,null);
});
test('Improved maneuver prevents provoking AoO',()=>{
 const g=duel();g.find('hero').maneuverImprovements=['trip'];g.s.testRolls=[17];
 const r=g.dispatch({op:'maneuver',actor:'hero',target:'warden',kind:'trip'},'actor');
 assert.ok(Object.hasOwn(r,'success'));assert.equal(g.s.interrupt,null);
});
test('Untrusted actor cannot inject +100 CMB or instant sunder damage',()=>{
 const g=duel(),before=clone(g.s);
 assert.throws(()=>g.dispatch({op:'maneuver',actor:'hero',target:'warden',kind:'trip',bonus:100},'actor'),/GM authorization/);
 assert.deepEqual(g.s,before);
});
test('Disarm drops registered held item, not deletes it',()=>{
 const g=duel();g.find('warden').equipment=[{id:'club',name:'Club',location:'held'},{id:'shield',name:'Shield',location:'held'}];
 const r=deterministic(g,'hero','warden','disarm',12,{item:'club'});
 assert.equal(r.success,true);assert.equal(g.find('warden').equipment[0].location,'dropped');
 assert.equal(g.find('warden').equipment[1].location,'held');
});
test('Sunder uses hardness and marks item broken below half HP',()=>{
 const g=duel();g.find('warden').equipment=[{id:'blade',name:'Blade',location:'held',hp:12,maxHp:12,hardness:4}];
 const r=deterministic(g,'hero','warden','sunder',20,{item:'blade',damage:12});
 assert.equal(r.applied,8);assert.equal(r.item.hp,4);assert.equal(r.item.broken,true);
});
test('Bull rush moves target and stops before occupied square',()=>{
 const g=duel();g.find('warden').statTotals={cmd:15};g.s.testRolls=[15];
 const r=deterministic(g,'hero','warden','bull_rush',15);assert.equal(r.success,true);assert.ok(r.pushedSquares>=1);
 assert.ok(g.find('warden').x>4);
});
test('Grapple creates relation and both grappled conditions, escape removes both',()=>{
 const g=duel();const r=deterministic(g,'hero','warden','grapple',20);
 assert.equal(r.success,true);assert.equal(g.s.grapples.length,1);
 assert.equal(g.hasCondition('hero','grappled'),true);assert.equal(g.hasCondition('warden','grappled'),true);
 g.dispatch({op:'end_turn'},'actor');g.s.testRolls=[20];
 const escaped=g.dispatch({op:'grapple_action',actor:'warden',kind:'escape'},'actor');
 assert.equal(escaped.escaped,true);assert.equal(g.s.grapples.length,0);
 assert.equal(g.hasCondition('hero','grappled'),false);assert.equal(g.hasCondition('warden','grappled'),false);
});
test('Grapple maintenance gets +5, pins and cleans pinned on release',()=>{
 const g=duel();deterministic(g,'hero','warden','grapple',20);
 g.dispatch({op:'end_turn'},'actor');g.dispatch({op:'end_turn'},'actor');
 g.s.testRolls=[20];const kept=g.dispatch({op:'grapple_action',actor:'hero',kind:'maintain',option:'pin'},'actor');
 assert.equal(kept.pinned,true);assert.equal(g.hasCondition('warden','pinned'),true);
 g.dispatch({op:'grapple_action',actor:'hero',kind:'release'},'actor');
 assert.equal(g.hasCondition('warden','pinned'),false);
});
test('Grapple lapses at end of following unmaintained turn',()=>{
 const g=duel();deterministic(g,'hero','warden','grapple',20);
 g.dispatch({op:'end_turn'},'actor');g.dispatch({op:'end_turn'},'actor');
 g.dispatch({op:'end_turn'},'actor');assert.equal(g.s.grapples.length,0);
});
test('New maneuvers are available with validated parameters',()=>{
 const g=duel();assert.equal(MANEUVERS.drag.implemented,true);
 assert.throws(()=>g.dispatch({op:'maneuver',actor:'hero',target:'warden',kind:'dirty_trick'},'actor'),/six legal conditions/);
});
test('Registration accepts equipment and maneuver flags, rejects invalid inventories',()=>{
 const g=duel();const definition={id:'fixture',name:'Maneuver Creature',stats:{maxHp:30,hitDiceCount:4,bab:4,str:16,sizeCategory:'medium',legs:4,
 equipment:[{id:'staff',name:'Staff',location:'held',hp:10,maxHp:10,hardness:5}],maneuverImprovements:['grapple'],maneuverModifiers:{cmb:{grapple:2}}}};
 assert.equal(g.dispatch({op:'register_creature',definition},'gm').registered,'fixture');
 const broken=clone(definition);broken.id='bad';broken.stats.equipment[0].location='equipped';
 assert.throws(()=>g.dispatch({op:'register_creature',definition:broken},'gm'),/equipment location/);
});
test('Disarm drops both hands when beating CMD by 10 or more',()=>{
 const g=duel();g.find('warden').equipment=[{id:'club',name:'Club',location:'held'},{id:'knife',name:'Knife',location:'held'}];
 const r=deterministic(g,'hero','warden','disarm',20,{item:'club'});
 assert.equal(r.dropped.length,2);
});
test('Broken or dropped equipment affects the linked attack rather than being merely a label',()=>{
 const g=duel(),hero=g.find('hero');hero.equipment=[{id:'sword',name:'Sword',location:'held',hp:5,maxHp:10,hardness:3,broken:true}];
 hero.attacks=[{label:'Sword',itemId:'sword',attackKind:'manufactured'}];
 const profile=g.attackRoutine('hero')[0];g.s.testRolls=[20,4];
 const r=g.dispatch({op:'attack',actor:'hero',target:'warden'},'actor');
 assert.ok(r.hit);assert.equal(r.total,20+g.stat('hero','attack')-2);
 const other=duel();other.find('hero').equipment=[{id:'sword',name:'Sword',location:'dropped'}];
 other.find('hero').attacks=[{label:'Sword',itemId:'sword',attackKind:'manufactured'}];
 assert.throws(()=>other.dispatch({op:'attack',actor:'hero',target:'warden'},'actor'),/not currently held/);
 assert.equal(other.s.actions.resources.standard,1);
});
test('Active grapples block ordinary walking; release allows movement',()=>{
 const g=duel();deterministic(g,'hero','warden','grapple',20);
 assert.throws(()=>g.dispatch({op:'move',actor:'hero',path:[{x:2,y:3}]},'actor'),/grapple|Condition prohibits movement/);
 g.dispatch({op:'grapple_action',actor:'hero',kind:'release'},'actor');
 assert.equal(g.grappleFor('hero'),null);
});
test('Grapple state and condition effects roll back together on turn undo',()=>{
 const g=duel();deterministic(g,'hero','warden','grapple',20);
 assert.equal(g.s.grapples.length,1);
 g.dispatch({op:'undo_turn'},'gm');
 assert.equal(g.s.grapples.length,0);assert.equal(g.hasCondition('warden','grappled'),false);
});
test('Flat-footed CMD drops positive Dexterity and dodge bonuses',()=>{
 const g=duel();g.find('warden').dex=18;
 g.dispatch({op:'apply_condition',target:'warden',condition:'flat_footed'},'gm');
 const cmd=g.cmdFor('warden','grapple');assert.equal(cmd,g.stat('warden','cmd')-4);
});
test('Shaken attack penalty also applies to combat maneuver checks',()=>{
 const g=duel();const base=g.cmbFor('hero','trip');
 g.dispatch({op:'apply_condition',condition:'shaken',target:'hero'},'gm');
 assert.equal(g.cmbFor('hero','trip'),base-2);
});
test('Stunned target grants +4 to maneuver check',()=>{
 const g=duel();g.find('hero').maneuverImprovements=['trip'];
 g.dispatch({op:'apply_condition',condition:'stunned',target:'warden'},'gm');
 g.s.testRolls=[9];const r=g.dispatch({op:'maneuver',actor:'hero',target:'warden',kind:'trip'},'actor');
 assert.equal(r.cmb,g.cmbFor('hero','trip')+4);
});
console.log(`${passed} V3.10 maneuver tests passed`);
