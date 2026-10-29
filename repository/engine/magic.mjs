/** V3.27 — spell resources, casting-linked dispels and native Ready counters.
 * No spell database, tactical AI, automatic AoO choices or untrusted scripts.
 */
import {CollectiveGame} from './collectives.mjs';
import {clone,abilityMod,newTurnActions} from './core.mjs';
import {spellArea,spellGridDistance} from './spell_geometry.mjs';
import {mapClearRay} from './map_geometry.mjs';
import {unresolvedActions,unresolvedDecisions,isReadOnlyCommand,unlinkEffectDeadlines} from './lifecycle.mjs';
import {toRounds} from './ailments.mjs';
import {validateCriticalProfile} from './critical_rules.mjs';
import {STANDARD_CONDITION_IDS} from './conditions.mjs';
import {EFFECT_TAGS} from './trait_library.mjs';
const magicInt=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
const magicText=s=>typeof s==='string'&&s.trim().length>0&&s.length<=120;
const magicObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
// HP/life transitions belong to vitality, never an expiring condition bundle.
export const SPELL_CONDITION_IDS=Object.freeze(STANDARD_CONDITION_IDS.filter(id=>!['dead','dying','stable','disabled'].includes(id)));
export class MagicGame extends CollectiveGame {
 constructor(state){
  super(state);this.s.spellSerial ||= 0;this.s.pendingSpellCast ||= null;
  this.s.activeSpellCasts ||= [];this.s.castingSerial ||= 0;this.s.spellCastHistory ||= [];
  this.s.spellInstanceSerial ||= 0;
  this.turnStart=clone(this.s);this.roundStart=clone(this.s);
 }
 concentrationEvents(){return this.s.pendingEvents.filter(e=>e.kind==='concentration'&&e.status==='active');}
 concentrationFor(actor){return this.concentrationEvents().find(e=>e.actor===actor&&e.payload.phase==='maintaining');}
 focusFor(actor){return this.castingFor(actor)||this.concentrationFor(actor)?.payload;}
 validateConcentrationSpell(spell){
  const c=spell.concentration;
  this.assert(magicObj(c)&&Object.keys(c).every(k=>['maxRounds','afterRounds'].includes(k)),'Invalid concentration settings');
  if(c.maxRounds!==undefined)this.assert(magicInt(c.maxRounds,1,100000),'Invalid concentration maximum');
  if(c.afterRounds!==undefined)this.assert(magicInt(c.afterRounds,0,100000),'Invalid post-concentration duration');
  this.assert(!spell.delivery&&!spell.dispel&&!spell.counterspell&&(spell.effect||spell.area),'Concentration needs an ongoing effect or fixed area, without attack delivery/dispel/counterspell');
 }
 validateConcentrationEvent({actor,payload,duration,requiresInput}){
  this.assert(this._registeringConcentration&&payload?.actor===actor&&!requiresInput&&['indefinite','time','initiative'].includes(duration?.type),'Create concentration through its spell payload');
 }
 beginConcentration(actor,spell,spellSource){
  this.assert(!this.concentrationFor(actor),'Stop concentration before maintaining another spell');
  this.assert(!this.castingFor(actor),'Complete or cancel the ongoing casting before starting maintained concentration');
  this.assert(spell.effect||spell.persistent,'Concentration needs a persistent area or ongoing effect');
  const id=`concentration_${++this.s.spellSerial}`,max=spell.concentration.maxRounds;
  const score=this.s.initiative.entries.find(e=>e.id===actor)?.score;
  this.assert(!max||!this.s.initiative.enabled||Number.isInteger(score),'Concentration maximum needs caster initiative');
  const duration=!max?{type:'indefinite'}:this.s.initiative.enabled?{type:'initiative',afterRounds:max,atScore:score,onExpire:'expire'}:{type:'time',count:max,unit:'round',onExpire:'expire'};
  const checkSpell={name:spell.name,level:spell.level,casterLevel:spell.casterLevel,...(spell.ability?{ability:spell.ability}:{}),...(spell.concentrationBonus!==undefined?{concentrationBonus:spell.concentrationBonus}:{})};
  this._registeringConcentration=true;
  try{this.registerPendingEvent({id,label:`Concentrating: ${spell.name}`,kind:'concentration',actor,requiresInput:false,
   trigger:'Spend a standard action each subsequent turn; stop or failed concentration ends the linked spell.',duration,
   payload:{maintenanceEventId:id,actor,spell:checkSpell,spellSource:clone(spellSource),phase:'maintaining',afterRounds:spell.concentration.afterRounds||0,
    needsMaintenance:false,coversDeferredStart:this.s.deferredTurnStart?.actor===actor,continuousChecks:{}}});}
  finally{this._registeringConcentration=false;}
  return id;
 }
 concentrationOverview(){return this.concentrationEvents().map(e=>({id:e.id,actor:e.actor,spell:e.payload.spell.name,castingId:e.payload.spellSource.id,
  phase:e.payload.phase,needsMaintenance:e.payload.needsMaintenance,duration:clone(e.duration),afterRounds:e.payload.afterRounds}));}
 maintainConcentration({actor}={}){
  const e=this.concentrationFor(actor);this.assert(e,'No maintained spell for this creature');
  this.assert(actor===this.active()?.id,'Only the active creature may maintain concentration');
  this.assert(unresolvedActions(this.s).length===0&&unresolvedDecisions(this.s).length===0,'Resolve pending operation before maintaining concentration');
  this.assert(e.payload.needsMaintenance,'Concentration is already covered this turn');
  this.spendAction(actor,'standard',`Maintain ${e.payload.spell.name}`);
  e.payload.needsMaintenance=false;
  // Same contextual checks as casting; no defensive check or new casting AoO.
  const failure=this.initialCastingChecks(actor,e.payload.spell,e.payload,false);
  return failure||{status:'maintaining',id:e.id,castingId:e.payload.spellSource.id};
 }
 stopConcentration({actor,reason='caster voluntarily stops concentrating'}={}){
  const e=this.concentrationFor(actor);this.assert(e,'No maintained spell for this creature');
  this.assert(typeof reason==='string'&&reason.trim().length>0&&reason.length<=500,'Stopping concentration needs a reason');
  return this.stopConcentrationEvent(e,reason);
 }
 stopConcentrationEvent(e,reason){
  const rounds=e.payload.afterRounds;
  if(!rounds){this.concludePendingEvent(e,'ended',reason);return {status:'ended',id:e.id,reason};}
  const old=e.duration,score=this.s.initiative.entries.find(x=>x.id===this.active()?.id)?.score;
  let duration=this.s.initiative.enabled?{type:'initiative',round:this.s.round+rounds,score,onExpire:'expire'}:{type:'time',at:this.s.worldRounds+rounds,onExpire:'expire'};
  // The original maximum is an absolute cap, including the lingering tail.
  if(old.type==='time'&&old.at<duration.at||old.type==='initiative'&&(old.round<duration.round||old.round===duration.round&&old.score>duration.score))duration=clone(old);
  e.duration=duration;e.payload.phase='lingering';e.payload.needsMaintenance=false;e.label=`Lingering: ${e.payload.spell.name}`;
  this.note(`${e.payload.spell.name}: concentration ends (${reason}); its declared lingering duration remains.`);
  return {status:'lingering',id:e.id,reason,duration:clone(duration)};
 }
 concentrationLinks(e){
  const id=e.payload.spellSource.id;
  return {effects:this.s.effects.filter(x=>x.spellSource?.id===id),areas:this.persistentAreaEvents().filter(x=>x.payload.spellSource.id===id)};
 }
 reconcileConcentration(){
  for(const e of this.concentrationEvents()){
   const links=this.concentrationLinks(e);
   if(!links.effects.length&&!links.areas.length){this.concludePendingEvent(e,'ended','no linked spell effects remain');continue;}
   if(e.payload.phase==='lingering'&&e.payload.departedSource)continue;
   const c=this.s.creatures.find(c=>c.id===e.actor);
   if(!c||c.summonDeparture){this.concludePendingEvent(e,'ended','caster departed');continue;}
   if(e.payload.phase==='maintaining'&&this.castingIncapacitated(e.actor))this.stopConcentrationEvent(e,'caster incapacitated');
  }
 }
 concludePendingEvent(event,outcome,reason){
  if(event.kind!=='concentration')return super.concludePendingEvent(event,outcome,reason);
  const links=this.concentrationLinks(event),result=super.concludePendingEvent(event,outcome,reason);
  for(const area of links.areas)if(this.s.pendingEvents.includes(area))this.concludePendingEvent(area,outcome,reason);
  for(const effect of links.effects)this.removeEffect(effect.id,{countAsAction:false});
  return result;
 }
 onPendingTurnStart(actor){
  super.onPendingTurnStart(actor);
  const e=this.concentrationFor(actor);
  if(e){e.payload.needsMaintenance=!e.payload.coversDeferredStart;e.payload.coversDeferredStart=false;}
 }
 onPendingTurnEnd(actor){
  const e=this.concentrationFor(actor);
  if(e?.payload.needsMaintenance)this.stopConcentrationEvent(e,'required maintenance action was skipped');
  return super.onPendingTurnEnd(actor);
 }
 onClockExpirations(){
  super.onClockExpirations();
  for(const e of this.concentrationEvents())if(e.duration.type==='time'&&e.duration.at<=this.s.worldRounds)this.expirePendingEvent(e,'concentration duration expired');
 }
 castingRounds(time='standard'){
  if(time==='1_round')return 1;
  if(magicObj(time)){
   this.assert(Object.keys(time).every(k=>['count','unit'].includes(k))&&magicInt(time.count,1,100000)&&['round','minute','hour','day'].includes(time.unit),'Invalid casting duration');
   const rounds=toRounds(time);this.assert(rounds<=100000,'Casting duration exceeds 100000 rounds');return rounds;
  }
  this.assert(['standard','move','swift','full_round'].includes(time),'Unsupported casting action');return 0;
 }
 previewSpellArea(area){return spellArea(this.s,area);}
 validateSpell(spell){
  this.assert(magicObj(spell)&&magicText(spell.name),'Spell needs a name');
  this.validateExposure(spell.exposure);
  this.assert(spell.exposure===undefined||spell.area!==undefined,'Spell exposure applies to area spells');
  this.assert(!(spell.exposure&&spell.persistent?.exposure),'Declare area exposure once, on the spell or persistent settings');
  this.assert(Object.keys(spell).every(k=>['name','level','casterLevel','castingTime','defensive','concentrationBonus','ability','area','targets','save','spellResistance','components','healing','effect','delivery','spellId','sourceKind','rangeFeet','dispel','counterspell','resource','persistent','concentration','exposure','targeting'].includes(k)),'Unknown spell field');
  this.assert(spell.targeting===undefined||spell.targeting==='unrestricted'&&!spell.area&&!spell.dispel&&!spell.counterspell,'targeting:unrestricted is only for a published non-area effect without a specific creature-count limit');
  if(spell.resource!==undefined)this.validateResourceSelector(spell.resource);
  this.assert(magicInt(spell.level,0,9)&&magicInt(spell.casterLevel,1,100),'Spell level and caster level are required');
  if(spell.spellId!==undefined)this.assert(magicText(spell.spellId),'Invalid canonical spell identity');
  if(spell.sourceKind!==undefined)this.assert(['spell','spell_like'].includes(spell.sourceKind),'Invalid spell source kind');
  if(spell.rangeFeet!==undefined)this.assert(magicInt(spell.rangeFeet,0,100000)&&(spell.dispel||spell.counterspell),'rangeFeet here requires a dispel or counterspell; attacks use delivery.rangeFeet');
  this.castingRounds(spell.castingTime);
  if(spell.defensive!==undefined)this.assert(typeof spell.defensive==='boolean','Invalid defensive cast flag');
  if(spell.concentrationBonus!==undefined)this.assert(magicInt(spell.concentrationBonus,-100,400),'Invalid concentration bonus');
  if(spell.ability!==undefined)this.assert(['int','wis','cha'].includes(spell.ability),'Invalid spellcasting ability');
  if(spell.delivery!==undefined){
   const d=spell.delivery;
   this.assert(magicObj(d)&&['touch','ray'].includes(d.type)&&Object.keys(d).every(k=>['type','rangeFeet','attackOffset','attackAbility','criticalThreat','criticalMultiplier','improvedCritical','charges','attemptOnCast'].includes(k)),'Invalid spell delivery');
   this.assert(spell.area===undefined,'Attack-delivered spells cannot also define an area');
   if(d.type==='ray')this.assert(magicInt(d.rangeFeet,5,100000)&&d.charges===undefined&&d.attemptOnCast===undefined,'Rays need rangeFeet and cannot hold charges');
   else this.assert(d.rangeFeet===undefined&&(d.charges===undefined||magicInt(d.charges,1,1000))&&(d.attemptOnCast===undefined||typeof d.attemptOnCast==='boolean'),'Invalid touch delivery');
   if(d.attackOffset!==undefined)this.assert(magicInt(d.attackOffset,-1000,1000),'Invalid spell attack offset');
   if(d.attackAbility!==undefined)this.assert(['str','dex','none'].includes(d.attackAbility),'Invalid spell attack ability');
   validateCriticalProfile(d);
  }
  if(spell.concentration!==undefined)this.validateConcentrationSpell(spell);
  if(spell.persistent!==undefined)this.validatePersistentAreaSpell(spell);
  const areaDispel=!!spell.dispel&&spell.targets?.length===1&&typeof spell.targets[0]==='string'&&/^area_[0-9]+$/.test(spell.targets[0])&&!this.s.creatures.some(c=>c.id===spell.targets[0]);
  const touch=spell.delivery?.type==='touch';
  this.assert(touch&&spell.area===undefined||(spell.area!==undefined)!==(spell.targets!==undefined),'Provide an area OR list of targets');
  if(spell.area!==undefined)spellArea(this.s,spell.area);
  else if(areaDispel){/* Explicit area ID is a dispel target, not a creature token. */}
  else if(!touch||spell.targets!==undefined)this.assert(Array.isArray(spell.targets)&&spell.targets.length>=(touch?0:1)&&spell.targets.length<=(touch?1:50)&&spell.targets.every(t=>typeof t==='string'&&this.s.creatures.some(c=>c.id===t))&&(spell.delivery?.type==='ray'||new Set(spell.targets).size===spell.targets.length),'Invalid spell targets');
  if(touch&&spell.delivery.attemptOnCast)this.assert(spell.targets?.length===1,'Immediate touch delivery needs one target');
  if(spell.save!==undefined){
   const s=spell.save;
   this.assert(magicObj(s)&&['fort','ref','will'].includes(s.type)&&magicInt(s.dc,0,10000)&&['half','negates','none'].includes(s.onSuccess||'none'),'Invalid spell saving throw');
  }
  if(spell.spellResistance!==undefined)this.assert(typeof spell.spellResistance==='boolean','Spell resistance field must be boolean');
  if(spell.components!==undefined){
   this.assert(Array.isArray(spell.components)&&spell.components.length<=30,'Invalid spell damage packet');
   if(spell.components.length)this.validatePacketComponents(spell.components);
  }
  if(spell.healing!==undefined){
   const h=spell.healing;
   this.assert(magicObj(h)&&Object.keys(h).every(k=>['amount','dice'].includes(k))&&(h.amount!==undefined)!==(h.dice!==undefined),'Invalid spell healing definition');
   if(h.amount!==undefined)this.assert(magicInt(h.amount,0,100000),'Invalid flat healing');
   if(h.dice!==undefined)this.assert(magicObj(h.dice)&&magicInt(h.dice.count,1,100)&&magicInt(h.dice.sides,2,1000)&&magicInt(h.dice.bonus??0,-10000,10000),'Invalid healing dice');
  }
  if(spell.effect!==undefined){
   const e=spell.effect;
   this.assert(magicObj(e)&&Object.keys(e).every(k=>['rounds','mods','conditions','tags','applyOnSaveSuccess','dispellable'].includes(k))&&(spell.concentration?e.rounds==null:magicInt(e.rounds,1,100000)),'Spell effect needs supported fields and a round duration, or concentration-owned timing');
   this.assert(e.mods!==undefined||e.conditions!==undefined,'Spell effect needs modifiers or conditions');
   if(e.mods!==undefined)this.validateEffectModifiers(e.mods);
   if(e.conditions!==undefined)this.assert(Array.isArray(e.conditions)&&e.conditions.length>0&&e.conditions.length<=SPELL_CONDITION_IDS.length&&new Set(e.conditions).size===e.conditions.length&&e.conditions.every(c=>SPELL_CONDITION_IDS.includes(c)),'Invalid spell conditions; HP/life states use health commands');
   if(e.tags!==undefined)this.assert(Array.isArray(e.tags)&&new Set(e.tags).size===e.tags.length&&e.tags.every(t=>EFFECT_TAGS.includes(t)),'Invalid spell effect tags');
   if(spell.effect.applyOnSaveSuccess!==undefined)this.assert(typeof spell.effect.applyOnSaveSuccess==='boolean','Invalid save success flag');
   if(spell.effect.dispellable!==undefined)this.assert(typeof spell.effect.dispellable==='boolean','Invalid dispellable flag');
  }
  if(spell.dispel!==undefined||spell.counterspell!==undefined){
   this.assert(!(spell.dispel&&spell.counterspell)&&spell.targets?.length===1&&!spell.area&&!spell.delivery&&!spell.effect&&!spell.components?.length&&!spell.healing&&!spell.save&&!spell.spellResistance&&!spell.persistent,'Dispel/counterspell needs one target and no ordinary payload');
   const d=spell.dispel||spell.counterspell;
   this.assert(magicObj(d)&&Object.keys(d).every(k=>(spell.dispel?['effectId','greater','bonus']:['mode','matches','greater','bonus']).includes(k)),'Invalid dispel/counterspell definition');
   if(d.greater!==undefined)this.assert(typeof d.greater==='boolean','Invalid greater dispel flag');
   if(d.bonus!==undefined)this.assert(magicInt(d.bonus,-100,100),'Invalid dispel check bonus');
   if(spell.dispel){
    if(d.effectId!==undefined)this.assert(typeof d.effectId==='string'&&/^[a-z0-9_-]{1,64}$/i.test(d.effectId),'Invalid dispel effect ID');
    if(d.greater)this.assert(spell.casterLevel>=4,'Greater dispel needs at least caster level 4');
   }else{
    this.assert(['same','dispel'].includes(d.mode)&&(spell.castingTime||'standard')==='standard'&&(spell.sourceKind||'spell')==='spell','Counterspell needs an ordinary standard-action spell');
    if(d.mode==='same'){
     this.assert(magicInt(spell.rangeFeet,0,100000)&&d.greater===undefined&&d.bonus===undefined,'Matching counterspell needs its printed range');
     if(d.matches!==undefined)this.assert(Array.isArray(d.matches)&&d.matches.length<=30&&d.matches.every(magicText),'Invalid specific counterspell exceptions');
    }else this.assert(d.matches===undefined,'Dispel counterspell cannot declare matching exceptions');
   }
  }
  this.assert(spell.components?.length||spell.healing||spell.effect||spell.save||spell.dispel||spell.counterspell,'Spell has no supported effect');
 }
 concentration(actor,spell,dc){
  const c=this.find(actor),ability=spell.ability||'int';
  const bonus=spell.concentrationBonus??(spell.casterLevel+abilityMod(this.stat(actor,ability)));
  const d20=this.rollDie(20),total=d20+bonus,success=total>=dc;
  // Concentration is a caster-level check: natural 1/20 are not automatic outcomes.
  this.note(`${c.name}: concentration ${d20} + ${bonus} = ${total} vs DC ${dc}: ${success?'success':'failure'}.`);
  return {d20,bonus,total,dc,success};
 }
 heldTouch(actor){return this.s.pendingEvents.find(e=>e.kind==='held_spell'&&e.status==='active'&&e.actor===actor);}
 freeTouchAttempt(event){return event.payload.freeAttempt&&event.createdAt.round===this.s.round&&event.createdAt.worldRounds===this.s.worldRounds;}
 validateHeldSpellEvent({actor,payload,duration,requiresInput}){
  this.find(actor);
  this.assert(!this.heldTouch(actor),'Caster already holds a touch spell');
  this.assert(duration?.type==='indefinite'&&requiresInput===false,'Held spell uses an indefinite mechanical event');
  this.assert(magicObj(payload)&&Object.keys(payload).every(k=>['spell','spellSource','chargesRemaining','freeAttempt','resistanceCache'].includes(k))&&typeof payload.freeAttempt==='boolean'&&magicObj(payload.resistanceCache),'Invalid held spell payload');
  this.validateSpell(payload.spell);
  this.assert(payload.spell.delivery?.type==='touch'&&magicInt(payload.chargesRemaining,1,payload.spell.delivery.charges||1),'Invalid held touch charges');
  if(payload.spellSource!==undefined){
   const s=payload.spellSource;
   this.assert(magicObj(s)&&/^spell_instance_\d+$/.test(s.id)&&s.actor===actor&&s.name===payload.spell.name&&s.casterLevel===payload.spell.casterLevel&&s.level===payload.spell.level&&s.spellId===this.spellIdentity(payload.spell)&&s.sourceKind===(payload.spell.sourceKind||'spell')&&s.dispellable===(payload.spell.effect?.dispellable!==false),'Invalid held spell source');
  }
  for(const [target,r] of Object.entries(payload.resistanceCache)){
   this.find(target);this.assert(magicObj(r)&&magicInt(r.sr,1,1000)&&magicInt(r.d20,1,20)&&Number.isInteger(r.total)&&typeof r.success==='boolean','Invalid stored spell resistance check');
  }
 }
 clearHeldTouch(actor,reason){
  const e=this.heldTouch(actor);return e?this.concludePendingEvent(e,'cancelled',reason):null;
 }
 consumeHeldTouch(event,reason){
  event.payload.chargesRemaining--;
  if(!event.payload.chargesRemaining)this.concludePendingEvent(event,'discharged',reason);
  else this.note(`${event.label}: ${event.payload.chargesRemaining} touch charge(s) remain.`);
 }
 spellAttackProfile(spell){
  const d=spell.delivery,ray=d.type==='ray';
  const profile={attackKind:ray?'ray':'touch',attackMode:ray?'ranged_touch':'melee_touch',
   attackAbility:d.attackAbility||(ray?'dex':'str'),attackOffset:d.attackOffset||0,damageIntent:'lethal',
   criticalThreat:d.criticalThreat??20,criticalMultiplier:d.criticalMultiplier??2,improvedCritical:!!d.improvedCritical};
  if(ray){profile.rangedKind='ray';profile.rangeFeet=d.rangeFeet;}
  if(spell.components?.some(c=>c.precision))profile.precision={count:0,sides:2,bonus:1};
  return profile;
 }
 preflightSpellAttack(actor,target,spell){
  this.find(actor);this.find(target);
  const profile=this.spellAttackProfile(spell);
  this.validateAttackReach(actor,target,profile);
  this.assert(!this.attackDefenseContext(actor,target,profile,'touchAc').totalCover,'Spell target has total cover');
  return profile;
 }
 spellAttackCheck(actor,target,spell){
  const profile=this.spellAttackProfile(spell);
  const check=this.resolveAttackCheck(actor,target,spell.name,profile,'touchAc',{
   standalone:true,allowDownTarget:spell.delivery.type==='ray',canCritical:!!spell.components?.length,precisionEligible:!!profile.precision});
  const {context,...report}=check;
  if(check.hit)this.note(`${spell.name}: ${this.find(actor).name} hits ${this.find(target).name}${check.criticalHit?' (critical x'+check.criticalMultiplier+')':''}.`);
  return report;
 }
 spellOutcome(resolution){
  return {status:resolution.status||'resolved',resolution,...(resolution.interrupt?{interrupt:resolution.interrupt}:{})};
 }
 newSpellSource(actor,spell){
  return {id:`spell_instance_${++this.s.spellInstanceSerial}`,actor,name:spell.name,
   spellId:this.spellIdentity(spell),level:spell.level,casterLevel:spell.casterLevel,
   sourceKind:spell.sourceKind||'spell',dispellable:spell.persistent?.dispellable??(spell.effect?.dispellable!==false)};
 }
 spellIdentity(spell){return (spell.spellId||spell.name).trim().toLowerCase().replace(/\s+/g,' ');}
 // A derived index over the existing effect/event owners, never a second store.
 ongoingSpellEffects(target=null){
  const groups=new Map();
  const add=(recipient,source,kind,id)=>{
   if(!source||(target!==null&&recipient!==target))return;
   const key=recipient+'\0'+source.id;
   if(!groups.has(key))groups.set(key,{target:recipient,...clone(source),effectIds:[],eventIds:[]});
   groups.get(key)[kind].push(id);
  };
  for(const effect of this.s.effects)add(effect.target,effect.spellSource,'effectIds',effect.id);
  for(const e of this.s.pendingEvents)if(e.kind==='held_spell'&&e.status==='active'){
   const p=e.payload,source=p.spellSource||{id:e.id,actor:e.actor,name:p.spell.name,spellId:this.spellIdentity(p.spell),level:p.spell.level,casterLevel:p.spell.casterLevel,sourceKind:p.spell.sourceKind||'spell',dispellable:true};
   add(e.actor,source,'eventIds',e.id);
  }
  for(const e of this.persistentAreaEvents())add(e.id,e.payload.spellSource,'eventIds',e.id);
  return [...groups.values()];
 }
 spellInteractionRange(actor,target,spell){
  if(this.persistentAreaEvent(target))return this.persistentAreaInteractionRange(actor,target,spell);
  this.find(actor);this.find(target);
  const range=spell.rangeFeet??(100+10*spell.casterLevel);
  this.assert(this.spellTargetDistance(actor,target)<=range,'Spell target beyond range');
  this.assert(actor===target||!this.wallAttackGeometry(actor,target).blocked,'Spell target has no line of effect');
  if(actor!==target){
   const context=this.attackDefenseContext(actor,target,{attackMode:'melee_touch'},'touchAc');
   this.assert(!context.totalCover,'Spell target has no line of effect');
   this.assert(context.missChance<50||context.concealmentSource!=='total'&&!this.hasCondition(actor,'blinded')&&!this.hasCondition(target,'invisible'),'Spell target cannot be perceived');
  }
 }
 spellTargetDistance(actor,target){
  const ruling=this.geometryRuling(actor,target);if(ruling?.distanceFeet!==undefined)return ruling.distanceFeet;
  return Math.min(...this.footprint(this.find(actor)).flatMap(a=>this.footprint(this.find(target)).map(b=>spellGridDistance(a.x-b.x,a.y-b.y)*5)));
 }
 dispelCheck(actor,source,casterLevel,{bonus=0,roll=null,self=true}={}){
  const dc=11+source.casterLevel,automatic=self&&source.actor===actor;
  const d20=automatic?null:(roll??this.rollDie(20)),total=automatic?null:d20+casterLevel+bonus;
  const success=automatic||total>=dc;
  this.note(`${this.find(actor).name}: dispel ${automatic?'own spell automatically':`${d20} + ${casterLevel+bonus} = ${total} vs DC ${dc}: ${success?'success':'failure'}`}.`);
  return {dc,d20,bonus:casterLevel+bonus,total,success,automatic};
 }
 endSpellOnTarget(group){
  for(const id of group.effectIds)this.removeEffect(id,{countAsAction:false});
  for(const id of group.eventIds){const e=this.s.pendingEvents.find(e=>e.id===id);if(e)this.concludePendingEvent(e,'dispelled','spell dispelled');}
  return {castingId:group.id,target:group.target,spell:group.name,effectIds:[...group.effectIds],eventIds:[...group.eventIds]};
 }
 resolveDispel(actor,spell){
  const target=spell.targets[0];
  if(this.s.creatures.some(c=>c.id===target)&&this.collectiveKind(target)&&!spell.dispel.effectId)
   return {spell:spell.name,status:'immune',reason:'Collectives are immune to creature-targeted dispels; an explicitly targeted ongoing spell is a separate target',dispelled:[],checks:[]};
  if(!this.persistentAreaEvent(target)&&!this.s.creatures.some(c=>c.id===target))return {spell:spell.name,status:'blocked',reason:'Persistent area no longer exists',dispelled:[],checks:[]};
  // A target may have moved or an effect may have expired during casting AoOs.
  try{this.spellInteractionRange(actor,target,spell);}catch(error){
   if(!/^(Spell target beyond range|Spell target has no line of effect|Spell target cannot be perceived)$/.test(error.message))throw error;
   this.note(`${spell.name} fails: ${error.message}.`);return {spell:spell.name,status:'blocked',reason:error.message,dispelled:[],checks:[]};
  }
  let groups=this.ongoingSpellEffects(target).filter(g=>g.dispellable);
  if(spell.dispel.effectId)groups=groups.filter(g=>g.effectIds.includes(spell.dispel.effectId)||g.eventIds.includes(spell.dispel.effectId));
  groups.sort((a,b)=>b.casterLevel-a.casterLevel||a.id.localeCompare(b.id));
  const checks=[],dispelled=[],limit=spell.dispel.effectId?1:(spell.dispel.greater?Math.floor(spell.casterLevel/4):1);
  let roll=null;
  for(const group of groups){
   if(group.actor!==actor&&roll===null)roll=this.rollDie(20);
   const check=this.dispelCheck(actor,group,spell.casterLevel,{bonus:spell.dispel.bonus||0,roll});
   checks.push({castingId:group.id,spell:group.name,...check});
   if(check.success){dispelled.push(this.endSpellOnTarget(group));if(dispelled.length>=limit)break;}
  }
  return {spell:spell.name,caster:actor,target,status:'resolved',checks,dispelled};
 }
 validateCounterspellEvent({actor,payload}){
  this.assert(magicObj(payload)&&Object.keys(payload).length===1&&payload.counterspell,'Invalid native Ready payload');
  this.validateSpell(payload.counterspell);
  this.assert(payload.counterspell.counterspell&&payload.counterspell.targets[0]!==actor,'Ready counterspell needs another spellcaster');
  if(payload.counterspell.counterspell.mode==='same')this.skillBonus(actor,'Spellcraft');
 }
 readyCounterspell({actor,id,spell}={}){
  this.assert(unresolvedActions(this.s).length===0&&unresolvedDecisions(this.s).length===0,'Resolve pending combat/GM operation before Readying');
  this.assert(!this.castingFor(actor)&&!this.castingIncapacitated(actor),'Caster cannot Ready a counterspell');
  this.validateCounterspellEvent({actor,payload:{counterspell:spell}});
  return this.registerPendingEvent({id,label:`Counterspell: ${spell.name}`.slice(0,150),kind:'ready',actor,
   action:`Counter ${spell.targets[0]}'s casting with ${spell.name}`.slice(0,500),trigger:`When ${spell.targets[0]} begins casting a spell`,
   duration:{type:'turn_start',actor},payload:{counterspell:spell}});
 }
 counterspellCandidates(actor,spell){
  if(spell.sourceKind==='spell_like')return [];
  return this.s.pendingEvents.filter(e=>e.kind==='ready'&&e.status==='active'&&e.payload?.counterspell?.targets[0]===actor).map(e=>e.id);
 }
 remainingCounterspells(p=this.s.pendingSpellCast){
  return p&&!p.lostReason?(p.counterspells||[]).filter(id=>!p.counterHandled?.includes(id)&&this.s.pendingEvents.some(e=>e.id===id&&e.status==='active')):[];
 }
 finishCounterCasting(reaction){
  const parent=reaction.parentCasting,event=this.s.pendingEvents.find(e=>e.id===reaction.counterEventId);
  let check=null,success=false;
  if(!reaction.lostReason&&!parent.lostReason){
   if(this.castingIncapacitated(reaction.actor)||this.policy(reaction.actor,'no_actions')||this.policy(reaction.actor,'one_move_only'))this.loseCasting(reaction,'caster incapacitated');
   else try{this.spellInteractionRange(reaction.actor,parent.actor,reaction.spell);}catch(error){
    if(!/^(Spell target beyond range|Spell target has no line of effect|Spell target cannot be perceived)$/.test(error.message))throw error;
    this.loseCasting(reaction,error.message);
   }
   if(!reaction.lostReason&&reaction.spell.counterspell.mode==='dispel'){
    check=this.dispelCheck(reaction.actor,{actor:parent.actor,casterLevel:parent.spell.casterLevel},reaction.spell.casterLevel,
     {bonus:(reaction.spell.counterspell.bonus||0)+(reaction.spell.counterspell.greater?4:0),self:false});success=check.success;
   }else if(!reaction.lostReason)success=true;
  }
  if(success)this.loseCasting(parent,'counterspelled by '+this.find(reaction.actor).name);
  if(!reaction.lostReason)this.recordCasting(reaction,success?'countered':'failed_counterspell');
  if(event)this.concludePendingEvent(event,'resolved',success?'spell countered':reaction.lostReason||'counterspell failed');
  this.s.pendingSpellCast=parent;
  // A nested counter can temporarily replace the single generic Ready view.
  if(parent.counterEventId){const e=this.s.pendingEvents.find(e=>e.id===parent.counterEventId);
   if(e)this.s.pendingReadyAction={id:e.id,actor:e.actor,action:e.action,interrupting:parent.parentCasting.actor};}
  return {status:'needs_gm',counterspell:success?'countered':reaction.lostReason?'lost':'failed',check,
   spell:reaction.spell.name,remainingCounterspells:this.remainingCounterspells(parent),reason:'Confirm remaining casting opportunities, then resume spell'};
 }
 resolveCounterspell({id,take,perceived=false,identificationModifier=0}={}){
  const parent=this.s.pendingSpellCast;
  this.assert(parent&&this.remainingCounterspells(parent).includes(id),'No counterspell opportunity for that Ready');
  this.assert(!this.s.interrupt&&!this.s.pendingRider,'Resolve the attack rider before a counterspell');
  const owned=new Set();for(let p=parent;p;p=p.parentCasting)if(p.counterEventId)owned.add(p.counterEventId);
  this.assert(!this.s.pendingEventDecisions.some(e=>!owned.has(e.id))&&!this.s.pendingInitiativeEvent&&!this.s.pendingTimeEvent,'Resolve preceding GM checkpoint before a counterspell');
  this.assert(typeof take==='boolean'&&typeof perceived==='boolean'&&magicInt(identificationModifier,-100,100),'Invalid counterspell decision');
  const event=this.s.pendingEvents.find(e=>e.id===id),actor=event.actor;let spell=clone(event.payload.counterspell);
  parent.counterHandled ||= [];
  if(!take){parent.counterHandled.push(id);this.note(`${actor} declines this counterspell opportunity; Ready remains active.`);return {status:'declined',id};}
  this.assert(perceived,'GM must confirm the casting is perceived');
  this.assert(!this.castingIncapacitated(actor)&&!this.policy(actor,'no_actions')&&!this.policy(actor,'one_move_only')&&!this.castingFor(actor)&&!this.concentrationFor(actor),'Creature cannot counterspell');
  spell=this.bindSpellResource(actor,spell);
  this.spellInteractionRange(actor,parent.actor,spell);
  if(spell.counterspell.mode==='same')this.assert(!this.hasCondition(actor,'blinded'),'Cannot identify a casting while blinded');
  parent.counterHandled.push(id);
  let identification=null;
  if(spell.counterspell.mode==='same'){
   const distancePenalty=Math.floor(this.spellTargetDistance(actor,parent.actor)/10);
   const dc=15+parent.spell.level+distancePenalty+identificationModifier;
   identification={dc,distancePenalty,modifier:identificationModifier,...this.check(actor,'skill','Spellcraft',dc)};
   const matches=[this.spellIdentity(spell),...(spell.counterspell.matches||[]).map(x=>this.spellIdentity({name:x}))];
   if(!identification.success||!matches.includes(this.spellIdentity(parent.spell))){
    this.note(`Counterspell Ready ${id}: ${identification.success?'declared spell does not match':'identification failed'}; no counterspell was cast.`);
    return {status:'failed',reason:identification.success?'spell does not match':'identification failed',identification,spellExpended:false};
   }
  }
  let depth=0;for(let p=parent;p;p=p.parentCasting)depth++;
  this.assert(depth<30,'Counterspell nesting limit reached');
  this.activatePendingEvent(event,'counterspell',parent.actor);
  const resourceSpent=this.commitSpellResource(actor,spell);
  this.clearHeldTouch(actor,'counterspell casting begins');
  const reaction={id:`cast_${++this.s.castingSerial}`,actor,spell,resourceSpent,injuries:[],continuousChecks:{},parentCasting:parent,counterEventId:id};
  // Readying already paid the action. The reaction uses the normal casting
  // checks and the same AoO continuation, without touching the active budget.
  this.s.pendingSpellCast=reaction;
  const failure=this.initialCastingChecks(actor,spell,reaction,true);
  if(failure)return {...this.finishCounterCasting(reaction),identification};
  reaction.threats=this.castingThreats(actor,spell);reaction.handled=[];
  reaction.counterspells=this.counterspellCandidates(actor,spell);reaction.counterHandled=[];
  if(reaction.threats.length||reaction.counterspells.length){
   this.note(`${spell.name} counterspell casting pauses for opportunities.`);
   return {status:'needs_gm',reason:'counterspell casting opportunities',identification,threats:reaction.threats,counterspells:reaction.counterspells};
  }
  return {...this.finishCounterCasting(reaction),identification};
 }
 validateMapSpellPlacement(actor,spell){
  if(spell.dispel||spell.counterspell)return;
  if(spell.area){
   const starts=this.footprint(this.find(actor)).map(p=>({x:p.x+.5,y:p.y+.5}));
   this.assert(starts.some(p=>mapClearRay(this.s,p,spell.area.origin)),'Spell origin has no line of effect');
  }else if(!spell.delivery){for(const target of spell.targets||[])if(target!==actor){
   this.assert(!this.wallAttackGeometry(actor,target).blocked,'Spell target has no line of effect');
   this.assert(!this.mapSightBlocked(actor,target),'Spell target cannot be perceived through a sight barrier');
  }}
 }
 resolveSpell(actor,spell,spellSource=null){
  this.find(actor);this.validateSpell(spell);this.validateMapSpellPlacement(actor,spell);
  this.assert(!spell.counterspell,'Use Ready to execute a counterspell');
  if(spell.dispel)return this.resolveDispel(actor,spell);
  spellSource ||= this.newSpellSource(actor,spell);
  if(spell.concentration){
   this.assert(!this.concentrationFor(actor),'Stop concentration before maintaining another spell');
   this.assert(!this.castingIncapacitated(actor),'Caster cannot maintain concentration');
   this.assert(spell.effect||spell.persistent,'Concentration needs a persistent area or ongoing effect');
   const resolution=spell.persistent?this.createPersistentArea(actor,spell,spellSource):this.resolveSpellPayload(actor,spell,{spellSource});
   const id=this.beginConcentration(actor,spell,spellSource);this.reconcileConcentration();
   return {...resolution,concentrationId:this.s.pendingEvents.some(e=>e.id===id)?id:null};
  }
  if(spell.persistent)return this.createPersistentArea(actor,spell,spellSource);
  if(spell.delivery?.type==='touch'){
   this.clearHeldTouch(actor,'a new held touch effect replaces the previous one');
   const id=`held_spell_${++this.s.spellSerial}`;
   this.registerPendingEvent({id,label:`${spell.name}: held touch charge`,kind:'held_spell',actor,
    trigger:'Discharge on successful touch/contact; dissipate when another spell is cast.',requiresInput:false,
    duration:{type:'indefinite'},payload:{spell:clone(spell),spellSource,chargesRemaining:spell.delivery.charges||1,freeAttempt:actor===this.active().id,resistanceCache:{}}});
   if(spell.delivery.attemptOnCast)return this.deliverTouchSpell({actor,target:spell.targets[0]},'actor',true);
   return {status:'holding_charge',spell:spell.name,eventId:id,chargesRemaining:spell.delivery.charges||1};
  }
  if(spell.delivery?.type==='ray'){
   this.assert(!this.s.pendingRangedAction&&!this.s.interrupt&&!this.s.pendingSpellCast,'Resolve preceding interruption before ray delivery');
   return this.createRangedCheckpoint({kind:'spell',actor,spell:clone(spell),spellSource,reactors:this.rangedAoOReactors(actor)});
  }
  return this.resolveSpellPayload(actor,spell,{spellSource});
 }
 deliverTouchSpell({actor,target,willing=false}={},role='actor',fromCasting=false){
  this.assert(fromCasting||actor===this.active().id,'Only active creature may deliver a held touch spell');
  this.assert(unresolvedActions(this.s).length===0&&unresolvedDecisions(this.s).filter(d=>!fromCasting||d!=='deferred_turn_start').length===0,'Resolve pending combat/GM operation before touch delivery');
  this.assert(!this.castingFor(actor),'Cannot deliver a touch spell while casting');
  this.assert(!this.policy(actor,'no_actions')&&!this.castingIncapacitated(actor),'Caster cannot make a touch attack');
  this.assert(!this.policy(actor,'one_move_only'),'Nauseated: cannot deliver a touch attack');
  const event=this.heldTouch(actor);this.assert(event,'No held touch spell for this creature');
  this.assert(typeof willing==='boolean','Invalid willingness flag');
  if(willing&&target!==actor)this.assert(role==='gm','GM must confirm another creature is willing');
  const spell=event.payload.spell,self=target===actor;
  this.find(target);
  if(!self)this.preflightSpellAttack(actor,target,spell);
  if(!fromCasting&&!this.freeTouchAttempt(event))this.spendAction(actor,'standard','Deliver '+spell.name);
  else this.s.actions.activity++;
  event.payload.freeAttempt=false;
  const attack=self||willing?{hit:true,automatic:true,criticalMultiplier:1}:this.spellAttackCheck(actor,target,spell);
  if(!attack.hit)return {status:'holding_charge',spell:spell.name,eventId:event.id,attack,chargesRemaining:event.payload.chargesRemaining};
  return this.dischargeTouchAt(event,target,attack);
 }
 dischargeTouchAt(event,target,attack={hit:true,automatic:true,criticalMultiplier:1}){
  const spell={...clone(event.payload.spell),targets:[target]};
  const resolution=this.resolveSpellPayload(event.actor,spell,{criticalMultiplier:attack.criticalMultiplier||1,attack,resistanceCache:event.payload.resistanceCache,spellSource:event.payload.spellSource});
  this.consumeHeldTouch(event,'contact with '+target);
  return {status:this.heldTouch(event.actor)?'holding_charge':'resolved',eventId:event.id,attack,resolution,chargesRemaining:event.payload.chargesRemaining};
 }
 onAttackHit({actor,target,attackKind}){
  const held=this.heldTouch(actor);
  if(held&&['natural','unarmed'].includes(attackKind))return this.dischargeTouchAt(held,target);
  return null;
 }
 contactTouchSpell({actor,target=null,reason}={}){
  const event=this.heldTouch(actor);this.assert(event,'No held touch spell for this creature');
  this.assert(typeof reason==='string'&&reason.trim().length>0&&reason.length<=500,'Describe the unintended contact or discharge');
  if(target!==null){if(target!==actor)this.preflightSpellAttack(actor,target,event.payload.spell);return this.dischargeTouchAt(event,target);}
  this.consumeHeldTouch(event,reason);return {status:'discharged',eventId:event.id,reason,chargesRemaining:event.payload.chargesRemaining};
 }
 finishRangedSpell(pending){
  if(!this.canFinishRangedAction(pending)){
   this.note(`${pending.spell.name} cannot be fired: caster incapacitated.`);this.resumeDeferredTurnStart();return {status:'stopped',reason:'caster incapacitated'};
  }
  const results=[],resistanceCache={},activity=this.s.actions.activity;
  for(const target of pending.spell.targets){
   try{this.preflightSpellAttack(pending.actor,target,pending.spell);}
   catch(error){
    if(!/^(Target out of reach|Ranged target beyond maximum range|Spell target has total cover)/.test(error.message))throw error;
    results.push({target,status:'blocked',reason:error.message});this.note(`${pending.spell.name} ray to ${target} blocked: ${error.message}.`);continue;
   }
   const attack=this.spellAttackCheck(pending.actor,target,pending.spell);
   const resolution=attack.hit?this.resolveSpellPayload(pending.actor,{...pending.spell,targets:[target]},{criticalMultiplier:attack.criticalMultiplier,attack,resistanceCache,spellSource:pending.spellSource}):null;
   results.push({target,attack,resolution});
  }
  this.s.actions.activity=activity;
  this.resumeDeferredTurnStart();
  return {status:'resolved',spell:pending.spell.name,caster:pending.actor,rays:results};
 }
 threatens(actor,target,x,y){
  const cast=this.castingFor(actor);
  return cast&&!cast.lostReason?false:super.threatens(actor,target,x,y);
 }
 bindSpellEffect(effectId,{actor,spell,spellSource,areaEvent,payloadKey}){
  const applied=this.s.effects.find(e=>e.id===effectId);
  applied.spellSource=clone(spellSource);applied.spellPayloadKey=payloadKey;
  if(areaEvent){applied.persistentAreaSource=true;applied.areaEventId=areaEvent.id;applied.areaEffectScope=areaEvent.payload.effectScope;}
  unlinkEffectDeadlines(this.s,effectId);
  if(!spell.concentration&&this.s.initiative?.enabled&&areaEvent?.payload.effectScope!=='inside'){
   const score=this.s.initiative.entries.find(e=>e.id===actor)?.score??areaEvent?.payload.initiativeScore??(areaEvent?this.s.initiative.entries.find(e=>e.id===this.active()?.id)?.score:undefined);
   this.assert(Number.isInteger(score),'Caster needs an initiative position for round-duration spell');
   this.scheduleInitiativeEvent({id:`magic_exp_${++this.s.spellSerial}`,label:`${spell.name} expires on ${applied.target}`,
    afterRounds:spell.effect.rounds,atScore:score,requiresInput:false,expireEffectId:effectId});
  }
 }
 applySpellEffect(actor,target,spell,{spellSource,areaEvent,resolutionSerial,allowedEffectKeys=null}){
  const effectIds=[],conditions=[],spec=spell.effect;
  const immunity=this.evaluateEffect({target,tags:spec.tags||[]});
  if(immunity.blocked)return {effectId:null,effectIds,conditions,effectImmunity:immunity};
  const inside=areaEvent?.payload.effectScope==='inside',rounds=spell.concentration||this.s.initiative?.enabled||inside?null:spec.rounds;
  const liveSource=this.s.creatures.some(c=>c.id===actor)?actor:null;
  const parts=[...(spec.mods!==undefined?[{key:'mods'}]:[]),...(spec.conditions||[]).map(condition=>({key:`condition:${condition}`,condition}))];
  for(const part of parts){
   if(areaEvent&&spell.concentration&&!this.persistentAreaEvent(areaEvent.id))break;
   if(allowedEffectKeys&&!allowedEffectKeys.includes(part.key))continue;
   // Retain each live area part; a missing part can return on a later exposure.
   const existing=areaEvent&&this.s.effects.find(e=>e.areaEventId===areaEvent.id&&e.target===target&&(e.spellPayloadKey||'mods')===part.key);
   if(existing){effectIds.push(existing.id);if(part.condition)conditions.push({condition:part.condition,effectId:existing.id,retained:true});continue;}
   let effectId;
   if(part.condition){
    const previous=this._spellConditionApplication;this._spellConditionApplication=spellSource.id;
    let result;
    try{result=this.applyCondition({condition:part.condition,target,source:liveSource,rounds});}
    finally{this._spellConditionApplication=previous;}
    conditions.push({condition:part.condition,...result});effectId=result.effectId;
   }else{
    effectId=`magic_${resolutionSerial}_${target}`;
    this.addEffect({id:effectId,name:spell.name,source:liveSource,target,mods:spec.mods,rounds});
   }
   if(effectId&&areaEvent&&spell.concentration&&!this.persistentAreaEvent(areaEvent.id))this.removeEffect(effectId,{countAsAction:false});
   else if(effectId&&this.s.effects.some(e=>e.id===effectId)){this.bindSpellEffect(effectId,{actor,spell,spellSource,areaEvent,payloadKey:part.key});effectIds.push(effectId);}
  }
  return {effectId:effectIds[0]||null,effectIds,conditions,effectImmunity:null};
 }
 resolveSpellPayload(actor,spell,{criticalMultiplier=1,attack=null,resistanceCache=null,spellSource=null,areaEvent=null,targetIds=null,allowedEffectKeys=null}={}){
  if(!areaEvent)this.find(actor);this.validateSpell(spell);
  const liveSource=this.s.creatures.some(c=>c.id===actor)?actor:null;
  spellSource ||= this.newSpellSource(actor,spell);
  const area=spell.area?this.previewSpellArea(spell.area):null;
  if(area)area.affected=area.affected.filter(id=>this.exposureAllowed(this.find(id),spell.exposure));
  const targets=targetIds??(area?area.affected:[...spell.targets]);
  // Area damage dice are rolled ONCE for the spell, not separately per target.
  // The packet resolver receives fixed amounts per target, so resistances remain separate.
  const rolled=(spell.components||[]).map((comp,componentIndex)=>{
   const component=clone(comp),rolls=comp.dice?Array.from({length:comp.dice.count*criticalMultiplier},()=>this.rollDie(comp.dice.sides)):null;
   component.amount=Math.max(0,rolls?rolls.reduce((sum,n)=>sum+n,(comp.dice.bonus||0)*criticalMultiplier):comp.amount*criticalMultiplier);
   if(componentIndex===0&&attack?.combat?.damage)component.amount=Math.max(0,component.amount+attack.combat.damage*criticalMultiplier);
   delete component.dice;
   let precisionRolls=null;
   if(attack&&comp.precision){
    precisionRolls=attack.precisionEligible&&!attack.precisionImmune&&!attack.precisionNegated?Array.from({length:comp.precision.count},()=>this.rollDie(comp.precision.sides)):[];
    if(precisionRolls.length||attack.precisionEligible&&!attack.precisionImmune&&!attack.precisionNegated)component.amount+=precisionRolls.reduce((sum,n)=>sum+n,comp.precision.bonus||0);
    delete component.precision; // The shared attack check already resolved fortification for this hit.
   }
   return {component,rolls,precisionRolls};
  });
  const healingRolls=spell.healing?.dice?Array.from({length:spell.healing.dice.count},()=>this.rollDie(spell.healing.dice.sides)):null;
  const healing=spell.healing?Math.max(0,healingRolls?healingRolls.reduce((sum,n)=>sum+n,spell.healing.dice.bonus||0):spell.healing.amount):null;
  const results=[],resolutionSerial=++this.s.spellSerial;
  for(const id of targets){
   const target=this.find(id),entry={target:id,spellResistance:null,save:null,packet:null,healing:null,effectId:null,effectIds:[],conditions:[],effectImmunity:null};
   const collectiveImmunity=this.evaluateEffect({target:id,tags:spell.effect?.tags||[],targeting:spell.area?'area':spell.targeting||'creatures'});
   if(collectiveImmunity.blockedBy.some(reason=>reason.includes('specific number of creatures'))){entry.effectImmunity=collectiveImmunity;results.push(entry);continue;}
   if(spell.spellResistance&&id!==actor&&magicInt(target.spellResistance,1,1000)){
    entry.spellResistance=resistanceCache&&Object.hasOwn(resistanceCache,id)?resistanceCache[id]:null;
    if(!entry.spellResistance){
     const d20=this.rollDie(20),total=d20+spell.casterLevel;
     entry.spellResistance={sr:target.spellResistance,d20,total,success:total>=target.spellResistance};
     if(resistanceCache)resistanceCache[id]=clone(entry.spellResistance);
    }
    if(!entry.spellResistance.success){results.push(entry);continue;}
   }
   const cover=this.spellCover(actor,id,spell),coverBonus=({partial:1,cover:2,improved:4})[cover]||0;
   if(spell.save){entry.save=this.savingThrow(id,spell.save.type,spell.save.dc,{bonus:coverBonus});if(coverBonus)Object.assign(entry.save,{cover,coverBonus});}
   const negated=!!entry.save?.success&&spell.save.onSuccess==='negates';
   if(!negated&&rolled.length){
    const components=rolled.map(r=>{
     const comp={...r.component};if(comp.dice===undefined)delete comp.dice;
     if(cover==='improved'&&spell.save?.onSuccess==='half')comp.amount=entry.save.success?0:Math.floor(comp.amount/2);
     else if(entry.save?.success&&spell.save.onSuccess==='half')comp.amount=Math.floor(comp.amount/2);
     return comp;
    });
    entry.packet=this.resolvePacket({target:id,source:liveSource,cause:'spell',metadata:{sourceKind:'spell',magical:true,areaEffect:!!spell.area},components});
   }
   if(healing!==null&&!negated)entry.healing=this.healHitPoints({target:id,amount:entry.save?.success&&spell.save?.onSuccess==='half'?Math.floor(healing/2):healing});
   if(spell.effect&&!negated&&(!entry.save?.success||spell.effect.applyOnSaveSuccess))
    Object.assign(entry,this.applySpellEffect(actor,id,spell,{spellSource,areaEvent,resolutionSerial,allowedEffectKeys}));
   results.push(entry);
  }
  this.note(`${liveSource?this.find(actor).name:areaEvent?.label||actor}'s spell ${spell.name}: ${targets.length} target(s) resolved.`);
  return {spell:spell.name,caster:actor,castingId:spellSource.id,area,rolled:rolled.map(r=>({amount:r.component.amount,rolls:r.rolls,...(r.precisionRolls?{precisionRolls:r.precisionRolls}:{})})),healingRolls,healingAmount:healing,targets:results};
 }
 castingFor(actor){
  for(let cast=this.s.pendingSpellCast;cast;cast=cast.parentCasting)if(cast.actor===actor)return cast;
  return this.s.activeSpellCasts.find(c=>c.actor===actor);
 }
 castingOverview(){
  return {provoking:clone(this.s.pendingSpellCast),active:clone(this.s.activeSpellCasts),maintenance:this.concentrationOverview(),history:clone(this.s.spellCastHistory),held:clone(this.s.pendingEvents.filter(e=>e.kind==='held_spell'&&e.status==='active')),effects:this.ongoingSpellEffects(),counterspells:this.remainingCounterspells()};
 }
 recordCasting(cast,status,reason=null){
  const record={id:cast.id||null,actor:cast.actor,spell:cast.spell.name,status,reason,round:this.s.round,worldRounds:this.s.worldRounds,injuries:clone(cast.injuries||[]),resourceSpent:clone(cast.resourceSpent||null)};
  this.s.spellCastHistory.push(record);if(this.s.spellCastHistory.length>30)this.s.spellCastHistory.shift();return record;
 }
 loseCasting(cast,reason){
  if(cast.maintenanceEventId){const event=this.s.pendingEvents.find(e=>e.id===cast.maintenanceEventId);if(event)this.stopConcentrationEvent(event,reason);return {status:'lost',reason};}
  if(cast.lostReason)return {status:'lost',reason:cast.lostReason};
  cast.lostReason=reason;
  this.s.activeSpellCasts=this.s.activeSpellCasts.filter(c=>c!==cast);
  this.recordCasting(cast,'lost',reason);
  this.note(`${this.find(cast.actor).name} loses ${cast.spell.name}: ${reason}.`);
  return {status:'lost',reason,spell:cast.spell.name};
 }
 castingIncapacitated(actor){
  return !this.canAct(actor)||['unconscious','dead','dying','stunned','dazed','cowering','petrified'].some(c=>this.hasCondition(actor,c));
 }
 checkCasting(cast,dc,reason,damage=0){
  if(cast.lostReason)return {status:'lost',reason:cast.lostReason};
  if(this.castingIncapacitated(cast.actor))return this.loseCasting(cast,'caster incapacitated');
  const concentration=this.concentration(cast.actor,cast.spell,dc);
  cast.injuries ||= [];cast.injuries.push({reason,damage,concentration});
  if(cast.injuries.length>100)cast.injuries.shift();
  if(!concentration.success)return {...this.loseCasting(cast,reason),concentration};
  return {status:'casting',concentration};
 }
 castingDamage(actor,amount){
  const cast=this.focusFor(actor);
  if(!cast||cast.lostReason)return null;
  if(this.castingIncapacitated(actor))return this.loseCasting(cast,'caster incapacitated');
  if(!amount)return null;
  return this.checkCasting(cast,10+amount+cast.spell.level,'failed damaged-while-casting concentration',amount);
 }
 // One weapon hit can contain physical, precision and bonus energy damage.
 // Check concentration once for the complete hit, not once for each component.
 beginAttackDamage(actor,target,cause='weapon'){
  const hit={actor,target,cause,amount:0,previous:this._castingHit};this._castingHit=hit;return hit;
 }
 endAttackDamage(hit,completed){
  this._castingHit=hit.previous;
  return completed?this.castingDamage(hit.target,hit.amount):null;
 }
 afterCastingDamage(target,result,source,cause){
  // Losing temporary HP still means taking damage; immunity/DR do not.
  const amount=(result.applied||0)+(result.tempHpAbsorbed||0);
  if(this._castingDot?.target===target&&cause==='ailment'){this._castingDot.amount+=amount;return result;}
  const hit=this._castingHit;
  if(hit&&hit.actor===source&&hit.target===target&&cause===hit.cause){hit.amount+=amount;return result;}
  const casting=this.castingDamage(target,amount);
  return casting?{...result,casting}:result;
 }
 damage(target,amount,type='bludgeoning',source=null,cause='weapon',metadata={}){
  return this.afterCastingDamage(target,super.damage(target,amount,type,source,cause,metadata),source,cause);
 }
 resolvePacket(cmd={}){return this.afterCastingDamage(cmd.target,super.resolvePacket(cmd),cmd.source||null,cmd.cause||'spell');}
 applyAilmentEffects(ailment,definition){
  if(definition.kind!=='dot')return super.applyAilmentEffects(ailment,definition);
  const previous=this._castingDot,context={target:ailment.target,amount:0};this._castingDot=context;
  let result;
  try{result=super.applyAilmentEffects(ailment,definition);}finally{this._castingDot=previous;}
  ailment.lastDamage=context.amount;ailment.lastDamageAt=this.s.worldRounds;
  const cast=this.focusFor(ailment.target);
  if(cast){
   if(this.castingIncapacitated(ailment.target))this.loseCasting(cast,'caster incapacitated');
   // A final continuous-damage pulse no longer distracts subsequent casting.
   else if(definition.frequency&&(definition.frequency.maxTicks===undefined||ailment.processed<definition.frequency.maxTicks))this.checkContinuousCasting(cast,ailment);
  }
  return result;
 }
 checkContinuousCasting(cast,ailment){
  cast.continuousChecks ||= {};
  if(!ailment.lastDamage||cast.continuousChecks[ailment.id]===ailment.lastDamageAt)return null;
  cast.continuousChecks[ailment.id]=ailment.lastDamageAt;
  return this.checkCasting(cast,10+Math.floor(ailment.lastDamage/2)+cast.spell.level,'failed continuous-damage concentration',ailment.lastDamage);
 }
 applyCondition(cmd){
  const result=super.applyCondition(cmd),cast=this.focusFor(cmd.target);
  if(cast&&this.castingIncapacitated(cmd.target))this.loseCasting(cast,'caster incapacitated');
  return result;
 }
 hasCastingDecision(){return this.s.activeSpellCasts.some(c=>c.status==='ready')||this.s.pendingRangedAction?.kind==='spell';}
 onBeforeTurnStart(actor){
  const cast=this.s.activeSpellCasts.find(c=>c.actor===actor);
  if(!cast)return;
  if(this.castingIncapacitated(actor)){this.loseCasting(cast,'caster incapacitated');return;}
  if(this.s.round<=cast.paidRound)return;
  if(this.s.round>cast.paidRound+1){this.loseCasting(cast,'casting rounds were not consecutive');return;}
  if(cast.roundsPaid>=cast.totalRounds){
   cast.status='ready';this.note(`${cast.spell.name} finishes casting before ${this.find(actor).name}'s turn; choose its targets/area with complete_spell.`);
  }
 }
 onPendingClockAdvanced(){
  const result=super.onPendingClockAdvanced();
  if(this._advancingCastTime)for(const cast of [...this.s.activeSpellCasts]){
   if(this.castingIncapacitated(cast.actor)){this.loseCasting(cast,'caster incapacitated');continue;}
   if(cast.status==='casting'&&cast.deadlineAt<=this.s.worldRounds){cast.roundsPaid=cast.totalRounds;cast.status='ready';this.note(`${cast.spell.name} finishes casting; choose its targets/area with complete_spell.`);}
  }
  return result;
 }
 timeCheckpoint(){
  const cast=this.s.activeSpellCasts.find(c=>c.status==='ready');
  return cast?{kind:'spell_cast',id:cast.id,actor:cast.actor,label:`Complete ${cast.spell.name}: choose targets/area`}:null;
 }
 advanceTime(options={}){
  this.assert(options.maintainConcentration===undefined||typeof options.maintainConcentration==='boolean','Invalid downtime concentration declaration');
  const maintaining=this.concentrationEvents().filter(e=>e.payload.phase==='maintaining');
  this.assert(!maintaining.length||options.maintainConcentration===true,'Stop concentration or explicitly declare maintainConcentration:true during Fast Forward');
  const hadCasting=this.s.activeSpellCasts.length>0||!!this.heldTouch(this.active()?.id)||maintaining.length>0,at=this.s.worldRounds;
  this._advancingCastTime=true;
  try{
   const result=super.advanceTime(options);
   if(hadCasting&&this.s.worldRounds>at){
    for(const cast of this.s.activeSpellCasts)if(cast.status==='casting'){
     // Credit complete uninterrupted casting rounds during downtime. The next
     // turn must pay its own action; a partial Fast Forward is not a free one.
     cast.roundsPaid=Math.max(0,cast.totalRounds-(cast.deadlineAt-this.s.worldRounds));
     cast.paidRound=this.s.round-1;
    }
    for(const event of this.concentrationEvents())if(event.payload.phase==='maintaining')event.payload.needsMaintenance=true;
    this.s.actions=newTurnActions();
    // Downtime is not an opportunity to rewind into a partially spent combat turn.
    this.turnStart=clone(this.s);this.previousTurnStart=null;this.roundStart=clone(this.s);
   }
   return result;
  }finally{this._advancingCastTime=false;}
 }
 spendAction(actor,type,label){
  const cast=this.s.activeSpellCasts?.find(c=>c.actor===actor);
  if(cast&&!this._continuingSpell){
   this.assert(cast.status!=='ready','Complete the finished spell before taking turn actions');
   this.assert(cast.paidRound===this.s.round||type==='swift','Continue or cancel the long casting before taking another action');
  }
  this.assert(!this.s.pendingSpellCast,'Resolve the provoking spell and its AoOs before taking another action');
  return super.spendAction(actor,type,label);
 }
 startMove(actor,path,options={}){
  this.assert(!this.s.pendingSpellCast&&!this.hasCastingDecision(),'Resolve casting completion/AoOs before moving');
  return super.startMove(actor,path,options);
 }
 endTurn(){
  this.assert(!this.s.pendingSpellCast&&!this.hasCastingDecision(),'Resolve casting completion/AoOs before ending the turn');
  const held=this.heldTouch(this.active().id);if(held)held.payload.freeAttempt=false;
  const cast=this.s.activeSpellCasts.find(c=>c.actor===this.active().id);
  if(cast&&cast.paidRound!==this.s.round)this.loseCasting(cast,'a required consecutive full-round casting action was skipped');
  return super.endTurn();
 }
 castingThreats(actor,spell){
  if(spell.defensive||spell.castingTime==='swift')return [];
  return this.s.creatures.filter(c=>c.id!==actor&&c.team!==this.find(actor).team&&this.canAct(c.id)&&this.canTakeAoO(c.id,actor)).map(c=>c.id);
 }
 finishCastingAction(actor,spell,cast=null){
  const totalRounds=this.castingRounds(spell.castingTime);
  if(!totalRounds)return this.spellOutcome(this.resolveSpell(actor,spell));
  if(!cast){
   cast={id:`cast_${++this.s.castingSerial}`,actor,spell:clone(spell),status:'casting',totalRounds,roundsPaid:0,paidRound:null,deadlineAt:this.s.worldRounds+totalRounds,injuries:[]};
   this.s.activeSpellCasts.push(cast);
  }
  cast.roundsPaid++;cast.paidRound=this.s.round;cast.status='casting';
  cast.deadlineAt=this.s.worldRounds+Math.max(1,totalRounds-cast.roundsPaid+1);
  this.note(`${this.find(actor).name} casts ${spell.name}: full-round action ${cast.roundsPaid}/${totalRounds}; concentration continues between turns.`);
  return {status:'casting',cast:clone(cast)};
 }
 initialCastingChecks(actor,spell,context,initial){
  const collectiveCheck=this.collectiveCastingCheck(actor,spell);
  if(collectiveCheck&&!collectiveCheck.success)return {...this.loseCasting(context,'failed swarm/troop casting distraction'),collectiveCheck};
  if(spell.defensive&&initial){
   const concentration=this.concentration(actor,spell,15+2*spell.level);
   if(!concentration.success)return {...this.loseCasting(context,'failed defensive concentration'),concentration};
  }
  if(this.hasCondition(actor,'entangled')){
   const concentration=this.concentration(actor,spell,15+spell.level);
   if(!concentration.success)return {...this.loseCasting(context,'failed entangled concentration'),concentration};
  }
  for(const ailment of this.s.activeAilments.filter(a=>a.target===actor&&this.s.ailmentCatalog[a.definition]?.kind==='dot')){
   const checked=this.checkContinuousCasting(context,ailment);
   if(checked?.status==='lost')return checked;
  }
  return null;
 }
 payCastingAction(actor,spell,cast=null){
  this._continuingSpell=true;
  try{this.spendAction(actor,this.castingRounds(spell.castingTime)?'full_round':spell.castingTime||'standard',`Cast ${spell.name}`);}finally{this._continuingSpell=false;}
  const resourceSpent=cast?cast.resourceSpent:this.commitSpellResource(actor,spell);
  if(!cast)this.clearHeldTouch(actor,'another spell casting begins');
  const context=cast||{actor,spell,resourceSpent,injuries:[],continuousChecks:{}};
  const failure=this.initialCastingChecks(actor,spell,context,!cast);if(failure)return failure;
  const threats=cast?[]:this.castingThreats(actor,spell);
  const counterspells=cast?[]:this.counterspellCandidates(actor,spell);
  if(threats.length||counterspells.length){
   if(cast)this.s.activeSpellCasts=this.s.activeSpellCasts.filter(c=>c!==cast);
   this.s.pendingSpellCast={id:`cast_${++this.s.castingSerial}`,actor,spell:clone(spell),resourceSpent,threats,handled:[],counterspells,counterHandled:[],injuries:clone(context.injuries||[]),continuousChecks:clone(context.continuousChecks||{}),continuing:cast};
   this.note(`Casting ${spell.name} pauses for ${threats.length} AoO(s) and ${counterspells.length} readied counterspell(s).`);
   return {status:'needs_gm',reason:counterspells.length?'readied counterspell opportunities':'casting provokes',threats,counterspells,pendingSpell:spell.name};
  }
  const result=this.finishCastingAction(actor,spell,cast);
  if(!cast&&result.cast){const ongoing=this.s.activeSpellCasts.find(c=>c.id===result.cast.id);ongoing.injuries=clone(context.injuries);ongoing.continuousChecks=clone(context.continuousChecks);ongoing.resourceSpent=resourceSpent;result.cast=clone(ongoing);}
  return {...result,...(resourceSpent?{resourceSpent}: {})};
 }
 startCasting({actor,spell}={}){
  this.assert(unresolvedActions(this.s).length===0&&unresolvedDecisions(this.s).length===0,'Resolve pending combat/GM operation before casting');
  this.assert(this.active().id===actor,'Only active creature may cast');
  this.assert(!this.policy(actor,'one_move_only'),'Nauseated: cannot cast spells');
  this.assert(!this.castingFor(actor),'Cannot cast another spell while concentrating on a casting');
  this.assert(!this.concentrationFor(actor),'Stop concentration before casting another spell');
  this.validateSpell(spell);this.validateMapSpellPlacement(actor,spell);
  spell=this.bindSpellResource(actor,spell);
  this.assert(!spell.counterspell,'Use ready_counterspell for a counterspell');
  if(spell.dispel){
   this.spellInteractionRange(actor,spell.targets[0],spell);
   if(spell.dispel.effectId)this.assert(this.ongoingSpellEffects(spell.targets[0]).some(g=>g.effectIds.includes(spell.dispel.effectId)||g.eventIds.includes(spell.dispel.effectId)),'No such ongoing spell effect on this target');
  }
  if(!this.castingRounds(spell.castingTime)){
   if(spell.delivery?.type==='ray')for(const target of spell.targets)this.preflightSpellAttack(actor,target,spell);
   if(spell.delivery?.type==='touch'&&spell.delivery.attemptOnCast&&spell.targets[0]!==actor)this.preflightSpellAttack(actor,spell.targets[0],spell);
  }
  return this.payCastingAction(actor,spell);
 }
 continueLongCasting({actor}={}){
  const cast=this.s.activeSpellCasts.find(c=>c.actor===actor);
  this.assert(cast&&cast.status==='casting','No unfinished long casting for this creature');
  this.assert(unresolvedActions(this.s).length===0&&unresolvedDecisions(this.s).length===0,'Resolve pending combat/GM operation first');
  this.assert(actor===this.active().id,'Only active creature may continue casting');
  this.assert(cast.paidRound===this.s.round-1&&cast.roundsPaid<cast.totalRounds,'Casting already paid this round or ready for completion');
  return this.payCastingAction(actor,cast.spell,cast);
 }
 resolveCastingAoO({actor,take}={}){
  const p=this.s.pendingSpellCast;
  this.assert(p&&p.threats.includes(actor)&&!(p.handled||[]).includes(actor),'No unresolved casting AoO for this creature');
  this.assert(typeof take==='boolean','Choose whether to take the casting AoO');
  this.assert(!this.s.interrupt&&!this.s.pendingRider,'Resolve the attack rider before another casting AoO');
  let attack=null;
  if(take){
   this.assert(this.canTakeAoO(actor,p.actor),'Creature no longer has a legal casting AoO');
   this.assert((this.s.aooUsed[actor]||0)<this.aooLimit(actor),'No AoO uses remain');
   this.s.aooUsed[actor]=(this.s.aooUsed[actor]||0)+1;
   attack=this.resolveAttack(actor,p.actor,'Casting AoO');
  }else this.note(`${this.find(actor).name} declines the casting AoO.`);
  p.handled ||= [];p.handled.push(actor);
  return {status:'needs_gm',reason:'confirm remaining casting AoOs, then continue spell',attack,remaining:p.threats.filter(id=>!p.handled.includes(id))};
 }
 continueCasting({damageTaken=0,aooResolved=false}={}){
  const pending=this.s.pendingSpellCast;
  this.assert(!!pending,'No pending spell');
  this.assert(this.remainingCounterspells(pending).length===0,'Resolve or decline readied counterspells before continuing');
  this.assert(aooResolved===true||(pending.handled?.length===pending.threats.length),'GM must explicitly confirm AoO adjudication');
  const owned=new Set();for(let p=pending;p;p=p.parentCasting)if(p.counterEventId)owned.add(p.counterEventId);
  this.assert(!this.s.interrupt&&!this.s.pendingRider&&(!this.s.pendingReadyAction||owned.has(this.s.pendingReadyAction.id))&&!this.s.pendingEventDecisions.some(e=>!owned.has(e.id)),'Resolve the attack rider or Readied Action before continuing the spell');
  this.assert(magicInt(damageTaken,0,100000),'Invalid spellcasting damage');
  this.assert(!damageTaken||!(pending.injuries||[]).some(i=>i.reason==='failed damaged-while-casting concentration'),'Damage already checked automatically; omit damageTaken');
  if(aooResolved&&pending.handled?.length!==pending.threats.length)this.note('GM confirms externally adjudicated casting AoOs.');
  let injury=null;
  if(damageTaken)injury=this.castingDamage(pending.actor,damageTaken);
  if(!pending.lostReason&&this.castingIncapacitated(pending.actor))this.loseCasting(pending,'caster incapacitated');
  if(pending.counterEventId)return this.finishCounterCasting(pending);
  this.s.pendingSpellCast=null;
  if(pending.lostReason)return {status:'lost',reason:pending.lostReason,...(injury?.concentration?{concentration:injury.concentration}:{})};
  const cast=pending.continuing;
  if(cast){cast.injuries=clone(pending.injuries);cast.continuousChecks=clone(pending.continuousChecks||{});this.s.activeSpellCasts.push(cast);}
  const result=this.finishCastingAction(pending.actor,pending.spell,cast);
  if(!cast&&result.cast){const ongoing=this.s.activeSpellCasts.find(c=>c.id===result.cast.id);ongoing.injuries=clone(pending.injuries);ongoing.continuousChecks=clone(pending.continuousChecks||{});ongoing.resourceSpent=pending.resourceSpent;result.cast=clone(ongoing);}
  return {...result,...(injury?.concentration?{concentration:injury.concentration}:{})};
 }
 completeCasting({actor,targets,area}={}){
  const cast=this.s.activeSpellCasts.find(c=>c.actor===actor);
  this.assert(cast?.status==='ready','Spell has not reached its completion point');
  this.assert(!this.s.pendingInitiativeEvent&&!this.s.pendingEventDecisions.length&&!this.s.pendingTimeEvent&&!this.s.interrupt&&!this.s.pendingSpellCast,'Resolve preceding GM/interrupt checkpoint before completing the spell');
  this.assert(!(targets!==undefined&&area!==undefined),'Choose targets OR area');
  if(this.castingIncapacitated(actor)){
   const lost=this.loseCasting(cast,'caster incapacitated');this.resumeDeferredTurnStart();return lost;
  }
  const spell=clone(cast.spell);
  if(targets!==undefined){spell.targets=targets;delete spell.area;}
  if(area!==undefined){spell.area=area;delete spell.targets;}
  this.validateSpell(spell);
  this.s.activeSpellCasts=this.s.activeSpellCasts.filter(c=>c!==cast);
  const activity=this.s.actions.activity;
  const resolution=this.resolveSpell(actor,spell);
  // Completion belongs before the new turn, not to that turn's action budget.
  this.s.actions.activity=activity;
  this.recordCasting(cast,'resolved');
  this.resumeDeferredTurnStart();
  return this.spellOutcome(resolution);
 }
 cancelCasting({actor,reason='caster voluntarily stops casting'}={}){
  const cast=this.castingFor(actor);this.assert(cast,'No casting for this creature');
  this.assert(typeof reason==='string'&&reason.trim().length>0&&reason.length<=500,'Invalid cancellation reason');
  const result=this.loseCasting(cast,reason);
  // AoO adjudication remains pending even when the spell has been lost.
  this.resumeDeferredTurnStart();return result;
 }
 interruptCasting({actor,kind='check',dc,damage,reason}={}){
  const cast=this.focusFor(actor);this.assert(cast,'No casting or maintained spell for this creature');
  if(kind==='break')return cast.maintenanceEventId?this.stopConcentration({actor,reason}):this.cancelCasting({actor,reason});
  this.assert(['check','continuous_damage'].includes(kind),'Unknown casting interruption kind');
  if(kind==='continuous_damage'){
   this.assert(magicInt(damage,0,100000),'Invalid continuous damage');dc=10+Math.floor(damage/2)+cast.spell.level;
   reason='failed continuous-damage concentration';
  }
  this.assert(magicInt(dc,0,100000)&&typeof reason==='string'&&reason.trim().length>0&&reason.length<=500,'Concentration interruption needs DC and reason');
  const result=this.checkCasting(cast,dc,reason,damage||0);
  if(result.status==='lost')this.resumeDeferredTurnStart();return result;
 }
 lifecycleStatus(){return {...super.lifecycleStatus(),spellcasting:this.castingOverview()};}
 inspect(){return {...super.inspect(),pendingSpellCast:clone(this.s.pendingSpellCast),spellcasting:this.castingOverview()};}
 dispatch(cmd,role='actor'){
  this.assert(magicObj(cmd),'Command must be an object');
  this.assert(['gm','actor','player'].includes(role),'Unknown role');
  if(isReadOnlyCommand(cmd.op))return this.dispatchMagic(cmd,role);
  // Presentation edits use normal undo selection, but never resolve mechanics.
  if(['gm_set_map_artwork','gm_save_map','gm_delete_map','gm_set_player_display','gm_set_player_view'].includes(cmd.op))return this.transaction(()=>{
   const result=this.dispatchMagic(cmd,role);this.s.actions.activity=Math.max(1,this.s.actions.activity);return result;
  });
  // Automatic checkpoints suspend new gameplay, but retain the existing GM
  // adjudications and continuation commands needed to resolve the checkpoint.
  if(['stand_up','crawl','total_defense','move','double_move','charge','attack','full_attack','full_attack_next','use_action','end_turn',
   'delay_turn','maneuver','grapple_action','replace_attack','reload_weapon','draw_ammunition','remove_dirty_trick',
   'cast_spell','ready_counterspell','use_immediate','maintain_concentration'].includes(cmd.op))
   this.assert(!this.turnStartBlocked()&&!this.s.deferredTurnStart,'Resolve the pending GM/pre-turn checkpoint before taking another action');
  return this.transaction(()=>{
   const checkpoint=this.turnStart,featureState=this.featureStateSignature(),mapRevision=this.s.scene.revision;
   const result=this.dispatchMagic(cmd,role);
   if(!['undo_turn','undo_round'].includes(cmd.op)){
    // Accepted manual mutations belong to this turn even if their subsystem
    // does not spend an action (HP, ammunition, resources, GM corrections).
    if(this.turnStart===checkpoint&&this.s.actions.activity===0&&!['gm_advance_time','gm_advance_to_event'].includes(cmd.op))this.s.actions.activity=1;
    this.finishVitalityCommand();
    this.reconcileConcentration();
    this.flushSummons();
    if(this.s.scene.revision===mapRevision&&this.featureStateSignature()!==featureState){this.mapRevisionChanged();this.syncZones();}
   }
   return this.withSpatialAdvisories(result);
  });
 }
 dispatchMagic(cmd,role='actor'){
  const op=cmd?.op;
  const ops=['gm_preview_spell_area','gm_resolve_spell','cast_spell','gm_continue_spell','gm_check_concentration','continue_spell','complete_spell','cancel_spell','gm_resolve_casting_aoo','gm_interrupt_spell','gm_get_spellcasting','deliver_touch_spell','gm_discharge_touch_spell','ready_counterspell','gm_resolve_counterspell','maintain_concentration','stop_concentration'];
  if(op==='gm_get_persistent_areas'){this.assert(role==='gm','Only GM may inspect persistent areas');return this.persistentAreasOverview();}
  const hadCastingDecision=this.hasCastingDecision();
   if(!ops.includes(op)){
    if(this.s.pendingSpellCast&&['end_turn','gm_end_initiative','gm_advance_time','gm_advance_to_event','delay_turn'].includes(op))this.assert(false,'Resolve the provoking spell and its AoOs before advancing combat or time');
    if(['delay_turn','gm_end_initiative','gm_begin_initiative'].includes(op))this.assert(!this.s.activeSpellCasts.length,'Complete or cancel ongoing casting before changing encounter timing');
    const result=super.dispatch(cmd,role);
    if(hadCastingDecision&&!this.hasCastingDecision()&&!isReadOnlyCommand(op)&&!['undo_turn','undo_round'].includes(op))this.resumeDeferredTurnStart();
    return result;
   }
   const gameplay=['cast_spell','continue_spell','complete_spell','cancel_spell','deliver_touch_spell','ready_counterspell','maintain_concentration','stop_concentration'].includes(op);
   this.assert(role==='gm'||(role==='actor'&&gameplay),'Only the GM can preview/adjudicate magic');
   if(role==='actor')this.assert(cmd.actor===this.active().id,'Only active creature may control its casting');
   if(op==='gm_get_spellcasting')return this.castingOverview();
   if(op==='maintain_concentration')return this.maintainConcentration(cmd);
   if(op==='stop_concentration')return this.stopConcentration(cmd);
   if(op==='ready_counterspell')return this.readyCounterspell(cmd);
   if(op==='gm_resolve_counterspell')return this.resolveCounterspell(cmd);
   if(op==='deliver_touch_spell')return this.deliverTouchSpell(cmd,role);
   if(op==='gm_discharge_touch_spell')return this.contactTouchSpell(cmd);
   if(op==='gm_preview_spell_area')return this.previewSpellArea(cmd.area);
   if(op==='gm_resolve_spell'){this.note('GM override: resolve spell without casting time or action cost.');return this.resolveSpell(cmd.actor,cmd.spell);}
   if(op==='gm_check_concentration'){
    this.find(cmd.actor);this.assert(magicInt(cmd.dc,0,100000),'Invalid concentration DC');
    this.assert(magicInt(cmd.casterLevel,1,100),'Invalid caster level');
    return this.concentration(cmd.actor,{casterLevel:cmd.casterLevel,ability:cmd.ability,concentrationBonus:cmd.bonus},cmd.dc);
   }
   if(op==='cast_spell')return this.startCasting(cmd);
   if(op==='gm_continue_spell')return this.continueCasting(cmd);
   if(op==='continue_spell')return this.continueLongCasting(cmd);
   if(op==='complete_spell')return this.completeCasting(cmd);
   if(op==='cancel_spell')return this.cancelCasting(cmd);
   if(op==='gm_resolve_casting_aoo')return this.resolveCastingAoO(cmd);
   if(op==='gm_interrupt_spell')return this.interruptCasting(cmd);
 }
}
