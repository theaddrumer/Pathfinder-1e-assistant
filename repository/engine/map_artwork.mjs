/** Portable presentation contract. Image bytes stay private; no mechanical effects. */
export const ARTWORK_MAX_BYTES=16*1024*1024;
export const ARTWORK_MAX_SIDE=8192;
export const ARTWORK_MAX_PIXELS=16*1024*1024;
// Base64 plus JSON, placement and redactions. Shared by local editor and MCP.
export const ARTWORK_REQUEST_BYTES=23*1024*1024;
const artObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const artKeys=(v,keys)=>artObject(v)&&Object.keys(v).every(k=>keys.includes(k));
const artCheck=(ok,message)=>{if(!ok)throw Error(message);};
const artNumber=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
export function artworkHeader(png){
 artCheck(typeof png==='string'&&png.length>40&&png.length<=Math.ceil(ARTWORK_MAX_BYTES/3)*4&&png.length%4===0&&/^[A-Za-z0-9+/]+={0,2}$/.test(png),'Artwork needs base64 PNG, at most 16 MiB; use the local Map artwork editor to import an image');
 const b=atob(png.slice(0,44));
 artCheck(b.slice(0,8)==='\x89PNG\r\n\x1a\n'&&b.slice(12,16)==='IHDR','Artwork must be a PNG image');
 const n=i=>((b.charCodeAt(i)*16777216)+(b.charCodeAt(i+1)<<16)+(b.charCodeAt(i+2)<<8)+b.charCodeAt(i+3));
 const width=n(16),height=n(20);
 artCheck(width>=1&&height>=1&&width<=ARTWORK_MAX_SIDE&&height<=ARTWORK_MAX_SIDE&&width*height<=ARTWORK_MAX_PIXELS,'Artwork exceeds 8192 pixels per side or 16 megapixels');
 artCheck(b.charCodeAt(24)===8&&[2,6].includes(b.charCodeAt(25))&&b.charCodeAt(28)===0,'Import an 8-bit non-interlaced RGB/RGBA PNG through Map artwork');
 return {width,height};
}
export function validateArtwork(art){
 artCheck(artKeys(art,['png','placement','redactions']),'Unknown artwork field');
 const size=artworkHeader(art.png),p=art.placement;
 artCheck(artKeys(p,['x','y','width','height','rotation'])&&artNumber(p.x,-512,512)&&artNumber(p.y,-512,512)&&artNumber(p.width,.01,1024)&&artNumber(p.height,.01,1024)&&artNumber(p.rotation,-180,180),'Artwork placement needs x/y, positive width/height in grid squares, and rotation -180 to 180');
 artCheck(Array.isArray(art.redactions)&&art.redactions.length<=100,'Artwork permits at most 100 redaction rectangles');
 for(const r of art.redactions)artCheck(artKeys(r,['x','y','width','height','color'])&&[r.x,r.y,r.width,r.height].every(Number.isInteger)&&r.x>=0&&r.y>=0&&r.width>0&&r.height>0&&r.x+r.width<=size.width&&r.y+r.height<=size.height&&/^#[0-9a-f]{6}$/i.test(r.color),'Redactions need in-bounds source-pixel rectangles and #RRGGBB color');
 return size;
}
export function artworkSummary(state){
 const a=state.scene?.artwork;
 return a?{configured:true,...artworkHeader(a.png),placement:{...a.placement},redactions:a.redactions.map(r=>({...r})),encodedBytes:a.png.length}:{configured:false};
}
export function setMapArtwork(game,cmd){
 artCheck(artKeys(cmd,['op','image','placement','calibration','redactions','reason']),'Unknown map artwork command field');game.sceneReason(cmd.reason);
 if(cmd.image===null){
  artCheck(cmd.placement===undefined&&cmd.calibration===undefined&&cmd.redactions===undefined,'Clearing artwork cannot also set alignment or redactions');delete game.s.scene.artwork;
 }else{
  const old=game.s.scene.artwork;
  artCheck(cmd.image!==undefined||cmd.placement!==undefined||cmd.calibration!==undefined||cmd.redactions!==undefined,'Supply image, placement, calibration or redactions');
  artCheck(cmd.image===undefined||typeof cmd.image==='string','image must be base64 PNG or null to clear');
  artCheck(cmd.placement===undefined||cmd.calibration===undefined,'Use placement OR calibration, not both');
  const replacement=cmd.image!==undefined;
  const next={png:replacement?cmd.image:old?.png,
   placement:cmd.placement??old?.placement??{x:0,y:0,width:game.s.width,height:game.s.height,rotation:0},
   redactions:cmd.redactions??(replacement?[]:old?.redactions??[])};
  if(cmd.calibration!==undefined)next.placement=calibrateArtwork(artworkHeader(next.png),cmd.calibration);
  validateArtwork(next);game.s.scene.artwork=JSON.parse(JSON.stringify(next));
 }
 game.note(`GM changes map artwork: ${cmd.reason}`);
 return {...artworkSummary(game.s),mechanicsChanged:false};
}

/** Two corresponding intersections determine uniform scale, rotation and offset.
 * Source coordinates are pixels; grid coordinates are intersections, not cell centers.
 * Returns the existing placement contract, with no second geometry state.
 */
export function calibrateArtwork(size,calibration){
 artCheck(artKeys(calibration,['points'])&&Array.isArray(calibration.points)&&calibration.points.length===2,'Calibration needs exactly two points with source and grid x/y');
 const points=calibration.points;
 for(const point of points){
  artCheck(artKeys(point,['source','grid'])&&artKeys(point.source,['x','y'])&&artKeys(point.grid,['x','y']),'Calibration points need source and grid x/y');
  artCheck(artNumber(point.source.x,0,size.width)&&artNumber(point.source.y,0,size.height)&&artNumber(point.grid.x,-512,512)&&artNumber(point.grid.y,-512,512),'Calibration coordinates are outside supported image/grid bounds');
 }
 const [a,b]=points,dx=b.source.x-a.source.x,dy=b.source.y-a.source.y,gx=b.grid.x-a.grid.x,gy=b.grid.y-a.grid.y;
 artCheck(Math.hypot(dx,dy)>=1&&Math.hypot(gx,gy)>=.01,'Calibration points must be distinct; use intersections several printed squares apart');
 const scale=Math.hypot(gx,gy)/Math.hypot(dx,dy),angle=Math.atan2(gy,gx)-Math.atan2(dy,dx),cos=Math.cos(angle),sin=Math.sin(angle);
 const p={x:a.grid.x-scale*(cos*a.source.x-sin*a.source.y),y:a.grid.y-scale*(sin*a.source.x+cos*a.source.y),width:size.width*scale,height:size.height*scale,rotation:((angle*180/Math.PI+540)%360)-180};
 artCheck(artNumber(p.x,-512,512)&&artNumber(p.y,-512,512)&&artNumber(p.width,.01,1024)&&artNumber(p.height,.01,1024),'Calibration produces an unsupported placement; check pixel positions and grid spacing');
 return p;
}
