import assert from 'node:assert/strict';
import {RiderGame} from './riders.mjs';
import {clone} from './core.mjs';
let passed=0;
function test(label,fn){try{fn();++passed;console.log('PASS',label)}catch(e){console.error('FAIL',label,e);process.exitCode=1}}
function arena(){const g=new RiderGame();g.s.tiles={};g.s.width=12;g.s.height=10;
 const h=g.find('hero'),w=g.find('warden');Object.assign(h,{x:2,y:4,reach:1,size:1,hp:100,maxHp:100});
 Object.assign(w,{x:3,y:4,reach:1,size:1,hp:100,maxHp:100,str:12,bab:2,sizeAttack:0,sizeCMD:0});
 h.attacks=[{label:'Bite',naturalAttack:'bite',attackKind:'natural',damageDie:6,attackOffset:0,
  riders:['grab','constrict'],constrictDie:6,constrictBonus:2},{label:'Claw',naturalAttack:'claw',attackKind:'natural',damageDie:4}];
 return g;
}
test('Hit pauses for optional Grab; declining does not spend an action or reroll damage',()=>{
 const g=arena();g.s.testRolls=[18,4];
 const hp=g.find('warden').hp,r=g.dispatch({op:'attack',actor:'hero',target:'warden',index:0});
 assert.equal(r.status,'interrupt');assert.equal(g.s.interrupt.type,'rider_choice');
 assert.equal(g.find('warden').hp,hp-7);assert.equal(g.s.actions.resources.standard,0);
 const count=g.s.testRolls.length;
 const res=g.dispatch({op:'resolve_rider',actor:'hero',mode:'decline'});
 assert.equal(res.declined,true);assert.equal(g.s.grapples.length,0);
 assert.equal(g.s.testRolls.length,count);assert.equal(g.s.interrupt,null);
});
test('Free Grab adds +4 CMB and successful initiating check triggers separate constrict once',()=>{
 const g=arena();g.s.testRolls=[18,4,20,3];const target=g.find('warden');
 const old=target.hp,cmbBefore=g.cmbFor('hero','grapple'),hit=g.dispatch({op:'attack',actor:'hero',target:'warden',index:0});
 assert.equal(hit.status,'interrupt');assert.equal(hit.attack,undefined);
 const out=g.dispatch({op:'resolve_rider',actor:'hero',mode:'normal'});
 assert.equal(out.success,true);assert.equal(out.grappled,true);assert.equal(out.cmb,cmbBefore+4);
 assert.equal(target.hp,old-(4+g.stat('hero','damage'))-(3+2));
 assert.equal(g.hasCondition('hero','grappled'),true);assert.equal(g.hasCondition('warden','grappled'),true);
 assert.equal(g.s.actions.resources.standard,0);assert.equal(g.s.grapples[0].fromGrab,true);
});
test('Limb-only Grab leaves holder ungrappled and takes -20 CMB, +4 Grab',()=>{
 const g=arena();g.find('hero').statTotals={cmb:50};g.s.testRolls=[19,2,20,4];
 g.dispatch({op:'attack',actor:'hero',target:'warden',index:0});
 const out=g.dispatch({op:'resolve_rider',actor:'hero',mode:'appendage'});
 assert.equal(out.success,true);assert.equal(out.cmb,g.cmbFor('hero','grapple')-16);
 assert.equal(g.hasCondition('hero','grappled'),false);assert.equal(g.hasCondition('warden','grappled'),true);
 const release=g.dispatch({op:'grapple_action',actor:'hero',kind:'release'});
 assert.equal(release.released,true);assert.equal(g.hasCondition('warden','grappled'),false);
});
test('Maintaining Grab gets +5 maintain, +4 Grab; Constrict follows success, not failure',()=>{
 const g=arena();g.s.testRolls=[20,1,2,20,3];g.dispatch({op:'attack',actor:'hero',target:'warden'});
 g.dispatch({op:'resolve_rider',actor:'hero',mode:'normal'});
 g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});
 g.s.testRolls=[20,4,5];const before=g.find('warden').hp;
 const result=g.dispatch({op:'grapple_action',actor:'hero',kind:'maintain',option:'hold'});
 assert.equal(result.success,true);assert.equal(result.cmb,g.cmbFor('hero','grapple')+9);
 assert.equal(g.find('warden').hp,before-7-(4+g.stat('hero','damage')));assert.ok(result.constrict);assert.ok(result.grabDamage);
});
test('Failed Grab never inflicts Constrict or creates a grapple relationship',()=>{
 const g=arena();g.s.testRolls=[20,1,3,1];const before=g.find('warden').hp;
 g.dispatch({op:'attack',actor:'hero',target:'warden'});
 const hitHp=g.find('warden').hp;
 assert.ok(hitHp<before);
 const outcome=g.dispatch({op:'resolve_rider',actor:'hero',mode:'normal'});
 assert.equal(outcome.success,false);assert.equal(g.find('warden').hp,hitHp);
 assert.equal(g.s.grapples.length,0);assert.equal(g.s.interrupt,null);
});
test('Grab without Constrict still damages on successful later maintenance checks',()=>{
 const g=arena();g.find('hero').attacks[0].riders=['grab'];
 delete g.find('hero').attacks[0].constrictDie;delete g.find('hero').attacks[0].constrictBonus;
 g.s.testRolls=[20,1,3,20];g.dispatch({op:'attack',actor:'hero',target:'warden'});
 const started=g.dispatch({op:'resolve_rider',actor:'hero',mode:'normal'});
 assert.equal(started.constrict,null);
 g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});
 const before=g.find('warden').hp;g.s.testRolls=[20,4];
 const maintained=g.dispatch({op:'grapple_action',actor:'hero',kind:'maintain',option:'hold'});
 assert.equal(maintained.success,true);assert.equal(maintained.constrict,null);
 assert.equal(g.find('warden').hp,before-(4+g.stat('hero','damage')));
});
test('Normal Grab stops remaining strikes; limb-only hold may continue',()=>{
 const g=arena();g.s.testRolls=[20,1,3,20,4];g.dispatch({op:'full_attack',actor:'hero',target:'warden'});
 g.dispatch({op:'resolve_rider',actor:'hero',mode:'normal'});
 assert.throws(()=>g.dispatch({op:'full_attack_next',actor:'hero',target:'warden'}),/normal Grab has grappled/);
 assert.equal(g.dispatch({op:'finish_full_attack',actor:'hero'}).status,'done');
 const h=arena();h.find('hero').statTotals={cmb:45};h.s.testRolls=[20,1,3,20,4];h.dispatch({op:'full_attack',actor:'hero',target:'warden'});
 h.dispatch({op:'resolve_rider',actor:'hero',mode:'appendage'});h.s.testRolls=[20,1,4];
 const next=h.dispatch({op:'full_attack_next',actor:'hero',target:'warden'});
 assert.equal(next.status,'done');
});
test('Targets larger than Grab allowance do not create a pending choice',()=>{
 const g=arena();g.find('warden').sizeCategory='huge';g.s.testRolls=[20,1,4];
 const result=g.dispatch({op:'attack',actor:'hero',target:'warden'});
 assert.equal(result.hit,true);assert.equal(g.s.interrupt,null);assert.match(result.advisory,/too large/i);
});
test('Full attack suspends after Grab hit; resume from second strike after decision',()=>{
 const g=arena();g.s.testRolls=[20,1,2,20,3];
 const first=g.dispatch({op:'full_attack',actor:'hero',target:'warden'});
 assert.equal(first.attack.status,'interrupt');assert.equal(g.s.pendingFullAttack.index,1);
 assert.throws(()=>g.dispatch({op:'full_attack_next',actor:'hero',target:'warden'}),/pending action/i);
 g.dispatch({op:'resolve_rider',actor:'hero',mode:'decline'});
 g.s.testRolls=[20,1,4];const next=g.dispatch({op:'full_attack_next',actor:'hero',target:'warden'});
 assert.equal(next.status,'done');assert.equal(g.s.pendingFullAttack,null);
});
test('Trip replaces full attack slot without costing another standard action',()=>{
 const g=arena();g.find('hero').maneuverImprovements=['trip'];
 g.s.testRolls=[20,1,3];const first=g.dispatch({op:'full_attack',actor:'hero',target:'warden'});
 g.dispatch({op:'resolve_rider',actor:'hero',mode:'decline'});
 assert.equal(g.s.pendingFullAttack.index,1);
 g.s.testRolls=[20];const res=g.dispatch({op:'replace_attack',actor:'hero',target:'warden',kind:'trip'});
 assert.equal(res.status,'done');assert.equal(res.maneuver.success,true);
 assert.equal(g.hasCondition('warden','prone'),true);assert.equal(g.s.pendingFullAttack,null);
 assert.equal(g.s.actions.resources.standard,0);
});
test('Sunder replacement AoO can interrupt and then resume without double slot consumption',()=>{
 const g=arena();g.find('warden').equipment=[{id:'sword',name:'Sword',location:'held',hp:14,maxHp:14,hardness:4}];
 g.s.testRolls=[20,1,3];g.dispatch({op:'full_attack',actor:'hero',target:'warden'});
 g.dispatch({op:'resolve_rider',actor:'hero',mode:'decline'});
 g.s.testRolls=[20];let pending=g.dispatch({op:'replace_attack',actor:'hero',target:'warden',kind:'sunder',item:'sword',damage:12},'gm');
 assert.equal(pending.status,'interrupt');assert.equal(g.s.pendingFullAttack.index,1);
 const result=g.dispatch({op:'resolve_interrupt',take:false});
 assert.equal(result.status,'done');assert.equal(g.s.pendingFullAttack,null);
 assert.equal(g.find('warden').equipment[0].hp<14,true);
});
test('Grappled CMB does not double-count the attack penalty; grapple checks exempted',()=>{
 const g=arena(),base=g.cmbFor('hero','grapple');
 g.applyCondition({condition:'grappled',target:'hero'});
 assert.equal(g.cmbFor('hero','trip'),base-2);
 assert.equal(g.cmbFor('hero','grapple'),base);
});
test('Player cannot decide Grab reaction for a different creature',()=>{
 const g=arena();g.dispatch({op:'end_turn'});g.find('warden').attacks=[{label:'Tentacle',riders:['grab'],damageDie:4}];
 g.s.testRolls=[20,1,3];const r=g.dispatch({op:'attack',actor:'warden',target:'hero'});
 assert.equal(r.status,'interrupt');
 assert.throws(()=>g.dispatch({op:'resolve_rider',actor:'hero',mode:'normal'},'player'),/Player may only control/);
 assert.equal(g.s.interrupt?.type,'rider_choice');
});
test('Malformed rider data rejected at registration, rollback preserves state',()=>{
 const g=arena();const before=clone(g.s);
 assert.throws(()=>g.dispatch({op:'resolve_rider',actor:'hero',mode:'normal'}),/No pending|Only reacting/);
 assert.deepEqual(g.s,before);
 const def={id:'bad_grabber',name:'Bad grabber',stats:{maxHp:10,str:12,dex:10,con:10,bab:2,damageDie:6,
  statTotals:{ac:15,touchAc:11,flatFootedAc:14},attacks:[{label:'Bite',riders:['grab','constrict'],damageDie:6}]}};
 assert.throws(()=>g.dispatch({op:'register_creature',definition:def},'gm'),/Constrict rider requires/);
 assert.deepEqual(g.s,before);
});
console.log(`${passed} V3.12 rider tests passed`);
