/** Common combat options; native effects, Pending Events and continuations remain owners. */
import {SceneGame} from './scene.mjs';
import {STANDARD_CONDITIONS} from './conditions.mjs';
import {clone,abilityMod} from './core.mjs';
import {unresolvedActions} from './lifecycle.mjs';
const combatObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const combatInt=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
const combatFeats=['power_attack','deadly_aim','piranha_strike','combat_expertise','rapid_shot','point_blank_shot','vital_strike','improved_vital_strike','greater_vital_strike','furious_focus','critical_focus'];
const combatModes=['powerAttack','deadlyAim','piranhaStrike','combatExpertise','fightingDefensively','rapidShot','totalDefense'];
const combatFeatFor={powerAttack:'power_attack',deadlyAim:'deadly_aim',piranhaStrike:'piranha_strike',combatExpertise:'combat_expertise',rapidShot:'rapid_shot'};
// Segment must cross opposite rectangle borders, including their corners.
export function oppositeBorders(a,b,rect){
 const dx=b.x-a.x,dy=b.y-a.y,eps=1e-8;
 const crosses=(axis,value,other,lo,hi)=>{
  const d=axis==='x'?dx:dy;if(Math.abs(d)<eps)return false;
  const t=(value-a[axis])/d,q=a[other]+t*(other==='x'?dx:dy);
  return t>eps&&t<1-eps&&q>=lo-eps&&q<=hi+eps;
 };
 return crosses('x',rect.x,'y',rect.y,rect.y+rect.size)&&crosses('x',rect.x+rect.size,'y',rect.y,rect.y+rect.size)||
  crosses('y',rect.y,'x',rect.x,rect.x+rect.size)&&crosses('y',rect.y+rect.size,'x',rect.x,rect.x+rect.size);
}
export class CombatMechanicsGame extends SceneGame {
 validateCombatProfile(p){
  this.assert(combatObject(p)&&Object.keys(p).every(k=>['feats','acrobaticsRanks','cannotBeFlanked','totalsExcludeCombatOptions'].includes(k)),'Invalid combat profile');
  this.assert(p.totalsExcludeCombatOptions===true,'Combat profile must confirm totalsExcludeCombatOptions:true; import totals without these conditional bonuses/penalties');
  this.assert(Array.isArray(p.feats)&&p.feats.length<=combatFeats.length&&new Set(p.feats).size===p.feats.length&&p.feats.every(f=>combatFeats.includes(f)),'Unknown or duplicate supported combat feat');
  if(p.acrobaticsRanks!==undefined)this.assert(combatInt(p.acrobaticsRanks,0,100),'Supply Acrobatics ranks, not its total bonus');
  if(p.cannotBeFlanked!==undefined)this.assert(typeof p.cannotBeFlanked==='boolean','Invalid cannotBeFlanked flag');
 }
 validateCreature(def){
  const safe=clone(def);delete safe.stats?.combatProfile;
  for(const a of safe.stats?.attacks||[])for(const k of ['weaponHands','lightWeapon','offhand','threatens'])delete a[k];
  super.validateCreature(safe);
  if(def.stats?.combatProfile!==undefined)this.validateCombatProfile(def.stats.combatProfile);
  for(const [i,a] of (def.stats?.attacks||[]).entries()){
   if(a.weaponHands!==undefined)this.assert([1,2].includes(a.weaponHands),`definition.stats.attacks[${i}].weaponHands must be 1 or 2`);
   for(const k of ['lightWeapon','offhand','threatens'])if(a[k]!==undefined)this.assert(typeof a[k]==='boolean',`Invalid definition.stats.attacks[${i}].${k}: expected boolean`);
  }
 }
 hasCombatFeat(id,feat){return this.find(id).combatProfile?.feats?.includes(feat)===true;}
 combatMode(id,mode){return this.s.pendingEvents?.find(e=>e.kind==='combat_mode'&&e.actor===id&&e.status==='active'&&e.payload.mode===mode);}
 validateCombatEvent({kind,actor,payload,duration,requiresInput}){
  this.assert(this._registeringCombatEvent&&combatObject(payload)&&requiresInput===false,'Use the dedicated combat/immunity command');
  this.find(actor);
  this.assert(kind==='combat_mode'?duration.type==='turn_start':duration.type==='time','Invalid combat timer');
 }
 concludePendingEvent(e,outcome,reason){
  if(e.kind==='combat_mode'&&e.payload.effectId)this.removeEffect(e.payload.effectId,{countAsAction:false});
  return super.concludePendingEvent(e,outcome,reason);
 }
 addCombatMode(actor,mode){
  if(this.combatMode(actor,mode))return;
  const c=this.find(actor),scale=1+Math.floor(Math.max(0,c.bab)/4),mods=[];
  if(mode==='powerAttack'||mode==='piranhaStrike'||mode==='combatExpertise')mods.push({stat:'cmb',value:-scale,type:'untyped'});
  if(mode==='fightingDefensively')mods.push({stat:'attack',value:-4,type:'untyped'});
  if(mode==='rapidShot')mods.push({stat:'attack',value:-2,type:'untyped'});
  const ac=mode==='combatExpertise'?scale:mode==='fightingDefensively'?(c.combatProfile?.acrobaticsRanks>=3?3:2):mode==='totalDefense'?(c.combatProfile?.acrobaticsRanks>=3?6:4):0;
  if(ac)mods.push({stat:'ac_all',value:ac,type:'dodge'});
  const effectId=`combat_effect_${++this.s.registeredSeq}`;
  this.addEffect({id:effectId,name:mode,source:actor,target:actor,mods});
  this._registeringCombatEvent=true;
  try{this.registerPendingEvent({id:`combat_mode_${++this.s.registeredSeq}`,label:mode,kind:'combat_mode',actor,trigger:'Expires at the start of the actor’s next turn.',requiresInput:false,duration:{type:'turn_start',actor},payload:{mode,scale,effectId}});}
  finally{this._registeringCombatEvent=false;}
 }
 onPendingEncounterEnd(){
  super.onPendingEncounterEnd();
  for(const e of this.s.pendingEvents)if(e.kind==='combat_mode'&&e.duration.type==='turn_start')e.duration={type:'time',at:this.s.worldRounds+1,onExpire:'expire'};
 }
 helpless(id){return ['helpless','paralyzed','unconscious'].some(k=>this.hasCondition(id,k));}
 losesDex(id){return this.helpless(id)||['flat_footed','blinded','cowering','stunned','pinned'].some(k=>this.hasCondition(id,k));}
 effectsFor(id,key){
  const effects=super.effectsFor(id,key);
  if(['ac','touchAc','flatFootedAc','cmd'].includes(key)&&effects.some(m=>m.type==='dodge'&&m.value>0)&&(key==='flatFootedAc'||this.losesDex(id)))return effects.filter(m=>m.type!=='dodge'||m.value<=0);
  return effects;
 }
 stat(id,key){
  if(!this._combatOrdinaryAbilities){
   if(key==='dex'&&this.helpless(id)||key==='str'&&this.hasCondition(id,'paralyzed'))return 0;
   if(['ac','touchAc','flatFootedAc'].includes(key)&&this.helpless(id)){
    // Derive from supplied flat-footed AC instead of guessing printed Dex/dodge decomposition.
    this._combatOrdinaryAbilities=true;
    try{
     const dex=abilityMod(super.stat(id,'dex'))+this.damagePenalty(id,'dex');
     const flat=super.stat(id,'flatFootedAc');
     const ordinary=key==='touchAc'?super.stat(id,'touchAc')-Math.max(0,super.stat(id,'ac')-flat):flat;
     return ordinary-5-Math.min(0,dex);
    }finally{this._combatOrdinaryAbilities=false;}
   }
  }
  return super.stat(id,key);
 }
 attackDefenseContext(actor,target,attack,defense){
  const result=super.attackDefenseContext(actor,target,attack,defense);
  if(this.helpless(target)&&!['ranged','ranged_touch'].includes(attack.attackMode))result.acBonus-=4;
  return result;
 }
 aooLimit(id){return this.combatMode(id,'totalDefense')?0:super.aooLimit(id);}
 threatens(actor,target,vx,vy){
  if(!this.canAct(actor)||this.policy(actor,'one_move_only'))return false;
  const c=this.find(actor),armed=this.attackRoutine(actor).some(a=>{
   const mode=a.attackMode||c.attackMode||'melee',kind=a.attackKind||c.attackKind||'manufactured';
   return ['melee','melee_touch'].includes(mode)&&a.threatens!==false&&(kind!=='unarmed'||a.threatens===true)&&this.attackPostureAllowed(actor,a);
  });
  return armed&&super.threatens(actor,target,vx,vy);
 }
 flankingInfo(actor,target,profile={}){
  const a=this.find(actor),t=this.find(target),mode=profile.attackMode||a.attackMode||'melee';
  if(!['melee','melee_touch'].includes(mode)||a.reach<=0)return {flanking:false,reason:'Requires a melee attack with positive reach'};
  if(t.combatProfile?.cannotBeFlanked)return {flanking:false,reason:'Target configured as unflankable'};
  if(profile._flanking!==undefined)return {flanking:profile._flanking,reason:'Explicit GM ruling'};
  if(a.elevation||t.elevation)return {flanking:false,requiresAdjudication:true,reason:'Elevation requires a GM flanking ruling'};
  if(a.team===t.team)return {flanking:false,reason:'No opposing faction'};
  const candidates=this.s.creatures.filter(c=>c.id!==actor&&c.id!==target&&c.team!==t.team&&c.reach>0&&this.canAct(c.id)&&this.threatens(c.id,target));
  let elevated=false;
  for(const other of candidates){
   if(other.elevation){elevated=true;continue;}
   for(const p of this.footprint(a))for(const q of this.footprint(other))if(oppositeBorders({x:p.x+.5,y:p.y+.5},{x:q.x+.5,y:q.y+.5},t))return {flanking:true,partner:other.id};
  }
  return {flanking:false,...(elevated?{requiresAdjudication:true,reason:'An elevated potential flanker requires adjudication'}:{})};
 }
 prepareCombatOptions(cmd){
  const options=cmd.combatOptions??{};
  this.assert(combatObject(options)&&Object.keys(options).every(k=>combatModes.includes(k)&&k!=='totalDefense'||k==='vitalStrike'),'Unknown combat option');
  for(const [k,v] of Object.entries(options))this.assert(k==='vitalStrike'?combatInt(v,1,3):v===true,'Select options with true; active modes last until next turn and cannot be switched off early');
  if(!Object.keys(options).length)return;
  this.assert(['attack','full_attack','charge'].includes(cmd.op),'Choose combat options when beginning an attack, full attack or charge');
  this.assert(!unresolvedActions(this.s).length,'Resolve pending action before selecting combat options');
  this.assert(this.active()?.id===cmd.actor&&this.canAct(cmd.actor),'Only the active capable creature can select combat options');
  const profile=this.attackRoutine(cmd.actor)[cmd.op==='attack'?(cmd.index??0):0];this.assert(!!profile,'Unknown attack selection');
  const c=this.find(cmd.actor),mode=profile.attackMode||c.attackMode||'melee',melee=['melee','melee_touch'].includes(mode);
  for(const [key,feat] of Object.entries(combatFeatFor))if(options[key])this.assert(this.hasCombatFeat(cmd.actor,feat),`Creature has no configured ${feat}`);
  this.assert(!(options.powerAttack&&(options.piranhaStrike||this.combatMode(cmd.actor,'piranhaStrike'))||options.piranhaStrike&&this.combatMode(cmd.actor,'powerAttack')),'Power Attack and Piranha Strike cannot combine');
  if(options.piranhaStrike)this.assert(melee&&profile.lightWeapon===true,'Piranha Strike requires an explicitly light melee weapon');
  if(options.powerAttack)this.assert(melee,'Power Attack requires a melee attack');
  if(options.deadlyAim)this.assert(!melee,'Deadly Aim requires a ranged attack');
  if(options.combatExpertise)this.assert(['attack','full_attack'].includes(cmd.op)&&melee,'Combat Expertise requires a melee attack/full-attack action');
  if(options.fightingDefensively)this.assert(['attack','full_attack'].includes(cmd.op),'Fighting defensively requires an attack/full-attack action');
  if(options.fightingDefensively||options.combatExpertise)this.assert(!this.combatMode(cmd.actor,'totalDefense'),'Cannot combine with total defense');
  if(options.rapidShot){
   this.assert(cmd.op==='full_attack'&&mode==='ranged','Rapid Shot requires a ranged weapon full attack');
   this.assert(!this.combatMode(cmd.actor,'rapidShot'),'Rapid Shot extra attack already used this round');
  }
  if(options.vitalStrike){
   this.assert(cmd.op==='attack','Vital Strike only applies to the ordinary attack action');
   const feat=['vital_strike','improved_vital_strike','greater_vital_strike'][options.vitalStrike-1];
   this.assert(this.hasCombatFeat(cmd.actor,feat),`Creature has no configured ${feat}`);
  }
  for(const key of Object.keys(options))if(key!=='vitalStrike')this.addCombatMode(cmd.actor,key);
 }
 attackRoutine(id){
  const slots=super.attackRoutine(id);
  if(this._combatCommand?.actor===id){
   const cmd=this._combatCommand;
   const selected=slots[cmd.op==='attack'?(cmd.index??0):0];
   if(selected){if(cmd.flanking!==undefined)selected._flanking=cmd.flanking;if(cmd.precisionEligible!==undefined)selected._precisionEligible=cmd.precisionEligible;}
   if(cmd.op==='attack'&&cmd.combatOptions?.vitalStrike)slots[cmd.index??0]._vitalStrike=cmd.combatOptions.vitalStrike;
   if(cmd.op==='full_attack'&&cmd.combatOptions?.rapidShot){
    const ranged=slots.filter(a=>(a.attackMode||this.find(id).attackMode)==='ranged');
    this.assert(ranged.length>0,'Rapid Shot requires a ranged weapon');
    const best=ranged.reduce((a,b)=>a.attackOffset>=b.attackOffset?a:b);
    const extra={...clone(best),label:'Rapid Shot: '+best.label};
    for(const a of slots){delete a._flanking;delete a._precisionEligible;}
    if(cmd.flanking!==undefined)extra._flanking=cmd.flanking;if(cmd.precisionEligible!==undefined)extra._precisionEligible=cmd.precisionEligible;
    slots.unshift(extra);
    this.assert(slots.length<=21,'Too many attacks');
   }
  }
  return slots;
 }
 resolveAttack(actor,target,label='Attack',profile=null,defense='ac'){
  if(profile===null&&label==='AoO')profile=this.attackRoutine(actor).find(a=>['melee','melee_touch'].includes(a.attackMode||this.find(actor).attackMode||'melee'));
  return super.resolveAttack(actor,target,label,profile,defense);
 }
 combatAttackAdjustments(actor,target,profile={},description={}){
  const c=this.find(actor),mode=description.attackMode||profile.attackMode||c.attackMode||'melee',melee=['melee','melee_touch'].includes(mode),touch=mode.endsWith('_touch');
  let attack=0,damage=0;const applied=[];
  const flank=this.flankingInfo(actor,target,profile);if(flank.flanking){attack+=2;applied.push('flanking');}
  if(flank.requiresAdjudication)this.note('Flanking not inferred: elevation requires a GM ruling.');
  const pa=this.combatMode(actor,'powerAttack'),ps=this.combatMode(actor,'piranhaStrike'),da=this.combatMode(actor,'deadlyAim'),ce=this.combatMode(actor,'combatExpertise');
  const first=!(this.s.actions.combatAttacks||0);
  if(melee&&(pa||ps)){
   const scale=(pa||ps).payload.scale;
   const focus=!!pa&&this.hasCombatFeat(actor,'furious_focus')&&profile.weaponHands===2&&this.active()?.id===actor&&first;
   attack-=focus?0:scale;
   if(!touch&&(!ps||profile.lightWeapon===true)){
    const off=profile.offhand||['offhand','natural_secondary'].includes(profile.role)||profile.naturalRole==='secondary'||(profile.naturalRole===undefined&&description.primary===false);
    const heavy=profile.weaponHands===2||profile.role==='natural_solo'||(profile.attackKind==='natural'&&profile.naturalRole!=='secondary'&&profile.damageAbility==='one_half_str');
    damage+=scale*(off?1:pa&&heavy?3:2);
   }
   applied.push(pa?'powerAttack':'piranhaStrike');if(focus)applied.push('furiousFocus');
  }
  if(!melee&&da){attack-=da.payload.scale;if(!touch)damage+=2*da.payload.scale;applied.push('deadlyAim');}
  if(melee&&ce){attack-=ce.payload.scale;applied.push('combatExpertise');}
  if(!melee&&this.hasCombatFeat(actor,'point_blank_shot')&&this.distance(c,this.find(target))*5<=30){
   attack++;damage++;applied.push('pointBlankShot');
  }
  return {attack,damage,flanking:flank,applied,confirmation:this.hasCombatFeat(actor,'critical_focus')?4:0};
 }
 recordCombatAttack(actor){
  if(this.active()?.id===actor)this.s.actions.combatAttacks=(this.s.actions.combatAttacks||0)+1;
 }
 advanceTime(cmd){
  this.assertTimeIdle();
  // Leaving turn-based play for elapsed time uses the existing world clock.
  if(!this.s.initiative?.enabled&&(cmd.stopAtNext||cmd.count>0))for(const e of this.s.pendingEvents)
   if(e.kind==='combat_mode'&&e.duration.type==='turn_start')e.duration={type:'time',at:this.s.worldRounds+1,onExpire:'expire'};
  return super.advanceTime(cmd);
 }
 startMove(actor,path,options={}){
  if(this.hasCondition(actor,'prone')&&options.action!=='gm_free')this.assert(options.action==='crawl','Prone: use crawl or stand_up before ordinary movement');
  if(options.action==='crawl'){
   this.assert(this.hasCondition(actor,'prone'),'Crawl requires prone');
   this.assert(Array.isArray(path)&&path.length===1,'Crawl moves one adjacent square per move action');
  }
  return super.startMove(actor,path,options);
 }
 onMovementSquare(c){
  const m=this.s.pendingMove;
  if(m?.action==='crawl'){
   m.crawlEntry=true;
   m.threats=this.s.creatures.filter(o=>o.id!==c.id&&!m.seen.includes(o.id)&&this.canTakeAoO(o.id,c.id)).map(o=>o.id);
   m.seen.push(...m.threats);
  }
  super.onMovementSquare(c);
  if(!this.s.interrupt&&m?.crawlEntry)this.offerCrawlEntry(m);
 }
 offerCrawlEntry(m){
  if(!this.canContinueMovement(m.actor)){m.crawlEntry=false;m.threats=null;return;}
  m.threats=m.threats.filter(id=>this.canTakeAoO(id,m.actor));
  const reactor=m.threats.shift();
  if(reactor){
   const c=this.find(m.actor);
   this.s.interrupt={type:'aoo',reactor,target:m.actor,reason:'crawl_entry',from:{x:c.x,y:c.y},to:{x:c.x,y:c.y}};
   this.note(`${c.name} crawls into a threatened square; ${this.find(reactor).name} may take an AoO.`);
  }else{m.crawlEntry=false;m.threats=null;}
 }
 continueMove(){
  const m=this.s.pendingMove;
  if(m?.crawlEntry){this.offerCrawlEntry(m);if(this.s.interrupt)return {status:'interrupt',interrupt:clone(this.s.interrupt)};}
  return super.continueMove();
 }
 completeRangedAction(pending){
  if(pending.kind!=='stand')return super.completeRangedAction(pending);
  this.s.pendingRangedAction=null;
  if(!this.canAct(pending.actor)||this.policy(pending.actor,'no_movement'))return {status:'stopped',reason:'Cannot complete standing'};
  this.removeCondition({target:pending.actor,condition:'prone'});
  return {status:'done',actor:pending.actor,standing:true};
 }
 standUp(actor){
  this.assert(!unresolvedActions(this.s).length,'Resolve pending action first');
  this.assert(this.hasCondition(actor,'prone'),'Creature is not prone');
  this.assert(!this.policy(actor,'no_movement'),'Condition prevents standing');
  this.spendAction(actor,'move','stand up');
  return this.createRangedCheckpoint({kind:'stand',actor,reactors:this.rangedAoOReactors(actor)});
 }
 sourceImmunity(target,source,ability){return this.s.pendingEvents.find(e=>e.kind==='source_immunity'&&e.actor===target&&e.status==='active'&&e.payload.source===source&&e.payload.ability===ability);}
 grantSourceImmunity({target,source,ability,count=24,unit='hour'}){
  this.find(target);this.find(source);
  this.assert(typeof ability==='string'&&/^[a-z][a-z0-9_-]{0,63}$/i.test(ability),'Use a stable ability identifier');
  this._registeringCombatEvent=true;let e;
  try{e=this.registerPendingEvent({id:`source_immunity_${++this.s.registeredSeq}`,label:`${ability} immunity (${source})`.slice(0,150),kind:'source_immunity',actor:target,requiresInput:false,trigger:'Blocks explicitly identified repeat exposure.',duration:{type:'time',count,unit},payload:{source,ability}});}
  finally{this._registeringCombatEvent=false;}
  const old=this.s.pendingEvents.find(x=>x.id!==e.id&&x.kind==='source_immunity'&&x.actor===target&&x.payload.source===source&&x.payload.ability===ability);
  if(old){const fresh=this.s.pendingEvents.find(x=>x.id===e.id);fresh.duration.at=Math.max(fresh.duration.at,old.duration.at);this.concludePendingEvent(old,'replaced','immunity refreshed');e=clone(fresh);}
  return e;
 }
 evaluateEffect(spec={}){
  const result=super.evaluateEffect(spec);
  if(spec.ability!==undefined){
   this.assert(typeof spec.source==='string'&&typeof spec.ability==='string'&&/^[a-z][a-z0-9_-]{0,63}$/i.test(spec.ability),'Source-specific checks require source and ability');
   this.find(spec.source);
   const immunity=this.sourceImmunity(spec.target,spec.source,spec.ability);
   if(immunity){result.blocked=true;result.blockedBy.push('source-specific immunity');result.immunityEvent=immunity.id;}
  }
  return result;
 }
 combatOverview(target){
  const ids=target?[this.find(target).id]:this.s.creatures.map(c=>c.id);
  return ids.map(id=>({target:id,profile:clone(this.find(id).combatProfile??null),modes:this.s.pendingEvents.filter(e=>e.kind==='combat_mode'&&e.actor===id).map(e=>({mode:e.payload.mode,expires:clone(e.duration)})),sourceImmunities:this.s.pendingEvents.filter(e=>e.kind==='source_immunity'&&e.actor===id).map(e=>({source:e.payload.source,ability:e.payload.ability,expires:clone(e.duration),eventId:e.id}))}));
 }
 dispatch(cmd,role='actor'){
  if(cmd.op==='gm_get_combat') {this.assert(role==='gm','GM query required');return this.combatOverview(cmd.target);}
  if(cmd.op==='gm_get_flanking'){this.assert(role==='gm','GM query required');const routine=this.attackRoutine(cmd.actor),index=cmd.index??0;this.assert(combatInt(index,0,routine.length-1),'Invalid attack index');return this.flankingInfo(cmd.actor,cmd.target,routine[index]);}
  if(['gm_set_combat_profile','gm_grant_source_immunity'].includes(cmd.op)){
   this.assert(role==='gm','GM setup required');this.assert(!unresolvedActions(this.s).length,'Finish pending resolution first');
   if(cmd.op==='gm_grant_source_immunity')return this.grantSourceImmunity(cmd);
   this.assert(!this.s.pendingEvents.some(e=>e.kind==='combat_mode'&&e.actor===cmd.target),'Wait for active combat modes to expire before changing the profile');
   this.validateCombatProfile(cmd.profile);this.find(cmd.target).combatProfile=clone(cmd.profile);return this.combatOverview(cmd.target);
  }
  if(cmd.op==='save'&&cmd.ability!==undefined){
   this.assert(role==='gm','Source-aware saves require GM adjudication');
   this.assert(!unresolvedActions(this.s).length,'Finish pending resolution first');
   this.assert(['fort','ref','will'].includes(cmd.save)&&combatInt(cmd.dc,0,10000),'Invalid saving throw');
   const immunity=this.evaluateEffect({target:cmd.target,source:cmd.source,ability:cmd.ability,tags:cmd.tags||[],save:cmd.save});
   if(immunity.blocked)return {skipped:true,...immunity};
  }
  if(cmd.op==='apply_condition'&&cmd.ability!==undefined){
   this.assert(role==='gm','Source-aware conditions require GM adjudication');
   this.assert(!unresolvedActions(this.s).length,'Finish pending resolution first');
   this.assert(Object.hasOwn(STANDARD_CONDITIONS,cmd.condition),'Unknown standard condition');
   const immunity=this.evaluateEffect({target:cmd.target,source:cmd.source,ability:cmd.ability,tags:cmd.tags||[]});
   if(immunity.blocked)return {skipped:true,...immunity};
  }
  if(['stand_up','crawl','total_defense'].includes(cmd.op)){
   this.assert(role==='gm'||role==='actor'||role==='player'&&cmd.actor==='hero','Not authorized');
   this.assert(!unresolvedActions(this.s).length&&!this.turnStartBlocked()&&!this.s.deferredTurnStart,'Resolve pending action/checkpoint first');
   if(cmd.op==='stand_up')return this.standUp(cmd.actor);
   if(cmd.op==='crawl')return this.startMove(cmd.actor,cmd.path,{action:'crawl'});
   this.assert(!this.combatMode(cmd.actor,'fightingDefensively')&&!this.combatMode(cmd.actor,'combatExpertise'),'Cannot combine total defense with fighting defensively or Combat Expertise');
   this.spendAction(cmd.actor,'standard','total defense');this.addCombatMode(cmd.actor,'totalDefense');return this.combatOverview(cmd.actor);
  }
  const attacks=['attack','full_attack','full_attack_next','charge','admin_attack'];
  if(cmd.combatOptions!==undefined)this.assert(attacks.includes(cmd.op),'combatOptions only supported on attack commands');
  if(attacks.includes(cmd.op)){
   if(cmd.flanking!==undefined)this.assert(role==='gm'&&typeof cmd.flanking==='boolean','Explicit flanking is a GM boolean ruling');
   this.prepareCombatOptions(cmd);
   const prior=this._combatCommand;this._combatCommand=cmd;
   try{
    // Continuation slots were already materialized; preserve per-strike adjudication.
    if(cmd.op==='full_attack_next'&&this.s.pendingFullAttack){const slot=this.s.pendingFullAttack.slots[this.s.pendingFullAttack.index];if(cmd.flanking!==undefined)slot._flanking=cmd.flanking;if(cmd.precisionEligible!==undefined)slot._precisionEligible=cmd.precisionEligible;}
    return super.dispatch(cmd,role);
   }finally{this._combatCommand=prior;}
  }
  return super.dispatch(cmd,role);
 }
}
