import assert from 'node:assert/strict';
import {Kernel,initialState} from './kernel.mjs';
import {MAP_DIRECTIONS,mapElevationDelta} from './map_geometry.mjs';
import {clone} from './core.mjs';
const gm=(g,c)=>g.dispatch(c,'gm');
const make=()=>{const s=initialState();s.tiles={};Object.assign(s.creatures[0],{x:1,y:3,reach:6,hp:200,maxHp:200});Object.assign(s.creatures[1],{x:8,y:6,size:1,reach:1,hp:200,maxHp:200});return new Kernel(s);};
const add=(g,f)=>gm(g,{op:'gm_set_map_features',features:[f],reason:'Declared map feature'});
const wall=(more={})=>({id:'barrier',preset:'wall',points:[{x:4,y:0},{x:4,y:8}],...more});
const setDoor=(g,state)=>gm(g,{op:'gm_set_door',id:'barrier',state,reason:'Door adjudication'});
const move=(g,path,more={})=>g.dispatch({op:'move',actor:'hero',path,...more});
const free=(g,path,actor='hero')=>gm(g,{op:'gm_adjudicate',kind:'move_free',actor,path,allowanceFeet:500,reason:'Exercise declared route'});
const spell=(more={})=>({name:'Test spell',level:1,casterLevel:5,targets:['warden'],components:[{amount:8,damageType:'force'}],...more});
const area=(g,mode='burst',more={})=>gm(g,{op:'gm_preview_spell_area',area:{shape:'sphere',mode,origin:{x:2,y:3},sizeFeet:40,...more}});
const stairs=(more={})=>({id:'stairs',preset:'stairs',points:[{x:2,y:0},{x:2,y:8}],elevationTransition:{up:'E',riseFeet:5},properties:{directionalCosts:{E:2}},...more});
let passed=0,failed=0;function test(name,fn){try{fn();passed++;console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,e.stack);}}
test('eight-way geometry and validation are atomic',()=>{
 const g=make();add(g,wall({points:[{x:4.25,y:0},{x:4.25,y:1},{x:5.25,y:2}]}));const before=g.exportState(),checkpoint=clone(g.turnStart);
 for(const f of [wall({points:[{x:4,y:1},{x:5,y:3}]}),wall({properties:{directionalCosts:{UP:2}}}),wall({points:[{x:4,y:1},{x:4,y:1}]}),wall({id:undefined}),wall({properties:{cost:0}}),wall({cells:[]}),wall({points:null})])assert.throws(()=>add(g,f));
 assert.deepEqual(g.exportState(),before);assert.deepEqual(g.turnStart,checkpoint);assert.throws(()=>g.dispatch({op:'gm_set_door',id:'barrier',state:'open',reason:'No authority'}),/GM/);
});
test('boundary stops movement, attacks, charge and maneuvers before expenditure',()=>{
 const g=make();Object.assign(g.find('warden'),{x:6,y:3});add(g,wall());assert(g.legalPosition('hero',4,3));const before=g.exportState();
 assert.throws(()=>move(g,[{x:2,y:3},{x:3,y:3},{x:4,y:3}]),/Blocked/);assert.throws(()=>g.dispatch({op:'attack',actor:'hero',target:'warden'}),/total cover/);
 assert.throws(()=>g.dispatch({op:'charge',actor:'hero',target:'warden'}),/obstructed/);assert.throws(()=>g.dispatch({op:'maneuver',actor:'hero',target:'warden',kind:'bull_rush'}),/barrier/);assert.deepEqual(g.exportState(),before);
});
test('parallel movement works; diagonals and larger footprints cannot tunnel',()=>{
 const g=make();add(g,wall());assert(g.canTraverse('hero',{x:3,y:3},{x:3,y:2}));assert(!g.canTraverse('hero',{x:3,y:3},{x:4,y:2}));g.find('hero').size=2;assert(!g.legalPosition('hero',3,3));
});
test('partial cells require explicit traversal and emit an overlap advisory',()=>{
 const g=make();add(g,wall({points:[{x:1,y:3},{x:3,y:5}]}));assert(!g.legalPosition('hero',1,3));assert(g.spatialAdvisories().some(x=>x.includes('overlaps')));
 gm(g,{op:'gm_set_traversal',target:'hero',cells:[{x:1,y:3,passable:true},{x:2,y:3,passable:true}],reason:'Clear side of partial cells'});assert.equal(move(g,[{x:2,y:3}],{step:true}).status,'done');
});
test('all eight cost directions, diagonal parity, and nonstacking overlaps',()=>{
 for(const [d,[dx,dy]] of Object.entries(MAP_DIRECTIONS)){
  const g=make();Object.assign(g.find('hero'),{x:3,y:3});for(const id of ['a','b'])add(g,{id,preset:'stairs',cells:[{x:3,y:3},{x:3+dx,y:3+dy}],properties:{directionalCosts:{[d]:2}}});
  assert.equal(g.moveCost('hero',3+dx,3+dy,1,!!(dx&&dy),{x:3,y:3}),2);assert.equal(g.moveCost('hero',3,3,1,!!(dx&&dy),{x:3+dx,y:3+dy}),1);
  if(dx&&dy)assert.equal(g.moveCost('hero',3+dx,3+dy,2,true,{x:3,y:3}),4);assert.throws(()=>move(g,[{x:3+dx,y:3+dy}],{step:true}),/step|difficult|costly/);
 }
});
test('bent paths calculate each leg rather than direction from the initial square',()=>{
 const g=make();Object.assign(g.find('hero'),{x:3,y:3,speed:15});add(g,{id:'hill',preset:'stairs',cells:[{x:4,y:3},{x:4,y:2}],properties:{directionalCosts:{E:2,N:2,NE:10}}});
 assert.equal(g.dispatch({op:'double_move',actor:'hero',path:[{x:4,y:3},{x:4,y:2}]}).status,'done');
});
test('incorporeal clearance is distinct from attack permission and force barriers',()=>{
 for(const [properties,expected] of [[{},true],[{material:'force'},false],[{thicknessFeet:10},false]]){const g=make();g.find('hero').subtypes=['incorporeal'];add(g,wall({properties}));assert.equal(g.canTraverse('hero',{x:3,y:3},{x:4,y:3}),expected);assert(g.wallAttackGeometry('hero','warden').blocked);}
});
test('doors gate every spell shape and movement through shared geometry',()=>{
 const g=make();add(g,wall({preset:'door'}));for(const mode of ['burst','emanation','spread'])assert(!area(g,mode).cells.some(p=>p.x>=4));assert(!area(g,'burst',{shape:'line',direction:'E'}).cells.some(p=>p.x>=4));
 setDoor(g,'open');for(const mode of ['burst','emanation','spread'])assert(area(g,mode).cells.some(p=>p.x>=4));assert(g.canTraverse('hero',{x:3,y:3},{x:4,y:3}));setDoor(g,'closed');assert(g.wallAttackGeometry('hero','warden').blocked);
});
test('spreads go around finite walls',()=>{
 const g=make();add(g,wall({points:[{x:4,y:1},{x:4,y:6}]}));assert(!area(g).cells.some(p=>p.x===6&&p.y===3));assert(area(g,'spread').cells.some(p=>p.x===6&&p.y===3));
});
test('bars require passage ruling; declared cover blocks AoOs',()=>{
 const g=make();Object.assign(g.find('warden'),{x:6,y:3});add(g,wall({preset:'bars'}));assert(g.wallAttackGeometry('hero','warden').blocked);assert(!g.mapSightBlocked('hero','warden'));
 add(g,wall({preset:'bars',properties:{effect:'allow'}}));assert.equal(g.attackDefenseContext('hero','warden',{attackMode:'ranged'},'ac').acBonus,4);assert(!g.canTakeAoO('hero','warden'));
 gm(g,{op:'gm_set_geometry',actor:'hero',target:'warden',ruling:{cover:'none'},reason:'Clear opening'});assert(g.canTakeAoO('hero','warden'));
});
test('screens block sight rather than effects',()=>{
 const g=make();Object.assign(g.find('warden'),{x:6,y:3});add(g,wall({preset:'screen'}));assert(!g.wallAttackGeometry('hero','warden').blocked);assert.equal(g.attackDefenseContext('hero','warden',{attackMode:'ranged'},'ac').missChance,50);assert(!g.canTakeAoO('hero','warden'));
 assert.throws(()=>g.dispatch({op:'cast_spell',actor:'hero',spell:spell()}),/perceived/);gm(g,{op:'gm_set_geometry',actor:'hero',target:'warden',ruling:{lineOfSight:true},reason:'Special sense'});assert(!g.mapSightBlocked('hero','warden'));
});
test('cover uses native Reflex saves without changing stats, including improved-cover damage',()=>{
 for(const [cover,bonus] of [['partial',1],['cover',2],['improved',4]]){const g=make();add(g,wall({preset:'bars',properties:{effect:'allow',cover}}));const ref=g.stat('warden','ref');g.s.testRolls=[1];const r=gm(g,{op:'gm_resolve_spell',actor:'hero',spell:spell({save:{type:'ref',dc:999,onSuccess:'half'}})});assert.equal(r.targets[0].save.total,1+ref+bonus);assert.equal(g.stat('warden','ref'),ref);assert.equal(r.targets[0].packet.raw,cover==='improved'?4:8);}
});
test('spread excludes cover Reflex bonus; burst uses its origin',()=>{
 const g=make();Object.assign(g.find('warden'),{x:6,y:3});add(g,wall({preset:'bars',properties:{effect:'allow'}}));for(const mode of ['spread','burst']){g.s.testRolls=[1,1];const s=spell({area:{shape:'sphere',origin:{x:2,y:3},mode,sizeFeet:40},save:{type:'ref',dc:999,onSuccess:'half'}});delete s.targets;const r=gm(g,{op:'gm_resolve_spell',actor:'hero',spell:s});assert.equal(r.targets.find(t=>t.target==='warden').save.coverBonus,mode==='spread'?undefined:2);}
});
test('targeted spells and origin placement cannot bypass walls',()=>{
 const g=make();add(g,wall());const before=g.exportState();assert.throws(()=>g.dispatch({op:'cast_spell',actor:'hero',spell:spell()}),/line of effect/);const s=spell({area:{shape:'sphere',origin:{x:6,y:3},sizeFeet:10}});delete s.targets;assert.throws(()=>g.dispatch({op:'cast_spell',actor:'hero',spell:s}),/origin/);assert.deepEqual(g.exportState(),before);
});
test('forced push stops at wall; teleport does not trace intervening features',()=>{
 const g=make();g.find('hero').x=2;Object.assign(g.find('warden'),{x:3,y:3});g.find('hero').maneuverImprovements=['bull_rush'];add(g,wall());g.s.testRolls=[20];assert.equal(gm(g,{op:'maneuver',actor:'hero',target:'warden',kind:'bull_rush',bonus:100}).pushedSquares,0);gm(g,{op:'gm_adjudicate',kind:'relocate',target:'hero',x:5,y:3,reason:'Teleport'});assert.equal(g.find('hero').x,5);
});
test('linked object retains native HP/hardness and destruction opens its barrier',()=>{
 const g=make();gm(g,{op:'gm_spawn_object',id:'panel',name:'Panel',x:4,y:3,material:'wood',thicknessInches:1});add(g,wall({preset:'door',objectId:'panel'}));assert(!g.wallAttackGeometry('hero','panel').blocked);assert(!g.occupiesSpace(g.find('panel')));
 gm(g,{op:'gm_set_geometry',actor:'hero',target:'warden',ruling:{lineOfEffect:false},reason:'Door closed'});gm(g,{op:'gm_resolve_packet',target:'panel',components:[{damageType:'slashing',amount:30}]});assert.equal(g.healthState('panel').status,'destroyed');assert(!g.wallAttackGeometry('hero','warden').blocked);assert.equal(g.geometryRuling('hero','warden'),null);
});
test('door changes reuse persistent-area entry receipts',()=>{
 const g=make();Object.assign(g.find('warden'),{x:6,y:3});add(g,wall({preset:'door'}));const s=spell({area:{shape:'sphere',origin:{x:2,y:3},sizeFeet:40},persistent:{duration:{count:5,unit:'round'},triggers:['enter'],affects:'enemies'}});delete s.targets;gm(g,{op:'gm_resolve_spell',actor:'hero',spell:s});const hp=g.find('warden').hp;setDoor(g,'open');assert.equal(g.find('warden').hp,hp-8);setDoor(g,'closed');setDoor(g,'open');assert.equal(g.find('warden').hp,hp-8);
});
test('resize, restore, pure diagnostics, undo and scene closure',()=>{
 const g=make();add(g,wall({preset:'door'}));const before=g.exportState();assert.deepEqual(new Kernel(before).mapFeatures(),g.mapFeatures());assert.throws(()=>gm(g,{op:'gm_configure_map',width:10,height:7,reason:'Clip endpoint'}),/clip/);gm(g,{op:'gm_get_geometry',actor:'hero',target:'warden'});assert.deepEqual(g.exportState(),before);g.turnStart=clone(g.s);setDoor(g,'open');gm(g,{op:'undo_turn'});assert.equal(g.mapFeatures()[0].doorState,'closed');gm(g,{op:'gm_close_scene',keep:['hero'],placements:[{id:'hero',x:1,y:1}],reason:'Leave scene'});assert.deepEqual(g.mapFeatures(),[]);
});
test('uphill then downhill restores elevation, including negative heights and annotations',()=>{
 const g=make();add(g,stairs());gm(g,{op:'gm_set_elevation',target:'hero',elevation:{feet:-10,grounded:true,layer:'ground',note:'In a pit'},reason:'Starting height'});
 free(g,[{x:2,y:3}]);assert.equal(g.find('hero').elevation.feet,-5);free(g,[{x:2,y:4}]);assert.equal(g.find('hero').elevation.feet,-5);free(g,[{x:1,y:4}]);assert.deepEqual(g.find('hero').elevation,{feet:-10,grounded:true,layer:'ground',note:'In a pit'});
});
test('all eight uphill directions reverse exactly, including stops on diagonal boundaries',()=>{
 for(const [up,[dx,dy]] of Object.entries(MAP_DIRECTIONS)){
  const f=stairs({points:[{x:4-dy*3,y:4+dx*3},{x:4+dy*3,y:4-dx*3}],elevationTransition:{up,riseFeet:7}});
  const a={x:3.5-dx,y:3.5-dy},b={x:3.5+dx,y:3.5+dy},middle={x:3.5,y:3.5};
  assert.equal(mapElevationDelta(f,a,b),7,up);assert.equal(mapElevationDelta(f,b,a),-7,up);
  assert.equal(mapElevationDelta(f,a,middle)+mapElevationDelta(f,middle,b),7,up);assert.equal(mapElevationDelta(f,b,middle)+mapElevationDelta(f,middle,a),-7,up);
 }
});
test('failed movement changes neither height nor action budget; accepted steps and undo update together',()=>{
 const g=make();add(g,stairs());const before=g.exportState();assert.throws(()=>move(g,[{x:2,y:3}],{step:true}),/difficult|costly/);assert.deepEqual(g.exportState(),before);
 g.turnStart=clone(g.s);move(g,[{x:2,y:3}]);assert.equal(g.find('hero').elevation.feet,5);gm(g,{op:'undo_turn'});assert.equal(g.find('hero').x,1);assert.equal(g.find('hero').elevation,undefined);
});
test('airborne passage, annotation-only stairs and teleport do not alter height',()=>{
 const g=make();add(g,stairs());gm(g,{op:'gm_set_elevation',target:'hero',elevation:{feet:30,grounded:false,layer:'air'},reason:'Flying'});assert.equal(g.moveCost('hero',2,3,1,false),1);free(g,[{x:2,y:3}]);assert.equal(g.find('hero').elevation.feet,30);
 const h=make();const f=stairs();delete f.elevationTransition;add(h,f);free(h,[{x:2,y:3}]);assert.equal(h.find('hero').elevation,undefined);
 const k=make();add(k,stairs());gm(k,{op:'gm_adjudicate',kind:'relocate',target:'hero',x:3,y:3,reason:'Teleport'});assert.equal(k.find('hero').elevation,undefined);
});
test('multiple rises on a route accumulate and reverse without repeated charges inside the same level',()=>{
 const g=make();add(g,stairs());add(g,stairs({id:'second',points:[{x:3,y:0},{x:3,y:8}],elevationTransition:{up:'E',riseFeet:10}}));free(g,[{x:2,y:3},{x:3,y:3},{x:3,y:4}]);assert.equal(g.find('hero').elevation.feet,15);free(g,[{x:2,y:4},{x:1,y:4}]);assert.equal(g.find('hero').elevation.feet,0);
});
test('height transitions validate direction/geometry and reject ambiguous overlapping rises',()=>{
 const g=make();for(const f of [stairs({elevationTransition:{up:'N',riseFeet:5}}),stairs({elevationTransition:{up:'E',riseFeet:0}}),stairs({cells:[{x:2,y:3}],points:undefined})])assert.throws(()=>add(g,f));
 add(g,stairs());add(g,stairs({id:'duplicate'}));const before=g.exportState();assert.throws(()=>free(g,[{x:2,y:3}]),/Multiple elevation/);assert.deepEqual(g.exportState(),before);
});
test('pending AoO does not apply rise early, continuation applies it exactly once',()=>{
 const g=make();g.find('hero').reach=1;Object.assign(g.find('warden'),{x:1,y:2});add(g,stairs());const r=move(g,[{x:2,y:3}]);assert.equal(r.status,'interrupt');assert.equal(g.find('hero').elevation,undefined);
 assert.throws(()=>add(g,wall()),/pending/);gm(g,{op:'gm_get_geometry',actor:'hero',target:'warden'});g.dispatch({op:'resolve_interrupt',take:false});assert.equal(g.find('hero').elevation.feet,5);
});
test('forced movement applies the same height transition',()=>{
 const g=make();Object.assign(g.find('hero'),{x:1,y:3});Object.assign(g.find('warden'),{x:2,y:3});g.find('hero').maneuverImprovements=['bull_rush'];add(g,stairs({points:[{x:3,y:0},{x:3,y:8}]}));g.s.testRolls=[20];const r=gm(g,{op:'maneuver',actor:'hero',target:'warden',kind:'bull_rush',bonus:0});assert(r.pushedSquares>=1);assert.equal(g.find('warden').elevation.feet,5);
});
console.log(`V3.35 map features: ${passed} passed, ${failed} failed`);if(failed)process.exitCode=1;
