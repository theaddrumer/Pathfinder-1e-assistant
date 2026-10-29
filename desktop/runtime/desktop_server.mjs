#!/usr/bin/env node
/** Desktop stdio entry: one adapter, one save writer, two local-only views. */
import http from 'node:http';
import path from 'node:path';
import {homedir} from 'node:os';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {AIAdapter} from './ai_adapter.mjs';
import {openSessionStore} from './session_store.mjs';
import {createMcpServer} from './mcp_tools.mjs';
import {handleArtworkEditor} from './artwork_editor_server.mjs';
import {startPlayerHttp} from './player_server.mjs';

const file=process.env.TABLETOP_DESKTOP_STATE_PATH||path.join(homedir(),'.pathfinder-assistant-desktop','encounter.json');
const store=openSessionStore(file);
let adapter,player,editor,mcp,closing;
const close=()=>closing??=(async()=>{
 await Promise.allSettled([mcp?.close(),...[editor,player].filter(Boolean).map(s=>new Promise(r=>{s.close(r);s.closeIdleConnections();}))]);
 store.close();
})();
process.once('exit',()=>store.close());
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{close().finally(()=>process.exit(0));});
try{
 adapter=new AIAdapter({saved:store.saved,persist:store.save});
 if(!store.saved)store.save(adapter.snapshot());
 player=await startPlayerHttp(adapter,{port:0});
 const playerMapUrl=`http://127.0.0.1:${player.address().port}/player`;
 editor=http.createServer(async(req,res)=>{
  const host=`127.0.0.1:${editor.address().port}`;
  if(req.headers.host!==host||!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||req.headers.origin&&req.headers.origin!==`http://${host}`){res.writeHead(403);return res.end('Local access only');}
  try{
   if(await handleArtworkEditor(adapter,req,res,{localHosts:[host]}))return;
   if(req.url==='/'&&['GET','HEAD'].includes(req.method)){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"});
    return res.end(req.method==='HEAD'?undefined:`<!doctype html><html lang="en"><meta charset="utf-8"><title>Pathfinder Assistant — Map controls</title><h1>Pathfinder Assistant</h1><p><a href="${playerMapUrl}">Open player map</a></p><p><a href="/artwork">Open GM map artwork and alignment controls</a></p><p>The artwork editor is for the GM. It can show unrevealed areas. Keep it separate from a player-facing display.</p></html>`);
   }
   res.writeHead(404);res.end('Not found');
  }catch{if(!res.headersSent)res.writeHead(500);res.end('Local view request failed');}
 });
 editor.requestTimeout=30000;editor.headersTimeout=10000;
 await new Promise((resolve,reject)=>{editor.once('error',reject);editor.listen(0,'127.0.0.1',resolve);});
 const controlPanelUrl=`http://127.0.0.1:${editor.address().port}/`;
 const desktopViews={playerMapUrl,mapArtworkUrl:controlPanelUrl+'artwork',controlPanelUrl};
 mcp=createMcpServer(adapter,{desktopViews});
 await mcp.connect(new StdioServerTransport());
 console.error('Pathfinder desktop map controls: '+controlPanelUrl);
 process.stdin.once('end',()=>{close().finally(()=>process.exit(0));});
}catch(error){console.error(error.message);await close();process.exitCode=1;}
