import assert from 'node:assert/strict';
import {Kernel,initialState} from './kernel.mjs';
import {clone} from './core.mjs';
const gm=(g,c)=>g.dispatch(c,'gm');
const make=()=>{const s=initialState();s.tiles={};Object.assign(s.creatures[0],{x:1,y:3,hp:200,maxHp:200});Object.assign(s.creatures[1],{x:5,y:3,size:1,reach:1,hp:200,maxHp:200});return new Kernel(s);};
const elev=(g,target,feet=20,grounded=false,layer='air')=>gm(g,{op:'gm_set_elevation',target,elevation:{feet,grounded,layer},reason:'Declared elevation'});
const geometry=(g,actor,target,ruling)=>gm(g,{op:'gm_set_geometry',actor,target,ruling,reason:'GM measures vertical geometry'});
const close=(g,more={})=>gm(g,{op:'gm_close_scene',keep:['hero'],placements:[{id:'hero',x:2,y:2}],width:30,height:20,reason:'Leave cleared chamber',...more});
const register=(g,size='tiny')=>gm(g,{op:'register_creature',definition:{id:'small_'+size,name:size,creatureType:'humanoid',stats:{maxHp:20,sizeCategory:size}}});
const spawn=(g,id,x=2,y=3,size='tiny',more={})=>gm(g,{op:'spawn_creature',definition:'small_'+size,id,x,y,team:'enemy',...more});
const area=(g,exposure={mode:'surface'},more={})=>gm(g,{op:'gm_resolve_spell',actor:'hero',spell:{name:'Test hazard',level:1,casterLevel:5,area:{shape:'sphere',origin:{x:5,y:3},sizeFeet:10},components:[{amount:3,damageType:'force'}],persistent:{duration:{count:5,unit:'round'},triggers:['create','enter','turn_start'],exposure,...more}}});
let n=0;function test(name,fn){fn();n++;console.log('PASS',name);}
test('map supports large setup, soft-lock resizing and pure inspection',()=>{
 const g=make();gm(g,{op:'gm_configure_map',width:100,height:80,reason:'Adventure map'});gm(g,{op:'gm_establish_scene'});
 const r=gm(g,{op:'gm_configure_map',width:120,height:80,reason:'Chase enters next street'});assert(r.advisories.some(x=>x.includes('Established')));
 const before=g.exportState();gm(g,{op:'gm_get_map'});g.inspect();assert.deepEqual(g.exportState(),before);
 assert.throws(()=>g.dispatch({op:'gm_configure_map',width:20,height:20,reason:'No authority'}),/GM/);
});
test('invalid/shrinking map and partial batch failure leave state and checkpoints unchanged',()=>{
 const g=make();gm(g,{op:'gm_set_tiles',cells:[{x:9,y:7,kind:'wall'},{x:2,y:2,kind:'difficult'}],reason:'Layout'});
 const before=g.exportState(),turn=clone(g.turnStart);
 assert.throws(()=>gm(g,{op:'gm_configure_map',width:8,height:8,reason:'Shrink'}),/clip/);
 assert.throws(()=>gm(g,{op:'gm_set_tiles',cells:[{x:1,y:1,kind:'wall'},{x:99,y:1,kind:'wall'}],reason:'Bad batch'}),/bounds/);
 assert.throws(()=>gm(g,{op:'gm_configure_map',width:0,height:8,reason:'Bad'}),/dimensions/);
 assert.deepEqual(g.exportState(),before);assert.deepEqual(g.turnStart,turn);
});
test('active areas and tile elevation cannot silently be clipped',()=>{
 const g=make();area(g);const before=g.exportState();assert.throws(()=>gm(g,{op:'gm_configure_map',width:6,height:8,reason:'Shrink'}),/clip/);assert.deepEqual(g.exportState(),before);
 gm(g,{op:'gm_set_tile_elevation',x:9,y:0,elevation:{surfaceFeet:-20,note:'Pit'},reason:'Map feature'});
 const map=gm(g,{op:'gm_get_map'});assert.equal(map.elevationTiles['9,0'].surfaceFeet,-20);assert.deepEqual(map.tiles,{});
});
test('elevation annotations warn without granting actions, occupancy needs distinct declared layers',()=>{
 const g=make();const actions=clone(g.s.actions.resources);elev(g,'hero');assert.deepEqual(g.s.actions.resources,actions);
 gm(g,{op:'gm_adjudicate',kind:'relocate',target:'hero',x:5,y:3,reason:'Flying over enemy'});
 assert.equal(g.find('hero').x,g.find('warden').x);assert(g.inspect().map.advisories.length);
 const before=g.exportState();assert.throws(()=>elev(g,'hero',0,true,'ground'),/occupancy/);assert.deepEqual(g.exportState(),before);
 const restored=new Kernel(g.exportState());assert.equal(restored.find('hero').elevation.feet,20);
});
test('geometry declarations enforce ranged distance, reach and ordinary action budget',()=>{
 const g=make();elev(g,'warden');geometry(g,'hero','warden',{distanceFeet:20,meleeReach:true,lineOfEffect:true});
 g.s.testRolls=[1];g.dispatch({op:'attack',actor:'hero',target:'warden'});assert.equal(g.s.actions.resources.standard,0);
 assert.throws(()=>g.dispatch({op:'attack',actor:'hero',target:'warden'}),/action|standard/i);
 const h=make();elev(h,'warden');geometry(h,'hero','warden',{distanceFeet:100});
 assert.throws(()=>h.dispatch({op:'cast_spell',actor:'hero',spell:{name:'Short ray',level:1,casterLevel:1,delivery:{type:'ray',rangeFeet:30},targets:['warden'],components:[{amount:1,damageType:'force'}]}}),/range/);
 assert.equal(h.s.actions.resources.standard,1);
});
test('rulings invalidate when positions or terrain change and do not disable conditions',()=>{
 const g=make();geometry(g,'hero','warden',{meleeReach:true,threatens:true});
 gm(g,{op:'apply_condition',target:'hero',condition:'dazed'});assert.throws(()=>g.dispatch({op:'attack',actor:'hero',target:'warden'}),/actions/);
 gm(g,{op:'remove_condition',target:'hero',condition:'dazed'});
 gm(g,{op:'gm_adjudicate',kind:'relocate',target:'warden',x:6,y:3,reason:'Move target'});assert.equal(g.geometryRuling('hero','warden'),null);
 geometry(g,'hero','warden',{lineOfEffect:true});gm(g,{op:'gm_set_tile',x:3,y:3,kind:'wall'});assert.equal(g.geometryRuling('hero','warden'),null);
});
test('explicit threat ruling suppresses an incorrect flat-map AoO and movement still costs an action',()=>{
 const g=make();g.find('warden').x=2;elev(g,'hero');geometry(g,'warden','hero',{threatens:false});
 const r=g.dispatch({op:'move',actor:'hero',path:[{x:1,y:2}]});assert.equal(r.status,'done');assert.equal(g.s.actions.resources.move,0);
});
test('same-square Tiny melee works, zero reach does not threaten adjacent squares',()=>{
 const g=make();register(g);spawn(g,'tiny1',1,3);assert.equal(g.find('tiny1').reach,0);
 assert.equal(g.threatens('tiny1','warden'),false);assert.equal(g.threatens('tiny1','hero'),true);assert.equal(g.meleeReach('tiny1','hero'),true);assert.equal(g.meleeReach('tiny1','warden'),false);
 g.s.testRolls=[1];g.dispatch({op:'attack',actor:'hero',target:'tiny1'});assert.equal(g.s.actions.resources.standard,0);
 g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});g.s.testRolls=[1];g.dispatch({op:'attack',actor:'tiny1',target:'hero'});
});
test('Tiny capacity is enforced without blocking occupancy of a larger creature',()=>{
 const g=make();register(g);for(let i=0;i<4;i++)spawn(g,'tiny'+i,1,3);
 const before=g.exportState();assert.throws(()=>spawn(g,'tiny4',1,3),/blocked/);assert.deepEqual(g.exportState(),before);
 register(g,'diminutive');spawn(g,'dim',3,3,'diminutive');assert.equal(g.find('dim').reach,0);
});
test('Tiny entry into an enemy square pauses for AoO and resumes the same movement',()=>{
 const g=make();register(g);spawn(g,'tiny',2,3);g.s.turn=2;
 const r=g.dispatch({op:'move',actor:'tiny',path:[{x:1,y:3}]});assert.equal(r.status,'interrupt');assert.equal(g.find('tiny').x,2);
 g.dispatch({op:'resolve_interrupt',take:false});assert.equal(g.find('tiny').x,1);assert.equal(g.s.actions.resources.move,0);
});
test('traversal exceptions cross a declared obstacle while paying declared cost; elevation changes invalidate them',()=>{
 const g=make();gm(g,{op:'gm_set_tile',x:2,y:3,kind:'wall'});elev(g,'hero');
 gm(g,{op:'gm_set_traversal',target:'hero',cells:[{x:2,y:3,passable:true,costSquares:3}],reason:'Fly over wall with ascent'});
 g.dispatch({op:'move',actor:'hero',path:[{x:2,y:3},{x:3,y:3}]});assert.equal(g.find('hero').x,3);assert.equal(g.s.actions.resources.move,0);
 elev(g,'hero',30,false,'high');assert.equal(g.legalPosition('hero',2,3),false);
});
test('surface automation skips flight, landing fires once, annotation edits do not retrigger damage',()=>{
 const g=make();g.installRule({id:'spikes',on:'tile_enter',when:[{op:'eq',a:{ref:'event.tile'},b:'hazard'}],actions:[{op:'deal_damage',target:{ref:'event.actor'},amount:4,damageType:'piercing'}]});
 gm(g,{op:'gm_set_tile',x:2,y:3,kind:'hazard'});elev(g,'hero');g.dispatch({op:'move',actor:'hero',path:[{x:2,y:3}]});assert.equal(g.find('hero').hp,200);
 elev(g,'hero',0,true,'ground');assert.equal(g.find('hero').hp,196);elev(g,'hero',0,true,'ground');assert.equal(g.find('hero').hp,196);
});
test('surface persistent areas exclude flight, include landing, and honor existing per-round exposure receipts',()=>{
 const g=make();elev(g,'warden');const a=area(g);assert.equal(g.find('warden').hp,200);
 elev(g,'warden',0,true,'ground');assert.equal(g.find('warden').hp,197);elev(g,'warden');elev(g,'warden',0,true,'ground');assert.equal(g.find('warden').hp,197);
 gm(g,{op:'gm_advance_time',count:1,unit:'round'});assert.equal(g.find('warden').hp,194);assert(g.persistentAreaEvent(a.areaId));
});
test('volume areas still affect fliers and explicit exclusion works on future exposures',()=>{
 const g=make();elev(g,'warden');const a=area(g,{mode:'volume'});assert.equal(g.find('warden').hp,197);
 gm(g,{op:'gm_set_exposure',areaId:a.areaId,exposure:{mode:'volume',targets:{warden:false},reason:'Above cloud'},reason:'Cloud height adjudication'});
 gm(g,{op:'gm_advance_time',count:1,unit:'round'});assert.equal(g.find('warden').hp,197);
});
test('scene closure preserves source-independent spell and ailment consequences, daily usage and world clock',()=>{
 const g=make();g.find('hero').hp=55;
 gm(g,{op:'apply_condition',target:'hero',condition:'frightened',source:'warden',rounds:5});
 gm(g,{op:'gm_resolve_spell',actor:'warden',spell:{name:'Lingering debuff',level:1,casterLevel:5,targets:['hero'],effect:{rounds:4,conditions:['sickened']}}});
 gm(g,{op:'register_ailment',definition:{id:'venom',name:'Venom',kind:'poison',delivery:'injury',save:{type:'fort',dc:100},frequency:{every:{count:1,unit:'round'},maxTicks:3},cure:{successes:1,consecutive:true},effects:[{kind:'hp',damageType:'force',dice:{count:1,sides:4}}]}});
 g.s.testRolls=[1];gm(g,{op:'expose_ailment',definition:'venom',target:'hero',source:'warden'});
 gm(g,{op:'gm_set_spellcasting',actor:'hero',reason:'Daily book',book:{id:'book',name:'Book',mode:'spontaneous',ability:'int',casterLevel:1,pools:[{id:'general',allotment:{type:'imported',totals:{1:2}}}],spells:[{id:'bolt',name:'Bolt',level:1}]}});
 g.find('hero').int=18;g.dispatch({op:'cast_spell',actor:'hero',spell:{name:'Bolt',level:1,casterLevel:1,targets:['warden'],components:[{amount:1,damageType:'force'}],resource:{book:'book',spell:'bolt'}}});
 const hp=g.find('hero').hp,clock=g.s.worldRounds,resources=clone(g.s.spellResources);
 const preview=gm(g,{op:'gm_preview_scene_close',keep:['hero']});assert.deepEqual(preview.remove,['warden']);
 close(g);assert.equal(g.find('hero').hp,hp);assert.equal(g.s.worldRounds,clock);assert.deepEqual(g.s.spellResources,resources);
 assert(g.hasCondition('hero','sickened'));assert(g.hasCondition('hero','frightened'));assert.equal(g.s.activeAilments[0].source,null);
 assert.equal(g.s.conditionInstances.find(c=>c.condition==='frightened').source,null);assert.equal(g.previousTurnStart,null);assert(!g.turnStart.creatures.some(c=>c.id==='warden'));
 g.s.testRolls=[1,2];gm(g,{op:'gm_advance_time',count:1,unit:'round'});assert(g.find('hero').hp<hp);
 const h=new Kernel(g.exportState());h.inspect();assert.equal(h.s.creatures.length,1);
});
test('scene closure clears fixed areas/history and rejects unsafe or invalid closure atomically',()=>{
 const g=make();area(g);const before=g.exportState();assert.throws(()=>close(g,{placements:[{id:'hero',x:99,y:2}]}),/placement/);assert.deepEqual(g.exportState(),before);
 gm(g,{op:'gm_begin_initiative',scores:{hero:20,warden:10}});assert.throws(()=>close(g),/initiative/);gm(g,{op:'gm_end_initiative'});
 close(g);assert.equal(g.persistentAreaEvents().length,0);assert.equal(g.s.pendingEventHistory.length,0);assert.equal(g.s.spellCastHistory.length,0);assert.equal(g.s.scene.established,false);
 gm(g,{op:'undo_turn'});assert.equal(g.s.creatures.length,1);assert.equal(g.s.width,30);
 close(g,{keep:[],placements:[]});assert.equal(g.s.creatures.length,0);g.inspect();
});
test('wall-top landing accepts new traversal ruling atomically and surface area modifiers reconcile',()=>{
 const g=make();gm(g,{op:'gm_set_tile',x:2,y:3,kind:'wall'});elev(g,'hero');
 gm(g,{op:'gm_set_traversal',target:'hero',cells:[{x:2,y:3,passable:true}],reason:'Fly over wall'});
 g.dispatch({op:'move',actor:'hero',path:[{x:2,y:3}]});
 gm(g,{op:'gm_set_elevation',target:'hero',elevation:{feet:10,grounded:true,layer:'walltop'},traversal:[{x:2,y:3,passable:true}],reason:'Land on top of wall'});
 assert.equal(g.find('hero').elevation.grounded,true);
 const h=make();gm(h,{op:'gm_resolve_spell',actor:'hero',spell:{name:'Ground entanglement',level:1,casterLevel:2,area:{shape:'sphere',origin:{x:5,y:3},sizeFeet:10},effect:{rounds:3,conditions:['entangled']},persistent:{duration:{count:3,unit:'round'},exposure:{mode:'surface'}}}});
 assert(h.hasCondition('warden','entangled'));elev(h,'warden');assert(!h.hasCondition('warden','entangled'));elev(h,'warden',0,true,'ground');assert(h.hasCondition('warden','entangled'));
});
test('source departure preserves authored concentration tail and cannot grant a reused ID ownership',()=>{
 const g=make();gm(g,{op:'gm_resolve_spell',actor:'warden',spell:{name:'Lingering fear',level:1,casterLevel:3,targets:['hero'],effect:{conditions:['shaken']},concentration:{afterRounds:2}}});
 close(g);assert(g.hasCondition('hero','shaken'));assert.equal(g.concentrationEvents()[0].payload.phase,'lingering');assert.equal(g.concentrationEvents()[0].actor,null);
 const source=g.s.effects.find(e=>e.spellSource)?.spellSource;assert.equal(source.actor,null);assert.equal(source.departedActor,'warden');
 const h=new Kernel(g.exportState());gm(h,{op:'gm_advance_time',count:2,unit:'round'});assert(!h.hasCondition('hero','shaken'));assert.equal(h.concentrationEvents().length,0);
});
test('retained held touch charge survives scene transition without a second free attempt or stale targets',()=>{
 const g=make();g.dispatch({op:'cast_spell',actor:'hero',spell:{name:'Held touch',level:1,casterLevel:3,targets:['warden'],delivery:{type:'touch'},components:[{amount:3,damageType:'force'}]}});
 const id=g.heldTouch('hero').id;close(g);assert.equal(g.heldTouch('hero').id,id);assert.equal(g.heldTouch('hero').payload.freeAttempt,false);assert.equal(g.heldTouch('hero').payload.spell.targets,undefined);
 register(g);spawn(g,'new_target',2,2);g.s.testRolls=[20,1];g.dispatch({op:'deliver_touch_spell',actor:'hero',target:'new_target'});assert.equal(g.s.actions.resources.standard,0);assert.equal(g.find('new_target').hp,17);
});
test('zero-reach defenders react to Tiny entry in their own square without moving the entrant early',()=>{
 const g=make();g.find('hero').sizeCategory='tiny';g.find('hero').reach=0;register(g);spawn(g,'entrant',2,3);g.s.turn=2;
 const r=g.dispatch({op:'move',actor:'entrant',path:[{x:1,y:3}]});assert.equal(r.status,'interrupt');assert.equal(g.find('entrant').x,2);
 g.s.testRolls=[20,1,1];g.dispatch({op:'resolve_interrupt',take:true});assert(g.find('entrant').hp<20);assert.equal(g.find('entrant').x,1);assert.equal(g.s.aooUsed.hero,1);
 assert.equal(g._entryAoO,undefined);
});
console.log(`${n} scene integration groups passed`);
