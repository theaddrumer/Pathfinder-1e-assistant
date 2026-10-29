/** Player presentation only. Never return engine records or infer perception. */
import {mapFeatureActive} from './map_geometry.mjs';
export const PLAYER_STYLES=Object.freeze(['marker','wall','door','water','terrain','floor']);
const pvObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const pvInt=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
const pvKeys=(v,keys)=>pvObject(v)&&Object.keys(v).every(k=>keys.includes(k));
const pvCheck=(ok,message)=>{if(!ok)throw Error(message);};
const pvKey=(x,y)=>`${x},${y}`;
export function validatePlayerDisplay(d){
 pvCheck(pvKeys(d,['layer','label','color','style','showVitals'])&&['gm','map'].includes(d.layer),'Player display requires layer gm or map');
 pvCheck(d.showVitals===undefined||typeof d.showVitals==='boolean','showVitals must be boolean');
 pvCheck(d.label===undefined||typeof d.label==='string'&&d.label.length<=80,'Player label must be text of at most 80 characters');
 pvCheck(d.color===undefined||typeof d.color==='string'&&/^#[0-9a-f]{6}$/i.test(d.color),'Player color must be #RRGGBB');
 pvCheck(d.style===undefined||PLAYER_STYLES.includes(d.style),'Player style must be marker, wall, door, water, terrain or floor');
}
export function setPlayerDisplay(game,cmd){
 pvCheck(pvKeys(cmd,['op','kind','ids','display','reason']),'Unknown player display command field');
 game.sceneReason(cmd.reason);validatePlayerDisplay(cmd.display);
 pvCheck(['creature','feature'].includes(cmd.kind),'Choose creature or feature display');
 pvCheck(Array.isArray(cmd.ids)&&cmd.ids.length>0&&cmd.ids.length<=1000&&new Set(cmd.ids).size===cmd.ids.length&&cmd.ids.every(id=>typeof id==='string'),'Supply 1–1000 unique existing IDs');
 const records=cmd.ids.map(id=>cmd.kind==='creature'?game.find(id):game.mapFeatures().find(f=>f.id===id));
 pvCheck(records.every(Boolean),'Unknown map feature ID');
 for(const record of records){const display={...(record.playerDisplay||{}),...cmd.display};validatePlayerDisplay(display);record.playerDisplay=display;}
 game.note(`GM changes ${cmd.kind} player display: ${cmd.reason}`);
 return {kind:cmd.kind,ids:[...cmd.ids],layer:cmd.display.layer,mechanicsChanged:false};
}
export function setPlayerView(game,cmd){
 pvCheck(pvKeys(cmd,['op','title','revealed','cells','rect','all','reason']),'Unknown player view command field');game.sceneReason(cmd.reason);
 pvCheck(cmd.title===undefined||typeof cmd.title==='string'&&cmd.title.length<=120,'Player title must be text of at most 120 characters');
 const selectors=['cells','rect','all'].filter(k=>cmd[k]!==undefined);
 pvCheck(selectors.length<=1,'Choose cells, rect or all, not multiple selectors');
 pvCheck(selectors.length>0||cmd.title!==undefined,'Supply a title or reveal/hide selection');
 pvCheck(selectors.length?typeof cmd.revealed==='boolean':cmd.revealed===undefined,'A reveal/hide selection requires revealed boolean');
 let cells=[];
 if(cmd.cells!==undefined){
  pvCheck(Array.isArray(cmd.cells)&&cmd.cells.length>0&&cmd.cells.length<=65536,'Supply 1–65536 cells');
  for(const c of cmd.cells)pvCheck(pvKeys(c,['x','y'])&&pvInt(c.x,0,game.s.width-1)&&pvInt(c.y,0,game.s.height-1),'Player reveal cell out of bounds');
  cells=cmd.cells;
 }
 if(cmd.rect!==undefined||cmd.all!==undefined){
  if(cmd.all!==undefined)pvCheck(cmd.all===true,'all must be true');
  const r=cmd.rect??{x:0,y:0,width:game.s.width,height:game.s.height};
  pvCheck(pvKeys(r,['x','y','width','height'])&&pvInt(r.x,0,game.s.width-1)&&pvInt(r.y,0,game.s.height-1)&&pvInt(r.width,1,game.s.width-r.x)&&pvInt(r.height,1,game.s.height-r.y),'Player reveal rectangle out of bounds');
  for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)cells.push({x,y});
 }
 // Lazy initialization preserves old saves and checkpoints byte-for-byte until edited.
 const view=game.s.scene.playerView||{title:'Encounter map',revealed:{}};
 if(cmd.title!==undefined)view.title=cmd.title;
 for(const {x,y} of cells){if(cmd.revealed)view.revealed[pvKey(x,y)]=true;else delete view.revealed[pvKey(x,y)];}
 game.s.scene.playerView=view;game.note(`GM changes player view: ${cmd.reason}`);
 return {title:view.title,editedCells:cells.length,revealed:cmd.revealed??null,mechanicsChanged:false};
}
export function prunePlayerView(state){
 const v=state.scene?.playerView;if(!v)return;
 for(const k of Object.keys(v.revealed)){const [x,y]=k.split(',').map(Number);if(x>=state.width||y>=state.height)delete v.revealed[k];}
}
// Split at grid crossings so no path endpoints reveal geometry inside fog.
// A boundary is public when at least one adjoining cell is revealed.
function publicSegments(a,b,visible){
 const dx=b.x-a.x,dy=b.y-a.y,ts=[0,1];
 for(const [start,d,end] of [[a.x,dx,b.x],[a.y,dy,b.y]])if(Math.abs(d)>1e-9)
  for(let k=Math.floor(Math.min(start,end))+1;k<Math.max(start,end);k++){const t=(k-start)/d;if(t>0&&t<1)ts.push(t);}
 const sorted=[...new Set(ts)].sort((x,y)=>x-y),segments=[];
 const point=t=>({x:a.x+dx*t,y:a.y+dy*t});
 for(let i=1;i<sorted.length;i++){
  const mid=point((sorted[i-1]+sorted[i])/2),xs=[Math.floor(mid.x)],ys=[Math.floor(mid.y)];
  if(Math.abs(mid.x-Math.round(mid.x))<1e-9)xs.push(Math.round(mid.x)-1);
  if(Math.abs(mid.y-Math.round(mid.y))<1e-9)ys.push(Math.round(mid.y)-1);
  if(xs.some(x=>ys.some(y=>visible(x,y))))segments.push([point(sorted[i-1]),point(sorted[i])]);
 }
 return segments;
}
export function playerProjection(state){
 const view=state.scene?.playerView,visible=(x,y)=>x>=0&&y>=0&&x<state.width&&y<state.height&&view?.revealed?.[pvKey(x,y)]===true;
 const cells=[],features=[],tokens=[];
 for(let y=0;y<state.height;y++)for(let x=0;x<state.width;x++)if(visible(x,y)){
  const kind=state.tiles?.[pvKey(x,y)];
  // Hidden hazards are not announced merely because their floor was revealed.
  cells.push({x,y,terrain:['wall','force_wall','difficult'].includes(kind)?kind:'floor'});
 }
 for(const f of state.scene?.features||[]){
  const d=f.playerDisplay;if(d?.layer!=='map')continue;
  // Broken linked objects disappear; open doors remain as public dashed outlines.
  if(!mapFeatureActive(state,f)&&f.doorState!=='open')continue;
  const style=d.style||'marker',color=d.color||'#b6a17c',label=d.label||'';
  const visual={style,color,...(f.doorState!==undefined?{open:f.doorState==='open'}:{})};
  if(f.cells){
   const shown=f.cells.filter(p=>visible(p.x,p.y)).map(p=>({x:p.x,y:p.y}));
   if(shown.length)features.push({...visual,cells:shown,label});
  }else{
   const segments=f.points.slice(1).flatMap((b,i)=>publicSegments(f.points[i],b,visible));
   if(segments.length)features.push({...visual,segments,label});
  }
 }
 for(const c of state.creatures){
  const d=c.playerDisplay;if(d?.layer!=='map')continue;
  const size=c.size||1;let shown=true;
  for(let y=c.y;y<c.y+size;y++)for(let x=c.x;x<c.x+size;x++)if(!visible(x,y))shown=false;
  if(shown){
   const token={x:c.x,y:c.y,size,label:d.label??'Creature',color:d.color||'#75c6bf'};
   // Explicit GM opt-in only; team/name never implies permission to publish stats.
   // Read native state, not a second health/condition store. Never copy sources or notes.
   if(d.showVitals===true)token.vitals={hp:c.hp,maxHp:c.maxHp,
    temporaryHp:(state.energyTempHp?.[c.id]||[]).reduce((sum,p)=>sum+p.amount,0),
    nonlethal:state.nonlethalDamage?.[c.id]||0,
    conditions:[...new Set((state.conditionInstances||[]).filter(e=>e.target===c.id).map(e=>e.condition))].sort()};
   tokens.push(token);
  }
 }
 // Explicit allowlist: only opted-in vitals; no IDs, private names/notes, teams, turns, log or revisions.
 return {schema:1,map:{width:state.width,height:state.height,squareFeet:5,title:view?.title??'Encounter map'},cells,features,tokens};
}

/** GM-only diagnostics. Never attach this to the public projection. */
export function playerVisibilityStatus(state){
 const projection=playerProjection(state),features=state.scene?.features||[],tokens=state.creatures||[];
 return {revealedCells:projection.cells.length,totalCells:state.width*state.height,
  visibleFeatures:projection.features.length,gmLayerFeatures:features.filter(f=>f.playerDisplay?.layer!=='map').length,
  visibleTokens:projection.tokens.length,gmLayerTokens:tokens.filter(c=>c.playerDisplay?.layer!=='map').length,
  message:projection.cells.length===0?'Player map is fully covered. Reveal an appropriate region with gm_set_player_view; publish intended features/tokens with gm_set_player_display. Revealing cells alone does not publish GM-layer entries.':'Revealed cells are visible. GM-layer entries remain hidden; use gm_preview_player_view to inspect exactly what players receive.'};
}
