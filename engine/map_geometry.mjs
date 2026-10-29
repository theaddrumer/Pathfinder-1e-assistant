/** Pure shared 2-D geometry. Scene owns feature data; no timers or stored caches. */
export const MAP_DIRECTIONS=Object.freeze({N:[0,-1],NE:[1,-1],E:[1,0],SE:[1,1],S:[0,1],SW:[-1,1],W:[-1,0],NW:[-1,-1]});
export const MAP_COVER_RANK=Object.freeze({none:0,partial:1,soft:2,cover:2,improved:3,total:4});
export const MAP_PRESETS=Object.freeze({
 open:{movement:'allow',sight:'allow',effect:'allow',cover:'none'},
 wall:{movement:'block',sight:'block',effect:'block',cover:'cover'},
 force_wall:{movement:'block',sight:'allow',effect:'block',cover:'cover',material:'force'},
 bars:{movement:'block',sight:'allow',effect:'adjudicate',cover:'cover'},
 slit:{movement:'block',sight:'allow',effect:'adjudicate',cover:'improved'},
 debris:{movement:'allow',sight:'allow',effect:'allow',cover:'partial',cost:2},
 difficult:{movement:'allow',sight:'allow',effect:'allow',cover:'none',cost:2},
 stairs:{movement:'allow',sight:'allow',effect:'allow',cover:'none'},
 screen:{movement:'allow',sight:'block',effect:'allow',cover:'none'},
 door:{movement:'block',sight:'block',effect:'block',cover:'cover'}
});
const mapEps=1e-9;
const mapCross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export function mapDirection(a,b){return Object.keys(MAP_DIRECTIONS).find(k=>{const [x,y]=MAP_DIRECTIONS[k];return x===Math.sign(b.x-a.x)&&y===Math.sign(b.y-a.y);})||null;}
export function rayIntersectsTile(a,b,x,y){
 let lo=0,hi=1;
 for(const [start,d,min,max] of [[a.x,b.x-a.x,x,x+1],[a.y,b.y-a.y,y,y+1]]){
  if(Math.abs(d)<mapEps){if(start<min||start>max)return false;continue;}
  const u=(min-start)/d,v=(max-start)/d;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));if(lo>hi)return false;
 }
 return true;
}
export function mapSegmentsIntersect(a,b,c,d){
 if(Math.max(a.x,b.x)<Math.min(c.x,d.x)-mapEps||Math.max(c.x,d.x)<Math.min(a.x,b.x)-mapEps||Math.max(a.y,b.y)<Math.min(c.y,d.y)-mapEps||Math.max(c.y,d.y)<Math.min(a.y,b.y)-mapEps)return false;
 const p=mapCross(a,b,c),q=mapCross(a,b,d),r=mapCross(c,d,a),s=mapCross(c,d,b);
 return p*q<=mapEps&&r*s<=mapEps;
}
export function mapFeatureActive(state,f){
 if(f.doorState==='open')return false;
 if(f.objectId){const c=state.creatures.find(c=>c.id===f.objectId);if(c?.objectProfile&&c.hp<=0)return false;}
 return true;
}
export function mapFeatureHitsRay(f,a,b){return f.cells?f.cells.some(p=>rayIntersectsTile(a,b,p.x,p.y)):f.points.slice(1).some((p,i)=>mapSegmentsIntersect(a,b,f.points[i],p));}
export function mapRayFeatures(state,a,b){return (state.scene?.features||[]).filter(f=>mapFeatureActive(state,f)&&mapFeatureHitsRay(f,a,b));}
export function mapRayObstacles(state,a,b,{ignoreObject=null}={}){
 const out=[];
 for(const [key,kind] of Object.entries(state.tiles||{}))if(['wall','force_wall'].includes(kind)){
  const [x,y]=key.split(',').map(Number);if(rayIntersectsTile(a,b,x,y))out.push({x,y,kind});
 }
 for(const f of mapRayFeatures(state,a,b))if(f.objectId!==ignoreObject&&f.properties.effect!=='allow')out.push({featureId:f.id,kind:f.properties.material==='force'?'force_wall':'wall',requiresRuling:f.properties.effect==='adjudicate'});
 return out;
}
export const mapClearRay=(state,a,b)=>mapRayObstacles(state,a,b).length===0;
export function mapRayCover(state,a,b,ignoreObject=null){
 let cover=mapRayObstacles(state,a,b,{ignoreObject}).some(o=>!o.featureId)?'cover':'none';
 for(const f of mapRayFeatures(state,a,b))if(f.objectId!==ignoreObject&&MAP_COVER_RANK[f.properties.cover]>MAP_COVER_RANK[cover])cover=f.properties.cover;
 return cover;
}
export function mapCellSolid(state,x,y){return ['wall','force_wall'].includes(state.tiles?.[`${x},${y}`])||(state.scene?.features||[]).some(f=>f.cells&&mapFeatureActive(state,f)&&f.properties.effect!=='allow'&&f.cells.some(p=>p.x===x&&p.y===y));}
function mapHull(points){
 const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y),half=rows=>{const h=[];for(const p of rows){while(h.length>1&&mapCross(h.at(-2),h.at(-1),p)<=0)h.pop();h.push(p);}return h;};
 const low=half(sorted),high=half([...sorted].reverse());return [...low.slice(0,-1),...high.slice(0,-1)];
}
export function mapSweptHull(from,to,size=1){return mapHull([from,to].flatMap(p=>[{x:p.x,y:p.y},{x:p.x+size,y:p.y},{x:p.x+size,y:p.y+size},{x:p.x,y:p.y+size}]));}
function mapSegmentInHull(a,b,h){
 let lo=0,hi=1;
 for(let i=0;i<h.length;i++){
  const p=h[i],q=h[(i+1)%h.length],v=mapCross(p,q,a),slope=mapCross(p,q,b)-v;
  if(Math.abs(slope)<mapEps){if(v<=mapEps)return false;continue;}
  const t=(mapEps-v)/slope;if(slope>0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>=hi)return false;
 }
 return true;
}
export function mapFeatureHitsHull(f,h){
 if(f.points)return f.points.slice(1).some((b,i)=>mapSegmentInHull(f.points[i],b,h));
 return f.cells.some(p=>{
  const r=mapSweptHull(p,p),axes=[{x:1,y:0},{x:0,y:1},...h.map((v,i)=>({x:-(h[(i+1)%h.length].y-v.y),y:h[(i+1)%h.length].x-v.x}))];
  return axes.every(a=>{const one=h.map(v=>v.x*a.x+v.y*a.y),two=r.map(v=>v.x*a.x+v.y*a.y);return Math.min(Math.max(...one),Math.max(...two))-Math.max(Math.min(...one),Math.min(...two))>mapEps;});
 });
}
// Authored rise across one boundary, measured with the footprint center. The
// boundary itself belongs to its upper side, so reversing retraces exactly.
export function mapElevationDelta(f,from,to,size=1){
 if(!f.elevationTransition)return 0;
 const [dx,dy]=MAP_DIRECTIONS[f.elevationTransition.up],a=f.points[0];
 const center=p=>({x:p.x+size/2,y:p.y+size/2}),p=center(from),q=center(to);
 const side=v=>(v.x-a.x)*dx+(v.y-a.y)*dy>=-mapEps?1:0;
 if(side(p)===side(q)||!mapSegmentsIntersect(p,q,...f.points))return 0;
 return (side(q)-side(p))*f.elevationTransition.riseFeet;
}
