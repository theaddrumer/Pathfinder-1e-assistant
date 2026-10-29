import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {AIAdapter} from './ai_adapter.mjs';
import {startPlayerHttp} from './player_server.mjs';
import {startHttp} from './mcp_server.mjs';
let seq=0,count=0;const gm=(a,command)=>a.execute('gm',{command,expectedRevision:a.revision,requestId:'net_'+ ++seq,reason:'Player transport fixture'});
const test=async(name,fn)=>{await fn();count++;console.log('PASS',name)};
await test('public listener has no command, file traversal, origin or mutation access',async()=>{
 const a=new AIAdapter({demo:true}),s=await startPlayerHttp(a,{port:0}),base=`http://127.0.0.1:${s.address().port}`;
 try{
  const before=a.snapshot();for(const url of ['/mcp','/index.html','/registry.mjs','/encounter.json','/%2e%2e/mcp_server.mjs','/state?gm=true'])assert.equal((await fetch(base+url)).status,404,url);
  for(const method of ['POST','PUT','DELETE','PATCH','OPTIONS'])assert.equal((await fetch(base+'/state',{method,body:method==='OPTIONS'?undefined:'{}'})).status,405);
  assert.equal((await fetch(base+'/state',{headers:{Origin:'https://untrusted.example'}})).status,403);
  const status=await new Promise((resolve,reject)=>{const r=http.get(base+'/state',{headers:{Host:'untrusted.example'}},res=>{res.resume();resolve(res.statusCode)});r.on('error',reject)});assert.equal(status,403);
  const page=await fetch(base+'/player');assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/default-src 'none'/);const html=await page.text();assert(!html.includes('kernel_gm'));assert(!html.includes('register-creature'));
  assert.deepEqual(a.snapshot(),before);
 }finally{await new Promise(r=>s.close(r))}
 await assert.rejects(()=>startPlayerHttp(a,{host:'0.0.0.0',port:0}),/loopback/);
});
await test('public hash ignores private state and tracks actual movement, hide and persisted state',async()=>{
 const a=new AIAdapter({demo:true});a.game.s.tiles={};gm(a,{op:'gm_set_player_view',all:true,revealed:true});gm(a,{op:'gm_set_player_display',kind:'creature',ids:['hero'],display:{layer:'map',label:'Explorer'}});
 const s=await startPlayerHttp(a,{port:0}),base=`http://127.0.0.1:${s.address().port}`;
 try{
  let r=await fetch(base+'/state'),etag=r.headers.get('etag'),p=await r.json();assert.equal(p.tokens.length,1);assert(!JSON.stringify(p).includes('warden'));assert(!JSON.stringify(p).includes('maxHp'));
  gm(a,{op:'gm_resolve_damage',target:'warden',amount:1,damageType:'force'});
  r=await fetch(base+'/state',{headers:{'If-None-Match':etag}});assert.equal(r.status,304);assert.equal(await r.text(),'');
  a.execute('action',{command:{op:'move',actor:'hero',path:[{x:1,y:5}]},expectedRevision:a.revision,requestId:'visible_move'});
  r=await fetch(base+'/state',{headers:{'If-None-Match':etag}});assert.equal(r.status,200);p=await r.json();assert.equal(p.tokens[0].y,5);assert.notEqual(r.headers.get('etag'),etag);
  gm(a,{op:'gm_set_player_display',kind:'creature',ids:['hero'],display:{layer:'gm'}});p=await (await fetch(base+'/state')).json();assert.equal(p.tokens.length,0);
  const saved=a.snapshot();a.game.find('warden').name='PRIVATE_CHANGED';a.game=new AIAdapter({saved}).game;assert.deepEqual(await (await fetch(base+'/state')).json(),p);
 }finally{await new Promise(r=>s.close(r))}
});
await test('shared vitals refresh over HTTP while hidden or unshared stats keep the same hash',async()=>{
 const a=new AIAdapter({demo:true});a.game.s.tiles={};
 gm(a,{op:'gm_set_player_view',all:true,revealed:true});
 for(const id of ['hero','warden'])gm(a,{op:'gm_set_player_display',kind:'creature',ids:[id],display:{layer:'map',label:id==='hero'?'Explorer':'Enemy',showVitals:id==='hero'}});
 const server=await startPlayerHttp(a,{port:0}),base=`http://127.0.0.1:${server.address().port}`;
 try{
  let r=await fetch(base+'/state'),etag=r.headers.get('etag'),p=await r.json();
  const hp=p.tokens.find(t=>t.vitals).vitals.hp;assert(!p.tokens.find(t=>t.label==='Enemy').vitals);
  gm(a,{op:'gm_resolve_damage',target:'warden',amount:1,damageType:'force'});
  assert.equal((await fetch(base+'/state',{headers:{'If-None-Match':etag}})).status,304);
  gm(a,{op:'gm_resolve_damage',target:'hero',amount:1,damageType:'force'});
  r=await fetch(base+'/state',{headers:{'If-None-Match':etag}});assert.equal(r.status,200);p=await r.json();assert.equal(p.tokens.find(t=>t.vitals).vitals.hp,hp-1);
  gm(a,{op:'gm_set_player_display',kind:'creature',ids:['hero'],display:{layer:'gm'}});
  r=await fetch(base+'/state');etag=r.headers.get('etag');assert(!(await r.text()).includes('vitals'));
  gm(a,{op:'gm_resolve_damage',target:'hero',amount:1,damageType:'force'});
  assert.equal((await fetch(base+'/state',{headers:{'If-None-Match':etag}})).status,304);
 }finally{await new Promise(r=>server.close(r))}
});
await test('private MCP remains authenticated and public listener never reuses GM credentials',async()=>{
 const a=new AIAdapter(),token='private-fixture-token-with-at-least-24-chars';const gmServer=await startHttp(a,{port:0,token}),player=await startPlayerHttp(a,{port:0});
 try{
  const g=`http://127.0.0.1:${gmServer.address().port}`,p=`http://127.0.0.1:${player.address().port}`;
  assert.equal((await fetch(g+'/mcp',{method:'POST',body:'{}'})).status,401);
  assert.equal((await fetch(g+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,Origin:p},body:'{}'})).status,403);
  assert.equal((await fetch(p+'/state')).status,200);assert.equal((await fetch(p+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+token},body:'{}'})).status,405);
 }finally{await new Promise(r=>player.close(r));await new Promise(r=>gmServer.close(r))}
});
await test('real CLI starts both listeners and releases its encounter lock on exit',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kernel-player-cli-')),file=path.join(dir,'encounter.json');
 const child=spawn(process.execPath,['mcp_server.mjs','--http'],{cwd:new URL('.',import.meta.url),env:{...process.env,TABLETOP_PORT:'0',TABLETOP_PLAYER_PORT:'0',TABLETOP_STATE_PATH:file,TABLETOP_PLAYER_VIEW:''},stdio:['ignore','pipe','pipe']});
 try{
  const output=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(Error('CLI startup timed out: '+log)),8000);child.once('exit',code=>{clearTimeout(timer);reject(Error('Early exit '+code+': '+log))});child.stderr.on('data',b=>{log+=b;if(log.includes('encounter persistence enabled.')){clearTimeout(timer);resolve(log)}})});
  const url=output.match(/Player map: (http:\/\/[^ ]+)/)[1];assert.equal((await fetch(url)).status,200);assert(fs.existsSync(file));
  const done=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await done;assert(!fs.existsSync(file+'.lock'));
 }finally{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');fs.rmSync(dir,{recursive:true,force:true})}
});
console.log(`${count} player transport groups passed`);
