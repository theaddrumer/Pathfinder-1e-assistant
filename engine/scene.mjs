/** V3.34: scene lifecycle and declared spatial rulings, not a 3-D simulator.
 * The scene owns map metadata only. Effects, resources and clocks keep their owners.
 */
import {setMapArtwork,artworkSummary} from './map_artwork.mjs';
import {saveMapSnapshot,loadMapSnapshot,listMapSnapshots,deleteMapSnapshot} from './map_snapshots.mjs';
import {EncounterBasicsGame} from './encounter_basics.mjs';
import {fallingPlan} from './falling_rules.mjs';
import {validatePlayerDisplay,setPlayerDisplay,setPlayerView,prunePlayerView,playerProjection,playerVisibilityStatus} from './player_view.mjs';
import {clone,newTurnActions} from './core.mjs';
import {unresolvedActions,unresolvedDecisions} from './lifecycle.mjs';
import {MAP_DIRECTIONS,MAP_PRESETS,MAP_COVER_RANK,mapDirection,mapFeatureActive,mapRayFeatures,mapRayCover,mapSweptHull,mapFeatureHitsHull,mapElevationDelta} from './map_geometry.mjs';
const sceneObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const sceneInt=(x,a,b)=>Number.isInteger(x)&&x>=a&&x<=b;
const sceneText=x=>typeof x==='string'&&x.trim().length>0&&x.length<=500;
const sceneKeys=(x,keys)=>sceneObj(x)&&Object.keys(x).every(k=>keys.includes(k));
const smallSpace={tiny:1/4,diminutive:1/25,fine:1/100};
const spatialWarning='Elevation is GM-adjudicated: X/Y reach, AoOs, range, cover, area exposure and movement costs may be inaccurate. Declare relevant geometry/traversal/exposure rulings before acting; elevation alone grants no flight or free movement.';
export class SceneGame extends EncounterBasicsGame {
 constructor(state){
  super(state);
  this.s.scene ||= {name:'Encounter',established:false,revision:0,tiles:{},geometry:[],traversal:[]};
  this.s.scene.features ||= [];
  this.turnStart=clone(this.s);this.roundStart=clone(this.s);
 }
 sceneSafe(){this.assert(!unresolvedActions(this.s).length&&!unresolvedDecisions(this.s).length,'Resolve pending action/decision before changing scene geometry');}
 sceneReason(reason){this.assert(sceneText(reason),'Supply a reason for the GM spatial ruling');}
 validateDimensions(width,height){this.assert(sceneInt(width,1,256)&&sceneInt(height,1,256),'Map dimensions must be 1–256 squares (5 feet each)');}
 validateElevation(e){
  this.assert(sceneKeys(e,['feet','grounded','layer','note'])&&Number.isFinite(e.feet)&&Math.abs(e.feet)<=100000&&typeof e.grounded==='boolean','Elevation needs feet from map datum and grounded boolean');
  this.assert(e.layer===undefined||typeof e.layer==='string'&&/^[a-z0-9_-]{1,40}$/i.test(e.layer),'Invalid declared occupancy layer');
  this.assert(e.note===undefined||typeof e.note==='string'&&e.note.length<=500,'Invalid elevation note');
 }
 validateCreature(def){super.validateCreature(def);if(smallSpace[def.stats?.sizeCategory])this.assert(def.stats.size===undefined||def.stats.size===1,'Tiny and smaller tokens use a one-cell logical footprint');}
 prepareSpatialSpawn(c,cmd){if(cmd.playerDisplay!==undefined){validatePlayerDisplay(cmd.playerDisplay);c.playerDisplay=clone(cmd.playerDisplay);}if(cmd.elevation!==undefined){this.validateElevation(cmd.elevation);c.elevation=clone(cmd.elevation);}}
 initializeCreature(c,def){super.initializeCreature(c,def);if(smallSpace[c.sizeCategory]&&def.stats.reach===undefined)c.reach=0;}
 groundContact(c){return c.elevation?.grounded!==false;}
 validateExposure(e){
  if(e===undefined)return;
  this.assert(sceneKeys(e,['mode','targets','reason'])&&['surface','volume'].includes(e.mode),'Exposure needs surface or volume mode');
  if(e.targets!==undefined){
   this.assert(sceneObj(e.targets)&&Object.keys(e.targets).length<=100,'Invalid exposure target rulings');
   for(const [id,value] of Object.entries(e.targets))this.assert(/^[a-z][a-z0-9_-]{0,63}$/i.test(id)&&typeof value==='boolean','Exposure ruling needs a creature ID and boolean');
   this.sceneReason(e.reason);
  }
  if(e.reason!==undefined)this.sceneReason(e.reason);
 }
 exposureAllowed(c,e){
  if(e?.targets&&Object.hasOwn(e.targets,c.id))return e.targets[c.id];
  return e?.mode!=='surface'||this.groundContact(c);
 }
 spatialStamp(c){return JSON.stringify([c.x,c.y,c.size,c.reach,c.elevation||null,this.s.scene?.revision||0]);}
 geometryRuling(actor,target){
  const a=this.s.creatures.find(c=>c.id===actor),b=this.s.creatures.find(c=>c.id===target);
  if(!a||!b)return null;
  return this.s.scene?.geometry.find(r=>r.actor===actor&&r.target===target&&r.from===this.spatialStamp(a)&&r.to===this.spatialStamp(b))||null;
 }
 distance(a,b,ax=a.x,ay=a.y,bx=b.x,by=b.y){
  const r=ax===a.x&&ay===a.y&&bx===b.x&&by===b.y?this.geometryRuling(a.id,b.id):null;
  return r?.distanceFeet!==undefined?r.distanceFeet/5:super.distance(a,b,ax,ay,bx,by);
 }
 meleeReach(actor,target){
  const declared=this.geometryRuling(actor,target)?.meleeReach;if(declared!==undefined)return declared;
  if(this._entryAoO?.reactor===actor&&this._entryAoO.target===target)return true;
  return super.meleeReach(actor,target);
 }
 movementThreatens(reactor,mover,from,to){
  if(super.movementThreatens(reactor,mover,from,to))return true;
  const a=this.find(reactor),b=this.find(mover),ruling=this.geometryRuling(reactor,mover);
  if(ruling?.threatens===false||ruling?.meleeReach===false)return false;
  return !!smallSpace[b.sizeCategory]&&this.occupancyLayer(a)===this.occupancyLayer(b)&&
   this.footprint(a).some(p=>p.x===to.x&&p.y===to.y)&&this.threatens(reactor,mover,to.x,to.y);
 }
 resolveMovementOpportunity(reactor,target,interrupt){
  const old=this._entryAoO;
  // A zero-reach defender can strike a very small entrant at the boundary of
  // its own square. The mover's actual position stays unchanged until resolved.
  const c=this.find(target);
  if(!this.meleeReach(reactor,target)&&this.movementThreatens(reactor,target,c,interrupt.to))this._entryAoO={reactor,target};
  try{return super.resolveMovementOpportunity(reactor,target,interrupt);}finally{this._entryAoO=old;}
 }
 threatGeometry(a,b,vx=b.x,vy=b.y){
  const r=vx===b.x&&vy===b.y?this.geometryRuling(a.id,b.id):null;
  return r?.threatens??super.threatGeometry(a,b,vx,vy);
 }
 wallAttackGeometry(actor,target){
  const r=this.geometryRuling(actor,target);
  if(r?.lineOfEffect!==undefined)return {blocked:!r.lineOfEffect,fromWall:false,solidObstacles:[],adjudicated:true,reason:r.reason};
  return super.wallAttackGeometry(actor,target);
 }
 mapFeatures(){return this.s.scene?.features||[];}
 featureStateSignature(){return JSON.stringify(this.mapFeatures().map(f=>[f.id,mapFeatureActive(this.s,f)]));}
 mapGeometryOverview({actor,target}){return {actor,target,direction:mapDirection(this.find(actor),this.find(target)),lineOfEffect:this.wallAttackGeometry(actor,target),lineOfSight:!this.mapSightBlocked(actor,target),meleeCover:this.mapCoverBetween(actor,target),rangedCover:this.mapCoverBetween(actor,target,{attackMode:'ranged'}),ruling:clone(this.geometryRuling(actor,target)),advisories:this.spatialAdvisories()};}
 mapFeaturePassable(c,f){return f.properties.movement!=='block'||this.traits(c.id).incorporeal&&f.properties.material!=='force'&&(f.properties.thicknessFeet??0)<=(c.size||1)*5;}
 mapMovementBlocked(id,from,to){
  const c=this.find(id),hull=mapSweptHull(from,to,c.size||1);
  if(this.footprint(c,to.x,to.y).every(p=>this.traversalRuling(c,p.x,p.y)?.passable===true))return false;
  return this.mapFeatures().some(f=>f.objectId!==id&&mapFeatureActive(this.s,f)&&!this.mapFeaturePassable(c,f)&&mapFeatureHitsHull(f,hull));
 }
 elevationChanges(c,from,to){
  if(!this.groundContact(c))return [];
  return this.mapFeatures().filter(f=>mapFeatureActive(this.s,f)).map(f=>({id:f.id,delta:mapElevationDelta(f,from,to,c.size||1)})).filter(r=>r.delta);
 }
 canTraverse(id,from,to){
  const c=this.find(id),changes=this.elevationChanges(c,from,to);
  this.assert(changes.length<=1,'Multiple elevation transitions crossed in one step; combine or separate the authored boundaries');
  if(changes.length)this.assert(Math.abs((c.elevation?.feet||0)+changes[0].delta)<=100000,'Elevation transition exceeds supported height');
  return super.canTraverse(id,from,to)&&!this.mapMovementBlocked(id,from,to);
 }
 onSpatialMovement(c,from){
  super.onSpatialMovement(c,from);
  const changes=this.elevationChanges(c,from,c);this.assert(changes.length<=1,'Ambiguous elevation transitions');
  if(changes.length){
   c.elevation={...(c.elevation||{feet:0,grounded:true}),feet:(c.elevation?.feet||0)+changes[0].delta};
   this.validateElevation(c.elevation);this.pruneGeometry();
   this.note(`${c.name} crosses ${changes[0].id}: elevation ${changes[0].delta>0?'+':''}${changes[0].delta} ft, now ${c.elevation.feet} ft.`);
  }
 }
 canChargeThrough(id,from,to){
  if(!this.canTraverse(id,from,to))return false;
  const c=this.find(id),direction=mapDirection(from,to),hull=mapSweptHull(from,to,c.size||1);
  if(this.groundContact(c)&&this.mapFeatures().some(f=>mapFeatureActive(this.s,f)&&mapFeatureHitsHull(f,hull)&&(f.properties.directionalCosts[direction]??f.properties.cost)>1))return false;
  return this.moveCost(id,to.x,to.y,1,from.x!==to.x&&from.y!==to.y,from)===1;
 }
 chargePath(actor,target){
  this.assert(!this.wallAttackGeometry(actor,target).blocked,'No legal charge: line of effect is obstructed');
  this.assert(!this.mapSightBlocked(actor,target),'No legal charge: target is behind a sight barrier');
  return super.chargePath(actor,target);
 }
 mapSightBlocked(actor,target){
  const ruling=this.geometryRuling(actor,target);if(ruling?.lineOfSight!==undefined)return !ruling.lineOfSight;
  const a=this.find(actor),b=this.find(target);
  return this.footprint(a).every(p=>this.footprint(b).every(q=>mapRayFeatures(this.s,{x:p.x+.5,y:p.y+.5},{x:q.x+.5,y:q.y+.5}).some(f=>f.objectId!==target&&f.properties.sight==='block')));
 }
 mapCoverBetween(actor,target,attack={}){
  const declared=this.geometryRuling(actor,target)?.cover;if(declared!==undefined)return declared;
  const a=this.find(actor),b=this.find(target),ranged=['ranged','ranged_touch','ray'].includes(attack.attackMode);
  const adjacent=!ranged&&super.distance(a,b)<=1;
  const corners=p=>[{x:p.x+1e-6,y:p.y+1e-6},{x:p.x+1-1e-6,y:p.y+1e-6},{x:p.x+1-1e-6,y:p.y+1-1e-6},{x:p.x+1e-6,y:p.y+1-1e-6}];
  const stronger=(a,b)=>MAP_COVER_RANK[a]>=MAP_COVER_RANK[b]?a:b;
  let best='total';
  for(const p of this.footprint(a))for(const q of this.footprint(b)){
   const byCorner=corners(p).map(start=>corners(q).reduce((c,end)=>stronger(c,mapRayCover(this.s,start,end,target)),'none'));
   const cover=byCorner.reduce((a,b)=>adjacent?stronger(a,b):(MAP_COVER_RANK[a]<MAP_COVER_RANK[b]?a:b));
   if(MAP_COVER_RANK[cover]<MAP_COVER_RANK[best])best=cover;
  }
  return best;
 }
 attackMapContext(actor,target,attack){return {cover:this.mapCoverBetween(actor,target,attack),sightBlocked:this.mapSightBlocked(actor,target)};}
 spellCover(actor,target,spell){
  if(spell.save?.type!=='ref'||spell.area?.mode==='spread')return 'none';
  if(!spell.area)return actor===target?'none':(this.geometryRuling(actor,target)?.cover??this.find(target).defenseProfile?.cover??this.mapCoverBetween(actor,target,{attackMode:'ranged'}));
  const origin=spell.area.origin;let best='total';
  for(const p of this.footprint(this.find(target))){
   let cover='none';
   for(const dx of [1e-6,1-1e-6])for(const dy of [1e-6,1-1e-6]){const c=mapRayCover(this.s,origin,{x:p.x+dx,y:p.y+dy},target);if(MAP_COVER_RANK[c]>MAP_COVER_RANK[cover])cover=c;}
   if(MAP_COVER_RANK[cover]<MAP_COVER_RANK[best])best=cover;
  }
  return best;
 }
 canTakeAoO(reactor,target){
  if(!super.canTakeAoO(reactor,target))return false;
  const cover=this.geometryRuling(reactor,target)?.cover??this.find(target).defenseProfile?.cover??this.mapCoverBetween(reactor,target);
  return cover==='none'&&this.attackDefenseContext(reactor,target,{attackMode:'melee'},'ac').missChance<50;
 }
 validateManeuver(cmd,options){super.validateManeuver(cmd,options);this.assert(!this.wallAttackGeometry(cmd.actor,cmd.target).blocked,'Maneuver blocked by a barrier');}
 mapRevisionChanged(){this.s.scene.revision++;this.s.scene.geometry=[];this.s.scene.traversal=[];}
 setMapFeatures({features,remove=[],reason}){
  this.sceneSafe();this.sceneReason(reason);
  this.assert(Array.isArray(features)&&features.length<=1000&&Array.isArray(remove)&&remove.length<=1000,'Supply up to 1000 feature edits/removals');
  const ids=new Set(),next=[];
  for(const input of features){
   this.assert(sceneKeys(input,['id','name','preset','cells','points','properties','doorState','objectId','note','elevationTransition','playerDisplay'])&&typeof input.id==='string'&&/^[a-z][a-z0-9_-]{0,63}$/i.test(input.id)&&!ids.has(input.id),'Invalid or duplicate feature ID');ids.add(input.id);
   this.assert(Object.hasOwn(MAP_PRESETS,input.preset),'Choose a map feature preset');
   this.assert((input.cells!==undefined)!==(input.points!==undefined),'Feature needs cells OR a path of points');
   if(input.cells!==undefined){
    this.assert(Array.isArray(input.cells)&&input.cells.length>0&&input.cells.length<=65536,'Invalid feature cells');const seen=new Set();
    for(const p of input.cells){this.assert(sceneKeys(p,['x','y'])&&sceneInt(p.x,0,this.s.width-1)&&sceneInt(p.y,0,this.s.height-1)&&!seen.has(`${p.x},${p.y}`),'Invalid/duplicate feature cell');seen.add(`${p.x},${p.y}`);}
   }else{
    this.assert(Array.isArray(input.points)&&input.points.length>=2&&input.points.length<=1000,'Wall path needs 2–1000 points');
    for(const [i,p] of input.points.entries()){
     this.assert(sceneKeys(p,['x','y'])&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=this.s.width&&p.y>=0&&p.y<=this.s.height,'Feature point out of bounds');
     if(i){const a=input.points[i-1],dx=Math.abs(p.x-a.x),dy=Math.abs(p.y-a.y);this.assert(Math.max(dx,dy)>1e-6&&(dx<1e-9||dy<1e-9||Math.abs(dx-dy)<1e-9),'Path segments must follow one of eight directions');}
    }
   }
   this.assert(input.properties===undefined||sceneKeys(input.properties,['movement','sight','effect','cover','material','cost','directionalCosts','thicknessFeet','heightFeet']),'Unknown feature property');
   const p={material:'ordinary',cost:1,directionalCosts:{},...clone(MAP_PRESETS[input.preset]),...clone(input.properties||{})};
   this.assert(['allow','block'].includes(p.movement)&&['allow','block'].includes(p.sight)&&['allow','block','adjudicate'].includes(p.effect)&&Object.hasOwn(MAP_COVER_RANK,p.cover),'Invalid feature obstruction/cover');
   this.assert(['ordinary','force'].includes(p.material)&&Number.isFinite(p.cost)&&p.cost>=1&&p.cost<=1000,'Invalid feature material/cost multiplier');
   this.assert(sceneObj(p.directionalCosts)&&Object.keys(p.directionalCosts).every(d=>Object.hasOwn(MAP_DIRECTIONS,d)&&Number.isFinite(p.directionalCosts[d])&&p.directionalCosts[d]>=1&&p.directionalCosts[d]<=1000),'Directional costs need N, NE, E, SE, S, SW, W or NW multipliers');
   for(const k of ['thicknessFeet','heightFeet'])this.assert(p[k]===undefined||Number.isFinite(p[k])&&p[k]>=0&&p[k]<=100000,'Invalid barrier dimension');
   for(const k of ['name','note'])this.assert(input[k]===undefined||sceneText(input[k]),'Invalid feature text');
   this.assert(input.doorState===undefined||['open','closed'].includes(input.doorState),'Invalid door state');
   if(input.objectId!==undefined)this.assert(typeof input.objectId==='string'&&this.find(input.objectId).objectProfile,'Feature durability requires an existing object token');
   if(input.elevationTransition!==undefined){
    const t=input.elevationTransition;this.assert(sceneKeys(t,['up','riseFeet'])&&Object.hasOwn(MAP_DIRECTIONS,t.up)&&Number.isFinite(t.riseFeet)&&t.riseFeet>0&&t.riseFeet<=100000,'Elevation transition needs up direction and positive riseFeet');
    this.assert(input.points?.length===2,'Elevation transition needs one straight boundary (two points)');
    const [dx,dy]=MAP_DIRECTIONS[t.up],[a,b]=input.points;
    this.assert(Math.abs((b.x-a.x)*dx+(b.y-a.y)*dy)<1e-9,'Uphill direction must be perpendicular to the transition boundary');
   }
   if(input.playerDisplay!==undefined)validatePlayerDisplay(input.playerDisplay);
   const previousDisplay=this.mapFeatures().find(f=>f.id===input.id)?.playerDisplay;
   next.push({...clone(input),...(input.playerDisplay===undefined&&previousDisplay?{playerDisplay:clone(previousDisplay)}:{}),properties:p,...(input.preset==='door'?{doorState:input.doorState||'closed'}:{})});
  }
  this.assert(new Set(remove).size===remove.length&&remove.every(id=>this.mapFeatures().some(f=>f.id===id)&&!ids.has(id)),'Unknown, duplicate or conflicting removal');
  const merged=this.mapFeatures().filter(f=>!ids.has(f.id)&&!remove.includes(f.id)).concat(next);
  this.assert(merged.length<=1000&&merged.reduce((n,f)=>n+(f.cells?.length||f.points.length),0)<=100000,'Scene feature geometry exceeds budget');
  this.s.scene.features=merged;this.mapRevisionChanged();this.syncZones();
  this.note(`GM changes map features: ${reason}`);return {updated:next.map(f=>f.id),removed:remove,advisories:this.featureAdvisories()};
 }
 setDoor({id,state,reason}){
  this.sceneSafe();this.sceneReason(reason);const f=this.mapFeatures().find(f=>f.id===id);
  this.assert(f?.doorState!==undefined&&['open','closed'].includes(state),'Unknown door or invalid state');
  f.doorState=state;this.mapRevisionChanged();this.syncZones();this.note(`GM sets ${id} ${state}: ${reason}`);return {id,state,advisories:this.featureAdvisories()};
 }
 featureAdvisories(){
  const warnings=[];
  if(this.mapFeatures().some(f=>f.properties.effect==='adjudicate'&&mapFeatureActive(this.s,f)))warnings.push('Bars/slits or custom openings require an effect-passage ruling. Until declared allow, these features block automatic line of effect and area propagation.');
  for(const c of this.s.creatures)if(this.mapMovementBlocked(c.id,c,c))warnings.push(`${c.id} overlaps a movement barrier: declare partial-square traversal/placement or relocate before ordinary movement.`);
  if(this.mapFeatures().some(f=>f.properties.heightFeet!==undefined))warnings.push('Barrier heights are annotations; elevation does not automatically bypass walls. Use geometry/traversal rulings.');
  for(const f of this.mapFeatures())if(f.objectId&&!this.s.creatures.some(c=>c.id===f.objectId))warnings.push(`${f.id}: linked object ${f.objectId} is missing; barrier stays active until explicitly edited.`);
  return warnings;
 }
 traversalRuling(c,x,y){return this.s.scene?.traversal.find(r=>r.target===c.id&&r.x===x&&r.y===y&&r.elevation===JSON.stringify(c.elevation||null)&&r.revision===this.s.scene.revision);}
 terrainBlocks(c,x,y){
  const r=this.traversalRuling(c,x,y);
  return r?.passable!==undefined?!r.passable:['wall','force_wall'].includes(this.tileKind(x,y));
 }
 moveCost(id,x,y,diagonals,isDiagonal=true,from=null){
  const c=this.find(id),r=this.traversalRuling(c,x,y);
  if(r?.costSquares!==undefined)return r.costSquares;
  // No terrain movement penalty without contact with its surface. Climbing /
  // ascent costs and special barriers require a declared per-destination cost.
  if(!this.groundContact(c))return isDiagonal&&diagonals%2===0?2:1;
  const base=super.moveCost(id,x,y,diagonals,isDiagonal),step=(isDiagonal&&diagonals%2===0?2:1),origin=from||c;
  const direction=mapDirection(origin,{x,y}),hull=mapSweptHull(origin,{x,y},c.size||1);let multiplier=base/step;
  for(const f of this.mapFeatures())if(mapFeatureActive(this.s,f)&&(f.cells?mapFeatureHitsHull(f,mapSweptHull({x,y},{x,y},c.size||1)):mapFeatureHitsHull(f,hull)))multiplier=Math.max(multiplier,f.properties.directionalCosts[direction]??f.properties.cost);
  return step*multiplier;
 }
 occupiesSpace(c){return c.objectProfile?c.hp>0&&!this.mapFeatures().some(f=>f.objectId===c.id):!['dead'].includes(this.healthState(c.id).status);}
 occupancyLayer(c){return c.elevation?.layer||'ground';}
 blocksOccupancy(c,o,x,y){
  if(!super.blocksOccupancy(c,o,x,y))return false;
  if(this.occupancyLayer(c)!==this.occupancyLayer(o))return false;
  const a=smallSpace[c.sizeCategory],b=smallSpace[o.sizeCategory];
  if(a||b){
   if(!a)return false;
   const tiny=this.s.creatures.filter(t=>t.id!==c.id&&!this.collectiveKind?.(t.id)&&this.occupiesSpace(t)&&this.occupancyLayer(c)===this.occupancyLayer(t)&&smallSpace[t.sizeCategory]&&this.footprint(t).some(q=>q.x===x&&q.y===y));
   return a+tiny.reduce((sum,t)=>sum+smallSpace[t.sizeCategory],0)>1+1e-9;
  }
  return true;
 }
 legalPosition(id,x,y){
  if(!super.legalPosition(id,x,y))return false;
  const c=this.find(id);
  return !this.footprint(c,x,y).some(p=>this.traversalRuling(c,p.x,p.y)?.passable===false)&&!this.mapMovementBlocked(id,{x,y},{x,y});
 }
 spatialAdvisories(){return [...(this.s.creatures.some(c=>c.elevation)||Object.keys(this.s.scene?.tiles||{}).length?[spatialWarning]:[]),...this.featureAdvisories()];}
 withSpatialAdvisories(result){
  this.pruneGeometry();
  const warnings=this.spatialAdvisories();
  if(!warnings.length||!sceneObj(result))return result;
  return {...result,advisories:[...new Set([...(result.advisories||[]),...warnings])]};
 }
 pruneGeometry(){if(this.s.scene)this.s.scene.geometry=this.s.scene.geometry.filter(r=>this.geometryRuling(r.actor,r.target)===r);}
 mapOverview(){return clone({width:this.s.width,height:this.s.height,squareFeet:5,...this.s.scene,artwork:artworkSummary(this.s),tiles:this.s.tiles,elevationTiles:this.s.scene.tiles,
  geometry:this.s.scene.geometry.filter(r=>this.geometryRuling(r.actor,r.target)===r),
  creatures:this.s.creatures.map(c=>({id:c.id,x:c.x,y:c.y,sizeCategory:this.sizeCategory(c.id),elevation:c.elevation||null})),advisories:this.spatialAdvisories()});}
 inspect(){return {...super.inspect(),map:this.mapOverview()};}
 validateMapContents(){
  const inside=(x,y)=>sceneInt(x,0,this.s.width-1)&&sceneInt(y,0,this.s.height-1);
  for(const c of this.s.creatures)this.assert(this.footprint(c).every(p=>inside(p.x,p.y)),`Resize would clip creature ${c.id}`);
  for(const k of [...Object.keys(this.s.tiles),...Object.keys(this.s.scene.tiles)]){const [x,y]=k.split(',').map(Number);this.assert(inside(x,y),`Resize would clip terrain ${k}`);}
  for(const f of this.mapFeatures())this.assert(f.cells?f.cells.every(p=>inside(p.x,p.y)):f.points.every(p=>p.x<=this.s.width&&p.y<=this.s.height),`Resize would clip feature ${f.id}`);
  for(const e of this.persistentAreaEvents()){
   // Area shape bounds are validated independently of clipping by spellArea.
   const a=e.payload.spell.area;
   this.assert(a.origin.x>=0&&a.origin.x<=this.s.width&&a.origin.y>=0&&a.origin.y<=this.s.height,'Resize would clip area origin');
  }
 }
 configureMap({width,height,name,reason}){
  this.sceneSafe();this.sceneReason(reason);this.validateDimensions(width,height);
  const before={width:this.s.width,height:this.s.height};
  if(name!==undefined)this.assert(typeof name==='string'&&name.trim().length>0&&name.length<=120,'Invalid map name');
  // Preserve every existing area cell when shrinking, including edge effects.
  const footprints=this.persistentAreaEvents().map(e=>({id:e.id,cells:this.persistentAreaGeometry(e).cells}));
  this.s.width=width;this.s.height=height;this.validateMapContents();prunePlayerView(this.s);
  for(const a of footprints)this.assert(a.cells.every(p=>p.x<width&&p.y<height),`Resize would clip active area ${a.id}`);
  if(name!==undefined)this.s.scene.name=name.trim();
  this.s.scene.revision++;this.s.scene.geometry=[];this.s.scene.traversal=[];
  this.note(`GM sets map ${width}×${height}: ${reason}`);
  const advisories=this.s.scene.established?['Established scene: map dimensions changed intentionally. Keep the map stable between player inputs.']:[];
  this.syncZones();return {before,width,height,established:this.s.scene.established,advisories};
 }
 previewFall(cmd){
  this.assert(sceneKeys(cmd,['op','target','fall','landing','reason']),'Unknown fall command input');
  const c=this.find(cmd.target);
  this.assert(!c.objectProfile,'Creature falling rules do not resolve falling-object impacts');
  const plan=fallingPlan(cmd.fall);
  if(cmd.landing!==undefined){
   this.validateElevation(cmd.landing);
   // Test the declared destination layer without emitting entry events or retaining state.
   const old=c.elevation;
   try{c.elevation=clone(cmd.landing);this.assert(this.legalPosition(c.id,c.x,c.y),'Landing would cause illegal occupancy or terrain collision');}
   finally{if(old===undefined)delete c.elevation;else c.elevation=old;}
  }
  return {target:c.id,...plan,landing:clone(cmd.landing??null)};
 }
 resolveFall(cmd){
  this.sceneSafe();this.sceneReason(cmd.reason);
  const plan=this.previewFall(cmd),c=this.find(cmd.target);
  const roll=part=>{const rolls=part.count?Array.from({length:part.count},()=>this.rollDie(part.sides)):[];return {rolls,raw:part.amount??rolls.reduce((a,b)=>a+b,0)};};
  const lethal=roll(plan.lethal),nonlethal=roll(plan.nonlethal);
  this.note(`GM resolves ${plan.distanceFeet}-foot fall for ${c.name}: ${cmd.reason}${plan.override?'; override: '+plan.override.reason:''}`);
  const hit=this.beginAttackDamage?.(null,c.id,'environment');let completed=false,casting=null;
  try{
   if(lethal.raw)lethal.result=this.damage(c.id,lethal.raw,'bludgeoning',null,'environment');
   if(nonlethal.raw)nonlethal.result=this.damage(c.id,nonlethal.raw,'bludgeoning',null,'environment',{nonlethal:true});
   completed=true;
  }finally{if(hit)casting=this.endAttackDamage(hit,completed);}
  const lethalTaken=(lethal.result?.applied||0)+(lethal.result?.tempHpAbsorbed||0)+(nonlethal.result?.lethalOverflow||0);
  const anyTaken=lethalTaken+(nonlethal.result?.accumulated||0);
  const shouldProne=plan.override?.prone??(plan.proneOn==='any_damage'?anyTaken>0:lethalTaken>0);
  const condition=shouldProne?this.applyCondition({target:c.id,condition:'prone'}):null;
  // Reuse the elevation owner's contact/area notifications exactly once, after impact.
  if(cmd.landing!==undefined)this.setElevation({target:c.id,elevation:cmd.landing,reason:cmd.reason});
  return {target:c.id,plan,lethal,nonlethal,casting,condition,prone:this.hasCondition(c.id,'prone'),elevation:clone(c.elevation??null),health:this.healthState(c.id)};
 }
 setElevation({target,elevation,traversal,reason}){
  this.sceneSafe();this.sceneReason(reason);const c=this.find(target),wasGrounded=this.groundContact(c);
  if(elevation===null)delete c.elevation;else{this.validateElevation(elevation);c.elevation=clone(elevation);}
  if(traversal!==undefined)this.setTraversal({target,cells:traversal,reason});
  this.assert(this.legalPosition(target,c.x,c.y),'Elevation/layer would cause illegal occupancy or terrain collision');
  this.pruneGeometry();
  this.note(`GM elevation for ${c.name}: ${reason}`);
  // Evaluate contact-sensitive entry rules when landing, without a horizontal move.
  if(!wasGrounded&&this.groundContact(c))this.emit('tile_enter',{actor:target,x:c.x,y:c.y,tile:this.tileKind(c.x,c.y),elevationChange:true});
  this.syncZones();return {target,elevation:clone(c.elevation||null)};
 }
 setTiles({cells,reason}){
  this.sceneSafe();this.sceneReason(reason);
  this.assert(Array.isArray(cells)&&cells.length<=65536,'Supply up to 65536 terrain cells');
  const seen=new Set();
  for(const c of cells){
   this.assert(sceneKeys(c,['x','y','kind'])&&!seen.has(`${c.x},${c.y}`),'Invalid or duplicate terrain cell');seen.add(`${c.x},${c.y}`);
   super.dispatch({op:'gm_set_tile',...c},'gm');
  }
  this.s.scene.revision++;this.s.scene.geometry=[];this.s.scene.traversal=[];
  this.note(`GM edits ${cells.length} terrain cells: ${reason}`);this.syncZones();return {edited:cells.length};
 }
 setTileElevation({x,y,elevation,reason}){
  this.sceneSafe();this.sceneReason(reason);
  this.assert(sceneInt(x,0,this.s.width-1)&&sceneInt(y,0,this.s.height-1),'Tile out of bounds');
  if(elevation===null)delete this.s.scene.tiles[`${x},${y}`];
  else{
   this.assert(sceneKeys(elevation,['surfaceFeet','obstacleHeightFeet','note'])&&Number.isFinite(elevation.surfaceFeet)&&Math.abs(elevation.surfaceFeet)<=100000,'Tile elevation needs surfaceFeet');
   this.assert(elevation.obstacleHeightFeet===undefined||Number.isFinite(elevation.obstacleHeightFeet)&&elevation.obstacleHeightFeet>=0&&elevation.obstacleHeightFeet<=100000,'Invalid obstacle height');
   this.assert(elevation.note===undefined||typeof elevation.note==='string'&&elevation.note.length<=500,'Invalid tile note');
   this.s.scene.tiles[`${x},${y}`]=clone(elevation);
  }
  this.s.scene.revision++;this.s.scene.geometry=[];this.s.scene.traversal=[];
  this.note(`GM tile elevation (${x},${y}): ${reason}`);return {x,y,elevation};
 }
 setGeometry({actor,target,ruling,reason}){
  this.sceneReason(reason);this.assert(actor!==target,'Geometry ruling needs two different creatures');
  const a=this.find(actor),b=this.find(target);
  this.assert(ruling===null||sceneKeys(ruling,['distanceFeet','meleeReach','threatens','lineOfEffect','lineOfSight','cover']),'Invalid geometry ruling');
  if(ruling){
   if(ruling.distanceFeet!==undefined)this.assert(Number.isFinite(ruling.distanceFeet)&&ruling.distanceFeet>=0&&ruling.distanceFeet<=100000,'Invalid declared distance');
   if(ruling.cover!==undefined)this.assert(Object.hasOwn(MAP_COVER_RANK,ruling.cover),'Invalid declared cover');
   for(const key of ['meleeReach','threatens','lineOfEffect','lineOfSight'])if(ruling[key]!==undefined)this.assert(typeof ruling[key]==='boolean','Geometry permission must be boolean');
  }
  if(ruling?.threatens===true)this.assert(ruling.meleeReach!==false&&(ruling.meleeReach===true||(ruling.distanceFeet??super.distance(a,b)*5)<=a.reach*5),'Threat ruling needs consistent melee reach or distance');
  this.s.scene.geometry=this.s.scene.geometry.filter(r=>r.actor!==actor||r.target!==target);
  if(ruling)this.s.scene.geometry.push({actor,target,...clone(ruling),reason,from:this.spatialStamp(a),to:this.spatialStamp(b)});
  this.note(`GM geometry ${actor} → ${target}: ${reason}`);this.syncZones();return {actor,target,ruling};
 }
 setTraversal({target,cells,reason}){
  this.sceneSafe();this.sceneReason(reason);const c=this.find(target);
  this.assert(Array.isArray(cells)&&cells.length<=1000,'Supply at most 1000 traversal cells');
  const seen=new Set();
  for(const r of cells){
   this.assert(sceneKeys(r,['x','y','passable','costSquares'])&&sceneInt(r.x,0,this.s.width-1)&&sceneInt(r.y,0,this.s.height-1),'Invalid traversal cell');
   this.assert(!seen.has(`${r.x},${r.y}`),'Duplicate traversal cell');seen.add(`${r.x},${r.y}`);
   if(r.passable!==undefined)this.assert(typeof r.passable==='boolean','Passability must be boolean');
   if(r.costSquares!==undefined)this.assert(Number.isFinite(r.costSquares)&&r.costSquares>=1&&r.costSquares<=1000,'Traversal cost must be 1–1000 squares');
  }
  this.s.scene.traversal=this.s.scene.traversal.filter(r=>r.target!==target);
  for(const r of cells)this.s.scene.traversal.push({target,...clone(r),reason,elevation:JSON.stringify(c.elevation||null),revision:this.s.scene.revision});
  this.assert(this.legalPosition(target,c.x,c.y),'Traversal ruling blocks occupied square');
  this.note(`GM traversal ${target}: ${reason}`);return {target,cells:cells.length};
 }
 setExposure({areaId,ruleId,exposure,reason}){
  this.sceneSafe();this.sceneReason(reason);this.validateExposure(exposure);
  this.assert((areaId!==undefined)!==(ruleId!==undefined),'Choose one areaId or ruleId');
  if(areaId){const e=this.persistentAreaEvent(areaId);this.assert(e,'Unknown persistent area');e.payload.exposure=clone(exposure||{mode:'volume'});}
  else{const r=this.s.automationRules.find(r=>r.id===ruleId);this.assert(r&&['tile_enter','zone_enter','turn_start'].includes(r.on),'Unknown terrain/zone rule');r.exposure=clone(exposure||{mode:r.on==='tile_enter'?'surface':'volume'});}
  this.note(`GM exposure ${areaId||ruleId}: ${reason}`);this.syncZones();return {areaId,ruleId,exposure};
 }
 sceneClosePreview({keep,preserveMap=false}={}){
  this.assert(Array.isArray(keep)&&new Set(keep).size===keep.length,'Scene closure needs an explicit unique keep list (may be empty)');
  for(const id of keep)this.find(id);
  return {keep:clone(keep),remove:this.s.creatures.filter(c=>!keep.includes(c.id)).map(c=>c.id),
   clearAreas:this.persistentAreaEvents().map(e=>e.id),clearTerrain:!preserveMap,clearUndo:true,
   preserve:'Retained HP, resources, ongoing effects/ailments, world clock and surviving deadlines. No rest or time advancement.',
   advisories:['Save campaign notes or an encounter export with a companion tool before closure if historical records are wanted. Closure discards encounter history; world-clock schedules and retained creature deadlines remain.']};
 }
 closeScene(cmd,{preserveMap=false}={}){
  this.assert(cmd.preserveMap===undefined,'Use gm_clear_encounter to preserve the map');
  this.sceneSafe();this.sceneReason(cmd.reason);this.assert(!this.s.initiative.enabled,'End initiative before closing the scene');
  this.assert(!(this.s.activeSpellCasts||[]).length,'Complete or cancel casting before closing the scene');
  const report=this.sceneClosePreview({...cmd,preserveMap}),keep=new Set(cmd.keep);
  this.validateDimensions(cmd.width??this.s.width,cmd.height??this.s.height);
  this.assert(Array.isArray(cmd.placements)&&cmd.placements.length===keep.size,'Supply one placement for each retained creature');
  this.assert(new Set(cmd.placements.map(p=>p.id)).size===keep.size&&cmd.placements.every(p=>keep.has(p.id)),'Placements must match keep list');
  for(const g of [...this.s.grapples])this.releaseGrapple(g.holder,'scene closes:');
  for(const e of [...this.persistentAreaEvents()])this.concludePendingEvent(e,'cancelled','scene closes');
  // Departing casters stop maintenance; an authored lingering tail remains on
  // survivors under the same native deadline, with provenance but no live actor.
  for(const e of [...this.concentrationEvents()])if(!keep.has(e.actor)){
   if(e.payload.phase==='maintaining')this.stopConcentrationEvent(e,'caster leaves scene');
   if(this.s.pendingEvents.includes(e)&&e.payload.phase==='lingering'){
    e.payload.departedSource=e.actor;e.actor=null;e.payload.actor=null;
   }
  }
  for(const e of [...this.s.pendingEvents])if(e.actor&&!keep.has(e.actor)||e.duration.actor&&!keep.has(e.duration.actor)){
   if(this.s.pendingEvents.includes(e))this.concludePendingEvent(e,'cancelled','owner leaves scene');
  }
  this.flushSummons({downtime:true});
  this.assert(cmd.keep.every(id=>this.s.creatures.some(c=>c.id===id)),'A retained summon departed with its source; revise keep list');
  const removed=new Set(this.s.creatures.filter(c=>!keep.has(c.id)).map(c=>c.id));
  for(const e of [...this.s.effects])if(removed.has(e.target))this.removeEffect(e.id,{countAsAction:false});
  // Source provenance is retained without a live source reference. Poison,
  // damage, conditions and independent timed spells on survivors do not vanish.
  for(const rows of [this.s.effects,this.s.conditionInstances,this.s.activeAilments,this.s.negativeLevels,this.s.dirtyTricks])
   for(const row of rows)if(removed.has(row.source)){row.departedSource=row.source;row.source=null;}
  for(const source of [...this.s.effects.map(e=>e.spellSource),...this.s.pendingEvents.map(e=>e.payload?.spellSource)])
   if(source&&removed.has(source.actor)){source.departedActor=source.actor;source.actor=null;}
  this.s.creatures=this.s.creatures.filter(c=>keep.has(c.id));
  for(const key of ['activeAilments','negativeLevels','dirtyTricks'])this.s[key]=this.s[key].filter(r=>keep.has(r.target));
  for(const key of ['abilityDamage','abilityDrain','conHpAdjustments','energyTempHp','nonlethalDamage','riderBleed','aooUsed'])
   for(const id of Object.keys(this.s[key]||{}))if(!keep.has(id))delete this.s[key][id];
  this.s.spellResources=this.s.spellResources.filter(b=>keep.has(b.actor));
  for(const e of this.s.pendingEvents)if(e.kind==='held_spell'){
   delete e.payload.spell.targets;e.payload.spell.delivery.attemptOnCast=false;e.payload.freeAttempt=false;
   for(const id of Object.keys(e.payload.resistanceCache||{}))if(!keep.has(id))delete e.payload.resistanceCache[id];
  }
  this.s.automationRules=this.s.automationRules.filter(r=>r.owner&&keep.has(r.owner));
  this.s.zonePresence={};this.s.marks=this.s.marks.filter(m=>keep.has(m.source)&&keep.has(m.target));
  for(const rule of this.s.automationRules)if(rule.exposure?.targets)for(const id of Object.keys(rule.exposure.targets))if(!keep.has(id))delete rule.exposure.targets[id];
  if(!preserveMap){
  this.s.tiles={};this.s.width=cmd.width??this.s.width;this.s.height=cmd.height??this.s.height;
  this.s.scene={name:cmd.name||'New scene',established:false,revision:0,tiles:{},features:[],geometry:[],traversal:[]};
  this.assert(typeof this.s.scene.name==='string'&&this.s.scene.name.length<=120,'Invalid scene name');
  }else{
   this.s.scene.geometry=this.s.scene.geometry.filter(r=>keep.has(r.actor)&&keep.has(r.target)&&this.geometryRuling(r.actor,r.target)===r);
   this.s.scene.traversal=this.s.scene.traversal.filter(r=>keep.has(r.target));
  }
  for(const p of cmd.placements){
   this.assert(sceneKeys(p,['id','x','y','elevation']),'Invalid placement fields');
   const c=this.find(p.id);c.x=p.x;c.y=p.y;if(!preserveMap){delete c.elevation;delete c.playerDisplay;}
   if(p.elevation!==undefined){this.validateElevation(p.elevation);c.elevation=clone(p.elevation);}
  }
  for(const c of this.s.creatures)this.assert(preserveMap||this.legalPosition(c.id,c.x,c.y),`Invalid retained placement for ${c.id}`);
  this.s.turn=0;this.s.actions=newTurnActions();this.s.aooUsed={};
  this.s.testRolls=[];
  this.s.initiative={enabled:false,entries:[],acted:[],delayed:[],queuedResume:null,alerts:[],pendingQueue:[]};
  for(const key of ['pendingEventHistory','spellCastHistory','overrideLog','log'])this.s[key]=[];
  const definitions=new Set(this.s.creatures.map(c=>c.definitionId));
  this.s.creatureCatalog=Object.fromEntries(Object.entries(this.s.creatureCatalog).filter(([id])=>definitions.has(id)));
  const ailments=new Set(this.s.activeAilments.map(a=>a.definition));
  this.s.ailmentCatalog=Object.fromEntries(Object.entries(this.s.ailmentCatalog).filter(([id])=>ailments.has(id)));
  this.s.effectCatalog={};
  for(const e of this.s.pendingEvents)if(e.kind==='summon'&&removed.has(e.payload.source))e.payload.source=null;
  this.note(`Scene closed: ${cmd.reason}. Retained ${keep.size} creature(s); clock/resources unchanged.`);
  this.reconcileConcentration();this.syncConditions();
  // A fresh scene has no old undo chain. Do not fire new encounter entry effects
  // until the GM establishes it, spawns, moves, or starts initiative.
  this.previousTurnStart=null;this.turnStart=clone(this.s);this.roundStart=clone(this.s);
  return {...report,status:preserveMap?'encounter_cleared':'scene_closed',width:this.s.width,height:this.s.height};
 }
 clearEncounterPreview({keep=[]}={}){
  this.assert(Array.isArray(keep)&&new Set(keep).size===keep.length,'Supply unique creature IDs to retain');
  for(const id of keep)this.find(id);
  const retained=[...new Set([...keep,...this.s.creatures.filter(c=>c.objectProfile).map(c=>c.id)])];
  return {...this.sceneClosePreview({keep:retained,preserveMap:true}),endInitiative:!!this.s.initiative.enabled,
   keepObjects:this.s.creatures.filter(c=>c.objectProfile).map(c=>c.id),
   blockers:[...unresolvedActions(this.s),...unresolvedDecisions(this.s),...(this.s.activeSpellCasts.length?['active_casting']:[])],
   preservedSchedules:this.s.scheduledTimeEvents.map(e=>e.id)};
 }
 clearEncounter(cmd){
  this.assert(sceneKeys(cmd,['op','keep','reason']),'Unknown encounter cleanup field');
  this.sceneSafe();this.sceneReason(cmd.reason);
  this.assert(!this.s.activeSpellCasts.length,'Complete or cancel casting before clearing encounter');
  const preview=this.clearEncounterPreview(cmd);
  if(this.s.initiative.enabled)this.finishInitiative();
  // Reuse scene closure's lifecycle cleanup, retaining map/object records in place.
  const placements=preview.keep.map(id=>{const c=this.find(id);return {id,x:c.x,y:c.y};});
  const result=this.closeScene({keep:preview.keep,placements,reason:cmd.reason},{preserveMap:true});
  return {...result,keepObjects:preview.keepObjects,preservedSchedules:this.s.scheduledTimeEvents.map(e=>e.id)};
 }
 saveMap(cmd){return saveMapSnapshot(this,cmd);}
 loadMap(cmd){return loadMapSnapshot(this,cmd);}
 beginInitiative(cmd){const result=super.beginInitiative(cmd);this.s.scene.established=true;return result;}
 dispatch(cmd,role='actor'){
  const ops=['gm_set_map_artwork','gm_get_map_artwork','gm_save_map','gm_load_map','gm_list_maps','gm_delete_map','gm_clear_encounter','gm_preview_encounter_clear','gm_get_player_visibility','gm_set_player_display','gm_set_player_view','gm_preview_player_view','gm_preview_fall','gm_resolve_fall','gm_get_geometry','gm_set_map_features','gm_set_door','gm_set_tiles','gm_get_map','gm_preview_scene_close','gm_configure_map','gm_establish_scene','gm_close_scene','gm_set_elevation','gm_set_tile_elevation','gm_set_geometry','gm_set_traversal','gm_set_exposure'];
  if(!ops.includes(cmd.op)){
   const result=super.dispatch(cmd,role);
   if(cmd.op==='gm_set_tile'){this.s.scene.revision++;this.s.scene.geometry=[];this.s.scene.traversal=[];}
   return result;
  }
  this.assert(role==='gm','Map/elevation management is GM-only');
  switch(cmd.op){
   case 'gm_save_map':return this.saveMap(cmd);
   case 'gm_load_map':return this.loadMap(cmd);
   case 'gm_list_maps':return listMapSnapshots(this);
   case 'gm_delete_map':return deleteMapSnapshot(this,cmd);
   case 'gm_clear_encounter':return this.clearEncounter(cmd);
   case 'gm_preview_encounter_clear':return this.clearEncounterPreview(cmd);
   case 'gm_get_player_visibility':return playerVisibilityStatus(this.s);
   case 'gm_set_map_artwork':return setMapArtwork(this,cmd);
   case 'gm_get_map_artwork':return artworkSummary(this.s);
   case 'gm_set_player_display':return setPlayerDisplay(this,cmd);
   case 'gm_set_player_view':return setPlayerView(this,cmd);
   case 'gm_preview_player_view':return playerProjection(this.s);
   case 'gm_preview_fall':return this.previewFall(cmd);
   case 'gm_resolve_fall':return this.resolveFall(cmd);
   case 'gm_get_geometry':return this.mapGeometryOverview(cmd);
   case 'gm_set_map_features':return this.setMapFeatures(cmd);
   case 'gm_set_door':return this.setDoor(cmd);
   case 'gm_set_tiles':return this.setTiles(cmd);
   case 'gm_get_map':return this.mapOverview();
   case 'gm_preview_scene_close':return this.sceneClosePreview(cmd);
   case 'gm_configure_map':return this.configureMap(cmd);
   case 'gm_establish_scene':this.sceneSafe();this.s.scene.established=true;this.syncZones();return {established:true};
   case 'gm_close_scene':return this.closeScene(cmd);
   case 'gm_set_elevation':return this.setElevation(cmd);
   case 'gm_set_tile_elevation':return this.setTileElevation(cmd);
   case 'gm_set_geometry':return this.setGeometry(cmd);
   case 'gm_set_traversal':return this.setTraversal(cmd);
   case 'gm_set_exposure':return this.setExposure(cmd);
  }
 }
}
