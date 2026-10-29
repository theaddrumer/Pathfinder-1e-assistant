/** Disposable resolution/calibration regressions; no AP artwork or user saves. */
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {PNG} from 'pngjs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {AIAdapter} from './ai_adapter.mjs';
import {calibrateArtwork,artworkHeader,ARTWORK_MAX_BYTES,ARTWORK_REQUEST_BYTES} from './map_artwork.mjs';
import {createArtworkRenderer,normalizeArtwork} from './artwork_raster.mjs';
import {callTool} from './mcp_tools.mjs';
import {startHttp} from './mcp_server.mjs';
import {openSessionStore} from './session_store.mjs';
let seq=0,count=0;const gm=(a,command)=>a.execute('gm',{command,requestId:'resolution_'+ ++seq,expectedRevision:a.revision,reason:'Disposable large-map test'});
const test=async(name,fn)=>{const start=performance.now();await fn();console.log('PASS',name,Math.round(performance.now()-start)+' ms');count++;};
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const pixel=(p,x,y)=>[...p.data.subarray((y*p.width+x)*4,(y*p.width+x)*4+4)];
await test('two-point calibration handles partial edges, 10-ft grids, rotation and invalid input atomically',()=>{
 const c={points:[{source:{x:13,y:17},grid:{x:1,y:1}},{source:{x:213,y:17},grid:{x:21,y:1}}]};
 const p=calibrateArtwork({width:320,height:340},c);near(p.x,-.3);near(p.y,-.7);near(p.width,32);near(p.height,34);near(p.rotation,0);
 // Ten printed 10-ft squares occupy twenty native 5-ft cells.
 const rotated=calibrateArtwork({width:320,height:340},{points:[{source:{x:13,y:17},grid:{x:10,y:2}},{source:{x:13,y:217},grid:{x:30,y:2}}]});
 near(rotated.rotation,-90);near(rotated.x,8.3);near(rotated.y,3.3);
 const png=PNG.sync.write({width:320,height:340,data:Buffer.alloc(320*340*4,255)}).toString('base64'),a=new AIAdapter();
 gm(a,{op:'gm_set_map_artwork',image:png,calibration:c});assert.deepEqual(a.game.s.scene.artwork.placement,p);
 const before=a.snapshot();
 for(const calibration of [{points:[]},{points:[c.points[0],c.points[0]]},{points:[{...c.points[0],source:{x:-1,y:0}},c.points[1]]}]){
  assert.throws(()=>gm(a,{op:'gm_set_map_artwork',calibration}));assert.deepEqual(a.snapshot(),before);
 }
 assert.throws(()=>gm(a,{op:'gm_set_map_artwork',calibration:c,placement:p}),/OR/);assert.deepEqual(a.snapshot(),before);
});
const width=3200,height=3400,data=Buffer.alloc(width*height*4);let seed=37;
for(let y=0;y<height;y+=2)for(let x=0;x<width;x+=2){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=(seed>>>27)*8;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)data.set([v,255-v,v,255],((y+dy)*width+x+dx)*4);}
const encoded=PNG.sync.write({width,height,data}).toString('base64');
console.log('Large fixture:',width,'x',height,'PNG bytes',Buffer.from(encoded,'base64').length,'JSON bytes',encoded.length);
assert(encoded.length>4*1024*1024,'Exercise old per-map and transport ceilings');assert(Buffer.from(encoded,'base64').length<ARTWORK_MAX_BYTES);
const a=new AIAdapter();
await test('160×170 baseline retains 3200×3400 source pixels through import and public display',()=>{
 gm(a,{op:'gm_configure_map',width:160,height:170});
 const result=callTool(a,'kernel_gm',{command:{op:'gm_set_map_artwork',image:encoded},expectedRevision:a.revision,requestId:'large_import',reason:'Synthetic large map'});
 assert(!result.isError,JSON.stringify(result.structuredContent));
 gm(a,{op:'gm_set_player_view',all:true,revealed:true});
 const r=createArtworkRenderer()(a.game.s),out=PNG.sync.read(r.png);
 assert.equal(out.width,width);assert.equal(out.height,height);assert.deepEqual(out.data,data);
 assert.deepEqual(r.projection.artwork.placement,{x:0,y:0,width:160,height:170,rotation:0});
});
await test('large image map bookmarks, undo and disk restart preserve bytes and placement',()=>{
 gm(a,{op:'gm_save_map',id:'baseline'});gm(a,{op:'gm_save_map',id:'baseline_copy'});
 const original=a.game.s.scene.artwork.png;gm(a,{op:'gm_set_map_artwork',placement:{x:-.25,y:-.25,width:160,height:170,rotation:0}});
 gm(a,{op:'gm_load_map',id:'baseline',confirm:true});assert.equal(a.game.s.scene.artwork.png,original);
 gm(a,{op:'gm_set_map_artwork',image:null});gm(a,{op:'undo_turn'});assert.equal(a.game.s.scene.artwork.png,original);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'large-art-'));try{
  let store=openSessionStore(path.join(dir,'encounter.json'));store.save(a.snapshot());store.close();store=openSessionStore(path.join(dir,'encounter.json'));
  const b=new AIAdapter({saved:store.saved});store.close();assert.equal(b.game.s.scene.artwork.png,original);assert.equal(b.game.s.savedMaps.baseline_copy.artwork.png,original);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
await test('maximum 256×256 geometry does not reduce image resolution or allocate grid-sized artwork',()=>{
 const s=structuredClone(a.game.s);s.width=256;s.height=256;s.scene.artwork.placement={x:0,y:0,width:256,height:256,rotation:0};
 s.scene.playerView.revealed=Object.fromEntries(Array.from({length:256*256},(_,i)=>[`${i%256},${Math.floor(i/256)}`,true]));
 const out=PNG.sync.read(createArtworkRenderer()(s).png);assert.equal(out.width,width);assert.equal(out.height,height);assert.deepEqual(out.data,data);
});
await test('fractional/rotated pixel footprints never carry unrevealed RGB, including redactions',()=>{
 const b=new AIAdapter(),w=40,h=40,png=PNG.sync.write({width:w,height:h,data:Buffer.alloc(w*h*4,255)}).toString('base64');
 gm(b,{op:'gm_configure_map',width:4,height:4});gm(b,{op:'gm_set_player_view',cells:[{x:1,y:1}],revealed:true});
 const render=createArtworkRenderer();
 for(const rotation of [0,17,45,90,-37]){
  const p={x:.73,y:.39,width:2,height:2,rotation};gm(b,{op:'gm_set_map_artwork',image:png,placement:p,redactions:[{x:0,y:0,width:40,height:40,color:'#123456'}]});
  const out=PNG.sync.read(render(b.game.s).png),r=rotation*Math.PI/180;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const v=pixel(out,x,y);
   if(!v[3])assert.deepEqual(v,[0,0,0,0]);
   else{assert.deepEqual(v,[18,52,86,255]);for(const [dx,dy] of [[0,0],[1,0],[0,1],[1,1]]){
    const gx=p.x+Math.cos(r)*(x+dx)/w*p.width-Math.sin(r)*(y+dy)/h*p.height;
    const gy=p.y+Math.sin(r)*(x+dx)/w*p.width+Math.cos(r)*(y+dy)/h*p.height;
    assert(gx>=1-1e-8&&gx<=2+1e-8&&gy>=1-1e-8&&gy<=2+1e-8);
   }}
  }
 }
});
await test('local editor and official MCP HTTP accept >2 MiB artwork; ordinary tools retain their bound',async()=>{
 const b=new AIAdapter(),server=await startHttp(b,{port:0}),base=`http://127.0.0.1:${server.address().port}`;
 try{
  const body={command:{op:'gm_set_map_artwork',image:encoded},expectedRevision:b.revision,requestId:'editor_large',reason:'Synthetic full resolution import'};
  const response=await fetch(base+'/artwork/apply',{method:'POST',headers:{'Content-Type':'application/json','X-Tabletop-Editor':'1',Origin:base},body:JSON.stringify(body)});
  assert.equal(response.status,200,await response.text());assert.deepEqual(artworkHeader(b.game.s.scene.artwork.png),{width,height});
  const client=new Client({name:'large-artwork-regression',version:'1.0.0'});
  try{
   await client.connect(new StreamableHTTPClientTransport(new URL(base+'/mcp')));
   const uploaded=await client.callTool({name:'kernel_gm',arguments:{...body,expectedRevision:b.revision,requestId:'mcp_large'}});
   assert(!uploaded.isError,JSON.stringify(uploaded));
  }finally{await client.close();}
  const rejected=callTool(b,'kernel_query',{command:{op:'gm_get_map',extra:'x'.repeat(2*1024*1024)}});assert(rejected.isError);assert.match(rejected.structuredContent.error.message,/2 MiB/);
 }finally{await new Promise(r=>server.close(r));}
});
await test('dimension and byte limits reject before decoding oversized PNGs',()=>{
 const header=Buffer.from(encoded,'base64');header.writeUInt32BE(8193,16);assert.throws(()=>normalizeArtwork(header.toString('base64')),/exceeds/);
 header.writeUInt32BE(8192,16);header.writeUInt32BE(8192,20);assert.throws(()=>artworkHeader(header.toString('base64')),/exceeds/);
 assert(ARTWORK_REQUEST_BYTES>Math.ceil(ARTWORK_MAX_BYTES/3)*4+100000);
});
console.log(`${count} large-artwork groups passed`);
