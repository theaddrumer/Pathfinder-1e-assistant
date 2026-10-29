/** V3.30: fixed persistent regions. Geometry, spell payloads and Pending Events
 * retain ownership; the event payload is the only stored area record.
 */
import {SummonsGame} from './summons.mjs';
import {clone} from './core.mjs';
import {toRounds} from './ailments.mjs';
import {spellArea,spellGridDistance} from './spell_geometry.mjs';
import {mapClearRay,mapRayFeatures} from './map_geometry.mjs';
const areaObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export class PersistentAreasGame extends SummonsGame {
 persistentAreaEvents(){return (this.s.pendingEvents||[]).filter(e=>e.kind==='persistent_area'&&e.status==='active');}
 persistentAreaEvent(id){return this.persistentAreaEvents().find(e=>e.id===id);}
 validatePersistentAreaSpell(spell){
  const p=spell.persistent;this.validateExposure?.(p.exposure);
  this.assert(areaObject(p)&&Object.keys(p).every(k=>['duration','triggers','affects','frequency','effectScope','dispellable','exposure'].includes(k)),'Invalid persistent area settings');
  this.assert(spell.area&&!spell.delivery&&!spell.dispel&&!spell.counterspell,'Persistent spells need a fixed area and ordinary payload');
  if(spell.concentration)this.assert(p.duration==null,'Concentration owns the area duration; use concentration.maxRounds');
  else{
   this.assert(areaObject(p.duration)&&Object.keys(p.duration).every(k=>['count','unit','atScore'].includes(k)),'Area duration needs count/unit and optional atScore');
   const rounds=toRounds(p.duration);
   this.assert(Number.isInteger(rounds)&&rounds>=1&&rounds<=100000,'Area duration must be 1–100000 rounds');
   this.assert(p.duration.atScore===undefined||Number.isInteger(p.duration.atScore)&&Math.abs(p.duration.atScore)<=1000000,'Invalid area initiative score');
   this.assert(p.duration.atScore===undefined||this.s.initiative.enabled,'Area atScore requires active initiative');
  }
  this.assert(p.triggers===undefined||Array.isArray(p.triggers)&&p.triggers.length>0&&p.triggers.length<=3&&new Set(p.triggers).size===p.triggers.length&&p.triggers.every(t=>['create','enter','turn_start'].includes(t)),'Invalid persistent area triggers');
  this.assert(p.affects===undefined||['all','allies','enemies'].includes(p.affects),'Invalid area team filter');
  this.assert(p.frequency===undefined||['once_per_round','each_trigger'].includes(p.frequency),'Invalid area trigger frequency');
  this.assert(p.effectScope===undefined||['inside','duration'].includes(p.effectScope),'Invalid area modifier scope');
  this.assert(p.dispellable===undefined||typeof p.dispellable==='boolean','Invalid area dispellable flag');
 }
 validatePersistentAreaEvent({actor,payload,duration,requiresInput}){
  this.assert(this._registeringArea,'Create persistent areas through a spell with persistent settings');
  this.assert(actor===null&&areaObject(payload)&&!requiresInput&&(payload.spell.concentration?duration?.type==='indefinite':['time','initiative'].includes(duration?.type)&&duration.onExpire==='expire'),'Invalid persistent area timer');
 }
 persistentAreaGeometry(event){return spellArea(this.s,event.payload.spell.area);}
 persistentAreaTargets(event,geometry=this.persistentAreaGeometry(event)){
  const p=event.payload;
  return geometry.affected.filter(id=>{const c=this.find(id);return !c.summonDeparture&&this.exposureAllowed(c,p.exposure)&&(p.affects==='all'||(p.affects==='allies'?c.team===p.team:c.team!==p.team));});
 }
 persistentAreasOverview(){
  return this.persistentAreaEvents().map(e=>{const geometry=this.persistentAreaGeometry(e),p=e.payload;return {
   id:e.id,label:e.label,caster:p.spellSource.actor,castingId:p.spellSource.id,
   duration:clone(e.duration),remainingRounds:e.duration.type==='indefinite'?null:e.duration.type==='time'?Math.max(0,e.duration.at-this.s.worldRounds):Math.max(0,e.duration.round-this.s.round),
   exposure:clone(p.exposure||{mode:'volume'}),area:clone(p.spell.area),cells:geometry.cells,affected:this.persistentAreaTargets(e,geometry),
   triggers:clone(p.triggers),frequency:p.frequency,affects:p.affects,effectScope:p.effectScope,dispellable:p.spellSource.dispellable};});
 }
 createPersistentArea(actor,spell,spellSource){
  this.assert(this.persistentAreaEvents().length<64,'Too many persistent areas');
  const spec=spell.persistent,rounds=spell.concentration?null:toRounds(spec.duration),init=this.s.initiative.enabled;
  const score=spec.duration?.atScore??this.s.initiative.entries.find(e=>e.id===actor)?.score;
  this.assert(!init||Number.isInteger(score),'Persistent area source needs an initiative position or explicit atScore');
  const duration=spell.concentration?{type:'indefinite'}:init?{type:'initiative',afterRounds:rounds,atScore:score,onExpire:'expire'}:{type:'time',count:rounds,unit:'round',onExpire:'expire'};
  let id;do{id=`area_${++this.s.spellSerial}`;}while(this.s.creatures.some(c=>c.id===id)||this.s.pendingEvents.some(e=>e.id===id)||this.s.pendingEventHistory.some(e=>e.id===id));
  const template=clone(spell);delete template.persistent;delete template.resource;
  const payload={spell:template,spellSource:clone(spellSource),team:this.find(actor).team,initiativeScore:score??null,
   triggers:clone(spec.triggers||['create','enter','turn_start']),affects:spec.affects||'all',frequency:spec.frequency||'once_per_round',
   exposure:clone(spec.exposure||spell.exposure||{mode:'volume'}),effectScope:spec.effectScope||'inside',present:[],hitAt:{},modifierEligible:{},resistanceCache:{},nextAt:this.s.worldRounds+1};
  this._registeringArea=true;
  try{this.registerPendingEvent({id,label:spell.name,kind:'persistent_area',actor:null,requiresInput:false,
   trigger:'Automatically apply the declared area payload on its registered triggers; expire at the deadline.',duration,payload});}
  finally{this._registeringArea=false;}
  const e=this.persistentAreaEvent(id);e.payload.present=this.persistentAreaTargets(e);
  const resolution=e.payload.triggers.includes('create')?this.exposePersistentArea(e,e.payload.present,'create'):null;
  this.syncZones();
  return {status:'persistent_area',spell:spell.name,caster:actor,castingId:spellSource.id,areaId:id,duration:clone(e.duration),initial:resolution};
 }
 exposePersistentArea(e,targets,trigger){
  if(!this.persistentAreaEvent(e.id))return null;
  const p=e.payload;targets=targets.filter(id=>this.s.creatures.some(c=>c.id===id&&this.canBeAttacked(id)&&!c.summonDeparture)&&
   (p.frequency==='each_trigger'||p.hitAt[id]!==this.s.worldRounds));
  if(!targets.length)return null;
  for(const id of targets)p.hitAt[id]=this.s.worldRounds;
  const spell=clone(p.spell);
  this.note(`Persistent area ${e.id}: ${trigger} (${targets.join(', ')}).`);
  // Same caster-level/SR result is retained for this area and recipient. Saves
  // follow the explicit repeated payload. No new casting or slot expenditure.
  const resolution=this.resolveSpellPayload(p.spellSource.actor,spell,{spellSource:p.spellSource,resistanceCache:p.resistanceCache,areaEvent:e,targetIds:targets});
  if(p.spell.effect&&p.effectScope==='inside')for(const row of resolution.targets)
   p.modifierEligible[row.target]=this.s.effects.filter(effect=>effect.areaEventId===e.id&&effect.target===row.target).map(effect=>effect.spellPayloadKey||'mods');
  return resolution;
 }
 restoreAreaModifiers(e,inside){
  const p=e.payload;if(!p.spell.effect||p.effectScope!=='inside')return;
  // Re-entry during the cooldown restores the already-qualified occupancy
  // parts without another save, damage/healing roll or SR attempt. A previously
  // immune condition must not return alongside an eligible numeric modifier.
  // Accept V3.30/31's boolean eligibility for its single numeric payload.
  const spell=clone(p.spell);delete spell.components;delete spell.healing;delete spell.save;delete spell.spellResistance;
  for(const target of inside){
   const eligible=p.modifierEligible[target],keys=Array.isArray(eligible)?eligible:eligible?['mods']:[];
   const missing=keys.filter(key=>!this.s.effects.some(effect=>effect.areaEventId===e.id&&effect.target===target&&(effect.spellPayloadKey||'mods')===key));
   if(missing.length)this.resolveSpellPayload(p.spellSource.actor,spell,{spellSource:p.spellSource,areaEvent:e,targetIds:[target],allowedEffectKeys:missing});
  }
 }
 clearAreaModifiers(e,inside=[]){
  const keep=new Set(inside);
  for(const effect of [...this.s.effects])if(effect.areaEventId===e.id&&effect.areaEffectScope==='inside'&&!keep.has(effect.target))
   this.removeEffect(effect.id,{countAsAction:false});
 }
 syncPersistentAreas(){
  if(this._syncingAreas||!this.persistentAreaEvents().length)return;
  this._syncingAreas=true;
  try{for(let attempt=0;attempt<24;attempt++){
   let changed=false;
   for(const e of this.persistentAreaEvents()){
    const p=e.payload,inside=this.persistentAreaTargets(e),entered=inside.filter(id=>!p.present.includes(id));
    changed ||= entered.length>0||p.present.some(id=>!inside.includes(id));p.present=inside;
    this.clearAreaModifiers(e,inside);
    if(p.triggers.includes('enter')){this.exposePersistentArea(e,entered,'enter');this.restoreAreaModifiers(e,entered);}
   }
   if(!changed)return;
   this.assert(attempt<23,'Persistent area trigger iteration limit');
  }}finally{this._syncingAreas=false;}
 }
 syncZones(){const result=super.syncZones();this.syncPersistentAreas();return result;}
 emit(name,payload={}){
  const result=super.emit(name,payload);
  if(name==='turn_start'){
   this.syncPersistentAreas();
   for(const e of this.persistentAreaEvents())if(e.payload.triggers.includes('turn_start')&&e.payload.present.includes(payload.actor))
    this.exposePersistentArea(e,[payload.actor],'turn_start');
  }
  return result;
 }
 onClockExpirations(){
  for(const e of this.persistentAreaEvents())if(e.duration.type==='time'&&e.duration.at<=this.s.worldRounds)
   this.expirePendingEvent(e,'clock deadline');
 }
 onPendingClockAdvanced(){
  // Expiration resolves first, including when a recurrence shares its deadline.
  const result=super.onPendingClockAdvanced();
  this.syncPersistentAreas();
  for(const e of this.persistentAreaEvents()){
   const p=e.payload;
   if(this._advancingCastTime&&p.triggers.includes('turn_start')&&p.nextAt<=this.s.worldRounds)
    this.exposePersistentArea(e,p.present,'elapsed round');
   p.nextAt=this.s.worldRounds+1;
  }
  return result;
 }
 concludePendingEvent(event,outcome,reason){
  if(event.kind==='persistent_area')this.clearAreaModifiers(event);
  return super.concludePendingEvent(event,outcome,reason);
 }
 persistentAreaInteractionRange(actor,id,spell){
  const c=this.find(actor),e=this.persistentAreaEvent(id),point=e.payload.spell.area.origin;
  const starts=this.footprint(c).map(p=>({x:p.x+.5,y:p.y+.5}));
  const range=spell.rangeFeet??(100+10*spell.casterLevel);
  this.assert(Math.min(...this.footprint(c).map(p=>spellGridDistance(p.x-point.x,p.y-point.y)*5))<=range,'Spell target beyond range');
  this.assert(starts.some(start=>mapClearRay(this.s,start,point)),'Spell target has no line of effect');
  this.assert(starts.some(start=>!mapRayFeatures(this.s,start,point).some(f=>f.properties.sight==='block')),'Spell target cannot be perceived');
  this.assert(!this.hasCondition(actor,'blinded'),'Spell target cannot be perceived');
 }
 inspect(){return {...super.inspect(),persistentAreas:this.persistentAreasOverview()};}
 lifecycleStatus(){return {...super.lifecycleStatus(),persistentAreas:this.persistentAreasOverview()};}
}
