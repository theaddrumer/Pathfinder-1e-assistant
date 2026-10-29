import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {AIAdapter} from './ai_adapter.mjs';
import {startHttp} from './mcp_server.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kernel-transport-'));
let count=0;const test=async(name,fn)=>{await fn();count++;console.log('PASS',name);};
const connect=async(file)=>{
 const transport=new StdioClientTransport({command:process.execPath,args:[path.join(root,'mcp_server.mjs'),'--demo'],cwd:root,env:{...process.env,TABLETOP_STATE_PATH:file},stderr:'pipe'});
 let errors='';transport.stderr.on('data',chunk=>errors+=chunk.toString());const client=new Client({name:'kernel-integration-test',version:'1.0.0'});
 await client.connect(transport);return {client,transport,errors:()=>errors};
};
const call=async(client,name,args={})=>{const r=await client.callTool({name,arguments:args});assert(!r.isError,JSON.stringify(r));return r.structuredContent;};
try{
 await test('official SDK stdio discovery, references, mutation and durable retry after restart',async()=>{
  const file=path.join(dir,'stdio.json');let connection=await connect(file);let savedArgs,revision;
  try{
   const tools=await connection.client.listTools();assert.equal(tools.tools.length,7);assert(tools.tools.find(x=>x.name==='kernel_action').inputSchema.required.includes('expectedRevision'));
   const resources=await connection.client.listResources();assert(resources.resources.some(x=>x.name==='integration'));const guide=await connection.client.readResource({uri:'tabletop://reference/integration'});assert(guide.contents[0].text.includes('Retries'));
   const state=await call(connection.client,'kernel_status');savedArgs={command:{op:'gm_resolve_damage',target:'hero',amount:3,damageType:'force'},expectedRevision:state.revision,requestId:'stdio_once',reason:'Transport test injury'};
   const r=await call(connection.client,'kernel_gm',savedArgs);assert.equal(r.state.creatures.find(c=>c.id==='hero').hp,37);revision=r.revision;
  }finally{await connection.client.close();}
  connection=await connect(file);
  try{assert.equal((await call(connection.client,'kernel_status')).revision,revision);const replay=await call(connection.client,'kernel_gm',savedArgs);assert(replay.replayed);assert.equal((await call(connection.client,'kernel_status')).creatures.find(c=>c.id==='hero').hp,37);assert.equal(connection.errors(),'');}
  finally{await connection.client.close();}
 });
 await test('HTTP official SDK handshake, tool calls, auth/host/origin boundaries and concurrency',async()=>{
  const adapter=new AIAdapter({demo:true}),token='integration-test-private-token-123456';const server=await startHttp(adapter,{port:0,token});
  const endpoint=`http://127.0.0.1:${server.address().port}/mcp`;
  const client=new Client({name:'kernel-http-test',version:'1.0.0'}),transport=new StreamableHTTPClientTransport(new URL(endpoint),{requestInit:{headers:{Authorization:'Bearer '+token}}});
  try{
   const raw=(body,headers={})=>fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...headers},body});
   assert.equal((await raw('{}')).status,401);assert.equal((await raw('{}',{Authorization:'Bearer '+token,Origin:'https://untrusted.example'})).status,403);
   const hostStatus=await new Promise((resolve,reject)=>{const r=http.request(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,Host:'untrusted.example'}},res=>{res.resume();resolve(res.statusCode);});r.on('error',reject);r.end('{}');});assert.equal(hostStatus,403);
   assert.equal((await raw('not json',{Authorization:'Bearer '+token})).status,400);
   assert.equal((await raw('x'.repeat(2*1024*1024+1),{Authorization:'Bearer '+token})).status,413);
   await client.connect(transport);assert.equal((await client.listTools()).tools.length,7);const state=await call(client,'kernel_status');
   const args={command:{op:'gm_resolve_damage',target:'hero',amount:2,damageType:'force'},expectedRevision:state.revision,reason:'Simultaneous requests'};
   const responses=await Promise.all([client.callTool({name:'kernel_gm',arguments:{...args,requestId:'parallel_a'}}),client.callTool({name:'kernel_gm',arguments:{...args,requestId:'parallel_b'}})]);
   assert.equal(responses.filter(r=>r.isError).length,1);assert.equal(responses.find(r=>r.isError).structuredContent.error.code,'STALE_REVISION');assert.equal((await call(client,'kernel_status')).creatures.find(c=>c.id==='hero').hp,38);
   const bad=await client.callTool({name:'kernel_action',arguments:{command:{op:'admin_attack',actor:'hero',target:'warden'},expectedRevision:adapter.revision,requestId:'bypass'}});assert(bad.isError);assert.equal(adapter.sequence,1);
  }finally{await client.close();await new Promise(resolve=>server.close(resolve));}
 });
 await test('non-loopback or configured external hosts cannot start without private authentication',async()=>{
  await assert.rejects(()=>startHttp(new AIAdapter(),{host:'0.0.0.0',port:0}),/API_TOKEN/);
  await assert.rejects(()=>startHttp(new AIAdapter(),{port:0,allowedHosts:['game.example']}),/API_TOKEN/);
 });
 console.log(`${count} transport groups passed`);
}finally{fs.rmSync(dir,{recursive:true,force:true});}
