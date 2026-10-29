import assert from 'node:assert/strict';
import {Kernel,initialState} from './kernel.mjs';
import {AIAdapter} from './ai_adapter.mjs';
import {clone} from './core.mjs';
import {oppositeBorders} from './combat_mechanics.mjs';
const gm=(g,c)=>g.dispatch(c,'gm'),act=(g,c)=>g.dispatch(c,'actor');
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}}
function fixture(){const s=initialState();s.tiles={};Object.assign(s.creatures[0],{x:2,y:3,bab:8,hp:500,maxHp:500,str:18,dex:14});Object.assign(s.creatures[1],{x:3,y:3,size:1,reach:1,hp:500,maxHp:500});return new Kernel(s);}
function profile(g,feats=[],extra={}){return gm(g,{op:'gm_set_combat_profile',target:'hero',profile:{feats,totalsExcludeCombatOptions:true,...extra}});}
const attack=(options={},extra={})=>({op:'attack',actor:'hero',target:'warden',combatOptions:options,...extra});
function miss(g,cmd){g.s.testRolls=[1];return act(g,cmd);}
function ally(g,x=4,y=3){const c=clone(g.find('hero'));Object.assign(c,{id:'ally',name:'Ally',x,y});g.s.creatures.push(c);}
function unchanged(g,fn,re){const before=g.exportState();assert.throws(fn,re);assert.deepEqual(g.exportState(),before);}
function bow(g){g.find('hero').attacks=[{label:'Bow',attackMode:'ranged',rangeIncrementFeet:100,damageDie:8,damageAbility:'none',attackOffset:0},{label:'Bow 2',attackMode:'ranged',rangeIncrementFeet:100,damageDie:8,damageAbility:'none',attackOffset:-5}];g.find('warden').x=6;}
test('same-team ordinary, full attack, continuation and charge share target permission',()=>{
 for(const op of ['attack','full_attack']){const g=fixture();g.find('warden').team='party';const r=miss(g,{op,actor:'hero',target:'warden'});assert(r);if(op==='full_attack')assert.equal(miss(g,{op:'full_attack_next',actor:'hero',target:'warden'}).status,'done');}
 const g=fixture();g.find('warden').team='party';g.find('warden').x=6;assert(miss(g,{op:'charge',actor:'hero',target:'warden'}));
});
test('flanking uses opposite sides/corners, large footprints, threat and elevation',()=>{
 const g=fixture();ally(g);assert.equal(g.flankingInfo('hero','warden').flanking,true);
 g.find('ally').y=4;assert.equal(g.flankingInfo('hero','warden').flanking,false);
 g.find('ally').y=3;g.find('ally').elevation={feet:0};assert.equal(g.flankingInfo('hero','warden').requiresAdjudication,true);
 delete g.find('ally').elevation;g.find('ally').reach=0;assert.equal(g.flankingInfo('hero','warden').flanking,false);
 g.find('ally').reach=1;gm(g,{op:'apply_condition',target:'ally',condition:'paralyzed'});assert.equal(g.flankingInfo('hero','warden').flanking,false);
 assert(oppositeBorders({x:1.5,y:1.5},{x:4.5,y:4.5},{x:2,y:2,size:2}));
 assert(!oppositeBorders({x:1.5,y:2.5},{x:2.5,y:1.5},{x:2,y:2,size:2}));
});
test('flanking feeds +2 and precision, explicit false suppresses precision, walls block flankers',()=>{
 const g=fixture();ally(g);g.find('hero').attacks=[{label:'Knife',damageDie:4,precision:{count:1,sides:6}}];
 g.s.testRolls=[10,2,5];const r=act(g,attack());assert.equal(r.total,24);assert.equal(r.precisionDamage,5);assert.equal(r.combat.flanking.partner,'ally');
 const h=fixture();ally(h);h.find('hero').attacks=clone(g.find('hero').attacks);h.s.testRolls=[10,2];const q=act(h,attack({}, {precisionEligible:false}));assert.equal(q.precisionDamage,0);
 gm(h,{op:'gm_set_map_features',features:[{id:'wall',preset:'wall',points:[{x:4,y:3},{x:4,y:4}]}],reason:'Test wall'});assert.equal(h.flankingInfo('hero','warden').flanking,false);
});
test('elevated flank needs explicit GM ruling, actor cannot manufacture it',()=>{
 const g=fixture();ally(g);g.find('hero').elevation={feet:10};unchanged(g,()=>act(g,attack({}, {flanking:true})),/GM/);
 g.s.testRolls=[1];const r=gm(g,attack({}, {flanking:true}));assert.equal(r.combat.flanking.flanking,true);
});
test('Power Attack scales, uses hand role, persists through enemy turn and expires next turn',()=>{
 const g=fixture();profile(g,['power_attack']);g.find('hero').attacks=[{label:'Greatsword',weaponHands:2,damageDie:6}];
 g.s.testRolls=[10,3];const r=act(g,attack({powerAttack:true}));assert.equal(r.total,19);assert.equal(r.weaponDamage,16);assert.equal(g.stat('hero','cmb'),9);
 act(g,{op:'end_turn'});assert(g.combatMode('hero','powerAttack'));act(g,{op:'end_turn'});assert(!g.combatMode('hero','powerAttack'));assert.equal(g.stat('hero','cmb'),12);
});
test('Furious Focus first attack only, Power Attack touch damage excluded',()=>{
 const g=fixture();profile(g,['power_attack','furious_focus']);g.find('hero').attacks=[{label:'Sword',weaponHands:2,damageDie:6},{label:'Sword 2',weaponHands:2,damageDie:6,attackOffset:-5}];
 const first=miss(g,{op:'full_attack',actor:'hero',target:'warden',combatOptions:{powerAttack:true}});assert.equal(first.attack.bonus,12);
 const second=miss(g,{op:'full_attack_next',actor:'hero',target:'warden'});assert.equal(second.attack.bonus,4);
 const h=fixture();profile(h,['power_attack']);h.find('hero').attacks=[{label:'Touch',attackMode:'melee_touch',damageDie:4}];h.s.testRolls=[10,2];const r=act(h,attack({powerAttack:true}));assert.equal(r.combat.damage,0);assert.equal(r.combat.attack,-3);
});
test('Piranha Strike supports light/offhand and rejects Power Attack combination atomically',()=>{
 const g=fixture();profile(g,['power_attack','piranha_strike']);g.find('hero').attacks=[{label:'Dagger',damageDie:4,lightWeapon:true,offhand:true}];
 unchanged(g,()=>act(g,attack({powerAttack:true,piranhaStrike:true})),/cannot combine/);
 g.s.testRolls=[10,2];const r=act(g,attack({piranhaStrike:true}));assert.equal(r.combat.damage,3);
});
test('defensive modes stack dodge, retain attack costs and forbid total-defense combination',()=>{
 const g=fixture();profile(g,['combat_expertise'],{acrobaticsRanks:3});const base=g.stat('hero','ac');
 const r=miss(g,attack({combatExpertise:true,fightingDefensively:true}));assert.equal(r.bonus,5);assert.equal(g.stat('hero','ac'),base+6);assert.equal(g.stat('hero','flatFootedAc'),15);
 unchanged(g,()=>act(g,{op:'total_defense',actor:'hero'}),/Cannot combine/);
 const h=fixture();profile(h,[],{acrobaticsRanks:3});act(h,{op:'total_defense',actor:'hero'});assert.equal(h.stat('hero','ac'),23);assert.equal(h.aooLimit('hero'),0);assert.equal(h.s.actions.resources.standard,0);
});
test('Rapid Shot adds one paid slot with -2, Point-Blank Shot and Deadly Aim add applicable modifiers',()=>{
 const g=fixture();profile(g,['rapid_shot','deadly_aim','point_blank_shot']);bow(g);
 const r=miss(g,{op:'full_attack',actor:'hero',target:'warden',combatOptions:{rapidShot:true,deadlyAim:true}});assert.equal(r.remaining,2);assert.equal(r.attack.bonus,6);assert.equal(g.s.actions.resources.standard,0);assert.equal(g.s.actions.resources.move,0);
 const q=miss(g,{op:'full_attack_next',actor:'hero',target:'warden'});assert.equal(q.remaining,1);assert.equal(q.attack.combat.damage,7);
 assert.equal(miss(g,{op:'full_attack_next',actor:'hero',target:'warden'}).status,'done');
});
test('Critical Focus affects confirmation only; Vital Strike extra dice not multiplied on crit',()=>{
 const g=fixture();profile(g,['critical_focus','greater_vital_strike']);g.find('hero').attacks=[{label:'Sword',damageDie:6,criticalMultiplier:2}];
 g.s.testRolls=[20,10,2,3,4,5,6];const r=act(g,attack({vitalStrike:3}));assert.equal(r.total,32);assert.equal(r.confirmation.total,26);assert.equal(r.vitalDamage,15);assert.equal(r.weaponDamage,28);
 const h=fixture();profile(h,['vital_strike']);unchanged(h,()=>act(h,{op:'full_attack',actor:'hero',target:'warden',combatOptions:{vitalStrike:1}}),/ordinary attack/);
});
test('prone normal movement rejected; standing provokes before removing prone and pays once',()=>{
 const g=fixture();gm(g,{op:'apply_condition',target:'hero',condition:'prone'});
 unchanged(g,()=>act(g,{op:'move',actor:'hero',path:[{x:2,y:4}]}),/crawl or stand_up/);
 assert.equal(act(g,{op:'stand_up',actor:'hero'}).status,'interrupt');assert(g.hasCondition('hero','prone'));assert.equal(g.s.actions.resources.move,0);
 const r=act(g,{op:'resolve_interrupt',take:false});assert.equal(r.standing,true);assert(!g.hasCondition('hero','prone'));assert.equal(g.s.actions.resources.standard,1);
});
test('standing interrupted by incapacitation remains prone; crawler provokes when entering threat',()=>{
 const g=fixture();g.find('hero').hp=1;gm(g,{op:'apply_condition',target:'hero',condition:'prone'});act(g,{op:'stand_up',actor:'hero'});g.s.testRolls=[15,8];const r=act(g,{op:'resolve_interrupt',take:true});assert.equal(r.status,'stopped');assert(g.hasCondition('hero','prone'));
 const h=fixture();h.find('hero').x=1;gm(h,{op:'apply_condition',target:'hero',condition:'prone'});const q=act(h,{op:'crawl',actor:'hero',path:[{x:2,y:3}]});assert.equal(q.status,'interrupt');assert.equal(h.find('hero').x,2);h.s.testRolls=[1];act(h,{op:'resolve_interrupt',take:true});assert.equal(h.find('hero').x,2);assert(h.hasCondition('hero','prone'));
});
test('helpless AC/effective abilities use derived or printed defenses without hidden Dex assumptions',()=>{
 const g=fixture();gm(g,{op:'apply_condition',target:'hero',condition:'paralyzed'});assert.equal(g.stat('hero','dex'),0);assert.equal(g.stat('hero','str'),0);assert.equal(g.stat('hero','ac'),10);assert.equal(g.stat('hero','touchAc'),5);
 assert.equal(g.attackDefenseContext('warden','hero',{attackMode:'melee'},'ac').acBonus,-4);assert.equal(g.attackDefenseContext('warden','hero',{attackMode:'ranged'},'ac').acBonus,0);
 const h=fixture();h.find('hero').statTotals={ac:24,touchAc:15,flatFootedAc:19};gm(h,{op:'apply_condition',target:'hero',condition:'paralyzed'});assert.equal(h.stat('hero','ac'),14);assert.equal(h.stat('hero','touchAc'),5);assert.equal(h.stat('hero','flatFootedAc'),14);
 gm(h,{op:'remove_condition',target:'hero',condition:'paralyzed'});assert.equal(h.stat('hero','ac'),24);
});
test('source immunity skips matching saves/conditions, separates sources, and expires with native clock',()=>{
 const g=fixture();ally(g);gm(g,{op:'gm_grant_source_immunity',target:'hero',source:'warden',ability:'despair',count:24,unit:'hour'});
 g.s.testRolls=[10];const r=gm(g,{op:'save',target:'hero',source:'warden',ability:'despair',save:'will',dc:16});assert(r.skipped);assert.equal(g.s.testRolls.length,1);
 assert(gm(g,{op:'apply_condition',target:'hero',source:'warden',ability:'despair',condition:'paralyzed'}).skipped);assert(!g.hasCondition('hero','paralyzed'));
 assert(!gm(g,{op:'save',target:'hero',source:'ally',ability:'despair',save:'will',dc:16}).skipped);assert.equal(g.s.testRolls.length,0);
 gm(g,{op:'gm_advance_time',count:24,unit:'hour'});assert(!g.sourceImmunity('hero','warden','despair'));
});
test('combat state survives save/load; rejecting an unavailable option rolls back modes and RNG',()=>{
 const g=fixture();profile(g,['power_attack']);miss(g,attack({powerAttack:true}));const a=new AIAdapter({game:g});const b=new AIAdapter({saved:a.snapshot()});assert(b.game.combatMode('hero','powerAttack'));
 const h=fixture();unchanged(h,()=>act(h,attack({powerAttack:true})),/no configured/);profile(h,['rapid_shot']);unchanged(h,()=>act(h,attack({rapidShot:true})),/full attack/);
});
test('native registration imports explicit combat/weapon fields and rejects typos',()=>{
 const g=fixture(),definition={id:'fighter',name:'Fighter',stats:{maxHp:30,bab:8,combatProfile:{feats:['power_attack'],totalsExcludeCombatOptions:true},attacks:[{label:'Sword',weaponHands:2,lightWeapon:false,offhand:false,threatens:true}]}};
 gm(g,{op:'register_creature',definition});gm(g,{op:'spawn_creature',definition:'fighter',id:'fighter_1',x:7,y:6});
 assert.equal(g.find('fighter_1').attacks[0].weaponHands,2);assert(g.hasCombatFeat('fighter_1','power_attack'));
 unchanged(g,()=>gm(g,{op:'register_creature',definition:{...definition,id:'bad',stats:{...definition.stats,combatProfile:{...definition.stats.combatProfile,typo:true}}}}),/profile/);
});
test('Rapid Shot ranged AoO resume preserves precision override, ammo and single resource payment',()=>{
 const g=fixture();profile(g,['rapid_shot']);bow(g);g.find('warden').x=3;
 g.find('hero').ammunition={arrows:{type:'reserve',reserve:8,drawAction:'free'}};
 for(const a of g.find('hero').attacks){a.ammoId='arrows';a.precision={count:1,sides:6};}
 let r=act(g,{op:'full_attack',actor:'hero',target:'warden',precisionEligible:true,combatOptions:{rapidShot:true}});assert.equal(r.status,'interrupt');assert.equal(g.find('hero').ammunition.arrows.reserve,8);
 g.s.testRolls=[19,4,5];r=act(g,{op:'resolve_interrupt',take:false});assert.equal(r.status,'awaiting_attack');assert.equal(r.attack.precisionDamage,5);assert.equal(g.find('hero').ammunition.arrows.reserve,7);assert.equal(g.s.actions.resources.standard,0);
 assert.equal(g.s.pendingFullAttack.slots[1]._precisionEligible,undefined);
});
test('Vital Strike is retained across ranged interruption and uses one ammunition',()=>{
 const g=fixture();profile(g,['vital_strike']);bow(g);g.find('warden').x=3;g.find('hero').ammunition={arrows:{type:'reserve',reserve:5,drawAction:'free'}};g.find('hero').attacks[0].ammoId='arrows';
 assert.equal(act(g,attack({vitalStrike:1})).status,'interrupt');g.s.testRolls=[19,3,4];const r=act(g,{op:'resolve_interrupt',take:false});assert.equal(r.vitalDamage,4);assert.equal(g.find('hero').ammunition.arrows.reserve,4);
});
test('source-aware queries are pure and native immunity cannot be generically triggered',()=>{
 const g=fixture();const event=gm(g,{op:'gm_grant_source_immunity',target:'hero',source:'warden',ability:'despair',count:1,unit:'minute'});
 const before=g.exportState();assert(gm(g,{op:'gm_evaluate_effect',target:'hero',source:'warden',ability:'despair',tags:[]}).blocked);gm(g,{op:'gm_get_combat'});gm(g,{op:'gm_get_flanking',actor:'hero',target:'warden'});assert.deepEqual(g.exportState(),before);
 unchanged(g,()=>gm(g,{op:'gm_trigger_pending_event',id:event.id}),/expires automatically/);
 const later=gm(g,{op:'gm_grant_source_immunity',target:'hero',source:'warden',ability:'despair',count:1,unit:'round'});assert.equal(later.duration.at,event.duration.at);assert.equal(g.s.pendingEvents.filter(e=>e.kind==='source_immunity').length,1);
});
test('modes expire after encounter-end or explicit downtime and their effects leave no duplicate records',()=>{
 for(const initiative of [false,true]){
  const g=fixture();profile(g,['power_attack']);
  if(initiative)gm(g,{op:'gm_begin_initiative',scores:{hero:20,warden:10}});
  miss(g,attack({powerAttack:true}));
  if(initiative)gm(g,{op:'gm_end_initiative'});
  gm(g,{op:'gm_advance_time',count:1,unit:'round'});assert(!g.combatMode('hero','powerAttack'));assert(!g.s.effects.some(e=>e.name==='powerAttack'));
 }
});
test('previous-release save preserves an in-progress ranged attack and new undo remains deterministic',()=>{
 const g=fixture();bow(g);g.find('warden').x=3;act(g,attack());const a=new AIAdapter({game:g});
 for(const version of ['3.37.0','3.38.0','3.39.0']){const saved=a.snapshot();saved.engineVersion=version;const restored=new AIAdapter({saved});assert.equal(restored.game.s.pendingRangedAction.kind,'shot');restored.game.s.testRolls=[1];assert.equal(act(restored.game,{op:'resolve_interrupt',take:false}).hit,false);}
 const h=fixture();profile(h,['power_attack']);h.turnStart=clone(h.s);h.s.testRolls=[1];act(h,attack({powerAttack:true}));gm(h,{op:'undo_turn'});assert(!h.combatMode('hero','powerAttack'));assert.equal(h.s.actions.resources.standard,1);
});
console.log(`${passed} combat mechanics groups passed`);
