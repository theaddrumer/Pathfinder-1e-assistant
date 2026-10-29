import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const root=path.dirname(fileURLToPath(import.meta.url)),dir=fs.mkdtempSync(path.join(os.tmpdir(),'pf-launcher-'));
const file=path.join(dir,'encounter.json'),children=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,ms=10000){const start=Date.now();while(!fn()){if(Date.now()-start>ms)throw Error('Timed out');await pause(25);}}
function run(extra={}){
 const p=spawn(process.execPath,[path.join(root,'launcher','launcher_host.mjs')],{cwd:root,env:{...process.env,TABLETOP_STATE_PATH:file,TABLETOP_PORT:'0',TABLETOP_PLAYER_PORT:'0',...extra},stdio:['pipe','pipe','pipe']});
 let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);children.push(p);
 return {p,out:()=>out,err:()=>err};
}
async function ready(c){await until(()=>c.out().includes('TABLETOP_LAUNCHER_READY')||c.p.exitCode!==null);assert.equal(c.p.exitCode,null,c.err());return {mcp:Number(c.err().match(/listening on port (\d+)/)?.[1]),player:Number(c.err().match(/Player map: http:\/\/127.0.0.1:(\d+)/)?.[1])};}
async function stop(c,eof=false){if(eof)c.p.stdin.end();else c.p.stdin.write('shutdown\n');await until(()=>c.p.exitCode!==null);assert.equal(c.p.exitCode,0,c.err());assert(!fs.existsSync(file+'.lock'),'lock released');}
const call=async(client,name,args={})=>{const r=await client.callTool({name,arguments:args});assert(!r.isError,JSON.stringify(r));return r.structuredContent;};
let count=0;async function test(name,fn){await fn();count++;console.log('PASS',name);}
try{
 let revision;
 await test('launcher host serves live MCP and player map; accepted mutation persists across graceful stop/restart',async()=>{
  let c=run(),ports=await ready(c);assert(ports.mcp&&ports.player);
  const client=new Client({name:'launcher-test',version:'1'});
  try{
   await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${ports.mcp}/mcp`)));
   const status=await call(client,'kernel_status');
   const result=await call(client,'kernel_gm',{command:{op:'gm_set_player_view',title:'Launcher persistence test'},expectedRevision:status.revision,requestId:'launcher-test-title',reason:'Synthetic launcher test'});
   revision=result.revision;
   const response=await fetch(`http://127.0.0.1:${ports.player}/state`);assert.equal(response.status,200);assert.equal((await response.json()).map.title,'Launcher persistence test');
  }finally{await client.close();}
  await stop(c);c=run();ports=await ready(c);
  const restored=new Client({name:'launcher-test-restart',version:'1'});
  try{await restored.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${ports.mcp}/mcp`)));assert.equal((await call(restored,'kernel_status')).revision,revision);}finally{await restored.close();await stop(c);}
 });
 await test('parent pipe closure shuts down and preserves encounter',async()=>{const before=fs.readFileSync(file,'utf8'),c=run();await ready(c);await stop(c,true);assert.equal(fs.readFileSync(file,'utf8'),before);});
 await test('second writer rejected without stopping or altering the first writer',async()=>{const c=run();await ready(c);const other=run();await until(()=>other.p.exitCode!==null);assert.equal(other.p.exitCode,1);assert.match(other.err(),/already has a running server/);assert.equal(c.p.exitCode,null);await stop(c);});
 await test('occupied player port cleans up MCP listener and owned lock',async()=>{
  const blocker=net.createServer();await new Promise(resolve=>blocker.listen(0,'127.0.0.1',resolve));
  try{const c=run({TABLETOP_PLAYER_PORT:String(blocker.address().port)});await until(()=>c.p.exitCode!==null);assert.equal(c.p.exitCode,1);assert.match(c.err(),/EADDRINUSE/);assert(!c.out().includes('TABLETOP_LAUNCHER_READY'));assert(!fs.existsSync(file+'.lock'));assert(blocker.listening);}finally{await new Promise(resolve=>blocker.close(resolve));}
 });
 await test('stale crash lock recovers and damaged save fails without overwriting it',async()=>{
  fs.writeFileSync(file+'.lock',JSON.stringify({pid:2147483647,token:'test-crash'}));let c=run();await ready(c);await stop(c);
  fs.writeFileSync(file,'not json');c=run();await until(()=>c.p.exitCode!==null);assert.equal(c.p.exitCode,1);assert.equal(fs.readFileSync(file,'utf8'),'not json');assert(!fs.existsSync(file+'.lock'));
 });
 console.log(`${count} launcher lifecycle groups passed`);
}finally{for(const c of children)if(c.exitCode===null)c.kill();await pause(100);fs.rmSync(dir,{recursive:true,force:true});}
