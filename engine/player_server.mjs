/** Separate loopback-only, read-only listener. Never mounts MCP or GM files. */
import http from 'node:http';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createArtworkRenderer} from './artwork_raster.mjs';
export async function startPlayerHttp(adapter,{host='127.0.0.1',port=8788}={}){
 if(!['127.0.0.1','localhost','::1'].includes(host))throw Error('Player viewer currently supports loopback hosting only');
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid player port');
 const assets=new Map([
  ['/player',['text/html; charset=utf-8',fs.readFileSync(new URL('./player.html',import.meta.url))]],
  ['/player.js',['text/javascript; charset=utf-8',fs.readFileSync(new URL('./player.js',import.meta.url))]],
  ['/player.css',['text/css; charset=utf-8',fs.readFileSync(new URL('./player.css',import.meta.url))]]
 ]);
 let revision=null,state=null,body=null,etag=null,artwork=null,artworkUrl=null;
 const render=createArtworkRenderer();
 const refresh=()=>{
  if(revision!==adapter.revision||state!==adapter.game.s){
   const rendered=render(adapter.game.s);body=JSON.stringify(rendered.projection);artwork=rendered.png;artworkUrl=rendered.projection.artwork?.url;
   etag='\"'+createHash('sha256').update(body).digest('hex')+'\"';revision=adapter.revision;state=adapter.game.s;
  }
 };
 const server=http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  const reply=(status,text)=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8'});res.end(req.method==='HEAD'?undefined:text);};
  const address=server.address(),hosts=[`127.0.0.1:${address.port}`,`localhost:${address.port}`,`[::1]:${address.port}`];
  if(!hosts.includes(req.headers.host))return reply(403,'Host not allowed');
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return reply(403,'Origin not allowed');
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return reply(405,'Read-only viewer');}
  if(req.url==='/'){res.writeHead(302,{Location:'/player'});return res.end();}
  if(req.url==='/state'){
   try{
    refresh();
    // Public content hash only: hidden movements/GM actions do not advance it.
    res.setHeader('ETag',etag);
    if(req.headers['if-none-match']===etag){res.writeHead(304);return res.end();}
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(req.method==='HEAD'?undefined:body);
   }catch{return reply(503,'Map temporarily unavailable');}
   return;
  }
  if(/^\/artwork\/[a-f0-9]{64}\.png$/.test(req.url)){
   try{refresh();if(!artwork||req.url!==artworkUrl)return reply(404,'Not found');
    res.writeHead(200,{'Content-Type':'image/png'});res.end(req.method==='HEAD'?undefined:artwork);
   }catch{return reply(503,'Map temporarily unavailable');}return;
  }
  const asset=assets.get(req.url);
  if(!asset)return reply(404,'Not found');
  res.writeHead(200,{'Content-Type':asset[0]});res.end(req.method==='HEAD'?undefined:asset[1]);
 });
 server.requestTimeout=10000;server.headersTimeout=10000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
 return server;
}
