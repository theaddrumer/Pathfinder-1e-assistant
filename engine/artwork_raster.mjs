/** Server-only PNG decoding and fog masking. Never serve the source image to players. */
import {PNG} from 'pngjs';
import {createHash} from 'node:crypto';
import {artworkHeader,ARTWORK_MAX_BYTES,validateArtwork} from './map_artwork.mjs';
import {playerProjection} from './player_view.mjs';
export function decodeArtwork(png){
 const size=artworkHeader(png),buffer=Buffer.from(png,'base64');
 if(buffer.length>ARTWORK_MAX_BYTES||buffer.toString('base64')!==png)throw Error('Invalid artwork encoding');
 const image=PNG.sync.read(buffer,{checkCRC:true});
 if(image.width!==size.width||image.height!==size.height)throw Error('Invalid artwork dimensions');
 return image;
}
export function normalizeArtwork(png){
 const image=decodeArtwork(png);
 // Re-encode pixels only: discard source metadata, profiles, comments and trailing data.
 const out=PNG.sync.write({width:image.width,height:image.height,data:image.data},{colorType:6});
 if(out.length>ARTWORK_MAX_BYTES)throw Error('Normalized artwork exceeds 16 MiB; choose a smaller source or explicitly resize it');
 return out.toString('base64');
}
/** Mask at source resolution, independent of mechanical map dimensions.
 * A pixel survives only if its entire transformed footprint lies in revealed cells.
 * Rotated bounding rectangles are conservative: a boundary may lose a thin edge of source
 * pixels, but hidden RGB and partially hidden pixels cannot cross the boundary.
 */
export function createArtworkRenderer(){
 let key=null,cached=null,source=null,decoded=null;
 return state=>{
  const projection=playerProjection(state),a=state.scene?.artwork;
  if(!a||!projection.cells.length){key=null;cached=null;source=null;decoded=null;return {projection,png:null};}
  validateArtwork(a);
  const next=JSON.stringify([state.width,state.height,a.placement,a.redactions,state.scene.playerView.revealed]);
  if(source!==a.png||key!==next){
   const input=source!==a.png?decodeArtwork(a.png):decoded;
   const width=input.width,height=input.height,data=Buffer.alloc(width*height*4);
   const p=a.placement,angle=p.rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
   const pixels=a.redactions.length?Buffer.from(input.data):input.data;
   for(const r of a.redactions){
    const rgba=Buffer.from([...([1,3,5].map(i=>parseInt(r.color.slice(i,i+2),16))),255]);
    const row=Buffer.alloc(r.width*4).fill(rgba);
    for(let y=r.y;y<r.y+r.height;y++)row.copy(pixels,(y*input.width+r.x)*4);
   }
   // Summed-area table: four lookups even if one pixel spans many grid cells.
   const stride=state.width+1,visible=new Uint8Array(state.width*state.height),prefix=new Uint32Array(stride*(state.height+1));
   for(const c of projection.cells)visible[c.y*state.width+c.x]=1;
   for(let y=0;y<state.height;y++)for(let x=0,row=0;x<state.width;x++){
    row+=visible[y*state.width+x];prefix[(y+1)*stride+x+1]=prefix[y*stride+x+1]+row;
   }
   const ux=cos*p.width/width,uy=sin*p.width/width,vx=-sin*p.height/height,vy=cos*p.height/height;
   const minX=Math.min(0,ux,vx,ux+vx),maxX=Math.max(0,ux,vx,ux+vx),minY=Math.min(0,uy,vy,uy+vy),maxY=Math.max(0,uy,vy,uy+vy),eps=1e-9;
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;if(!pixels[i+3])continue;
    const ox=p.x+x*ux+y*vx,oy=p.y+x*uy+y*vy;
    const left=Math.floor(ox+minX+eps),top=Math.floor(oy+minY+eps),right=Math.ceil(ox+maxX-eps),bottom=Math.ceil(oy+maxY-eps);
    if(left<0||top<0||right>state.width||bottom>state.height||right<=left||bottom<=top)continue;
    const count=prefix[bottom*stride+right]-prefix[top*stride+right]-prefix[bottom*stride+left]+prefix[top*stride+left];
    if(count===(right-left)*(bottom-top))pixels.copy(data,i,i,i+4);
   }
   const png=PNG.sync.write({width,height,data},{colorType:6});
   const hash=createHash('sha256').update(png).digest('hex');
   cached={png,descriptor:{url:`/artwork/${hash}.png`,width,height,placement:{...p}}};
   source=a.png;key=next;decoded=input;
  }
  return {projection:{...projection,artwork:cached.descriptor},png:cached.png};
 };
}
