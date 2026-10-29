import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {AIAdapter} from './ai_adapter.mjs';
import {Kernel,initialState} from './kernel.mjs';
import {openSessionStore} from './session_store.mjs';
import {playerProjection,playerVisibilityStatus} from './player_view.mjs';
import {callTool} from './mcp_tools.mjs';
let n=0,seq=0;const test=(name,f)=>{f();n++;console.log('PASS',name);};
const gm=(a,command)=>a.execute('gm',{command,requestId:'map_'+ ++seq,expectedRevision:a.revision,reason:'Disposable map regression'});
const query=(a,op)=>a.query({command:{op},limit:100}).data;
const full=a=>a.snapshot();
function fixture(){
 const a=new AIAdapter();
 gm(a,{op:'gm_configure_map',width:30,height:40,name:'Test storehouse'});
 gm(a,{op:'gm_spawn_object',id:'crate',name:'Crate',x:3,y:3,material:'wood',maxHp:20});
 gm(a,{op:'gm_set_map_features',features:[{id:'crate_barrier',preset:'wall',cells:[{x:3,y:3}],objectId:'crate',playerDisplay:{layer:'map',label:'Crate',style:'wall'}},{id:'door',preset:'door',points:[{x:8,y:2},{x:8,y:4}],doorState:'open',playerDisplay:{layer:'gm',label:'Secret'}}]});
 gm(a,{op:'gm_set_tiles',cells:[{x:0,y:0,kind:'wall'},{x:1,y:0,kind:'difficult'}]});
 gm(a,{op:'gm_set_tile_elevation',x:5,y:5,elevation:{surfaceFeet:-10,note:'Pit'}});
 gm(a,{op:'gm_set_player_view',rect:{x:0,y:0,width:6,height:6},revealed:true,title:'Public storehouse'});
 gm(a,{op:'gm_establish_scene'});return a;
}
const save=(a,id='original',more={})=>gm(a,{op:'gm_save_map',id,...more});
const load=(a,id='original')=>gm(a,{op:'gm_load_map',id,confirm:true});
function character(a){gm(a,{op:'register_creature',definition:{id:'test_actor',name:'Test actor',stats:{maxHp:30}}});gm(a,{op:'spawn_creature',definition:'test_actor',id:'actor',x:10,y:10});}
test('map-only round trip preserves geometry, doors, damaged objects, masks and elevation',()=>{
 const a=fixture();gm(a,{op:'gm_resolve_damage',target:'crate',amount:9,damageType:'force'});assert.equal(a.game.find('crate').hp,16);
 const publicBefore=playerProjection(a.game.s),clock=a.game.gameTime();save(a);const original=structuredClone(a.game.s.savedMaps.original);
 gm(a,{op:'gm_set_door',id:'door',state:'closed'});gm(a,{op:'gm_set_player_view',all:true,revealed:false});gm(a,{op:'gm_repair_object',target:'crate',amount:20});
 load(a);assert.equal(a.game.find('crate').hp,16);assert.equal(a.game.mapFeatures()[1].doorState,'open');assert.equal(a.game.s.scene.tiles['5,5'].surfaceFeet,-10);
 assert.deepEqual(playerProjection(a.game.s),publicBefore);assert.deepEqual(a.game.gameTime(),clock);assert.deepEqual(a.game.s.savedMaps.original,original);assert.equal(a.game.s.scene.geometry.length,0);
});
test('destroyed linked objects stay destroyed after map load',()=>{
 const a=fixture();gm(a,{op:'gm_resolve_damage',target:'crate',amount:100,damageType:'force'});save(a);load(a);assert.equal(a.game.find('crate').hp,0);assert.equal(playerProjection(a.game.s).features.length,0);
});
test('save excludes characters, spells, effects and clocks without changing them',()=>{
 const a=fixture();character(a);gm(a,{op:'apply_condition',target:'actor',condition:'shaken',rounds:4});
 const before=structuredClone(a.game.s);save(a);const m=a.game.s.savedMaps.original;
 for(const key of ['creatures','effects','pendingEvents','clock','worldRounds','automationRules'])assert(!(key in m));
 assert.equal(m.objects.length,1);assert.deepEqual(a.game.s.effects,before.effects);assert.deepEqual(a.game.s.pendingEvents,before.pendingEvents);assert.equal(a.game.s.seed,before.seed);
});
test('blank map diagnostics are GM-only and never reveal hidden features',()=>{
 const a=fixture();gm(a,{op:'gm_set_player_view',all:true,revealed:false});const before=full(a);
 const v=query(a,'gm_get_player_visibility');assert.equal(v.revealedCells,0);assert.equal(v.gmLayerFeatures,1);assert.match(v.message,/fully covered/);
 assert.deepEqual(full(a),before);assert(!('gmLayerFeatures' in playerProjection(a.game.s)));assert(!JSON.stringify(playerProjection(a.game.s)).includes('Secret'));
 assert.deepEqual(a.status().map.playerVisibility,playerVisibilityStatus(a.game.s));
});
test('clear encounter ends initiative, preserves exact map/objects and removes actors/catalogs/history',()=>{
 const a=fixture();character(a);gm(a,{op:'gm_begin_initiative',scores:{actor:20}});const beforeMap=playerProjection(a.game.s),clock=a.game.gameTime();
 const p=query(a,'gm_preview_encounter_clear');assert.deepEqual(p.remove,['actor']);assert.deepEqual(p.keepObjects,['crate']);assert(p.endInitiative);
 gm(a,{op:'gm_clear_encounter'});assert.deepEqual(a.game.s.creatures.map(c=>c.id),['crate']);assert(!a.game.s.initiative.enabled);assert.deepEqual(playerProjection(a.game.s),beforeMap);assert.deepEqual(a.game.gameTime(),clock);
 assert(!a.game.s.creatureCatalog.test_actor);assert.equal(a.game.previousTurnStart,null);assert.equal(a.game.s.pendingEvents.length,0);
 gm(a,{op:'undo_turn'});assert(!a.game.s.creatures.some(c=>c.id==='actor'));
});
test('explicit survivors keep HP, effects, position, elevation and visibility with no free rest',()=>{
 const a=fixture();save(a);character(a);gm(a,{op:'gm_resolve_damage',target:'actor',amount:5,damageType:'force'});
 gm(a,{op:'apply_condition',target:'actor',condition:'shaken',rounds:4});gm(a,{op:'gm_set_elevation',target:'actor',elevation:{feet:10,grounded:false,layer:'air'}});
 gm(a,{op:'gm_set_player_display',kind:'creature',ids:['actor'],display:{layer:'map',label:'Hero'}});
 const c=structuredClone(a.game.find('actor')),effects=structuredClone(a.game.s.effects);gm(a,{op:'gm_clear_encounter',keep:['actor']});
 assert.equal(a.game.find('actor').hp,c.hp);assert.deepEqual(a.game.find('actor').elevation,c.elevation);assert.deepEqual(a.game.find('actor').playerDisplay,c.playerDisplay);assert.deepEqual(a.game.s.effects,effects);
 assert.throws(()=>load(a),/Clear the encounter/);
});
test('load needs explicit confirmation, empty characters and idle engine; rejection is atomic',()=>{
 const a=fixture();save(a);character(a);let before=full(a);assert.throws(()=>load(a),/Clear the encounter/);assert.deepEqual(full(a),before);
 gm(a,{op:'gm_clear_encounter'});before=full(a);assert.throws(()=>gm(a,{op:'gm_load_map',id:'original'}),/confirm:true/);assert.deepEqual(full(a),before);
});
test('cleanup cannot discard an unanswered reaction or ongoing casting',()=>{
 const s=initialState();s.tiles={};s.creatures[1].size=1;s.creatures[1].x=2;s.creatures[1].y=4;const a=new AIAdapter({game:new Kernel(s)});
 a.execute('action',{command:{op:'move',actor:'hero',path:[{x:1,y:5}]},requestId:'interrupt_fixture',expectedRevision:a.revision});assert(a.game.s.interrupt);
 const before=full(a);assert(query(a,'gm_preview_encounter_clear').blockers.length);assert.throws(()=>gm(a,{op:'gm_clear_encounter'}),/pending/);assert.deepEqual(full(a),before);
});
test('map save overwrite is explicit, IDs are safe, delete and save survive combat undo',()=>{
 const a=fixture();save(a);const before=full(a);assert.throws(()=>save(a),/overwrite/);assert.deepEqual(full(a),before);
 for(const id of ['__proto__','constructor','../escape',''])assert.throws(()=>save(a,id),/Map ID/);
 gm(a,{op:'undo_turn'});assert(a.game.s.savedMaps.original);save(a,'second');gm(a,{op:'gm_delete_map',id:'second'});gm(a,{op:'undo_round'});assert(!a.game.s.savedMaps.second);assert(a.game.s.savedMaps.original);
});
test('malformed saved geometry restores full map/checkpoints/library after rejected load',()=>{
 const a=fixture();save(a);a.game.s.savedMaps.original.features.push({id:'bad',preset:'wall',points:[{x:0,y:0},{x:500,y:500}]});
 const before=full(a);assert.throws(()=>load(a),/bounds/);assert.deepEqual(full(a),before);
});
test('map library survives scene close and real session restart; old engine saves remain readable',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'map-library-'));let store;
 try{const a=fixture();save(a);store=openSessionStore(path.join(dir,'encounter.json'));a.persist=store.save;
 gm(a,{op:'gm_close_scene',keep:[],placements:[]});store.close();store=openSessionStore(path.join(dir,'encounter.json'));const restored=new AIAdapter({saved:store.saved,persist:store.save});load(restored);assert.equal(restored.game.s.width,30);assert.equal(restored.game.mapFeatures().length,2);
 const old=restored.snapshot();old.engineVersion='3.43.0';assert(new AIAdapter({saved:old}));
 }finally{store?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('persistence errors roll back map saves and checkpoints; retries do not apply twice',()=>{
 const a=fixture();const before=full(a);a.persist=()=>{throw Error('disk failed')};assert.throws(()=>save(a),/disk failed/);assert.deepEqual(full(a),before);a.persist=null;
 const request={command:{op:'gm_save_map',id:'once'},requestId:'once',expectedRevision:a.revision,reason:'Retry test'};
 a.execute('gm',request);assert(a.execute('gm',request).replayed);assert.equal(query(a,'gm_list_maps').length,1);
});
test('discovery, schemas and query roles expose each feature',()=>{
 const a=fixture();for(const op of ['gm_save_map','gm_load_map','gm_clear_encounter','gm_list_maps','gm_get_player_visibility'])assert(a.catalog({op}).summary);
 const r=callTool(a,'kernel_reference',{topic:'map_library'});assert(!r.isError,JSON.stringify(r));
 assert.throws(()=>a.game.dispatch({op:'gm_clear_encounter',reason:'No GM authority'},'actor'),/GM/);
});
test('cleanup removes native areas/cooldowns while preserving scheduled world events and clock',()=>{
 const a=fixture();character(a);
 gm(a,{op:'gm_set_cooldown',target:'actor',ability:'Breath',rounds:3});
 gm(a,{op:'gm_schedule_time_event',id:'bell',label:'Bell',after:{count:1,unit:'hour'}});
 gm(a,{op:'gm_resolve_spell',actor:'actor',spell:{name:'Mist',level:1,casterLevel:2,area:{shape:'sphere',origin:{x:15,y:15},sizeFeet:5},effect:{rounds:3,conditions:['shaken']},persistent:{duration:{count:3,unit:'round'}}}});
 assert(a.game.persistentAreaEvents().length);const clock=a.game.gameTime();gm(a,{op:'gm_clear_encounter'});
 assert.equal(a.game.persistentAreaEvents().length,0);assert.equal(a.game.s.pendingEvents.length,0);assert.equal(a.game.s.effects.length,0);assert.equal(a.game.s.scheduledTimeEvents[0].id,'bell');assert.deepEqual(a.game.gameTime(),clock);
});
test('cleanup rejects active multi-round casting without spending or removing anything',()=>{
 const a=fixture();character(a);gm(a,{op:'gm_begin_initiative',scores:{actor:20}});
 a.execute('action',{command:{op:'cast_spell',actor:'actor',spell:{name:'Long cast',level:1,casterLevel:2,castingTime:'1_round',targets:['actor'],components:[{damageType:'force',amount:1}]}},requestId:'long_cast',expectedRevision:a.revision});
 const before=full(a);assert(a.game.s.activeSpellCasts.length);assert.throws(()=>gm(a,{op:'gm_clear_encounter'}),/casting/);assert.deepEqual(full(a),before);
});
test('survivor traversal rulings stay valid when geometry is unchanged',()=>{
 const a=fixture();character(a);gm(a,{op:'gm_set_traversal',target:'actor',cells:[{x:11,y:10,passable:true,costSquares:1}]});
 const before=structuredClone(a.game.s.scene.traversal);gm(a,{op:'gm_clear_encounter',keep:['actor']});assert.deepEqual(a.game.s.scene.traversal,before);
 assert(a.game.traversalRuling(a.game.find('actor'),11,10));
});
test('ordinary scene closure cannot use an internal preserve flag to bypass placement checks',()=>{
 const a=fixture();const before=full(a);assert.throws(()=>gm(a,{op:'gm_close_scene',keep:['crate'],placements:[{id:'crate',x:-1,y:0}],preserveMap:true}),/gm_clear_encounter/);assert.deepEqual(full(a),before);
});
console.log(`${n} map library groups passed`);
