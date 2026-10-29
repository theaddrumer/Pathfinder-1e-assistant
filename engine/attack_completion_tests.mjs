import assert from 'node:assert/strict';
import {AttackCompletionGame} from './attack_completion.mjs';
import {initialState} from './core.mjs';
import {weaponSizeDice} from './attack_completion_rules.mjs';
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS',name);}catch(error){console.error('FAIL',name,error);process.exitCode=1;}}
function duel(){const s=initialState();s.tiles={};const a=s.creatures[0],t=s.creatures[1];
 Object.assign(a,{x:1,y:3,attacks:[{label:'Club',attackKind:'manufactured',attackMode:'melee',damageDie:6}]});
 Object.assign(t,{x:2,y:3,hp:100,maxHp:100,armor:0,natural:0});
 return new AttackCompletionGame(s);
}
test('Nonlethal damage tracks separately and does not reduce ordinary HP',()=>{
 const g=duel();g.s.testRolls=[15,4];g.find('hero').attacks[0].damageIntent='nonlethal';
 const r=g.dispatch({op:'attack',actor:'hero',target:'warden'});
 assert.equal(r.hit,true);assert.equal(r.damage.nonlethal,true);assert.equal(g.find('warden').hp,100);
 assert.equal(g.nonlethalTotal('warden'),r.damage.applied);
 assert.equal(r.total,15+g.stat('hero','attack')-4);
});
test('Nonlethal equals current HP -> staggered; exceeds -> unconscious and no actions',()=>{
 const g=duel();g.find('warden').hp=10;
 g.dispatch({op:'gm_apply_nonlethal',target:'warden',amount:10},'gm');
 assert.equal(g.nonlethalState('warden').status,'staggered');
 g.dispatch({op:'gm_apply_nonlethal',target:'warden',amount:3},'gm');
 assert.equal(g.nonlethalState('warden').status,'unconscious');
 assert.equal(g.aooLimit('warden'),0);
 assert.equal(g.policy('warden','no_actions'),true);
});
test('Nonlethal immunities and DR still work',()=>{
 const g=duel();g.find('warden').creatureType='construct';
 assert.equal(g.dispatch({op:'gm_apply_nonlethal',target:'warden',amount:10},'gm').immune,true);
 assert.equal(g.nonlethalTotal('warden'),0);
 g.find('warden').creatureType='humanoid';g.find('warden').protections={dr:[{amount:5,bypass:['silver']} ]};
 const r=g.dispatch({op:'gm_apply_nonlethal',target:'warden',amount:9,cause:'weapon'},'gm');
 assert.equal(r.applied,4);
});
test('Excess nonlethal hits turn lethal on a later attack (without regeneration)',()=>{
 const g=duel();g.find('warden').maxHp=10;g.find('warden').hp=10;
 g.dispatch({op:'gm_apply_nonlethal',target:'warden',amount:10},'gm');
 const r=g.dispatch({op:'gm_apply_nonlethal',target:'warden',amount:3},'gm');
 assert.equal(r.lethalOverflow,3);assert.equal(g.find('warden').hp,7);assert.equal(g.nonlethalTotal('warden'),10);
});
test('Magical healing cures equivalent nonlethal; GM direct cure only nonlethal',()=>{
 const g=duel();g.find('warden').hp=10;
 g.dispatch({op:'gm_apply_nonlethal',target:'warden',amount:15},'gm');
 const r=g.dispatch({op:'gm_heal_hp',target:'warden',amount:5},'gm');
 assert.equal(r.hpHealed,5);assert.equal(r.nonlethalHealed,5);
 assert.equal(g.nonlethalState('warden').status,'none');
 assert.equal(g.dispatch({op:'gm_heal_nonlethal',target:'warden',amount:5},'gm').healed,5);
});
test('Weapon size progression 1d6 -> 1d8 and 1d8 -> 2d6',()=>{
 assert.deepEqual(weaponSizeDice(1,6,1),{count:1,sides:8,notation:'1d8',steps:1});
 assert.deepEqual(weaponSizeDice(1,8,1),{count:2,sides:6,notation:'2d6',steps:1});
 assert.deepEqual(weaponSizeDice(2,6,-1),{count:1,sides:8,notation:'1d8',steps:-1});
 assert.throws(()=>weaponSizeDice(1,7,1),/import explicit/i);
});
test('Scaled 2d6 damage rolls two dice once, not two separate damage components',()=>{
 const g=duel();g.find('hero').attacks[0].damageDie=8;g.find('hero').attacks[0].damageSizeSteps=1;
 g.s.testRolls=[20,1,3,5];const r=g.dispatch({op:'attack',actor:'hero',target:'warden'});
 assert.deepEqual(r.damageDice,{count:2,sides:6,notation:'2d6',steps:1});
 assert.deepEqual(r.weaponRolls,[[3,5]]);
});
test('Ranged projectile uses Dexterity, penalty per subsequent increment and no Str bonus to damage',()=>{
 const g=duel();g.find('warden').x=7;g.find('warden').y=3;
 g.find('hero').attacks=[{label:'Bow',attackKind:'manufactured',attackMode:'ranged',rangedKind:'projectile',rangeIncrementFeet:15,damageDie:6,damageTypes:['piercing']}];
 g.s.testRolls=[20,1,4];const r=g.dispatch({op:'attack',actor:'hero',target:'warden'});
 assert.equal(r.range.increment,2);assert.equal(r.range.rangePenalty,-2);
 assert.equal(r.total,20+g.find('hero').bab+1*2-2); // Dex +2, hero size 0
 assert.equal(r.weaponDamage,4+g.find('hero').damageOther);
});
test('Thrown weapons cap at five increments and projectile weapons at ten',()=>{
 const g=duel(),a=g.find('hero'),t=g.find('warden');
 a.attacks=[{label:'Thrown',attackMode:'ranged',rangedKind:'thrown',rangeIncrementFeet:5,damageDie:4}];
 t.x=8;assert.throws(()=>g.dispatch({op:'attack',actor:'hero',target:'warden'}),/maximum range/i);
 assert.equal(g.s.actions.resources.standard,1);
});
test('Ranged touch automatically targets touch AC and respects wall total cover',()=>{
 const g=duel(),a=g.find('hero'),t=g.find('warden');
 t.x=5;a.attacks=[{label:'Ray',attackKind:'ray',attackMode:'ranged_touch',rangedKind:'ray',rangeFeet:60,damageDie:4}];
 t.armor=70;t.natural=10;
 g.s.testRolls=[15,3];const r=g.dispatch({op:'attack',actor:'hero',target:'warden'});
 assert.equal(r.hit,true);
 const h=duel();h.find('hero').attacks=a.attacks;h.find('warden').x=5;
 h.s.tiles['3,3']='wall';
 assert.throws(()=>h.dispatch({op:'attack',actor:'hero',target:'warden'}),/total cover|wall/i);
});
test('Firing into melee is -4 unless Precise Shot; declarations override geometry',()=>{
 const g=duel(),a=g.find('hero'),t=g.find('warden');t.x=5;
 a.attacks=[{label:'Bow',attackMode:'ranged',rangeIncrementFeet:50,firingIntoMelee:true,damageDie:4}];
 g.s.testRolls=[18,3];let r=g.dispatch({op:'attack',actor:'hero',target:'warden'});
 assert.equal(r.range.meleePenalty,-4);
 const h=duel();h.find('warden').x=5;h.find('hero').attacks=a.attacks;h.find('hero').flags.preciseShot=true;
 h.s.testRolls=[18,3];r=h.dispatch({op:'attack',actor:'hero',target:'warden'});
 assert.equal(r.range.meleePenalty,0);
});
test('Validation and rollback protect import and generated attack dice',()=>{
 const g=duel();g.find('hero').attacks[0].damageDie=7;g.find('hero').attacks[0].damageSizeSteps=1;g.s.testRolls=[20,1,3];
 const before=JSON.stringify(g.exportState());
 assert.throws(()=>g.dispatch({op:'attack',actor:'hero',target:'warden'}),/size progression/i);
 assert.equal(JSON.stringify(g.exportState()),before);
});
test('Ranged full attack resolves more than one imported attack beyond melee reach',()=>{
 const g=duel(),a=g.find('hero'),t=g.find('warden');t.x=7;
 a.attacks=[{label:'Bow 1',attackMode:'ranged',rangeIncrementFeet:50,damageDie:4},
  {label:'Bow 2',attackMode:'ranged',rangeIncrementFeet:50,damageDie:4,attackOffset:-5}];
 g.s.testRolls=[17,2,17,3];const first=g.dispatch({op:'full_attack',actor:'hero',target:'warden'});
 assert.equal(first.status,'awaiting_attack');const second=g.dispatch({op:'full_attack_next',actor:'hero',target:'warden'});
 assert.equal(second.status,'done');assert.equal(g.s.pendingFullAttack,null);
});
test('Unarmed strike is nonlethal by default with no conversion penalty',()=>{
 const g=duel();g.find('hero').attacks=[{label:'Punch',attackKind:'unarmed',damageDie:4,damageTypes:['bludgeoning']}];
 g.s.testRolls=[17,3];const r=g.dispatch({op:'attack',actor:'hero',target:'warden'});
 assert.equal(r.damage.nonlethal,true);assert.equal(r.total,17+g.stat('hero','attack'));
});
test('Prone target takes +4 AC against ranged attacks and -4 against melee',()=>{
 const g=duel();g.dispatch({op:'apply_condition',target:'warden',condition:'prone'},'gm');
 const base=g.stat('warden','ac');
 g._attackContext={actor:'hero',target:'warden',mode:'ranged'};
 assert.equal(g.stat('warden','ac'),base+4);
 g._attackContext={actor:'hero',target:'warden',mode:'melee'};
 assert.equal(g.stat('warden','ac'),base-4);
 g._attackContext=null;
});

if(!process.exitCode)console.log(`${passed} V3.18 attack completion tests passed`);
