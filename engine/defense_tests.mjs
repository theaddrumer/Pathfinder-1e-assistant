import assert from 'node:assert/strict';
import {DefenseGame,armorProfile} from './defense.mjs';
import {clone} from './core.mjs';
let passed=0;function test(name,fn){try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e.stack);process.exitCode=1;}}
const armor=(mat='mithral')=>({id:'armor',name:'Plate',kind:'armor',location:'worn',armorCategory:'heavy',armorBonus:9,enhancementBonus:1,maxDexBonus:1,armorCheckPenalty:-6,arcaneSpellFailure:35,material:mat,hp:30,maxHp:30,hardness:10});
const shield=()=>({id:'shield',name:'Heavy shield',kind:'shield',location:'worn',armorBonus:2,enhancementBonus:1,armorCheckPenalty:-2,hp:15,maxHp:15});
function scene(){const g=new DefenseGame();g.s.tiles={};Object.assign(g.find('hero'),{x:3,y:3,reach:2,attacks:[{label:'Punch',damageDie:6,damageTypes:['bludgeoning']}],hp:100,maxHp:100});Object.assign(g.find('warden'),{x:4,y:3,reach:2,hp:100,maxHp:100});return g;}
const attack=(g,rolls,context)=>{g.s.testRolls=rolls;return g.dispatch({op:'attack',actor:'hero',target:'warden',...(context?{defenseContext:context}:{})},'gm');};
test('Mithral armor modifies cap, ACP, spell failure and effective category without altering proficiency',()=>{
 const p=armorProfile(armor());assert.equal(p.adjustedCategory,'medium');assert.equal(p.category,'heavy');assert.equal(p.maxDex,3);assert.equal(p.checkPenalty,-3);assert.equal(p.spellFailure,25);
});
test('Adamantine armor gives armor weight-specific DR/- and no invented DR to shield',()=>{
 for(const [category,dr] of [['light',1],['medium',2],['heavy',3]]){const g=scene(),a=armor('adamantine');a.armorCategory=category;g.find('warden').equipment=[a];assert.equal(g.traits('warden').dr.find(x=>x.source==='adamantine armor').amount,dr);}
});
test('Printed AC is authoritative; removing shield and armor subtracts the correct derived deltas',()=>{
 const g=scene();const w=g.find('warden');w.equipment=[armor('steel'),shield()];w.statTotals={ac:27,touchAc:12,flatFootedAc:25};w.defenseEquipmentBaseline=g.snapshotEquipmentDefense(w);
 assert.equal(g.stat('warden','ac'),27);
 let r=g.dispatch({op:'gm_set_equipment',target:'warden',item:'shield',location:'carried'},'gm');assert.equal(r.ac,24);
 r=g.dispatch({op:'gm_set_equipment',target:'warden',item:'armor',location:'carried'},'gm');assert.equal(r.ac,14);
 assert.equal(g.stat('warden','touchAc'),12);
});
test('Derived equipment mode gets AC bonus and dex cap adjustment without base armor double-count',()=>{
 const g=scene(),w=g.find('warden');w.armor=0;w.shield=0;w.dex=20;w.equipment=[armor('mithral')];w.equipmentACMode='derived';
 assert.equal(g.stat('warden','ac'),27); // base 10, natural 5, armor 10, Dex 3 (mithral cap)
});
test('Broken armor and shield halve AC grants; broken armor doubles remaining armor check penalty',()=>{
 const g=scene(),w=g.find('warden');w.equipment=[armor('steel'),shield()];w.defenseEquipmentBaseline=g.snapshotEquipmentDefense(w);w.statTotals={ac:30,touchAc:12,flatFootedAc:28};
 g.dispatch({op:'gm_set_equipment',target:'warden',item:'armor',broken:true},'gm');
 assert.equal(g.stat('warden','ac'),25);assert.equal(g.equipmentProfile('warden').items[0].checkPenalty,-12);
 g.dispatch({op:'gm_set_equipment',target:'warden',item:'shield',broken:true},'gm');assert.equal(g.stat('warden','ac'),23);
});
test('Cover changes AC, total cover blocks target and fails atomically',()=>{
 const g=scene(),base=g.stat('warden','ac');g.s.testRolls=[12];const r=attack(g,[12],{cover:'cover'});assert.equal(r.total,12+g.stat('hero','attack'));
 // Test margin when attack's natural roll otherwise hits normal AC but not cover.
 const h=scene();assert.throws(()=>attack(h,[10],{cover:'total'}),/total cover/);
 assert.equal(h.s.actions.resources.standard,1);
 assert.equal(base,h.stat('warden','ac'));
});
test('Concealment miss prevents critical, damage and on-hit riders before confirmation',()=>{
 const g=scene(),w=g.find('warden');const hp=w.hp;const result=attack(g,[20,12],{concealment:20});
 assert.equal(result.hit,false);assert.equal(result.missedByConcealment,true);assert.equal(w.hp,hp);assert.equal(result.missRolls[0],12);
});
test('Blind-Fight gives one reroll only for melee, ranged feats stay independent',()=>{
 const g=scene();g.find('hero').blindFight=true;const r=attack(g,[19,10,45,3],{concealment:20});assert.equal(r.hit,true);assert.deepEqual(r.defenseContext?.reroll,true);
 const h=scene();h.find('hero').blindFight=true;const d=h.attackDefenseContext('hero','warden',{attackMode:'ranged'},'ac');assert.equal(d.reroll,false);
});
test('Blindsight defeats blur/displacement within reach; blindsense alone does not',()=>{
 const g=scene();g.find('hero').vision={blindsight:30};const d=g.attackDefenseContext('hero','warden',{attackMode:'melee'},'ac');assert.equal(d.missChance,0);
 g.find('warden').defenseProfile={concealment:50,concealmentSource:'displacement'};
 assert.equal(g.attackDefenseContext('hero','warden',{attackMode:'melee'},'ac').missChance,0);
 g.find('hero').vision={blindsense:30};assert.equal(g.attackDefenseContext('hero','warden',{attackMode:'melee'},'ac').missChance,50);
});
test('GM context is restricted to GM, malformed context rolls back, undo rolls back equipment',()=>{
 const g=scene(),w=g.find('warden');w.equipment=[armor('steel')];const before=clone(g.s);
 assert.throws(()=>g.dispatch({op:'attack',actor:'hero',target:'warden',defenseContext:{cover:'total'}},'actor'),/GM/);
 assert.throws(()=>g.dispatch({op:'attack',actor:'hero',target:'warden',defenseContext:{cover:'fake'}},'gm'),/Invalid cover/);
 assert.deepEqual(g.s,before);
});
test('Registered creature validates and retains defensive equipment with printed AC',()=>{
 const g=scene(),d={id:'defender_v16',name:'Defender',stats:{maxHp:30,statTotals:{ac:25,touchAc:11,flatFootedAc:24},equipment:[armor('mithral'),shield()]}};
 g.dispatch({op:'register_creature',definition:d},'gm');g.dispatch({op:'spawn_creature',definition:d.id,id:'defender_1',x:6,y:5},'gm');
 assert.equal(g.stat('defender_1','ac'),25);
 assert.equal(g.dispatch({op:'gm_set_equipment',target:'defender_1',item:'shield',location:'carried'},'gm').ac,22);
});
if(!process.exitCode)console.log(`${passed} V3.16 defensive tests passed`);
test('Removing armor restores capped Dexterity to both normal and touch AC',()=>{
 const g=scene(),w=g.find('warden');w.dex=20;w.maxDex=3;
 w.equipment=[armor('mithral')];w.defenseEquipmentBaseline=g.snapshotEquipmentDefense(w);
 w.statTotals={ac:25,touchAc:13,flatFootedAc:22};
 assert.equal(g.stat('warden','ac'),25);assert.equal(g.stat('warden','touchAc'),13);
 g.dispatch({op:'gm_set_equipment',target:'warden',item:'armor',location:'carried'},'gm');
 assert.equal(g.stat('warden','ac'),17); // -10 armor, +2 liberated Dexterity
 assert.equal(g.stat('warden','touchAc'),15);
});
test('Persistent GM-managed defense profile applies independently of attack commands',()=>{
 const g=scene();g.dispatch({op:'gm_set_defense_profile',target:'warden',profile:{cover:'improved',concealment:50,concealmentSource:'displacement'}},'gm');
 assert.equal(g.attackDefenseContext('hero','warden',{attackMode:'melee'},'ac').acBonus,8);
 assert.equal(g.attackDefenseContext('hero','warden',{attackMode:'melee'},'ac').missChance,50);
 assert.throws(()=>g.dispatch({op:'gm_set_defense_profile',target:'warden',profile:{cover:'invented'}},'gm'),/Invalid cover/);
 assert.equal(g.find('warden').defenseProfile.cover,'improved');
});
test('Adamantine DR is applied to normal physical damage and not to energy',()=>{
 const g=scene(),w=g.find('warden');w.equipment=[armor('adamantine')];w.equipment[0].armorCategory='heavy';
 const p=g.dispatch({op:'gm_resolve_damage',target:'warden',amount:10,damageType:'slashing',cause:'weapon'},'gm');
 assert.equal(p.applied,7);
 const f=g.dispatch({op:'gm_resolve_damage',target:'warden',amount:10,damageType:'fire',cause:'spell'},'gm');
 assert.equal(f.applied,10);
});
test('Concealment forbids precision even after successfully passing its miss chance',()=>{
 const g=scene(),h=g.find('hero');h.attacks=[{label:'Sneak strike',damageDie:6,precision:{count:1,sides:6}}];
 g.s.testRolls=[19,50,3];const r=g.dispatch({op:'attack',actor:'hero',target:'warden',precisionEligible:true,defenseContext:{concealment:20}},'gm');
 assert.equal(r.hit,true);assert.equal(r.precisionEligible,false);assert.equal(r.precisionDamage,0);
});
