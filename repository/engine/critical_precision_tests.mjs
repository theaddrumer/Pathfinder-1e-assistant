import assert from 'node:assert/strict';
import {CriticalGame} from './critical.mjs';
import {criticalProfile} from './critical_rules.mjs';
import {initialState,clone} from './core.mjs';
let passed=0;
function test(label,fn){try{fn();passed++;console.log('PASS',label);}catch(e){console.error('FAIL',label,e);process.exitCode=1;}}
function scene(){const s=initialState();s.tiles={};const h=s.creatures[0],t=s.creatures[1];
 Object.assign(h,{x:2,y:4,hp:100,maxHp:100,damageDie:6,damageOther:0,attacks:[{label:'Rapier',attackKind:'manufactured',damageDie:6,criticalThreat:18,criticalMultiplier:2,
  precision:{count:2,sides:6,bonus:0},extraDamage:[{damageType:'fire',count:1,sides:4}]}]});
 Object.assign(t,{x:3,y:4,hp:150,maxHp:150});const g=new CriticalGame(s);return g;
}
function hit(g,rolls,options={}){g.s.testRolls=[...rolls];return g.dispatch({op:'attack',actor:'hero',target:'warden',...options});}
test('Threat confirmed: rolls weapon damage twice, precision and flaming once each',()=>{
 const g=scene();const t=g.find('warden');const r=hit(g,[19,18,5,4,3,2,4],{precisionEligible:true});
 assert.equal(r.criticalHit,true);assert.deepEqual(r.weaponRolls,[5,4]);assert.deepEqual(r.precisionRolls,[3,2]);
 assert.equal(r.precisionDamage,5);assert.equal(r.extraDamage[0].amount,4);
 assert.equal(t.hp,150-(5+4+2*g.stat('hero','damage')+5+4));
});
test('Natural 20 hits automatically but natural 1 on confirmation fails',()=>{
 const g=scene();const r=hit(g,[20,1,4,3]);assert.equal(r.hit,true);assert.equal(r.confirmation.confirmed,false);assert.equal(r.criticalHit,false);assert.equal(r.weaponRolls.length,1);
});
test('A roll in the extended threat range must still beat AC',()=>{
 const g=scene();g.find('warden').armor=50;const r=hit(g,[18]);assert.equal(r.hit,false);assert.equal(r.threat,undefined);
});
test('Keen and Improved Critical both double original range, do not stack',()=>{
 assert.equal(criticalProfile({criticalThreat:18,keen:true}).threat,15);
 assert.equal(criticalProfile({criticalThreat:18,improvedCritical:true}).threat,15);
 assert.equal(criticalProfile({criticalThreat:18,keen:true,improvedCritical:true}).threat,15);
 assert.deepEqual([criticalProfile({attackKind:'improvised',criticalThreat:18,keen:true}).threat,criticalProfile({itemCondition:'broken',criticalMultiplier:4}).multiplier],[20,2]);
});
test('Fortification 25% can negate a confirmed crit while normal hit remains',()=>{
 const g=scene();g.find('warden').protections={fortification:25};const r=hit(g,[20,20,12,6,2]);
 assert.equal(r.criticalNegated,true);assert.equal(r.criticalHit,false);assert.deepEqual(r.weaponRolls,[6]);assert.equal(r.damage.applied>0,true);
});
test('Fortification 25% does not negate on d% 26',()=>{
 const g=scene();g.find('warden').protections={fortification:25};const r=hit(g,[20,20,26,6,5,3]);
 assert.equal(r.criticalHit,true);assert.equal(r.weaponRolls.length,2);
});
test('Native precision immunity preserves base damage and fire dice',()=>{
 const g=scene();g.find('warden').protections={immunities:['precision']};const r=hit(g,[10,5,2],{precisionEligible:true});
 assert.equal(r.precisionDamage,0);assert.equal(r.precisionImmune,true);assert.equal(r.damage.applied>0,true);
});
test('OoZe and elemental inherit BOTH immunities but undead does not automatically',()=>{
 const g=scene(),t=g.find('warden');
 t.creatureType='ooze';assert.equal(g.criticalDefenses('warden').criticalImmune,true);assert.equal(g.criticalDefenses('warden').precisionImmune,true);
 t.creatureType='elemental'; // elemental is a subtype, not creature type
 t.creatureType='outsider';t.subtypes=['elemental'];assert.equal(g.criticalDefenses('warden').criticalImmune,true);
 t.creatureType='undead';t.subtypes=[];assert.equal(g.criticalDefenses('warden').criticalImmune,false);
});
test('A shared fortification roll cancels crit and precision together',()=>{
 const g=scene();g.find('warden').protections={fortification:75};const r=hit(g,[20,20,50,6,1],{precisionEligible:true});
 assert.equal(r.criticalNegated,true);assert.equal(r.precisionNegated,true);assert.equal(r.precisionDamage,0);assert.equal(r.defenseRoll,50);
});
test('Worn armor fortification works, carried and dropped armor does not',()=>{
 const g=scene(),t=g.find('warden');t.equipment=[{id:'armor',name:'Fortified mail',location:'worn',fortification:50}];
 assert.equal(g.criticalDefenses('warden').fortification,50);t.equipment[0].location='carried';assert.equal(g.criticalDefenses('warden').fortification,0);
});
test('Native protection and worn fortification do not add together',()=>{
 const g=scene(),t=g.find('warden');t.protections={fortification:50};t.equipment=[{id:'armor',name:'Fortified mail',location:'worn',fortification:25}];
 assert.equal(g.criticalDefenses('warden').fortification,50);
});
test('Precision is explicitly enabled per attack, not assumed from the weapon profile',()=>{
 const g=scene();const r=hit(g,[12,3,2]);assert.equal(r.precisionEligible,false);assert.equal(r.precisionDamage,0);
});
test('Precision added to physical hit and DR is applied once',()=>{
 const g=scene();g.find('warden').protections={dr:[{amount:5,bypass:[]}]};
 const r=hit(g,[12,5,3,4,2],{precisionEligible:true});
 const normal=5+g.stat('hero','damage'),precision=7;
 assert.equal(r.damage.raw,normal+precision);assert.equal(r.damage.applied,normal+precision-5);
});
test('Critical and precision chances may be independently defined',()=>{
 const g=scene();g.find('warden').protections={criticalNegationChance:100,precisionNegationChance:0};
 const r=hit(g,[20,20,40,5,3,3,2],{precisionEligible:true});
 assert.equal(r.criticalNegated,true);assert.equal(r.precisionNegated,false);assert.equal(r.precisionDamage,6);
});
test('Spell packet precision inherits fire type and energy resistance is applied once',()=>{
 const g=scene(),t=g.find('warden');t.protections={resistances:{fire:10}};
 g.s.testRolls=[4,3];
 const r=g.dispatch({op:'gm_resolve_packet',target:'warden',cause:'spell',metadata:{sourceKind:'spell'},components:[
  {damageType:'fire',amount:15,precision:{count:2,sides:6}}
 ]},'gm');
 assert.equal(r.applied,15+7-10);assert.equal(r.components[0].precisionDamage,7);
 assert.equal(r.components[0].damageType,'fire');assert.equal(t.hp,150-(15+7-10));
});
test('An ooze ignores attached spell precision but remains vulnerable to ordinary fire',()=>{
 const g=scene(),t=g.find('warden');t.creatureType='ooze';const r=g.dispatch({op:'gm_resolve_packet',target:'warden',cause:'spell',components:[
  {damageType:'fire',amount:16,precision:{count:2,sides:6}}
 ]},'gm');
 assert.equal(r.precisionBlocked,true);assert.equal(r.components[0].precisionDamage,0);assert.equal(r.applied,16);
});
test('A spell packet makes one fortification check for qualifying precision',()=>{
 const g=scene(),t=g.find('warden');t.protections={fortification:75};g.s.testRolls=[45];
 const r=g.dispatch({op:'gm_resolve_packet',target:'warden',cause:'spell',components:[
  {damageType:'cold',amount:13,precision:{count:2,sides:6}},
  {damageType:'fire',amount:8,precision:{count:1,sides:4}}
 ]},'gm');
 assert.equal(r.precisionBlocked,true);assert.equal(r.precisionDefenseRoll,45);assert.equal(r.applied,21);
 assert.equal(g.s.testRolls.length,0);
});
test('Registration rejects malformed critical, precision, and fortified equipment',()=>{
 const g=scene();const d={id:'test_hero',name:'Test Hero',stats:{maxHp:30,attacks:[{label:'Dagger',criticalThreat:1}]}};
 assert.throws(()=>g.dispatch({op:'register_creature',definition:d},'gm'),/threat/);
 d.stats.attacks[0]={label:'Dagger',precision:{count:1,sides:1}};
 assert.throws(()=>g.dispatch({op:'register_creature',definition:d},'gm'),/precision/i);
 d.stats.attacks[0]={label:'Dagger'};d.stats.equipment=[{id:'armor',name:'Armor',location:'worn',fortification:125}];
 assert.throws(()=>g.dispatch({op:'register_creature',definition:d},'gm'),/fortification/);
});
test('Failed actions preserve HP, test-roll list, and critical state via rollback',()=>{
 const g=scene(),before=clone(g.s);assert.throws(()=>g.dispatch({op:'attack',actor:'hero',target:'warden',precisionEligible:'yes'}),/Invalid precision/);
 assert.deepEqual(g.s,before);
});
console.log(`${passed} V3.13 critical and precision checks passed`);
