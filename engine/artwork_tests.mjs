import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {PNG} from 'pngjs';
import {AIAdapter} from './ai_adapter.mjs';
import {createArtworkRenderer,normalizeArtwork} from './artwork_raster.mjs';
import {startPlayerHttp} from './player_server.mjs';
import {startHttp} from './mcp_server.mjs';
import {openSessionStore} from './session_store.mjs';
let n=0,seq=0;
const test=async(name,f)=>{await f();console.log('PASS',name);n++;};
const gm=(a,command)=>a.execute('gm',{command,expectedRevision:a.revision,requestId:'art_'+ ++seq,reason:'Disposable artwork test'});
function image(right=[0,255,0,255]){const width=4,height=4,data=Buffer.alloc(64);for(let y=0;y<4;y++)for(let x=0;x<4;x++)data.set(x<2?[255,0,0,255]:right,(y*4+x)*4);return PNG.sync.write({width,height,data}).toString('base64');}
function setup(){const a=new AIAdapter();gm(a,{op:'gm_configure_map',width:2,height:2});gm(a,{op:'gm_set_map_artwork',image:image()});return a;}
const pixel=(png,x,y)=>[...png.data.subarray((y*png.width+x)*4,(y*png.width+x)*4+4)];
await test('artwork is presentation-only, discoverable and rejects malformed uploads atomically',()=>{
 const a=setup(),s=a.game.s,clock=s.worldRounds,seed=s.seed,resources=structuredClone(s.actions.resources),tiles=structuredClone(s.tiles);
 gm(a,{op:'gm_set_map_artwork',placement:{x:0,y:0,width:2,height:2,rotation:0}});
 assert.equal(s.worldRounds,clock);assert.equal(s.seed,seed);assert.deepEqual(s.actions.resources,resources);assert.deepEqual(s.tiles,tiles);
 assert.equal(a.catalog({op:'gm_set_map_artwork'}).referenceTopic,'artwork');assert.equal(a.query({command:{op:'gm_get_map_artwork'}}).data.configured,true);
 const before=a.snapshot();
 for(const command of [
  {op:'gm_set_map_artwork',image:'https://example.com/map.png'},
  {op:'gm_set_map_artwork',image:image().slice(0,-12)+'AAAAAAAAAAAA'},
  {op:'gm_set_map_artwork',placement:{x:0,y:0,width:0,height:1,rotation:0}},
  {op:'gm_set_map_artwork',redactions:[{x:0,y:0,width:5,height:1,color:'#ffffff'}]},
  {op:'gm_set_map_artwork',image:null,redactions:[]}
 ]){assert.throws(()=>gm(a,command));assert.deepEqual(a.snapshot(),before);}
 const bytes=Buffer.from(image(),'base64');bytes.writeUInt32BE(100000,16);assert.throws(()=>normalizeArtwork(bytes.toString('base64')),/exceeds/);
 assert.throws(()=>a.game.dispatch({op:'gm_set_map_artwork',image:null,reason:'No actor authority'},'actor'),/GM|gm/);
});
await test('masked PNG has zero RGB and alpha outside revealed cells; private source never appears',()=>{
 const a=setup(),render=createArtworkRenderer();assert.equal(render(a.game.s).png,null);
 gm(a,{op:'gm_set_player_view',cells:[{x:0,y:0}],revealed:true});
 const r=render(a.game.s),png=PNG.sync.read(r.png);
 assert.deepEqual(pixel(png,0,0),[255,0,0,255]);assert.deepEqual(pixel(png,2,0),[0,0,0,0]);assert.deepEqual(pixel(png,0,2),[0,0,0,0]);
 assert(!JSON.stringify(r.projection).includes(a.game.s.scene.artwork.png));assert(!JSON.stringify(r.projection).includes('redactions'));
 const old=r.projection.artwork.url;
 gm(a,{op:'gm_set_map_artwork',image:image([0,0,255,255])});assert.equal(render(a.game.s).projection.artwork.url,old,'Hidden source changes do not change public hash');
});
await test('permanent redactions overwrite source pixels before transmission and replacement resets them',()=>{
 const a=setup(),render=createArtworkRenderer();gm(a,{op:'gm_set_player_view',all:true,revealed:true});
 gm(a,{op:'gm_set_map_artwork',redactions:[{x:0,y:0,width:2,height:4,color:'#102030'}]});
 let r=PNG.sync.read(render(a.game.s).png);assert.deepEqual(pixel(r,0,0),[16,32,48,255]);assert.deepEqual(pixel(r,2,0),[0,255,0,255]);
 gm(a,{op:'gm_set_map_artwork',placement:{x:0,y:0,width:2,height:2,rotation:0}});assert.equal(a.game.s.scene.artwork.redactions.length,1);
 gm(a,{op:'gm_set_map_artwork',image:image()});assert.equal(a.game.s.scene.artwork.redactions.length,0);
});
await test('alignment supports offsets, scaling and rotation without changing grid dimensions',()=>{
 const a=setup(),render=createArtworkRenderer();gm(a,{op:'gm_set_player_view',all:true,revealed:true});
 gm(a,{op:'gm_set_map_artwork',placement:{x:1,y:0,width:1,height:2,rotation:0}});
 let rendered=render(a.game.s),p=PNG.sync.read(rendered.png);
 assert.deepEqual(pixel(p,0,0),[255,0,0,255]);assert.equal(rendered.projection.artwork.placement.x,1);
 gm(a,{op:'gm_set_map_artwork',placement:{x:2,y:0,width:2,height:2,rotation:90}});
 gm(a,{op:'gm_set_player_view',all:true,revealed:false});gm(a,{op:'gm_set_player_view',cells:[{x:1,y:0}],revealed:true});
 rendered=render(a.game.s);p=PNG.sync.read(rendered.png);
 assert.deepEqual(pixel(p,0,0),[255,0,0,255]);assert.deepEqual(pixel(p,0,2),[0,0,0,0]);assert.deepEqual(pixel(p,2,0),[0,0,0,0]);
 assert.equal(rendered.projection.artwork.placement.rotation,90);assert.equal(a.game.s.width,2);
});
await test('named map round trip, cleanup, scene closure, undo and disk restart preserve intended artwork',()=>{
 const a=setup(),original=structuredClone(a.game.s.scene.artwork);gm(a,{op:'gm_save_map',id:'with_art'});
 gm(a,{op:'gm_clear_encounter',keep:[]});assert.deepEqual(a.game.s.scene.artwork,original);
 gm(a,{op:'gm_close_scene',keep:[],placements:[]});assert.equal(a.game.s.scene.artwork,undefined);
 gm(a,{op:'gm_load_map',id:'with_art',confirm:true});assert.deepEqual(a.game.s.scene.artwork,original);
 gm(a,{op:'gm_set_map_artwork',image:null});gm(a,{op:'undo_turn'});assert.deepEqual(a.game.s.scene.artwork,original);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'artwork-'));try{
  let store=openSessionStore(path.join(dir,'encounter.json'));store.save(a.snapshot());store.close();store=openSessionStore(path.join(dir,'encounter.json'));
  const b=new AIAdapter({saved:store.saved});store.close();assert.deepEqual(b.game.s.scene.artwork,original);assert.deepEqual(b.game.s.savedMaps.with_art.artwork,original);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
await test('persistence rejection and idempotent retries preserve the full engine transaction',()=>{
 const a=setup(),before=a.snapshot();a.persist=()=>{throw Error('Disk full');};assert.throws(()=>gm(a,{op:'gm_set_map_artwork',image:null}),/Disk full/);assert.deepEqual(a.snapshot(),before);
 a.persist=null;const request={command:{op:'gm_set_map_artwork',image:null},requestId:'retry_art',expectedRevision:a.revision,reason:'Retry fixture'};
 a.execute('gm',request);const once=a.snapshot();assert.equal(a.execute('gm',request).replayed,true);assert.deepEqual(a.snapshot(),once);
});
await test('player HTTP serves only the current masked PNG; old URLs fail after re-hide',async()=>{
 const a=setup();gm(a,{op:'gm_set_player_view',cells:[{x:0,y:0}],revealed:true});const s=await startPlayerHttp(a,{port:0}),base=`http://127.0.0.1:${s.address().port}`;
 try{
  const first=await fetch(base+'/state'),etag=first.headers.get('etag'),p=await first.json(),url=p.artwork.url;
  const r=await fetch(base+url);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(pixel(PNG.sync.read(Buffer.from(await r.arrayBuffer())),2,0),[0,0,0,0]);
  gm(a,{op:'gm_set_map_artwork',image:image([9,8,7,255])});assert.equal((await fetch(base+'/state',{headers:{'If-None-Match':etag}})).status,304);
  for(const path of ['/artwork','/artwork/state','/artwork/apply','/artwork/source.png'])assert.equal((await fetch(base+path)).status,404);
  gm(a,{op:'gm_set_player_view',all:true,revealed:false});assert.equal((await fetch(base+url)).status,404);assert.equal((await (await fetch(base+'/state')).json()).artwork,undefined);
 }finally{await new Promise(r=>s.close(r));}
});
await test('local editor shares revision/persistence rules and cannot issue other GM commands',async()=>{
 const a=setup(),s=await startHttp(a,{port:0}),base=`http://127.0.0.1:${s.address().port}`;
 try{
  assert.equal((await fetch(base+'/artwork')).status,200);
  const before=a.snapshot(),command={op:'gm_set_map_artwork',image:null},body={command,requestId:'editor_one',expectedRevision:a.revision,reason:'Local editor test'},headers={'Content-Type':'application/json','X-Tabletop-Editor':'1',Origin:base};
  assert.equal((await fetch(base+'/artwork/state',{headers:{Origin:'http://evil.example'}})).status,403);
  assert.equal((await fetch(base+'/artwork/apply',{method:'POST',body:JSON.stringify(body)})).status,403);
  assert.equal((await fetch(base+'/artwork/apply',{method:'POST',headers,body:JSON.stringify({...body,command:{op:'gm_clear_encounter'}})})).status,400);
  assert.deepEqual(a.snapshot(),before);
  assert.equal((await fetch(base+'/artwork/apply',{method:'POST',headers,body:JSON.stringify(body)})).status,200);
  assert.equal((await fetch(base+'/artwork/apply',{method:'POST',headers,body:JSON.stringify(body)})).status,200,'Identical retry accepted');
  assert.equal((await fetch(base+'/artwork/apply',{method:'POST',headers,body:JSON.stringify({...body,requestId:'editor_stale'})})).status,409);
  assert.equal(a.game.s.scene.artwork,undefined);
 }finally{await new Promise(r=>s.close(r));}
});
console.log(`${n} artwork groups passed`);
