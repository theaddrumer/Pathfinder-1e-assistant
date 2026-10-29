import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';

const root=path.resolve(process.argv[2]);
const {Client}=await import(pathToFileURL(path.join(root,'node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js')));
const {StdioClientTransport}=await import(pathToFileURL(path.join(root,'node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js')));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pf-github-desktop-'));
const file=path.join(dir,'encounter.json');
const connect=async()=>{
 const transport=new StdioClientTransport({command:process.execPath,args:[path.join(root,'desktop_server.mjs')],cwd:root,env:{...process.env,TABLETOP_DESKTOP_STATE_PATH:file},stderr:'pipe'});
 let stderr='';transport.stderr.on('data',b=>stderr+=b.toString());
 const client=new Client({name:'github-package-check',version:'1.0.0'});
 try{await client.connect(transport);}catch(e){await transport.close();throw Error(e.message+'\n'+stderr);}
 return client;
};
const call=async(c,name,args={})=>{const r=await c.callTool({name,arguments:args});assert(!r.isError,JSON.stringify(r));return r.structuredContent;};
let client;
try{
 client=await connect();assert.equal((await client.listTools()).tools.length,7);
 const state=await call(client,'kernel_status');assert.equal(state.creatures.length,0);
 const urls=state.desktopViews;assert(urls?.playerMapUrl&&urls.mapArtworkUrl&&urls.controlPanelUrl);
 for(const u of Object.values(urls)){assert.equal(new URL(u).hostname,'127.0.0.1');assert.equal((await fetch(u)).status,200);}
 assert.equal((await fetch(urls.controlPanelUrl,{headers:{Origin:'https://untrusted.example'}})).status,403);
 assert.equal((await fetch(new URL('/mcp',urls.controlPanelUrl))).status,404);
 assert((await call(client,'kernel_reference',{topic:'setup'})));
 const args={command:{op:'gm_roll',kind:'plain',count:2,sides:6},expectedRevision:state.revision,requestId:'github-plain-roll',reason:'Disposable packaging check'};
 const roll=await call(client,'kernel_gm',args);
 await client.close();client=null;
 for(const u of Object.values(urls))await assert.rejects(()=>fetch(u));
 assert(fs.existsSync(file));client=await connect();
 assert.equal((await call(client,'kernel_status')).revision,roll.revision);
 assert((await call(client,'kernel_gm',args)).replayed);
 console.log('PASS desktop SDK discovery, empty save, player/editor pages, access guards, plain roll, shutdown, persistence and retry');
}finally{await client?.close();fs.rmSync(dir,{recursive:true,force:true});}
