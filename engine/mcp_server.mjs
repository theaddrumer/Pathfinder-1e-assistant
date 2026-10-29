#!/usr/bin/env node
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {homedir} from 'node:os';
import {timingSafeEqual} from 'node:crypto';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {AIAdapter} from './ai_adapter.mjs';
import {openSessionStore} from './session_store.mjs';
import {createMcpServer} from './mcp_tools.mjs';
import {handleArtworkEditor} from './artwork_editor_server.mjs';
import {startPlayerHttp} from './player_server.mjs';
import {ARTWORK_REQUEST_BYTES} from './map_artwork.mjs';
const MAX_BODY=ARTWORK_REQUEST_BYTES;
export async function startHttp(adapter,{host='127.0.0.1',port=8787,token='',allowedHosts=[],allowedOrigins=[]}={}){
 const local=['127.0.0.1','localhost','::1'].includes(host);
 if((!local||allowedHosts.length)&&token.length<24)throw Error('Non-loopback HTTP binding or proxy hosts require TABLETOP_API_TOKEN with at least 24 characters');
 if(token&&token.length<24)throw Error('TABLETOP_API_TOKEN must contain at least 24 characters');
 const server=http.createServer(async(req,res)=>{
  const reject=(status,message)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify({error:message}));};
  const address=server.address(),localHosts=[`127.0.0.1:${address.port}`,`localhost:${address.port}`,`[::1]:${address.port}`];
  if(![...localHosts,...allowedHosts].includes(req.headers.host))return reject(403,'Host not allowed');
  if(!req.url.startsWith('/artwork')&&req.headers.origin&&!allowedOrigins.includes(req.headers.origin))return reject(403,'Origin not allowed');
  if(token){const got=Buffer.from(req.headers.authorization||''),want=Buffer.from('Bearer '+token);if(got.length!==want.length||!timingSafeEqual(got,want))return reject(401,'Authentication required');}
  if(await handleArtworkEditor(adapter,req,res,{localHosts}))return;
  if(req.url!=='/mcp')return reject(404,'Use /mcp');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return reject(405,'This stateless endpoint accepts POST; no event stream is needed');}
  let bytes=0,chunks=[];
  try{for await(const chunk of req){bytes+=chunk.length;if(bytes>MAX_BODY){reject(413,'Request exceeds 23 MiB');return;}chunks.push(chunk);}}
  catch{return;}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return reject(bytes>2*1024*1024?413:400,bytes>2*1024*1024?'Ordinary request exceeds 2 MiB':'Invalid JSON');}
  const artwork=body?.method==='tools/call'&&body?.params?.name==='kernel_gm'&&body?.params?.arguments?.command?.op==='gm_set_map_artwork';
  if(bytes>2*1024*1024&&!artwork)return reject(413,'Ordinary request exceeds 2 MiB');
  const mcp=createMcpServer(adapter),transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  res.on('close',()=>{transport.close().catch(()=>{});mcp.close().catch(()=>{});});
  try{await mcp.connect(transport);await transport.handleRequest(req,res,body);}catch{if(!res.headersSent)reject(500,'MCP request failed');else res.end();}
 });
 server.requestTimeout=30000;server.headersTimeout=10000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});return server;
}
export async function main(argv=process.argv.slice(2)){
 const args=new Set(argv);if([...args].some(x=>!['--http','--demo','--help'].includes(x)))throw Error('Options: --http, --demo, --help; configuration uses TABLETOP_* environment variables');
 if(args.has('--help')){console.log('Tabletop Kernel MCP: node mcp_server.mjs [--http] [--demo]\nDefault: stdio, empty encounter, autosaved private session. TABLETOP_STATE_PATH overrides the file; HTTP uses TABLETOP_HOST, TABLETOP_PORT, TABLETOP_API_TOKEN, TABLETOP_ALLOWED_HOSTS and TABLETOP_ALLOWED_ORIGINS. TABLETOP_PLAYER_PORT sets the separate loopback player listener (default 8788); TABLETOP_PLAYER_VIEW=off disables it. See INTEGRATION_V3_37.md and PLAYER_VIEW_V3_43.md.');return;}
 const filename=process.env.TABLETOP_STATE_PATH||path.join(homedir(),'.tabletop-kernel','encounter.json');
 const store=openSessionStore(filename);let adapter;
 try{adapter=new AIAdapter({saved:store.saved,persist:store.save,demo:args.has('--demo')});if(!store.saved)store.save(adapter.snapshot());}catch(e){store.close();throw e;}
 let connection,playerServer;const close=async()=>{try{if(playerServer)await new Promise(resolve=>playerServer.close(resolve));if(connection)await connection.close();}finally{store.close();}};
 process.once('exit',()=>store.close());for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{close().finally(()=>process.exit(0));});
 try{
  if(args.has('--http')){
   const port=Number(process.env.TABLETOP_PORT||8787);if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid TABLETOP_PORT');
   const server=await startHttp(adapter,{host:process.env.TABLETOP_HOST||'127.0.0.1',port,token:process.env.TABLETOP_API_TOKEN||'',allowedHosts:(process.env.TABLETOP_ALLOWED_HOSTS||'').split(',').filter(Boolean),allowedOrigins:(process.env.TABLETOP_ALLOWED_ORIGINS||'').split(',').filter(Boolean)});
   connection={close:()=>new Promise(resolve=>server.close(resolve))};
   if(process.env.TABLETOP_PLAYER_VIEW!=='off'){
    const playerPort=Number(process.env.TABLETOP_PLAYER_PORT||8788);playerServer=await startPlayerHttp(adapter,{port:playerPort});
    console.error(`Player map: http://127.0.0.1:${playerServer.address().port}/player (read-only, local computer)`);
   }
   console.error(`GM artwork editor: http://127.0.0.1:${server.address().port}/artwork (local GM only)`);
   console.error(`Tabletop Kernel listening on port ${server.address().port}; /mcp; encounter persistence enabled.`);
  }else{connection=createMcpServer(adapter);await connection.connect(new StdioServerTransport());process.stdin.once('end',()=>{close().finally(()=>process.exit(0));});}
 }catch(e){await close();throw e;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
