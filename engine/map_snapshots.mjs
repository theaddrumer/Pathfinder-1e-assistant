/** Named map-only bookmarks. SceneGame owns commands; the normal session store persists them.
 * No creatures, active spells, clocks, histories or arbitrary file paths in snapshots.
 */
import {validateArtwork} from './map_artwork.mjs';
import {clone} from './core.mjs';
import {validatePlayerDisplay} from './player_view.mjs';
const msObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const msKeys=(x,keys)=>msObject(x)&&Object.keys(x).every(k=>keys.includes(k));
const msId=x=>typeof x==='string'&&/^[a-z][a-z0-9_-]{0,63}$/i.test(x)&&!['constructor','prototype','__proto__'].includes(x);
const msBytes=x=>new TextEncoder().encode(JSON.stringify(x)).length;
function mapSummary(id,m){return {id,name:m.name,width:m.width,height:m.height,features:m.features.length,objects:m.objects.length,artwork:!!m.artwork,revealedCells:Object.keys(m.playerView?.revealed||{}).length,bytes:msBytes(m)};}
export function listMapSnapshots(game){return Object.entries(game.s.savedMaps||{}).map(([id,m])=>mapSummary(id,m));}
function saveBookmarksInCheckpoints(game){
 // Undoing a combat turn must not delete/restore library entries.
 for(const s of [game.turnStart,game.roundStart,game.previousTurnStart])if(s)s.savedMaps=clone(game.s.savedMaps);
}
export function saveMapSnapshot(game,cmd){
 game.assert(msKeys(cmd,['op','id','name','overwrite','reason']),'Unknown map-save field');game.sceneReason(cmd.reason);
 game.assert(msId(cmd.id),'Map ID needs 1–64 letters/digits/_/-, starting with a letter');
 game.assert(cmd.overwrite===undefined||typeof cmd.overwrite==='boolean','overwrite must be boolean');
 const name=cmd.name??game.s.scene.name;
 game.assert(typeof name==='string'&&name.trim().length>0&&name.length<=120,'Map name needs 1–120 characters');
 const library=game.s.savedMaps||{};
 game.assert(!Object.hasOwn(library,cmd.id)||cmd.overwrite===true,'Saved map already exists; use overwrite:true deliberately');
 game.assert(Object.hasOwn(library,cmd.id)||Object.keys(library).length<100,'Map library limit is 100 saved maps');
 const objects=game.s.creatures.filter(c=>c.objectProfile&&!game.summonEvent(c.id)&&!c.summonDeparture).map(c=>({
  id:c.id,name:c.name,x:c.x,y:c.y,size:c.size,maxHp:c.maxHp,hp:c.hp,
  profile:{...clone(c.objectProfile),attendedBy:null},
  ...(c.elevation?{elevation:clone(c.elevation)}:{}),...(c.playerDisplay?{playerDisplay:clone(c.playerDisplay)}:{})
 }));
 const ids=new Set(objects.map(o=>o.id));
 for(const f of game.mapFeatures())game.assert(!f.objectId||ids.has(f.objectId),'Map feature '+f.id+' references a missing or temporary object; repair that link before saving');
 const snapshot={format:'tabletop-map/1',name:name.trim(),width:game.s.width,height:game.s.height,
  established:!!game.s.scene.established,tiles:clone(game.s.tiles),elevationTiles:clone(game.s.scene.tiles),
  features:clone(game.mapFeatures()),objects,
  ...(game.s.scene.artwork?{artwork:clone(game.s.scene.artwork)}:{}),
  ...(game.s.scene.playerView?{playerView:clone(game.s.scene.playerView)}:{})};
 game.assert(objects.length<=100&&msBytes(snapshot)<=32*1024*1024,'Map exceeds 100 objects or 32 MiB');
 const next={...library,[cmd.id]:snapshot};game.assert(msBytes(next)<=64*1024*1024,'Saved map library exceeds 64 MiB; remove unused maps');
 game.s.savedMaps=next;saveBookmarksInCheckpoints(game);
 game.note(`Saved map ${cmd.id}: ${cmd.reason}`);
 return {...mapSummary(cmd.id,snapshot),excluded:{combatants:game.s.creatures.length-objects.length,persistentAreas:game.persistentAreaEvents().length,automationRules:game.s.automationRules.length},
  notes:'Map-only: terrain, features, object base durability/HP, elevation and player presentation. Active effects, automation rules, creatures, timers and clocks are not captured. Object attendants are cleared.'};
}
export function deleteMapSnapshot(game,cmd){
 game.assert(msKeys(cmd,['op','id','reason']),'Unknown map-delete field');game.sceneReason(cmd.reason);
 game.assert(msId(cmd.id)&&Object.hasOwn(game.s.savedMaps||{},cmd.id),'Unknown saved map');
 delete game.s.savedMaps[cmd.id];saveBookmarksInCheckpoints(game);game.note(`Deleted saved map ${cmd.id}: ${cmd.reason}`);return {deleted:cmd.id};
}
export function loadMapSnapshot(game,cmd){
 game.assert(msKeys(cmd,['op','id','confirm','reason']),'Unknown map-load field');game.sceneReason(cmd.reason);
 game.assert(cmd.confirm===true,'Loading replaces the current map and its objects. Save any wanted changes first, then use confirm:true');
 game.assert(msId(cmd.id)&&Object.hasOwn(game.s.savedMaps||{},cmd.id),'Unknown saved map');
 game.sceneSafe();game.assert(!game.s.initiative.enabled&&!game.s.activeSpellCasts.length,'End initiative and finish casting before loading a map');
 game.assert(game.s.creatures.every(c=>c.objectProfile),'Clear the encounter before loading a map (gm_clear_encounter keep:[]). Map loading never silently removes characters');
 const m=clone(game.s.savedMaps[cmd.id]);
 game.assert(msKeys(m,['format','name','width','height','established','tiles','elevationTiles','features','objects','playerView','artwork'])&&m.format==='tabletop-map/1','Unsupported map format');
 game.validateDimensions(m.width,m.height);
 game.assert(typeof m.name==='string'&&m.name.trim()&&m.name.length<=120&&typeof m.established==='boolean','Invalid saved map metadata');
 game.assert(msObject(m.tiles)&&msObject(m.elevationTiles)&&Array.isArray(m.features)&&Array.isArray(m.objects)&&m.objects.length<=100,'Invalid saved map records');
 game.assert(Object.keys(m.tiles).length<=65536&&Object.keys(m.elevationTiles).length<=65536,'Too many saved cells');
 // Native scene closure and object/geometry validators own restoration. Dispatch's
 // transaction restores map, library, RNG, clock and checkpoints on any rejection.
 game.closeScene({keep:[],placements:[],width:m.width,height:m.height,name:m.name,reason:cmd.reason});
 const cell=(key)=>{game.assert(/^(0|[1-9]\d*),(0|[1-9]\d*)$/.test(key),'Invalid saved cell key');const [x,y]=key.split(',').map(Number);return {x,y};};
 for(const [k,elevation] of Object.entries(m.elevationTiles))game.setTileElevation({...cell(k),elevation,reason:cmd.reason});
 for(const o of m.objects){
  game.assert(msKeys(o,['id','name','x','y','size','maxHp','hp','profile','elevation','playerDisplay'])&&msId(o.id),'Invalid saved object');
  game.validateObjectProfile(o.profile);game.assert(o.profile.attendedBy==null,'Saved objects cannot retain attendants');
  game.assert(Number.isInteger(o.hp)&&o.hp>=0&&o.hp<=o.maxHp,'Invalid saved object HP');
  game.spawnObject({id:o.id,name:o.name,x:o.x,y:o.y,size:o.size,maxHp:o.maxHp,...o.profile,elevation:o.elevation,playerDisplay:o.playerDisplay});
  const c=game.find(o.id);c.hp=o.hp;
  if(o.elevation){game.validateElevation(o.elevation);c.elevation=clone(o.elevation);}
  if(o.playerDisplay){validatePlayerDisplay(o.playerDisplay);c.playerDisplay=clone(o.playerDisplay);}
 }
 game.setTiles({cells:Object.entries(m.tiles).map(([k,kind])=>({...cell(k),kind})),reason:cmd.reason});
 game.setMapFeatures({features:m.features,reason:cmd.reason});
 if(m.playerView!==undefined){
  const v=m.playerView;game.assert(msKeys(v,['title','revealed'])&&msObject(v.revealed)&&Object.keys(v.revealed).length<=65536,'Invalid saved player view');
  game.dispatch({op:'gm_set_player_view',title:v.title,reason:cmd.reason},'gm');
  const cells=Object.entries(v.revealed).map(([k,b])=>{game.assert(b===true,'Invalid reveal flag');return cell(k);});
  if(cells.length)game.dispatch({op:'gm_set_player_view',cells,revealed:true,reason:cmd.reason},'gm');
 }
 if(m.artwork!==undefined){validateArtwork(m.artwork);game.s.scene.artwork=clone(m.artwork);}
 game.s.scene.established=m.established;game.validateMapContents();game.mapRevisionChanged();
 game.note(`Loaded saved map ${cmd.id}: ${cmd.reason}`);
 game.previousTurnStart=null;game.turnStart=clone(game.s);game.roundStart=clone(game.s);
 return {...mapSummary(cmd.id,m),status:'map_loaded',clock:game.gameTime(),advisories:game.featureAdvisories()};
}
