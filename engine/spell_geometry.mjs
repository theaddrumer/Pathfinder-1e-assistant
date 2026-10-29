/** Pathfinder 1e 2-D, 5-foot-square area geometry.
 * Origins are grid INTERSECTIONS, not centers. Shapes/targets are selected by GM.
 * Limits: no automatic elevation/cylinders, three-dimensional spheres, arbitrary
 * angles or corner-perforations. Every returned square is inside the map.
 */
import {MAP_DIRECTIONS,mapCellSolid,mapClearRay,rayIntersectsTile} from './map_geometry.mjs';
export {rayIntersectsTile};
const MAGIC_DIRECTIONS=MAP_DIRECTIONS;
const magicGridInt=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
const magicKey=(x,y)=>`${x},${y}`;
const magicSolid=mapCellSolid;
const magicClearRay=mapClearRay;
// PF 5-10-5 diagonal square counts, measured between grid intersections.
export const spellGridDistance=(x,y)=>Math.max(Math.abs(x),Math.abs(y))+Math.floor(Math.min(Math.abs(x),Math.abs(y))/2);
function magicFarEdgeWithin(x,y,ox,oy,radius){
 const dx=x+.5-ox,dy=y+.5-oy;
 if(Math.abs(dx)>=Math.abs(dy)){
  const far=dx>=0?x+1:x;
  return spellGridDistance(far-ox,y-oy)<=radius&&spellGridDistance(far-ox,y+1-oy)<=radius;
 }
 const far=dy>=0?y+1:y;
 return spellGridDistance(x-ox,far-oy)<=radius&&spellGridDistance(x+1-ox,far-oy)<=radius;
}
export function spellArea(state,area){
 if(!area||typeof area!=='object'||Array.isArray(area))throw Error('Spell area must be an object');
 if(Object.keys(area).some(k=>!['shape','mode','origin','direction','sizeFeet'].includes(k)))throw Error('Unknown spell area property');
 const {shape,mode='burst',origin,sizeFeet,direction}=area;
 if(!['sphere','cone','line'].includes(shape)||!['burst','emanation','spread'].includes(mode))throw Error('Unsupported area shape or mode');
 if((shape==='line'&&mode==='spread')||(shape==='cone'&&mode==='spread'))throw Error('Directional spreads require GM adjudication');
 if(!origin||!magicGridInt(origin.x,0,state.width)||!magicGridInt(origin.y,0,state.height))throw Error('Origin must be a map grid intersection');
 if(!magicGridInt(sizeFeet,5,2000)||sizeFeet%5!==0)throw Error('Area size must be a positive multiple of 5 feet');
 if((shape==='cone'||shape==='line')&&!Object.hasOwn(MAGIC_DIRECTIONS,direction))throw Error('Cone/line needs an eight-way direction');
 const R=sizeFeet/5,[vx,vy]=MAGIC_DIRECTIONS[direction]||[0,0],out=[],seen=new Set();
 const put=(x,y)=>{if(x>=0&&y>=0&&x<state.width&&y<state.height&&!magicSolid(state,x,y)&&!seen.has(magicKey(x,y))){out.push({x,y});seen.add(magicKey(x,y));}};
 if(shape==='line'){
  // Five-foot-wide octant template. Source corner and chosen octant determine
  // which one of the two boundary-adjacent rows/columns is included.
  let x=origin.x+(vx<0?-1:0),y=origin.y+(vy<0?-1:0);
  let previous=origin;
  for(let n=0;spellGridDistance(n*vx,n*vy)<R;n++,x+=vx,y+=vy){
   if(x<0||y<0||x>=state.width||y>=state.height||magicSolid(state,x,y))break;
   const center={x:x+.5,y:y+.5};if(!magicClearRay(state,previous,center))break;
   put(x,y);previous=center;
  }
 }else if(mode==='spread'){
  // Shortest legal paths around opaque solid tiles; 5/10/5 diagonal parity.
  // A path may not cross a blocked orthogonal corner.
  const queue=[],visited=new Map();
  for(let dx of [-1,0])for(let dy of [-1,0]){
   const x=origin.x+dx,y=origin.y+dy;
   if(x<0||y<0||x>=state.width||y>=state.height||magicSolid(state,x,y))continue;
   if(magicClearRay(state,origin,{x:x+.5,y:y+.5}))queue.push({x,y,cost:1,diag:0});
  }
  while(queue.length){
   queue.sort((a,b)=>a.cost-b.cost);
   const p=queue.shift(),key=magicKey(p.x,p.y)+':'+(p.diag%2);
   if(p.cost>R||(visited.has(key)&&visited.get(key)<=p.cost))continue;
   visited.set(key,p.cost);put(p.x,p.y);
   for(const [sx,sy] of Object.values(MAGIC_DIRECTIONS)){
    const x=p.x+sx,y=p.y+sy,diagonal=sx!==0&&sy!==0;
    if(x<0||y<0||x>=state.width||y>=state.height||magicSolid(state,x,y))continue;
    if(diagonal&&(magicSolid(state,p.x+sx,p.y)||magicSolid(state,p.x,p.y+sy)))continue;
    if(!magicClearRay(state,{x:p.x+.5,y:p.y+.5},{x:x+.5,y:y+.5}))continue;
    const diag=p.diag+(diagonal?1:0),cost=p.cost+(diagonal?(p.diag%2?2:1):1);
    if(cost<=R)queue.push({x,y,cost,diag});
   }
  }
 }else{
  for(let x=0;x<state.width;x++)for(let y=0;y<state.height;y++){
   if(magicSolid(state,x,y)||!magicFarEdgeWithin(x,y,origin.x,origin.y,R))continue;
   if(shape==='cone'){
    const dx=x+.5-origin.x,dy=y+.5-origin.y;
    const dot=dx*vx+dy*vy,cross=dx*vy-dy*vx;
    if(dot<=0||Math.abs(cross)>dot+1e-9)continue; // 90-degree quarter circle.
   }
   if(magicClearRay(state,origin,{x:x+.5,y:y+.5}))put(x,y);
  }
 }
 out.sort((a,b)=>a.y-b.y||a.x-b.x);
 const affected=state.creatures.filter(c=>(c.objectProfile?c.hp>0:c.vitality?!c.vitality.dead:c.hp>0)&&Array.from({length:c.size||1},(_,i)=>i).some(dx=>Array.from({length:c.size||1},(_,i)=>i).some(dy=>seen.has(magicKey(c.x+dx,c.y+dy))))).map(c=>c.id);
 return {area:{shape,mode,origin:{...origin},direction:direction||null,sizeFeet},cells:out,affected};
}
