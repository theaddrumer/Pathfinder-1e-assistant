import assert from 'node:assert/strict';
import {FinalOffenseGame} from './final_offense.mjs';
import {clone} from './core.mjs';
let passed=0;const test=(name,fn)=>{try{fn();passed++;console.log('PASS',name);}catch(e){console.error('FAIL',name,e.stack);process.exitCode=1;}};
function scene(riders=[],other={}){
 const g=new FinalOffenseGame();g.s.tiles={};g.s.width=20;g.s.height=14;
 Object.assign(g.find('hero'),{x:2,y:5,reach:3,hp:100,maxHp:100,hitDiceCount:8,attacks:[{label:'Tentacle',naturalAttack:'tentacle',damageDie:6,attackKind:'natural',riders,...other}]});
 Object.assign(g.find('warden'),{x:5,y:5,hp:100,maxHp:100,hitDiceCount:10,reach:1,size:1,skills:{Perception:4}});
 return g;
}
const strike=(g,rolls)=>{g.s.testRolls=rolls;return g.dispatch({op:'attack',actor:'hero',target:'warden'});};
test('Pull: hit, optional free check, fixed movement toward attacker, no additional action',()=>{
 const g=scene(['pull'],{pullFeet:10});const r=strike(g,[18,3]);assert.equal(r.status,'interrupt');assert.equal(r.interrupt.rider,'pull');
 const standard=g.s.actions.resources.standard;g.s.testRolls=[20];const t=g.dispatch({op:'resolve_rider',actor:'hero',mode:'pull'});
 assert.equal(t.success,true);assert.equal(t.movedFeet,10);assert.equal(g.find('warden').x,3);assert.equal(g.s.actions.resources.standard,standard);
});
test('Push: victim moves away, stops before wall, no AoO',()=>{
 const g=scene(['push'],{pushFeet:15});g.s.tiles['7,5']='wall';strike(g,[18,4]);g.s.testRolls=[20];const t=g.dispatch({op:'resolve_rider',actor:'hero',mode:'push'});
 assert.equal(t.movedFeet,5);assert.equal(t.blocked,true);assert.equal(g.find('warden').x,6);assert.equal(g.s.interrupt,null);
});
test('Pull/Push size limit and decision decline',()=>{
 const g=scene(['pull'],{pullFeet:5});g.find('warden').sizeCategory='huge';const r=strike(g,[18,3]);assert.equal(r.status,undefined);assert.match(r.riders[0].skipped,/size/);
 const h=scene(['push'],{pushFeet:5});strike(h,[18,3]);const before=clone(h.s.actions);const r2=h.dispatch({op:'resolve_rider',actor:'hero',mode:'decline'});
 assert.equal(r2.declined,true);assert.deepEqual(h.s.actions,before);
});
test('Energy Drain applies negative levels, penalties and 5 HP per level',()=>{
 const g=scene(['energy_drain'],{energyDrainLevels:2,energyDrainDC:17});
 const atk=g.stat('warden','attack'),cmd=g.stat('warden','cmd'),will=g.stat('warden','will'),skill=g.skillBonus('warden','Perception'),hp=g.find('warden').maxHp;
 const r=strike(g,[18,4]);assert.equal(r.riders[0].applied,2);assert.equal(g.negativeCount('warden'),2);
 assert.equal(g.stat('warden','attack'),atk-2);assert.equal(g.stat('warden','cmd'),cmd-2);
 assert.equal(g.stat('warden','will'),will-2);assert.equal(g.skillBonus('warden','Perception'),skill-2);
 assert.equal(g.find('warden').maxHp,hp-10);assert.equal(g.s.energyTempHp.hero[0].amount,10);
});
test('Confirmed critical doubles energy drain; negation still leaves ordinary hit',()=>{
 const g=scene(['energy_drain'],{energyDrainLevels:2,energyDrainDC:17});
 // Crit confirmation roll 20, then damage roll.
 const r=strike(g,[20,20,3,4]);assert.equal(r.criticalHit,true);assert.equal(g.negativeCount('warden'),4);
 const h=scene(['energy_drain'],{energyDrainLevels:2,energyDrainDC:17});h.find('warden').protections={fortification:100};
 const n=strike(h,[20,20,1,3]);assert.equal(n.criticalHit,false);assert.equal(h.negativeCount('warden'),2);
});
test('24h Fort save on every negative level, failure becomes permanent, success disappears',()=>{
 const g=scene(['energy_drain'],{energyDrainLevels:2,energyDrainDC:18});strike(g,[18,3]);
 g.s.testRolls=[20,1];const r=g.dispatch({op:'gm_advance_time',count:24,unit:'hour'},'gm');
 assert.equal(r.negativeLevelSaves.length,2);assert.equal(g.negativeCount('warden'),1);
 assert.equal(g.s.negativeLevels[0].permanent,true);assert.equal(g.s.negativeLevels[0].dueAt,null);
 g.s.testRolls=[];const later=g.dispatch({op:'gm_advance_time',count:2,unit:'day'},'gm');assert.equal(later.negativeLevelSaves.length,0);
});
test('Negative levels equal Hit Dice kill; GM restoration does not auto-resurrect',()=>{
 const g=scene();g.find('warden').hitDiceCount=2;
 const r=g.dispatch({op:'gm_apply_negative_levels',target:'warden',levels:2,dc:12},'gm');assert.equal(r.dead,true);
 const restore=g.dispatch({op:'gm_restore_negative_levels',target:'warden',count:2},'gm');
 assert.equal(restore.removed,2);assert.equal(g.find('warden').hp,0);
});
test('Energy Drain immunity prevents levels and temporary HP',()=>{
 const g=scene(['energy_drain'],{energyDrainLevels:2,energyDrainDC:17});g.find('warden').creatureType='undead';
 const r=strike(g,[18,3]);assert.equal(r.riders[0].immune,true);assert.equal(g.negativeCount('warden'),0);assert.equal(g.s.energyTempHp.hero,undefined);
});
test('Temporary HP from Energy Drain absorbs incoming damage and expires',()=>{
 const g=scene(['energy_drain'],{energyDrainLevels:1,energyDrainDC:12});strike(g,[18,3]);const hp=g.find('hero').hp;
 let result=g.dispatch({op:'admin_damage',target:'hero',amount:3,damageType:'fire',cause:'environment'},'gm');
 assert.equal(result.tempHpAbsorbed,3);assert.equal(g.find('hero').hp,hp);
 g.dispatch({op:'gm_advance_time',count:1,unit:'hour'},'gm');assert.equal((g.s.energyTempHp.hero||[]).length,0);
});
test('Repeat Energy Drain hits do not stack same-source temporary HP',()=>{
 const g=scene(['energy_drain'],{energyDrainLevels:1,energyDrainDC:14});
 strike(g,[18,3]);assert.equal(g.s.energyTempHp.hero[0].amount,5);
 g.s.testRolls=[18,3];g.resolveAttack('hero','warden','repeat',g.find('hero').attacks[0]);
 assert.equal(g.s.energyTempHp.hero.length,1);assert.equal(g.s.energyTempHp.hero[0].amount,5);
});
test('Temporary HP applies after mitigation and to spell packets without phantom HP losses',()=>{
 const g=scene(['energy_drain'],{energyDrainLevels:2,energyDrainDC:13});strike(g,[18,3]);
 const hero=g.find('hero');hero.hp=2;
 const d=g.dispatch({op:'gm_resolve_packet',target:'hero',cause:'spell',components:[{damageType:'fire',amount:9},{damageType:'cold',amount:3}]},'gm');
 assert.equal(d.tempHpAbsorbed,10);assert.equal(d.applied,2);assert.equal(hero.hp,0);
});
test('Malformed rider definitions rejected atomically',()=>{
 const g=scene(),before=clone(g.s);for(const bad of [{riders:['pull']},{riders:['push'],pushFeet:7},{riders:['energy_drain'],energyDrainLevels:2},{riders:['energy_drain'],energyDrainLevels:2,energyDrainDC:-1}]){
 assert.throws(()=>g.dispatch({op:'register_creature',definition:{id:'bad',name:'Bad',stats:{maxHp:10,attacks:[{label:'Bite',...bad}]} }},'gm'));
 }assert.deepEqual(g.s,before);
});
test('Offensive rider decisions serialize through multiple choices without duplicating damage',()=>{
 const g=scene(['trip','push','pull'],{pushFeet:5,pullFeet:5});
 const r=strike(g,[18,3]);assert.equal(r.status,'interrupt');assert.equal(r.interrupt.rider,'trip');
 const hp=g.find('warden').hp;
 const first=g.dispatch({op:'resolve_rider',actor:'hero',mode:'decline'});
 assert.equal(first.interrupt.rider,'pull');
 const second=g.dispatch({op:'resolve_rider',actor:'hero',mode:'decline'});
 assert.equal(second.interrupt.rider,'push');
 const third=g.dispatch({op:'resolve_rider',actor:'hero',mode:'decline'});
 assert.equal(third.declined,true);assert.equal(g.s.interrupt,null);assert.equal(g.find('warden').hp,hp);
});
test('Pull and Push checks do not inherit ordinary maneuver-specific feat bonuses',()=>{
 const g=scene(['pull'],{pullFeet:5});g.find('hero').maneuverModifiers={cmb:{reposition:15,bull_rush:20}};
 strike(g,[18,3]);const base=g.cmbFor('hero','pull');g.s.testRolls=[10];const out=g.dispatch({op:'resolve_rider',actor:'hero',mode:'pull'});
 assert.equal(out.cmb,base);assert.notEqual(out.cmb,base+15);
});
test('GM-only negative level commands reject non-GM and roll back invalid changes',()=>{
 const g=scene(),saved=clone(g.s);
 assert.throws(()=>g.dispatch({op:'gm_apply_negative_levels',target:'warden',levels:2,dc:20},'actor'),/GM-only/);
 assert.throws(()=>g.dispatch({op:'gm_apply_negative_levels',target:'warden',levels:-1,dc:20},'gm'),/Invalid/);
 assert.deepEqual(g.s,saved);
});
test('Negative levels remain through export/import, and undo restores snapshots',()=>{
 const g=scene();g.dispatch({op:'gm_apply_negative_levels',target:'warden',levels:1,dc:17},'gm');
 const restored=new FinalOffenseGame(g.exportState());assert.equal(restored.negativeCount('warden'),1);
 g.dispatch({op:'undo_turn'},'gm');assert.equal(g.negativeCount('warden'),0);
});
console.log(`${passed} V3.15 test cases passed`);
