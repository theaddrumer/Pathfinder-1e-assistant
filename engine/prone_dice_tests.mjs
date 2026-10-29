import assert from 'node:assert/strict';
import {Kernel,initialState} from './kernel.mjs';
import {AIAdapter,ENGINE_VERSION} from './ai_adapter.mjs';
import {callTool} from './mcp_tools.mjs';
import {clone} from './core.mjs';
let count=0,seq=0;
const test=(name,fn)=>{fn();count++;console.log('PASS',name);};
const gm=(g,c)=>g.dispatch(c,'gm');
const prone=(g,target='hero')=>gm(g,{op:'apply_condition',target,condition:'prone'});
function make(profile={label:'Sword',attackMode:'melee',damageDie:6}){
 const s=initialState();s.tiles={};
 Object.assign(s.creatures[0],{x:1,y:3,hp:200,maxHp:200,attacks:[profile]});
 Object.assign(s.creatures[1],{x:2,y:3,size:1,reach:1,hp:200,maxHp:200,armor:0,natural:0});
 return new Kernel(s);
}
const ranged=(more={})=>({label:'Ranged weapon',attackMode:'ranged',rangedKind:'projectile',rangeIncrementFeet:60,damageDie:6,firingIntoMelee:false,...more});
const check=g=>{g.s.testRolls=[15,15];return g.resolveAttackCheck('hero','warden','Test',g.attackRoutine('hero')[0]);};
test('prone penalizes melee and melee touch once, including confirmations and printed totals',()=>{
 for(const mode of ['melee','melee_touch'])for(const printed of [false,true]){
  const g=make({label:'Contact',attackMode:mode,damageDie:6});if(printed)g.find('hero').statTotals={attack:12};
  g.s.testRolls=[20,15];const a=g.resolveAttackCheck('hero','warden','Test',g.attackRoutine('hero')[0]);prone(g);
  g.s.testRolls=[20,15];const b=g.resolveAttackCheck('hero','warden','Test',g.attackRoutine('hero')[0]);
  assert.equal(b.total,a.total-4);assert.equal(b.confirmation.total,a.confirmation.total-4);
  assert.equal(g._attackContext,undefined);
 }
});
test('rules-declared ranged exceptions keep their standing attack bonus',()=>{
 for(const [label,kind] of [['Crossbow','projectile'],['Firearm','projectile'],['Shuriken','thrown']]){
  const g=make(ranged({label,rangedKind:kind,usableWhileProne:true}));const standing=check(g);prone(g);const lying=check(g);
  assert.equal(lying.total,standing.total);assert.equal(g.dispatch({op:'gm_describe_attack',actor:'hero',index:0},'gm').usableWhileProne,true);
 }
});
test('ranged touch weapons are not confused with rays',()=>{
 const g=make(ranged({attackMode:'ranged_touch'}));prone(g);assert.throws(()=>check(g),/Prone/);
 g.find('hero').attacks[0].usableWhileProne=true;assert(check(g).hit);
});
test('prone weapon rejection leaves action, ammunition, RNG, revision and continuations unchanged',()=>{
 for(const op of ['attack','full_attack']){
  const g=make(ranged({label:'Crossbow name alone is not a rule',ammoId:'bolts'}));
  g.find('hero').ammunition={bolts:{type:'loaded',capacity:2,loaded:2,reserve:4}};prone(g);g.s.testRolls=[20,20,6];
  const a=new AIAdapter({game:g}),before=a.snapshot();
  const r=callTool(a,'kernel_action',{command:{op,actor:'hero',target:'warden'},requestId:'blocked',expectedRevision:a.revision});
  assert(r.isError);assert.match(r.structuredContent.error.message,/usableWhileProne/);assert.deepEqual(a.snapshot(),before);
 }
});
test('prone exceptions still pay ammunition/action exactly once through ranged AoO continuation',()=>{
 const g=make(ranged({usableWhileProne:true,ammoId:'bolts'}));g.find('hero').ammunition={bolts:{type:'loaded',capacity:1,loaded:1,reserve:3}};prone(g);
 const r=g.dispatch({op:'attack',actor:'hero',target:'warden'});assert.equal(r.status,'interrupt');assert.equal(g.find('hero').ammunition.bolts.loaded,1);
 g.s.testRolls=[15,3];g.dispatch({op:'resolve_interrupt',take:false});assert.equal(g.find('hero').ammunition.bolts.loaded,0);assert.equal(g.s.actions.resources.standard,0);assert(!g.s.pendingRangedAction);
});
test('a ranged shot made illegal by a reaction stops cleanly without spending ammunition',()=>{
 const g=make(ranged({ammoId:'arrows'}));g.find('hero').ammunition={arrows:{type:'reserve',reserve:5}};
 assert.equal(g.dispatch({op:'attack',actor:'hero',target:'warden'}).status,'interrupt');
 // Simulate a reaction's native condition application between paid initiation and continuation.
 g._spellConditionApplication='test_reaction';g.applyCondition({condition:'prone',target:'hero'});delete g._spellConditionApplication;
 const r=g.dispatch({op:'resolve_interrupt',take:false});assert.equal(r.status,'stopped');assert.equal(g.find('hero').ammunition.arrows.reserve,5);
 assert(!g.s.interrupt);assert(!g.s.pendingRangedAction);assert.equal(g.s.actions.resources.standard,0);
});
test('native ray casting while prone keeps attack bonus and spell damage',()=>{
 const run=lying=>{const g=make();g.find('warden').x=4;if(lying)prone(g);g.s.testRolls=[15];return g.dispatch({op:'cast_spell',actor:'hero',spell:{name:'Test ray',level:1,casterLevel:3,delivery:{type:'ray',rangeFeet:60},targets:['warden'],components:[{damageType:'force',amount:4}]}});};
 const a=run(false),b=run(true);assert.deepEqual(b,a);
});
test('prone defender AC retains melee and ranged adjustments including touch',()=>{
 for(const mode of ['melee','melee_touch','ranged','ranged_touch']){
  const g=make(mode.startsWith('ranged')?ranged({attackMode:mode}):{label:'Contact',attackMode:mode,damageDie:6});
  const a=check(g);prone(g,'warden');const b=check(g);assert.equal(b.targetDefense,a.targetDefense+(mode.startsWith('ranged')?4:-4));
 }
});
test('registered attack flag is validated and survives spawn/save; other attack entries do not inherit it',()=>{
 const g=make(),definition={id:'ranger',name:'Ranger',stats:{maxHp:30,attacks:[ranged({usableWhileProne:true}),ranged()]}};
 gm(g,{op:'register_creature',definition});gm(g,{op:'spawn_creature',definition:'ranger',id:'ranger1',x:5,y:5});prone(g,'ranger1');
 const h=new Kernel(g.exportState());assert(h.attackPostureAllowed('ranger1',h.attackRoutine('ranger1')[0]));assert(!h.attackPostureAllowed('ranger1',h.attackRoutine('ranger1')[1]));
 for(const bad of ['true',1,null]){const d=clone(definition);d.id='bad';d.stats.attacks[0].usableWhileProne=bad;assert.throws(()=>gm(g,{op:'register_creature',definition:d}),/usableWhileProne/);}
 const d=clone(definition);d.id='bad';d.stats.attacks[0]={label:'Sword',usableWhileProne:true};assert.throws(()=>gm(g,{op:'register_creature',definition:d}),/ranged attack mode/);
});
const send=(a,command,extra={})=>a.execute('gm',{command,reason:'Test dice',requestId:'dice_'+ ++seq,expectedRevision:a.revision,...extra});
function withoutRollBookkeeping(s){const c=clone(s);delete c.seed;delete c.log;delete c.testRolls;delete c.actions.activity;return c;}
test('catalog example rolls dice with no creatures or HP/action/clock changes',()=>{
 const a=new AIAdapter(),entry=callTool(a,'kernel_catalog',{op:'gm_roll'}).structuredContent;
 assert.equal(entry.example.kind,'plain');assert.deepEqual(entry.required,[]);a.game.s.testRolls=[4];const before=a.game.exportState();
 const args={command:entry.example,reason:'Duration only',requestId:'duration',expectedRevision:a.revision};
 const r=callTool(a,'kernel_gm',args);assert(!r.isError,JSON.stringify(r));assert.equal(r.structuredContent.result.data.total,4);assert.equal(r.structuredContent.result.data.applied,0);
 assert.deepEqual(withoutRollBookkeeping(a.game.exportState()),withoutRollBookkeeping(before));const after=a.snapshot();
 assert.equal(a.game.s.actions.activity,1); // Existing undo bookkeeping, not an action expenditure.
 assert(callTool(a,'kernel_gm',args).structuredContent.replayed);assert.deepEqual(a.snapshot(),after);
});
test('plain roll cannot heal, spend slots/actions, advance timers or emit effect events',()=>{
 const a=new AIAdapter({game:make()});a.game.find('hero').hp=50;prone(a.game);a.game.s.testRolls=[2,4];const before=a.game.exportState();
 const r=send(a,{op:'gm_roll',kind:'plain',count:2,sides:6,bonus:-10});assert.deepEqual(r.result.data.rolls,[2,4]);assert.equal(r.result.data.total,-4);
 assert.deepEqual(withoutRollBookkeeping(a.game.exportState()),withoutRollBookkeeping(before));
});
test('dice-only defaults and errors are explicit, rejected requests do not consume RNG',()=>{
 const a=new AIAdapter();a.game.s.testRolls=[3];assert.equal(send(a,{op:'gm_roll',sides:4}).result.data.total,3);
 for(const command of [{kind:'dice',count:1,sides:4},{kind:'plain',dice:'1d4'},{kind:'plain',target:'hero'},{kind:'plain',count:0},{kind:'plain',sides:1},{kind:'plain',sides:1001},{kind:'plain',bonus:1.2}]){
  const before=a.snapshot();assert.throws(()=>send(a,{op:'gm_roll',...command}));assert.deepEqual(a.snapshot(),before);
 }
});
test('explicit damage/healing still use their existing application paths',()=>{
 const g=make();g.find('hero').hp=50;g.s.testRolls=[4];const damage=gm(g,{op:'gm_roll',kind:'damage',target:'hero',sides:6,damageType:'force'});assert.equal(damage.applied,4);assert.equal(g.find('hero').hp,46);
 g.s.testRolls=[3];const heal=gm(g,{op:'gm_roll',kind:'healing',target:'hero',sides:6});assert.equal(heal.applied,3);assert.equal(g.find('hero').hp,49);
});
test('3.37 sessions preserve map, clock, undo and retry receipts on upgrade',()=>{
 const a=new AIAdapter({game:make()});a.game.s.width=30;a.game.s.height=40;a.game.s.worldRounds=14402;a.game.s.scene.name='Preserved map';
 const args={command:{op:'gm_roll',kind:'plain',sides:4},reason:'Duration',requestId:'old_roll',expectedRevision:a.revision};a.execute('gm',args);
 const old=a.snapshot();old.engineVersion='3.37.0';const b=new AIAdapter({saved:old});assert.equal(b.snapshot().engineVersion,ENGINE_VERSION);
 assert.deepEqual(b.snapshot().game,old.game);const before=b.snapshot();assert(b.execute('gm',args).replayed);assert.deepEqual(b.snapshot(),before);
 for(const version of ['3.36.0','3.44.0'])assert.throws(()=>new AIAdapter({saved:{...old,engineVersion:version}}),/version/);
});
console.log(`${count} prone/dice groups passed`);
