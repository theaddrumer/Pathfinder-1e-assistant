import assert from 'node:assert/strict';
import {ManeuverGame,MANEUVERS,DIRTY_TRICK_CONDITIONS} from './maneuvers.mjs';
import {clone} from './core.mjs';
let passed=0;
function test(label,fn){try{fn();passed++;console.log('PASS',label)}catch(e){console.error('FAIL',label,e.stack);process.exitCode=1}}
function duel(){const g=new ManeuverGame();g.s.tiles={};g.s.width=12;g.s.height=12;
 Object.assign(g.find('hero'),{x:3,y:3,reach:1});Object.assign(g.find('warden'),{x:4,y:3,size:1,reach:1,hp:80,maxHp:80,str:12,dex:10,bab:2,sizeAttack:0,sizeCMD:0});return g;}
function perform(g,kind,props={},dice=20){g.s.testRolls=[dice];const cmd={op:'maneuver',actor:'hero',target:'warden',kind,...props};let r=g.dispatch(cmd,'actor');if(r.status==='interrupt'&&r.interrupt.type==='maneuver_aoo')r=g.dispatch({op:'resolve_interrupt',take:false},'actor');return r;}
test('Dirty Trick all six conditions exposed, one shared mechanic',()=>{
 assert.equal(DIRTY_TRICK_CONDITIONS.length,6);
 for(const condition of DIRTY_TRICK_CONDITIONS){const g=duel();const r=perform(g,'dirty_trick',{condition},13);assert.equal(r.success,true);assert.equal(g.hasCondition('warden',condition),true);assert.ok(r.rounds>=1);}
});
test('Dirty Trick checks margin and target can spend move to remove',()=>{
 const g=duel();const r=perform(g,'dirty_trick',{condition:'blinded'},15);assert.ok(r.rounds>=2);assert.equal(g.s.dirtyTricks.length,1);
 g.dispatch({op:'end_turn'},'actor');const out=g.dispatch({op:'remove_dirty_trick',actor:'warden',effectId:r.effectId},'actor');
 assert.equal(out.spent,'move');assert.equal(g.hasCondition('warden','blinded'),false);assert.equal(g.s.actions.resources.move,0);
});
test('Greater Dirty Trick uses d4 duration, standard action to remove',()=>{
 const g=duel();g.find('hero').greaterManeuvers=['dirty_trick'];g.s.testRolls=[20,3];let r=g.dispatch({op:'maneuver',actor:'hero',target:'warden',kind:'dirty_trick',condition:'sickened'},'actor');r=g.dispatch({op:'resolve_interrupt',take:false},'actor');
 assert.ok(r.rounds>=3);g.dispatch({op:'end_turn'},'actor');const out=g.dispatch({op:'remove_dirty_trick',actor:'warden',effectId:r.effectId},'actor');assert.equal(out.spent,'standard');assert.equal(g.s.actions.resources.standard,0);
});
test('Condition supersession does not create an invalid Dirty Trick removal record',()=>{
 const g=duel();g.dispatch({op:'apply_condition',target:'warden',condition:'frightened'},'gm');
 const r=perform(g,'dirty_trick',{condition:'shaken'});assert.equal(r.success,true);assert.match(r.advisory,/not applied/);
 assert.equal(g.s.dirtyTricks.length,0);assert.equal(g.hasCondition('warden','frightened'),true);
});
test('Dirty Trick cannot be removed as creature action by the wrong combatant',()=>{
 const g=duel();const r=perform(g,'dirty_trick',{condition:'dazzled'});
 assert.throws(()=>g.dispatch({op:'remove_dirty_trick',actor:'hero',effectId:r.effectId},'actor'),/No removable/);
});
test('Reposition follows supplied path and caps movement at margin',()=>{
 const g=duel();const r=perform(g,'reposition',{path:[{x:4,y:4},{x:5,y:4}]},20);assert.equal(r.success,true);assert.equal(r.repositionedSquares,2);assert.deepEqual([g.find('warden').x,g.find('warden').y],[5,4]);
});
test('Reposition never permits hazardous tiles or occupied squares',()=>{
 const g=duel();g.s.tiles['4,4']='hazard';
 assert.throws(()=>g.dispatch({op:'maneuver',actor:'hero',target:'warden',kind:'reposition',path:[{x:4,y:4}]},'actor'),/dangerous/);
});
test('Drag moves both creatures backward into vacated squares',()=>{
 const g=duel();const r=perform(g,'drag',{},12);assert.equal(r.success,true);assert.equal(r.draggedSquares,2);assert.deepEqual([g.find('hero').x,g.find('warden').x],[1,2]);
});
test('Drag stops before wall without overlapping creatures',()=>{
 const g=duel();g.s.tiles['1,3']='wall';const r=perform(g,'drag',{},20);
 assert.equal(r.draggedSquares,1);assert.deepEqual([g.find('hero').x,g.find('warden').x],[2,3]);
});
test('Steal requires exposed registered item and transfers item to attacker',()=>{
 const g=duel();g.find('hero').freeHands=1;g.find('warden').equipment=[{id:'necklace',name:'Necklace',location:'worn',accessible:true}];
 const r=perform(g,'steal',{item:'necklace'});assert.equal(r.success,true);assert.equal(g.find('warden').equipment.length,0);assert.equal(g.find('hero').equipment[0].id,'necklace');
});
test('Steal rejects held and unregistered hidden items',()=>{
 const g=duel();g.find('warden').equipment=[{id:'dagger',name:'Dagger',location:'held',accessible:true},{id:'ring',name:'Ring',location:'worn'}];
 for(const item of ['dagger','ring'])assert.throws(()=>g.dispatch({op:'maneuver',actor:'hero',target:'warden',kind:'steal',item},'actor'),/accessible/);
});
test('Fastened items confer effective +5 CMD to Steal',()=>{
 const g=duel();g.find('warden').equipment=[{id:'pouch',name:'Pouch',location:'worn',accessible:true,fastened:true}];
 g.s.testRolls=[10];let r=g.dispatch({op:'maneuver',actor:'hero',target:'warden',kind:'steal',item:'pouch'},'actor');
 r=g.dispatch({op:'resolve_interrupt',take:false},'actor');assert.equal(r.cmb,g.cmbFor('hero','steal')-5);
});
test('Overrun target chooses to avoid without a maneuver check',()=>{
 const g=duel();let r=perform(g,'overrun');assert.equal(r.interrupt.type,'overrun_avoid');
 r=g.dispatch({op:'resolve_interrupt',take:true},'actor');assert.equal(r.avoided,true);assert.equal(g.find('hero').x,5);assert.equal(g.find('warden').x,4);
});
test('Overrun refusal causes maneuver check and prone with margin 5',()=>{
 const g=duel();let r=perform(g,'overrun');g.s.testRolls=[20];
 r=g.dispatch({op:'resolve_interrupt',take:false},'actor');assert.equal(r.overran,true);assert.equal(r.prone,true);assert.equal(g.find('hero').x,5);assert.equal(g.hasCondition('warden','prone'),true);
});
test('Improved Overrun prevents the avoid choice',()=>{
 const g=duel();g.find('hero').maneuverImprovements=['overrun'];g.s.testRolls=[20];const r=g.dispatch({op:'maneuver',actor:'hero',target:'warden',kind:'overrun'},'actor');assert.equal(r.overran,true);assert.equal(g.s.interrupt,null);
});
test('Overrun blocked destination rejects before action is spent',()=>{
 const g=duel();g.s.tiles['5,3']='wall';
 assert.throws(()=>g.dispatch({op:'maneuver',actor:'hero',target:'warden',kind:'overrun'},'actor'),/beyond/);assert.equal(g.s.actions.resources.standard,1);
});
test('GM free movement retains normal AoO pause and no action cost',()=>{
 const g=duel();const r=g.dispatch({op:'gm_adjudicate',kind:'move_free',actor:'hero',path:[{x:2,y:3}],allowanceFeet:5,reason:'Magical floor grants movement'},'gm');
 assert.equal(r.result.status,'interrupt');assert.equal(g.s.actions.resources.standard,1);assert.equal(g.s.actions.resources.move,1);assert.equal(g.find('hero').x,3);
 g.dispatch({op:'resolve_interrupt',take:false},'actor');assert.equal(g.find('hero').x,2);assert.equal(g.s.overrideLog.length,1);
});
test('GM free movement can affect a non-active creature without charging the active turn',()=>{
 const g=duel();const r=g.dispatch({op:'gm_adjudicate',kind:'move_free',actor:'warden',path:[{x:5,y:3}],allowanceFeet:5,reason:'Wind pushes opponent'},'gm');
 assert.equal(r.result.status,'interrupt');g.dispatch({op:'resolve_interrupt',take:false},'gm');assert.equal(g.find('warden').x,5);assert.equal(g.s.actions.moved,false);
});
test('GM adjudication bridges modifier and condition without new condition subsystem',()=>{
 const g=duel();g.dispatch({op:'gm_adjudicate',kind:'modifier',target:'warden',stat:'attack',value:-3,reason:'Unusual local gravity'},'gm');
 g.dispatch({op:'gm_adjudicate',kind:'condition',target:'warden',condition:'shaken',reason:'Plot fear effect'},'gm');
 assert.equal(g.hasCondition('warden','shaken'),true);assert.equal(g.s.overrideLog.length,2);
});
test('Player/actor cannot call the GM override gateway',()=>{
 const g=duel();const before=clone(g.s);
 assert.throws(()=>g.dispatch({op:'gm_adjudicate',kind:'relocate',target:'hero',x:0,y:0,reason:'Unsafe test'},'actor'),/Only GM/);assert.deepEqual(g.s,before);
});
test('Bad GM movement and missing reason roll back entirely',()=>{
 const g=duel();const before=clone(g.s);
 assert.throws(()=>g.dispatch({op:'gm_adjudicate',kind:'move_free',actor:'hero',path:[{x:9,y:9}],allowanceFeet:5,reason:'Invalid move'},'gm'),/adjacent/);
 assert.deepEqual(g.s,before);
 assert.throws(()=>g.dispatch({op:'gm_adjudicate',kind:'relocate',target:'hero',x:2,y:2,reason:''},'gm'),/requires a brief reason/);
});
test('Dirty Trick and reposition state roll back with undo',()=>{
 const g=duel();perform(g,'dirty_trick',{condition:'blinded'});assert.equal(g.s.dirtyTricks.length,1);
 g.dispatch({op:'undo_turn'},'gm');assert.equal(g.s.dirtyTricks.length,0);assert.equal(g.s.conditionInstances.length,0);
});
console.log(`${passed} extended maneuver/GM override tests passed`);
