/** Local GM artwork editor on the private MCP listener, never the player listener. */
import fs from 'node:fs';
import {artworkSummary,ARTWORK_REQUEST_BYTES} from './map_artwork.mjs';
const assets=new Map([
 ['/artwork',['text/html; charset=utf-8','artwork_editor.html']],
 ['/artwork.js',['text/javascript; charset=utf-8','artwork_editor.js']],
 ['/artwork-model.js',['text/javascript; charset=utf-8','map_artwork.mjs']],
 ['/artwork.css',['text/css; charset=utf-8','artwork_editor.css']]
].map(([url,[type,file]])=>[url,[type,fs.readFileSync(new URL(file,import.meta.url))]]));
export async function handleArtworkEditor(adapter,req,res,{localHosts}){
 if(!req.url.startsWith('/artwork'))return false;
 const send=(status,data,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type});res.end(req.method==='HEAD'?undefined:typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data));};
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
 if(!localHosts.includes(req.headers.host)||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){send(403,{error:'Local, same-origin editor only'});return true;}
 if(['GET','HEAD'].includes(req.method)){
  const asset=assets.get(req.url);
  if(asset)send(200,asset[1],asset[0]);
  else if(req.url==='/artwork/state'){
   const s=adapter.game.s;
   send(200,{revision:adapter.revision,width:s.width,height:s.height,name:s.scene.name,artwork:s.scene.artwork??null,summary:artworkSummary(s)});
  }else send(404,{error:'Not found'});
  return true;
 }
 if(req.url!=='/artwork/apply'||req.method!=='POST'){send(405,{error:'Unsupported editor operation'});return true;}
 if(req.headers.origin!==`http://${req.headers.host}`||req.headers['x-tabletop-editor']!=='1'||req.headers['content-type']!=='application/json'){send(403,{error:'Use the local Map artwork page'});return true;}
 let bytes=0,chunks=[];
 try{
  for await(const chunk of req){bytes+=chunk.length;if(bytes>ARTWORK_REQUEST_BYTES){send(413,{error:'Image upload exceeds 23 MiB'});return true;}chunks.push(chunk);}
  const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(body?.command?.op!=='gm_set_map_artwork')throw Error('Editor accepts map artwork changes only');
  const result=adapter.execute('gm',body);
  send(200,{ok:true,revision:result.revision,artwork:artworkSummary(adapter.game.s)});
 }catch(error){send(error.code==='STALE_REVISION'?409:400,{error:error.message,code:error.code??'REJECTED'});}
 return true;
}
