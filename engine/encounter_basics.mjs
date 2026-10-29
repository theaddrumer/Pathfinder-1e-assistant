/** V3.31: vitality, small action/timer bookkeeping, and inanimate object tokens.
 * Reuses HP resolvers, conditions, clock, Pending Events, registry and geometry.
 */
import {PersistentAreasGame} from './persistent_areas.mjs';
import {clone} from './core.mjs';
import {DAMAGE_TYPES,EFFECT_TAGS,DR_BYPASS_TAGS,ENERGY_TYPES} from './trait_library.mjs';
import {OBJECT_MATERIALS,OBJECT_SIZE_AC,hardnessDamage} from './object_rules.mjs';
import {unresolvedActions,isReadOnlyCommand} from './lifecycle.mjs';
const basicInt=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
const basicObj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const basicText=v=>typeof v==='string'&&v.trim().length>0&&v.length<=120;
const basicTags=new Set([...DAMAGE_TYPES,...EFFECT_TAGS,...DR_BYPASS_TAGS]);
export class EncounterBasicsGame extends PersistentAreasGame {
 constructor(state){
  super(state);
  for(const c of this.s.creatures)this.syncVitality(c.id);
  this.turnStart=clone(this.s);this.roundStart=clone(this.s);
 }
 validateRecovery(spec){
  this.assert(basicObj(spec)&&Object.keys(spec).every(k=>['fastHealing','regeneration','disabled','excludedDamage'].includes(k)),'Invalid recovery profile');
  if(spec.fastHealing!==undefined)this.assert(basicInt(spec.fastHealing,0,10000),'Invalid fast healing');
  if(spec.disabled!==undefined)this.assert(typeof spec.disabled==='boolean','Invalid recovery switch');
  if(spec.excludedDamage!==undefined)this.assert(basicInt(spec.excludedDamage,0,1000000),'Invalid recovery-excluded damage');
  if(spec.regeneration!==undefined){
   const r=spec.regeneration;
   this.assert(basicObj(r)&&Object.keys(r).every(k=>['amount','bypass'].includes(k))&&basicInt(r.amount,1,10000),'Invalid regeneration');
   this.assert(Array.isArray(r.bypass)&&r.bypass.length<=20&&new Set(r.bypass).size===r.bypass.length&&r.bypass.every(t=>basicTags.has(t)),'Regeneration bypass needs known damage/weapon/effect tags');
  }
 }
 validateCreature(def){
  const safe=clone(def);delete safe.recovery;delete safe.objectProfile;
  if(safe.stats?.hp!==undefined){this.assert(basicInt(safe.stats.hp,-1000000,1000000),'Invalid HP');safe.stats.hp=Math.max(0,safe.stats.hp);}
  super.validateCreature(safe);
  if(def.recovery!==undefined){this.validateRecovery(def.recovery);this.assert(!def.objectProfile,'Objects cannot have creature recovery');
   if(def.recovery.regeneration)this.assert(!['construct','undead'].includes(def.creatureType),'Regeneration requires Constitution');}
  if(def.objectProfile!==undefined)this.validateObjectProfile(def.objectProfile);
 }
 initializeCreature(c,def){
  super.initializeCreature(c,def);
  if(def.recovery)c.recovery=clone(def.recovery);
  if(def.objectProfile)c.objectProfile=clone(def.objectProfile);
 }
 onCreatureSpawned(c,cmd){const result=super.onCreatureSpawned(c,cmd);this.syncVitality(c.id);return result;}
 adjustedHp(c,value){return c.objectProfile||this.traits(c.id).noCon?Math.max(0,Math.min(c.maxHp,value)):Math.min(c.maxHp,value);}
 nativeBasicEvent(kind,actor){return (this.s.pendingEvents||[]).find(e=>e.kind===kind&&e.actor===actor&&e.status==='active');}
 regenerationActive(id){
  const c=this.find(id);
  return !!c.recovery?.regeneration&&!c.recovery.disabled&&!this.nativeBasicEvent('regeneration_suppressed',id)&&!c.vitality?.dead;
 }
 healthState(id){
  const c=this.find(id),v=c.vitality||{},traits=this.traits(id);
  if(c.objectProfile)return {target:id,hp:c.hp,maxHp:c.maxHp,status:c.hp<=0?'destroyed':c.hp<=Math.floor(c.maxHp/2)?'broken':'intact',object:true};
  const regeneration=this.regenerationActive(id),con=this.stat(id,'con');
  const conDestroyed=!traits.noCon&&(con<=0||(this.s.abilityDamage?.[id]?.con||0)>=con);
  const explicitDeath=super.hasCondition(id,'dead');
  const dead=!!v.dead||explicitDeath||(!regeneration&&(c.slainByEnergyDrain||conDestroyed||(traits.noCon?c.hp<=0:c.hp<=-con)));
  const status=dead?'dead':c.hp>0?'healthy':c.hp===0?'disabled':v.conscious?'disabled':v.stable||super.hasCondition(id,'stable')?'stable':'dying';
  return {target:id,hp:c.hp,maxHp:c.maxHp,status,deathThreshold:traits.noCon?0:-con,regeneration,
   fastHealing:c.recovery?.disabled?0:c.recovery?.fastHealing||0,
   regenerationAmount:c.recovery?.regeneration?.amount||0,suppressed:!!this.nativeBasicEvent('regeneration_suppressed',id),
   aided:!!v.aided,continuousDamage:!!v.continuousDamage,nextAt:v.nextAt??null};
 }
 healthOverview(){return this.s.creatures.map(c=>this.healthState(c.id));}
 syncVitality(id){
  const c=this.find(id);if(c.objectProfile)return;
  c.vitality ||= {};
  const v=c.vitality,state=this.healthState(id),now=this.s.worldRounds||0;
  if(state.status==='dead'){
   if(!v.dead)this.note(`${c.name} dies.`);
   v.dead=true;v.nextAt=null;v.wakeAt=null;return;
  }
  if(c.hp>=0){v.stable=false;v.conscious=false;v.wakeAt=null;}
  if(state.status==='stable'&&!v.conscious)v.wakeAt ??= now+600;
  else v.wakeAt=null;
  const cap=Math.max(0,c.maxHp-(c.recovery?.excludedDamage||0));
  const heals=!c.recovery?.disabled&&((c.recovery?.fastHealing||0)>0||!!c.recovery?.regeneration)&&
   (c.hp<cap||(this.s.nonlethalDamage?.[id]||0)>0);
  const everyRound=state.status==='dying'||heals;
  v.nextAt=everyRound?Math.min(v.nextAt??now+1,now+1):v.wakeAt;
 }
 canAct(id){
  const c=this.find(id);if(c.objectProfile||c.summonDeparture)return false;
  return ['healthy','disabled'].includes(this.healthState(id).status)&&!super.policy(id,'no_actions');
 }
 canBeAttacked(id){return !['dead','destroyed'].includes(this.healthState(id).status)&&!this.find(id).summonDeparture;}
 hasCondition(id,condition){
  const state=this.healthState(id);
  if(condition==='dead'&&state.status==='dead'||condition==='disabled'&&state.status==='disabled'||condition==='dying'&&state.status==='dying'||condition==='stable'&&state.status==='stable')return true;
  if(condition==='unconscious'&&['dying','stable'].includes(state.status))return true;
  return super.hasCondition(id,condition);
 }
 policy(id,tag){
  const state=this.healthState(id);
  if((state.object||['dead','dying','stable'].includes(state.status))&&['no_actions','no_movement','no_aoo'].includes(tag))return true;
  if(state.status==='disabled'&&['one_standard_or_move','half_speed'].includes(tag))return true;
  return super.policy(id,tag);
 }
 applyHpLoss(id,amount,context={}){
  const c=this.find(id);
  if(amount<=0&&!(context.tempHpAbsorbed>0))return;
  c.vitality ||= {};
  const v=c.vitality;
  // Damage absorbed by temporary HP still counts; immunity/resistance/hardness prevent the qualifying damage.
  const tags=new Set([context.damageType,...(context.metadata?.tags||[]),...(context.metadata?.weaponTags||[]),
   ...(context.metadata?.damageTypes||[]),...this.weaponBypassTags(context.source??null,context.metadata||{}),
   ...(context.components||[]).filter(r=>r.applied>0).flatMap(r=>[r.damageType,...(r.tags||[])])]);
  if(c.recovery?.regeneration?.bypass.some(t=>tags.has(t)))this.suppressRegeneration({target:id,rounds:1,reason:'qualifying damage'});
  c.hp=this.adjustedHp(c,c.hp-amount);
  if(!c.objectProfile){v.stable=false;v.conscious=false;v.wakeAt=null;}
  this.syncVitality(id);
 }
 healHitPoints(cmd={}){
  this.assert(basicInt(cmd.amount,0,100000),'Invalid HP healing');
  const c=this.find(cmd.target);this.syncVitality(c.id);
  if(c.objectProfile)return {target:c.id,hpHealed:0,blocked:'Use gm_repair_object for an object'};
  if(this.healthState(c.id).status==='dead')return {target:c.id,hpHealed:0,blocked:'Ordinary healing cannot restore life'};
  const result=super.healHitPoints(cmd);
  if(result.hpHealed>0&&c.hp<0){c.vitality.stable=true;c.vitality.aided=true;}
  this.syncVitality(c.id);return {...result,health:this.healthState(c.id)};
 }
 stabilize({target,aided=true}={}){
  const c=this.find(target);this.syncVitality(target);
  this.assert(!c.objectProfile&&c.hp<0&&this.healthState(target).status!=='dead','Stabilization needs a living creature below 0 HP');
  this.assert(typeof aided==='boolean','Invalid aid flag');
  c.vitality.stable=true;c.vitality.aided=aided;c.vitality.wakeAt=this.s.worldRounds+600;
  this.syncVitality(target);this.note(`${c.name} is stable${aided?' with aid':''}.`);return this.healthState(target);
 }
 recoveryCheck(target,{wake=false}={}){
  const c=this.find(target),v=c.vitality;
  const continuous=v.continuousDamage||(this.s.activeAilments||[]).some(a=>a.target===target&&this.s.ailmentCatalog[a.definition]?.kind==='dot');
  const d20=continuous&&!wake?null:this.rollDie(20),bonus=this.abilityCheckBonus(target,'con')+Math.min(0,c.hp);
  const success=d20!==null&&(d20===20||d20+bonus>=10);
  if(wake){
   if(success)v.conscious=true;
   else {if(!v.aided)c.hp=this.adjustedHp(c,c.hp-1);v.wakeAt=this.s.worldRounds+600;}
  }else if(success){v.stable=true;v.wakeAt=this.s.worldRounds+600;}
  else c.hp=this.adjustedHp(c,c.hp-1);
  this.note(`${c.name}: ${wake?'consciousness':'stabilization'} check ${d20===null?'automatic failure (continuous damage)':`${d20} + ${bonus} vs DC 10: ${success?'success':'failure'}`}.`);
  this.syncVitality(target);return {target,d20,bonus,dc:10,success,health:this.healthState(target)};
 }
 healthTick(id,{turn=false}={}){
  const c=this.find(id);this.syncVitality(id);
  if(c.objectProfile||c.summonDeparture||this.healthState(id).status==='dead')return null;
  const v=c.vitality,out={target:id};
  if(!turn&&(v.nextAt===null||v.nextAt>this.s.worldRounds))return null;
  const rate=c.recovery?.disabled?0:(c.recovery?.fastHealing||0)+(this.regenerationActive(id)?c.recovery.regeneration.amount:0);
  if(rate){
   const cap=Math.max(0,c.maxHp-(c.recovery?.excludedDamage||0)),amount=Math.min(rate,Math.max(0,cap-c.hp));
   if(amount)out.healing=this.healHitPoints({target:id,amount});
   if(rate>amount&&(this.s.nonlethalDamage?.[id]||0)>0)out.nonlethal=this.healNonlethal({target:id,amount:rate-amount});
  }
  if(this.healthState(id).status==='dying')out.check=this.recoveryCheck(id);
  else if(v.wakeAt!==null&&v.wakeAt!==undefined&&v.wakeAt<=this.s.worldRounds)out.check=this.recoveryCheck(id,{wake:true});
  v.nextAt=null;this.syncVitality(id);return out;
 }
 beginTurnEffects(context){
  const result=super.beginTurnEffects(context);
  return {...result,health:this.healthTick(context.actor,{turn:true})};
 }
 advanceTime(options={}){
  for(const c of this.s.creatures)this.syncVitality(c.id);
  this._advancingHealthTime=true;
  try{return super.advanceTime(options);}finally{this._advancingHealthTime=false;}
 }
 onPendingClockAdvanced(){
  const result=super.onPendingClockAdvanced();
  if(this._advancingHealthTime)for(const e of [...this.s.pendingEvents])if(e.kind==='immediate'&&e.duration.type==='turn_end'&&e.createdAt.worldRounds+1<=this.s.worldRounds)this.expirePendingEvent(e,'off-turn immediate recovered during elapsed time');
  if(this._advancingHealthTime)for(const c of [...this.s.creatures])if(c.vitality?.nextAt!=null&&c.vitality.nextAt<=this.s.worldRounds)this.healthTick(c.id);
  return result;
 }
 configureRecovery({target,recovery}={}){
  const c=this.find(target);this.validateRecovery(recovery);this.assert(!c.objectProfile,'Objects use repair');
  if(recovery.regeneration)this.assert(!this.traits(target).noCon,'Regeneration requires Constitution');
  c.recovery=clone(recovery);this.syncVitality(target);return this.healthState(target);
 }
 spendAction(actor,type,label){
  if(type==='swift')this.assert(!this.nativeBasicEvent('immediate',actor),'Swift action already spent by an off-turn immediate action');
  const disabled=this.healthState(actor).status==='disabled',hp=this.find(actor).hp;
  const result=super.spendAction(actor,type,label);
  if(disabled&&type==='standard')this.s.pendingDisabledStrain={actor,hp,label};
  return result;
 }
 finishVitalityCommand(){
  for(const c of this.s.creatures){
   this.syncVitality(c.id);
   if(c.objectProfile?.attendedBy&&!this.s.creatures.some(a=>a.id===c.objectProfile.attendedBy&&!a.summonDeparture))c.objectProfile.attendedBy=null;
  }
  const strain=this.s.pendingDisabledStrain;
  if(strain&&unresolvedActions(this.s).length===0){
   this.s.pendingDisabledStrain=null;
   const c=this.s.creatures.find(c=>c.id===strain.actor);
   if(c&&c.hp<=strain.hp&&this.healthState(c.id).status!=='dead'){
    this.applyHpLoss(c.id,1);this.note(`${c.name} loses 1 HP after a strenuous action while disabled.`);
   }
  }
 }
 basicTimer({kind,actor,label,rounds=1,payload={}}){
  const init=this.s.initiative?.enabled,score=init?this.s.initiative.entries.find(e=>e.id===this.active()?.id)?.score:null;
  this.assert(basicInt(rounds,1,100000),'Timer needs 1–100000 rounds');
  this.assert(!init||Number.isInteger(score),'Active actor needs initiative');
  const duration=kind==='immediate'?{type:'turn_end',actor}:
   init?{type:'initiative',afterRounds:rounds,atScore:score,onExpire:'expire'}:{type:'time',count:rounds,unit:'round',onExpire:'expire'};
  const id=`${kind}_${++this.s.registeredSeq}`;
  this._registeringBasicEvent=true;
  try{return this.registerPendingEvent({id,kind,actor,label,trigger:'Native bookkeeping timer; expires automatically.',requiresInput:false,duration,payload});}
  finally{this._registeringBasicEvent=false;}
 }
 validateBasicEvent({kind,actor,payload,duration,requiresInput}){
  this.assert(this._registeringBasicEvent,'Use the dedicated immediate/cooldown/regeneration command');this.find(actor);
  this.assert(!requiresInput&&basicObj(payload),'Invalid native timer');
  this.assert(kind==='immediate'?duration.type==='turn_end':['time','initiative'].includes(duration.type),'Invalid native deadline');
 }
 useImmediate({actor,label='Immediate action'}={}){
  this.assert(basicText(label),'Name the immediate action');
  this.assert(this.canAct(actor),'Creature cannot act');
  this.assert(!this.hasCondition(actor,'flat_footed'),'Flat-footed creatures cannot use an immediate action');
  this.assert(!this.nativeBasicEvent('immediate',actor),'Immediate action unavailable until after the coming turn');
  if(this.active()?.id===actor){this.spendAction(actor,'swift',label);return {actor,spent:'current swift'};}
  const event=this.basicTimer({kind:'immediate',actor,label:`Immediate: ${label}`.slice(0,150)});
  this.note(`${this.find(actor).name} uses ${label}; the coming swift action is spent. GM resolves the effect.`);
  return {actor,spent:'next swift',eventId:event.id};
 }
 onPendingTurnStart(actor){
  super.onPendingTurnStart(actor);
  if(this.nativeBasicEvent('immediate',actor))this.s.actions.resources.swift=0;
 }
 onPendingTurnEnd(actor){
  for(const e of [...this.s.pendingEvents])if(e.status==='active'&&e.duration.type==='turn_end'&&e.duration.actor===actor)this.expirePendingEvent(e,'end of actor turn');
 }
 onPendingEncounterEnd(){
  super.onPendingEncounterEnd();
  for(const e of [...this.s.pendingEvents])if(e.kind==='immediate')e.duration={type:'time',at:this.s.worldRounds+1,onExpire:'expire'};
 }
 cooldownsOverview(){return this.s.pendingEvents.filter(e=>e.kind==='cooldown').map(e=>({target:e.actor,ability:e.payload.ability,label:e.label,eventId:e.id,duration:clone(e.duration)}));}
 setCooldown({target,ability,rounds}={}){
  this.find(target);this.assert(basicText(ability),'Name the ability');
  this.assert(!this.s.pendingEvents.some(e=>e.kind==='cooldown'&&e.actor===target&&e.payload.ability.toLowerCase()===ability.trim().toLowerCase()),'Ability is already cooling down');
  return this.basicTimer({kind:'cooldown',actor:target,label:`${ability.trim()} unavailable!`,rounds,payload:{ability:ability.trim()}});
 }
 suppressRegeneration({target,rounds=1,reason='GM adjudication'}={}){
  const c=this.find(target);this.assert(c.recovery?.regeneration,'Creature has no regeneration');
  this.assert(basicText(reason),'Supply suppression reason');
  const old=this.nativeBasicEvent('regeneration_suppressed',target);
  const event=this.basicTimer({kind:'regeneration_suppressed',actor:target,label:`Regeneration suppressed: ${c.name}`.slice(0,150),rounds,payload:{reason}});
  if(old){
   // Repeated matching damage refreshes the interval; never shortens a longer GM suppression.
   if(old.duration.type===event.duration.type){
    if(event.duration.type==='time')event.duration.at=Math.max(event.duration.at,old.duration.at);
    else if(old.duration.round>event.duration.round||old.duration.round===event.duration.round&&old.duration.score<event.duration.score)event.duration=clone(old.duration);
   }
   this.concludePendingEvent(old,'replaced','suppression refreshed');
   const live=this.s.pendingEvents.find(e=>e.id===event.id);live.duration=clone(event.duration);
  }
  this.syncVitality(target);return event;
 }
 concludePendingEvent(event,outcome,reason){
  const result=super.concludePendingEvent(event,outcome,reason);
  if(event.kind==='cooldown')this.note(`${this.find(event.actor).name}: ${event.payload.ability} ready${outcome==='expired'?'':' (GM cleared cooldown)'}.`);
  return result;
 }
 lifecycleStatus(){return {...super.lifecycleStatus(),health:this.healthOverview(),cooldowns:this.cooldownsOverview()};}
 validateObjectProfile(p){
  this.assert(basicObj(p)&&Object.keys(p).every(k=>['material','hardness','sizeCategory','ac','magicCasterLevel','attendedBy','energyMultiplier','rangedMultiplier'].includes(k)),'Invalid object profile');
  this.assert(basicInt(p.hardness,0,100000)&&basicInt(p.ac,-100,10000),'Object needs hardness and AC');
  this.assert(Object.hasOwn(OBJECT_SIZE_AC,p.sizeCategory),'Invalid object size');
  if(p.material!==undefined)this.assert(Object.hasOwn(OBJECT_MATERIALS,p.material),'Unknown object material');
  if(p.magicCasterLevel!==undefined)this.assert(basicInt(p.magicCasterLevel,1,100),'Invalid object caster level');
  if(p.attendedBy!==undefined&&p.attendedBy!==null)this.find(p.attendedBy);
  for(const k of ['energyMultiplier','rangedMultiplier'])if(p[k]!==undefined)this.assert([0,0.5,1,2].includes(p[k]),'Invalid object multiplier');
 }
 previewObject(spec={}){
  const {material='stone',thicknessInches=1,maxHp,hardness,sizeCategory='medium',ac,magicCasterLevel,attendedBy,energyMultiplier,rangedMultiplier}=spec;
  this.assert(Object.hasOwn(OBJECT_MATERIALS,material),'Unknown object material');
  this.assert(Number.isFinite(thicknessInches)&&thicknessInches>0&&thicknessInches<=100000,'Invalid thickness in inches');
  const preset=OBJECT_MATERIALS[material],hp=maxHp??Math.max(1,Math.floor(preset.hpPerInch*thicknessInches));
  this.assert(basicInt(hp,1,1000000),'Object HP must be 1–1000000');
  const profile={material,hardness:hardness??preset.hardness,sizeCategory,ac:ac??3+OBJECT_SIZE_AC[sizeCategory],
   ...(magicCasterLevel===undefined?{}:{magicCasterLevel}),...(attendedBy===undefined?{}:{attendedBy}),
   ...(energyMultiplier===undefined?{}:{energyMultiplier}),...(rangedMultiplier===undefined?{}:{rangedMultiplier})};
  this.validateObjectProfile(profile);return {maxHp:hp,objectProfile:profile,estimate:maxHp===undefined,thicknessInches};
 }
 spawnObject(cmd){
  const {id,name='Object',x,y,size=1}=cmd;
  const preview=this.previewObject(cmd),definition=`object_definition_${++this.s.registeredSeq}`;
  this.registerCreature({id:definition,name,objectProfile:preview.objectProfile,stats:{maxHp:preview.maxHp,size,speed:0,
   statTotals:{ac:preview.objectProfile.ac,touchAc:preview.objectProfile.ac,flatFootedAc:preview.objectProfile.ac}}});
  return {...this.spawnCreature({definition,id,name,x,y,team:'neutral',...(cmd.elevation!==undefined?{elevation:cmd.elevation}:{}),...(cmd.playerDisplay!==undefined?{playerDisplay:cmd.playerDisplay}:{})}),...preview};
 }
 traits(id){
  const result=super.traits(id);
  if(this.find(id).objectProfile)return {...result,noCon:true,immunities:[...new Set([...result.immunities,'nonlethal','critical','precision','ability_damage','ability_drain','energy_drain','bleed','poison','disease','mind_affecting','death','sleep','paralysis'])],notes:[...result.notes,'Inanimate object; GM decides whether the effect can affect this object.']};
  return result;
 }
 savingThrow(id,type,dc,options={}){
  const p=this.find(id).objectProfile;if(!p)return super.savingThrow(id,type,dc,options);
  this.assert(['fort','ref','will'].includes(type)&&basicInt(dc,0,100000),'Invalid object save');
  if(!p.magicCasterLevel&&!p.attendedBy)return {target:id,type,dc,d20:null,total:null,success:false,automaticFailure:true};
  const own=p.magicCasterLevel?2+Math.floor(p.magicCasterLevel/2):-Infinity;
  const attended=p.attendedBy?this.stat(p.attendedBy,type):-Infinity,bonus=Math.max(own,attended)+(options.bonus||0);
  const d20=this.rollDie(20),total=d20+bonus;return {target:id,type,dc,d20,total,bonus,success:d20===20||(d20!==1&&total>=dc)};
 }
 resolveProtection(id,amount,type,cause,metadata={},source=null,skipDR=false){
  const result=super.resolveProtection(id,amount,type,cause,metadata,source,skipDR),p=this.find(id).objectProfile;
  if(!p)return result;
  const factor=metadata.objectMultiplier??(ENERGY_TYPES.includes(type)?p.energyMultiplier??0.5:metadata.rangedWeapon?p.rangedMultiplier??0.5:1);
  result.applied=Math.floor(result.applied*factor);result.prevented=amount-result.applied;
  if(factor!==1)result.steps.push(`Object damage ×${factor} before hardness`);
  return result;
 }
 applyObjectHardness(id,amount,metadata){
  const p=this.find(id).objectProfile;if(!p)return null;
  const hit=this._castingHit?.target===id?this._castingHit:null;
  const hardness=Math.max(0,p.hardness-(hit?.hardnessUsed||0));
  const result=hardnessDamage(amount,p.hardness,metadata);
  if(!result.bypassed){result.prevented=Math.min(amount,hardness);result.applied=amount-result.prevented;if(hit)hit.hardnessUsed=(hit.hardnessUsed||0)+result.prevented;}
  return {...result,step:`Hardness ${p.hardness}: -${result.prevented}${result.bypassed?' (bypassed)':''}`};
 }
 repairObject({target,amount}={}){
  const c=this.find(target);this.assert(c.objectProfile,'Target is not an object');
  this.assert(c.hp>0,'Destroyed objects require GM reconstruction');this.assert(basicInt(amount,0,1000000),'Invalid repair amount');
  const old=c.hp;c.hp=Math.min(c.maxHp,c.hp+amount);this.note(`${c.name}: repaired ${c.hp-old} HP.`);return this.healthState(target);
 }
 beginInitiative(cmd){
  const result=super.beginInitiative(cmd);
  if(this.nativeBasicEvent('immediate',this.active().id))this.s.actions.resources.swift=0;
  this.healthTick(this.active().id,{turn:true});
  this.turnStart=clone(this.s);this.roundStart=clone(this.s);return result;
 }
 adjudicateHealth({target,hp,revive=false,stable=false,conscious=false}){
  const c=this.find(target);this.assert(basicInt(hp,c.objectProfile?0:-1000000,c.maxHp),'Invalid adjudicated HP');
  this.assert([revive,stable,conscious].every(v=>typeof v==='boolean'),'Invalid health flags');
  this.assert(unresolvedActions(this.s).length===0,'Finish the current action first');
  if(revive){
   this.removeCondition({target,condition:'dead'});c.vitality ||= {};c.vitality.dead=false;c.slainByEnergyDrain=false;
  }
  c.hp=hp;c.vitality ||= {};Object.assign(c.vitality,{stable,conscious:conscious&&hp<0,wakeAt:null,nextAt:null});
  this.syncVitality(target);return this.healthState(target);
 }
 delayTurn(){this.assert(this.canAct(this.active().id),'An incapacitated creature cannot Delay');return super.delayTurn();}
 syncConHp(target){if(this.traits(target).noCon)return {adjusted:false,reason:'No Constitution'};return super.syncConHp(target);}
 inspect(){return {...super.inspect(),health:this.healthOverview(),cooldowns:this.cooldownsOverview()};}
 dispatch(cmd,role='actor'){
  const op=cmd?.op;
  const ops=['gm_get_health','gm_set_recovery','gm_stabilize','gm_set_continuous_damage','gm_suppress_regeneration','use_immediate',
   'gm_get_cooldowns','gm_set_cooldown','gm_preview_object','gm_spawn_object','gm_repair_object'];
  if(!ops.includes(op))return super.dispatch(cmd,role);
  this.assert(role==='gm'||role==='actor'&&op==='use_immediate','Only GM may administer encounter mechanics');
  if(op==='gm_get_health')return this.healthOverview();
  if(op==='gm_get_cooldowns')return this.cooldownsOverview();
  if(op==='gm_preview_object')return this.previewObject(cmd);
  this.assert(!this.turnStartBlocked()&&!this.s.deferredTurnStart,'Resolve the pending GM/pre-turn checkpoint first');
  this.assert(unresolvedActions(this.s).length===0,'Finish the current action before changing encounter mechanics');
  return this.transaction(()=>{
   if(op==='gm_set_recovery')return this.configureRecovery(cmd);
   if(op==='gm_stabilize')return this.stabilize(cmd);
   if(op==='gm_set_continuous_damage'){
    const c=this.find(cmd.target);this.assert(typeof cmd.active==='boolean','Supply active boolean');
    c.vitality ||= {};c.vitality.continuousDamage=cmd.active;return this.healthState(c.id);
   }
   if(op==='gm_suppress_regeneration')return this.suppressRegeneration(cmd);
   if(op==='use_immediate')return this.useImmediate(cmd);
   if(op==='gm_set_cooldown')return this.setCooldown(cmd);
   if(op==='gm_spawn_object')return this.spawnObject(cmd);
   if(op==='gm_repair_object')return this.repairObject(cmd);
  });
 }
}
