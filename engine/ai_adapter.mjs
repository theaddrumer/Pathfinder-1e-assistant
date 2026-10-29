/** Transport-neutral AI boundary; all game mutations go through Kernel.dispatch. */
import {randomUUID,randomInt,createHash} from 'node:crypto';
import {Kernel,initialState} from './kernel.mjs';
import {normalizeArtwork,createArtworkRenderer} from './artwork_raster.mjs';
import {artworkSummary} from './map_artwork.mjs';
import {playerVisibilityStatus} from './player_view.mjs';
import {clone} from './core.mjs';
import {unresolvedActions,unresolvedDecisions} from './lifecycle.mjs';
import {COMMANDS,discover} from './integration_catalog.mjs';
export const ENGINE_VERSION='3.51.0';
// Keep published versions explicitly: a release bump must not drop the previous writer.
// This allowlist is independent of the current build; unknown future formats stay rejected.
const SUPPORTED_SESSION_VERSIONS=new Set([
 '3.37.0','3.38.0','3.39.0','3.40.0','3.41.0','3.42.0','3.43.0','3.46.0',
 '3.47.0','3.48.0','3.48.1','3.48.2','3.49.0','3.50.0','3.51.0'
]);
export const ADAPTER_INSTRUCTIONS='Use kernel_status first and read kernel_reference topic=start before operating an unfamiliar encounter. Discover commands with kernel_catalog; read kernel_reference for payload schemas. Ordinary actions use kernel_action, never GM damage to simulate an attack. Use kernel_gm only for explicit setup/adjudication with a reason. Mutations require the current revision and a unique requestId; retry an uncertain request with the SAME arguments and ID. Resolve returned continuations rather than repeating the original action. This server is the mechanical authority, not a tactical planner or rules database.';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const assert=(condition,message,code='INVALID_INPUT')=>{if(!condition){const e=Error(message);e.code=code;throw e;}};
const canonical=v=>Array.isArray(v)?v.map(canonical):object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export function assertJson(value,depth=0){
 assert(depth<=60,'Input nesting exceeds limit');
 if(value===null||typeof value==='boolean'||typeof value==='string')return;
 if(typeof value==='number'){assert(Number.isFinite(value),'JSON numbers must be finite');return;}
 assert(Array.isArray(value)||object(value),'Only JSON values are supported');
 if(object(value))assert([Object.prototype,null].includes(Object.getPrototypeOf(value)),'Only plain JSON objects are supported');
 for(const [key,v] of Object.entries(value)){assert(!['__proto__','prototype','constructor'].includes(key),'Reserved object key');assertJson(v,depth+1);}
}
export function bounded(value,{offset=0,limit=20,path=''}={}){
 assert(Number.isInteger(offset)&&offset>=0&&Number.isInteger(limit)&&limit>=1&&limit<=100,'Page needs offset >= 0 and limit 1–100');
 assert(typeof path==='string'&&(path===''||path.startsWith('/')),'Path must be an empty string or JSON pointer');
 let selected=value;
 for(const part of path.split('/').slice(1)){const key=part.replaceAll('~1','/').replaceAll('~0','~');assert(selected!==null&&typeof selected==='object'&&Object.hasOwn(selected,key),'Unknown result path');selected=selected[key];}
 const omissions=[];let budget=1200;
 const copy=(v,p,depth=0)=>{
  if(--budget<0||depth>12){omissions.push(p);return {omitted:true};}
  if(typeof v==='string'&&v.length>1500){omissions.push(p);return v.slice(0,1500)+'…';}
  if(Array.isArray(v)){if(v.length>limit)omissions.push(p);return v.slice(0,limit).map((x,i)=>copy(x,p+'/'+i,depth+1));}
  if(object(v)){const entries=Object.entries(v);if(entries.length>100)omissions.push(p);return Object.fromEntries(entries.slice(0,100).map(([k,x])=>[k,copy(x,p+'/'+k.replaceAll('~','~0').replaceAll('/','~1'),depth+1)]));}
  return v??null;
 };
 const array=Array.isArray(selected),record=object(selected),entries=record?Object.entries(selected):null,total=array?selected.length:record?entries.length:0;
 const page=array?selected.slice(offset,offset+limit):record?Object.fromEntries(entries.slice(offset,offset+limit)):selected;
 const data=array?page.map((v,i)=>copy(v,path+'/'+(offset+i))):copy(page,path);
 return {data,page:array||record?{kind:array?'array':'object',offset,total,nextOffset:offset+limit<total?offset+limit:null}:null,
  truncated:omissions.length>0,omittedPaths:[...new Set(omissions)].slice(0,50)};
}
export function continuations(game){
 const s=game.s,out=[];
 const add=(kind,owner,context,choices)=>out.push({kind,owner,context,choices});
 if(s.interrupt){
  if(s.interrupt.type==='rider_choice'){
   const r=s.pendingRider,modes=(r?.kind||'grab')==='grab'?['normal','appendage','decline']:['normal','decline'];
   add('rider','action',clone(s.interrupt),modes.map(mode=>({op:'resolve_rider',actor:r.actor,mode})));
  }else add('interrupt','action',clone(s.interrupt),[true,false].map(take=>({op:'resolve_interrupt',take})));
 }
 if(s.pendingSpellCast&&!s.interrupt){
  const cast=s.pendingSpellCast;
  for(const actor of (cast.threats||[]).filter(id=>!(cast.handled||[]).includes(id)))add('casting_aoo','gm',{actor,caster:cast.actor},[true,false].map(take=>({op:'gm_resolve_casting_aoo',actor,take})));
  for(const id of game.remainingCounterspells())add('counterspell','gm',{id,caster:cast.actor},[{op:'gm_resolve_counterspell',id,take:false},{op:'gm_resolve_counterspell',id,take:true,perceived:true}]);
  if(!out.length)add('casting_resume','gm',{caster:cast.actor},[{op:'gm_continue_spell'}]);
 }
 if(s.pendingTimeEvent)add('time_event','gm',clone(s.pendingTimeEvent),[{op:'gm_acknowledge_time_event',reason:'<GM resolution>'}]);
 if(s.pendingInitiativeEvent)add('initiative_event','gm',clone(s.pendingInitiativeEvent),[{op:'gm_acknowledge_initiative_event',reason:'<GM resolution>'}]);
 for(const id of s.pendingEventDecisions||[]){const e=s.pendingEvents.find(e=>e.id===(typeof id==='string'?id:id.id));add('pending_event','gm',e?{id:e.id,label:e.label,kind:e.kind,action:e.action}:id,[{op:'gm_resolve_pending_event',id:e?.id??id,reason:'<GM resolution>'}]);}
 for(const cast of s.activeSpellCasts||[]){
  if(cast.status==='ready')add('casting_complete','action',{actor:cast.actor,spell:cast.spell.name},[{op:'complete_spell',actor:cast.actor}]);
  else if(cast.actor===game.active()?.id&&cast.paidRound!==s.round)add('casting_continue','action',{actor:cast.actor,spell:cast.spell.name},[{op:'continue_spell',actor:cast.actor},{op:'cancel_spell',actor:cast.actor}]);
 }
 if(s.pendingFullAttack&&!s.interrupt&&!s.pendingRider)add('full_attack','action',{actor:s.pendingFullAttack.actor,remaining:s.pendingFullAttack.slots.length-s.pendingFullAttack.index},[{op:'full_attack_next',actor:s.pendingFullAttack.actor,target:'<choose target>'},{op:'finish_full_attack',actor:s.pendingFullAttack.actor}]);
 return out;
}
export class AIAdapter{
 constructor({game=null,saved=null,persist=null,demo=false}={}){
  this.persist=persist;this.renderArtwork=createArtworkRenderer();
  if(saved){
   assert(saved.format==='tabletop-kernel-session/1'&&SUPPORTED_SESSION_VERSIONS.has(saved.engineVersion),'Unsupported session format/version');
   assert(typeof saved.instanceId==='string'&&Number.isSafeInteger(saved.sequence)&&saved.sequence>=0&&Array.isArray(saved.receipts),'Invalid session header');
   this.game=new Kernel(saved.game.s);Object.assign(this.game,clone(saved.game));
   this.instanceId=saved.instanceId;this.sequence=saved.sequence;this.receipts=clone(saved.receipts);this.lastResult=clone(saved.lastResult??null);
  }else{
   const state=initialState();if(!demo){state.creatures=[];state.tiles={};state.log=[];state.seed=randomInt(1,2147483647);}
   this.game=game||new Kernel(state);this.instanceId=randomUUID();this.sequence=0;this.receipts=[];this.lastResult=null;
  }
 }
 get revision(){return `${this.instanceId}:${this.sequence}`;}
 snapshot(){return {format:'tabletop-kernel-session/1',engineVersion:ENGINE_VERSION,instanceId:this.instanceId,sequence:this.sequence,
  game:{s:this.game.exportState(),turnStart:clone(this.game.turnStart),roundStart:clone(this.game.roundStart),previousTurnStart:clone(this.game.previousTurnStart)},receipts:clone(this.receipts),lastResult:clone(this.lastResult)};}
 status({offset=0,limit=20,target,view='encounter'}={}){
  const g=this.game,s=g.s;
  assert(Number.isInteger(offset)&&offset>=0&&Number.isInteger(limit)&&limit>=1&&limit<=100,'Status page needs offset >= 0 and limit 1–100');
  assert(['encounter','continuations'].includes(view),'Unknown status view');
  const pending=continuations(g);
  if(view==='continuations')return {revision:this.revision,...bounded(pending,{offset,limit})};
  if(target!==undefined)g.find(target);
  const all=target?[g.find(target)]:s.creatures;
  const rows=all.slice(offset,offset+limit).map(c=>({id:c.id,name:c.name,team:c.team,x:c.x,y:c.y,size:c.size,elevation:c.elevation??null,
   hp:c.hp,maxHp:c.maxHp,health:g.healthState(c.id).status,nonlethal:g.nonlethalTotal(c.id),nonlethalStatus:g.nonlethalState(c.id).status,
   conditions:[...new Set(s.conditionInstances.filter(e=>e.target===c.id).map(e=>e.condition))],canAct:g.canAct(c.id),
   ...(target?{classification:g.classification(c.id),stats:Object.fromEntries(['ac','touchAc','flatFootedAc','fort','ref','will','attack','damage','cmb','cmd'].map(k=>[k,g.stat(c.id,k)]).concat([['speed',c.speed]])),statNotes:'speed is configured base feet per move; conditions, terrain, posture and spatial rulings can limit actual movement',definition:c.definitionId??null,combat:g.combatOverview(c.id)[0]}:{} )}));
  return {engineVersion:ENGINE_VERSION,revision:this.revision,clock:g.gameTime(),round:s.round,active:g.active()?.id??null,initiativeActive:!!s.initiative?.enabled,
   actions:clone(s.actions),map:{width:s.width,height:s.height,name:s.scene.name,established:s.scene.established,featureCount:s.scene.features.length,playerVisibility:playerVisibilityStatus(s),artwork:artworkSummary(s),savedMapCount:Object.keys(s.savedMaps||{}).length},
   creatures:rows,page:{offset,total:all.length,nextOffset:offset+limit<all.length?offset+limit:null},
   unresolved:{actions:unresolvedActions(s),decisions:unresolvedDecisions(s)},continuations:pending.slice(0,20),continuationPage:{total:pending.length,nextOffset:pending.length>20?20:null},
   warnings:g.spatialAdvisories().slice(0,20),storage:this.persist?'saved after every accepted mutation':'memory only'};
 }
 query({command,path='',offset=0,limit=20}={}){
  assertJson(command);assert(object(command)&&COMMANDS[command.op]?.channel==='query','Use a catalogued read-only command','WRONG_CHANNEL');
  const result=command.op==='gm_preview_player_view'?this.renderArtwork(this.game.s).projection:this.game.dispatch(command,'gm');return {revision:this.revision,...bounded(result,{path,offset,limit})};
 }
 result({requestId,path='',offset=0,limit=20}={}){
  assert(this.lastResult&&this.lastResult.requestId===requestId,'Only the latest accepted command has full result details; inspect current state for older actions','RESULT_EXPIRED');
  return {revision:this.revision,requestId,...bounded(this.lastResult.result,{path,offset,limit})};
 }
 execute(channel,{command,expectedRevision,requestId,reason}={}){
  assert(['action','gm'].includes(channel),'Unknown mutation channel');assertJson(command);
  assert(object(command)&&typeof command.op==='string','Command needs op');
  assert(typeof requestId==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(requestId),'requestId must be 1–80 letters/digits/_/-');
  assert(typeof expectedRevision==='string','Supply the current expectedRevision');
  const entry=Object.hasOwn(COMMANDS,command.op)?COMMANDS[command.op]:null;assert(entry&&entry.channel!=='query','Unknown/mutating command required; inspect catalog','WRONG_CHANNEL');
  assert(channel==='gm'||entry.channel==='action','Setup and adjudication require kernel_gm','WRONG_CHANNEL');
  if(channel==='gm')assert(typeof reason==='string'&&reason.trim().length>0&&reason.length<=500,'GM operations require a reason');
  const digest=createHash('sha256').update(JSON.stringify(canonical({channel,command,expectedRevision,reason:reason??null}))).digest('hex');
  const receipt=this.receipts.find(r=>r.requestId===requestId);
  if(receipt){assert(receipt.digest===digest,'requestId was already used with different arguments','REQUEST_ID_CONFLICT');return {...clone(receipt.response),replayed:true,currentRevision:this.revision};}
  assert(expectedRevision===this.revision,'State changed; call kernel_status and reconsider before issuing a new request','STALE_REVISION');
  assert(this.sequence<Number.MAX_SAFE_INTEGER,'Revision counter exhausted');
  const before={sequence:this.sequence,receipts:this.receipts,lastResult:this.lastResult};
  try{return this.game.transaction(()=>{
   const dispatchCommand=clone(command);
   if(command.op==='gm_set_map_artwork'&&typeof command.image==='string')dispatchCommand.image=normalizeArtwork(command.image);
   if(channel==='gm'&&dispatchCommand.reason===undefined)dispatchCommand.reason=reason;
   const result=this.game.dispatch(dispatchCommand,channel==='action'?'actor':'gm');
   if(channel==='gm')this.game.note(`AI GM adjudication ${command.op}: ${reason}`);
   this.sequence++;this.lastResult={requestId,result:result??null};
   const response={ok:true,requestId,revision:this.revision,replayed:false,result:bounded(result),state:this.status()};
   this.receipts=[...this.receipts,{requestId,digest,response:clone(response)}].slice(-64);
   // Persist before acknowledging. A storage failure restores all engine checkpoints too.
   if(this.persist)this.persist(this.snapshot());
   return response;
  });}catch(error){
   Object.assign(this,before);
   throw error;
  }
 }
 catalog(args){return discover(args);}
}
