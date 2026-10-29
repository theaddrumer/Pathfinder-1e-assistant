/** V3.10 — Combat maneuvers as validated actions, not tactical decisions.
 * Supports CMB/CMD, AoO suspension, basic bull rush/trip/disarm/sunder,
 * and one-on-one grapple initiation/maintenance/escape/release.
 * Movement variants and complex multiple-opponent interactions remain explicitly unsupported.
 */
import {FoundationsGame} from './foundations.mjs';
import {hardnessDamage} from './object_rules.mjs';
import {clone,abilityMod,stackModifiers} from './core.mjs';
import {materialHardness} from './weapon_materials.mjs';

export const COMBAT_SIZES=Object.freeze({fine:-8,diminutive:-4,tiny:-2,small:-1,medium:0,large:1,huge:2,gargantuan:4,colossal:8});
export const MANEUVERS=Object.freeze({
 trip:{action:'standard_or_attack_replacement',provokes:true,sizeLimit:1,implemented:true},
 disarm:{action:'standard_or_attack_replacement',provokes:true,implemented:true},
 sunder:{action:'standard_or_attack_replacement',provokes:true,implemented:true},
 bull_rush:{action:'standard_or_charge_replacement',provokes:true,sizeLimit:1,implemented:true},
 grapple:{action:'standard',provokes:true,implemented:true},
 drag:{action:'standard',provokes:true,sizeLimit:1,implemented:true},
 reposition:{action:'standard',provokes:true,sizeLimit:1,implemented:true},
 overrun:{action:'standard_or_move',provokes:true,sizeLimit:1,implemented:true},
 dirty_trick:{action:'standard',provokes:true,implemented:true},
 steal:{action:'standard',provokes:true,implemented:true}
});
export const DIRTY_TRICK_CONDITIONS=Object.freeze(['blinded','dazzled','deafened','entangled','shaken','sickened']);
const SIZE_NAMES=Object.keys(COMBAT_SIZES);
const maneuverIdent=s=>typeof s==='string'&&/^[a-z][a-z0-9_-]{0,63}$/i.test(s);
const pickSize=c=>c.sizeCategory||(c.size>=2?(['medium','large','huge','gargantuan','colossal'][Math.min(c.size-1,4)]):'medium');

export class ManeuverGame extends FoundationsGame {
 constructor(state){super(state);this.s.grapples ||= [];this.s.pendingManeuver ||= null;this.s.maneuverSequence ??= 0;this.s.dirtyTricks ||= [];this.s.pendingOverrun ||= null;this.s.overrideLog ||= [];this.s.overrideSeq ??= 0;this.turnStart=clone(this.s);this.roundStart=clone(this.s);}
 validateCreature(def){
  const copy=clone(def);const x=copy.stats;
  for(const k of ['sizeCategory','legs','tripImmune','flying','freeHands','equipment','maneuverImprovements','greaterManeuvers','maneuverModifiers','grab'])delete x[k];
  super.validateCreature(copy);
  const s=def.stats;
  if(s.sizeCategory!==undefined&&!SIZE_NAMES.includes(s.sizeCategory))throw Error(`Invalid definition.stats.sizeCategory: ${JSON.stringify(s.sizeCategory)}. Use a lowercase ID: ${SIZE_NAMES.join(', ')}`);
  if(s.legs!==undefined&&(!Number.isInteger(s.legs)||s.legs<0||s.legs>100))throw Error('Invalid number of legs');
  if(s.freeHands!==undefined&&(!Number.isInteger(s.freeHands)||s.freeHands<0||s.freeHands>20))throw Error('Invalid free-hands count');
  for(const k of ['tripImmune','flying'])if(s[k]!==undefined&&typeof s[k]!=='boolean')throw Error(`Invalid ${k} flag`);
  if(s.grab!==undefined&&typeof s.grab!=='boolean')throw Error('Invalid inherent Grab maneuver flag');
  if(s.maneuverImprovements!==undefined){
   if(!Array.isArray(s.maneuverImprovements)||s.maneuverImprovements.length>15||new Set(s.maneuverImprovements).size!==s.maneuverImprovements.length||s.maneuverImprovements.some(k=>!Object.hasOwn(MANEUVERS,k)))throw Error('Invalid maneuver improvements');
  }
  if(s.greaterManeuvers!==undefined){
   if(!Array.isArray(s.greaterManeuvers)||s.greaterManeuvers.length>15||new Set(s.greaterManeuvers).size!==s.greaterManeuvers.length||s.greaterManeuvers.some(k=>!Object.hasOwn(MANEUVERS,k)))throw Error('Invalid greater maneuvers');
  }
  if(s.maneuverModifiers!==undefined){
   if(!s.maneuverModifiers||typeof s.maneuverModifiers!=='object'||Object.keys(s.maneuverModifiers).some(k=>!['cmb','cmd'].includes(k)))throw Error('Invalid maneuver modifier groups');
   for(const group of Object.values(s.maneuverModifiers)){
    if(!group||typeof group!=='object'||Object.entries(group).some(([k,v])=>!Object.hasOwn(MANEUVERS,k)||!Number.isInteger(v)||Math.abs(v)>100))throw Error('Invalid maneuver modifiers');
   }
  }
  if(s.equipment!==undefined){
   if(!Array.isArray(s.equipment)||s.equipment.length>40)throw Error('Invalid equipment');
   const seen=new Set();
   for(const item of s.equipment){
    if(!item||!maneuverIdent(item.id)||seen.has(item.id)||typeof item.name!=='string'||!item.name.length||item.name.length>100)throw Error('Invalid equipment ID/name');
    seen.add(item.id);
    if(!['held','worn','carried','dropped'].includes(item.location))throw Error('Invalid equipment location');
    for(const k of ['maxHp','hp','hardness'])if(item[k]!==undefined&&(!Number.isInteger(item[k])||item[k]<0||item[k]>100000))throw Error('Invalid item durability');
    if(item.maxHp!==undefined&&item.hp>item.maxHp)throw Error('Item HP exceeds maximum');
    if(item.broken!==undefined&&typeof item.broken!=='boolean')throw Error('Invalid broken item flag');
    if(item.fortification!==undefined&&(!Number.isInteger(item.fortification)||item.fortification<0||item.fortification>100))throw Error('Invalid item fortification percentage');
    if(item.kind!==undefined&&!['armor','shield','weapon','other'].includes(item.kind))throw Error('Invalid item kind');
    if(item.armorCategory!==undefined&&!['light','medium','heavy'].includes(item.armorCategory))throw Error('Invalid armor category');
    if(item.material!==undefined&&!['steel','alchemical_silver','cold_iron','adamantine','mithral'].includes(item.material))throw Error('Invalid equipment material');
    for(const k of ['armorBonus','enhancementBonus','maxDexBonus','arcaneSpellFailure','weight','armorCheckPenalty'])if(item[k]!==undefined&&(!Number.isInteger(item[k])||Math.abs(item[k])>1000))throw Error('Invalid defensive equipment field');
    for(const k of ['destroyed','nonproficient'])if(item[k]!==undefined&&typeof item[k]!=='boolean')throw Error('Invalid equipment status');
    for(const k of ['accessible','fastened'])if(item[k]!==undefined&&typeof item[k]!=='boolean')throw Error(`Invalid item ${k} flag`);
   }
  }
 }
 sizeCategory(id){return pickSize(this.find(id));}
 sizeMod(id){return COMBAT_SIZES[this.sizeCategory(id)];}
 stat(id,key){
  const total=super.stat(id,key);
  if(key!=='cmb'&&key!=='cmd')return total;
  const c=this.find(id);
  if(c.statTotals&&Object.hasOwn(c.statTotals,key))return total;
  // Historical fixtures stored attack-size and CMD-size offsets separately.
  const oldOffset=key==='cmb'?(c.sizeAttack||0):(c.sizeCMD||0);
  let fixed=total+this.sizeMod(id)-oldOffset;
  // Tiny and smaller use Dexterity instead of Strength for CMB.
  if(key==='cmb'&&SIZE_NAMES.indexOf(this.sizeCategory(id))<=2)
   fixed+=abilityMod(this.stat(id,'dex'))+this.damagePenalty(id,'dex')-abilityMod(this.stat(id,'str'))-this.damagePenalty(id,'str');
  return fixed;
 }
 cmdFor(targetId,kind){
  let cmd=this.stat(targetId,'cmd');
  const c=this.find(targetId);
  if(this.hasCondition(targetId,'flat_footed'))cmd-=Math.max(0,abilityMod(this.stat(targetId,'dex')));
  // AC-derived typed protections carry over to CMD (not armor, shield or natural armor).
  const accepted=['circumstance','deflection','dodge','insight','luck','morale','profane','sacred'];
  const ac=this.effectsFor(targetId,'ac').filter(m=>(m.value<0||accepted.includes(m.type))&&!(this.hasCondition(targetId,'flat_footed')&&m.type==='dodge'));
  const cmdMods=this.effectsFor(targetId,'cmd');
  cmd+=stackModifiers([...cmdMods,...ac])-stackModifiers(cmdMods);
  if(['trip','disarm','overrun'].includes(kind)&&Number.isInteger(c.legs)&&c.legs>2)cmd+=2*(c.legs-2);
  if(c.maneuverModifiers?.cmd?.[kind])cmd+=c.maneuverModifiers.cmd[kind];
  return cmd;
 }
 cmbFor(actorId,kind){
  const c=this.find(actorId);
  // CMB already includes the Grappled condition's -2 CMB modifier.
  // Do not count its separate -2 attack-roll modifier a second time.
  const grappleIds=new Set((this.s.conditionInstances||[])
    .filter(x=>x.target===actorId&&x.condition==='grappled').map(x=>x.effectId));
  const attackMods=this.effectsFor(actorId,'attack').filter(m=>!grappleIds.has(m.effectId));
  const cmbMods=this.effectsFor(actorId,'cmb');
  let b=this.stat(actorId,'cmb')-stackModifiers(cmbMods)+stackModifiers([...cmbMods,...attackMods]);
  if(c.maneuverModifiers?.cmb?.[kind])b+=c.maneuverModifiers.cmb[kind];
  // The condition explicitly exempts grapple initiation/maintenance and escape.
  if(grappleIds.size&&['grapple','escape'].includes(kind))b+=2;
  return b;
 }
 startMove(actorId,path,options={}){
  this.assert(!this.grappleFor(actorId),'Cannot use ordinary movement during an active grapple; escape or release first');
  return super.startMove(actorId,path,options);
 }
 teleport(id,x,y,reason='teleportation'){
  const grapple=this.grappleFor(id);
  if(grapple)this.releaseGrapple(grapple.holder,'loses hold by relocation of');
  return super.teleport(id,x,y,reason);
 }
 resolveAttack(actorId,targetId,label='Attack',profile=null,defense='ac'){
  if(profile?.itemId){
   const item=(this.find(actorId).equipment||[]).find(x=>x.id===profile.itemId);
   this.assert(item&&item.location==='held'&&!item.destroyed,'Weapon is not currently held or usable');
   profile={...profile,itemCondition:item.broken?'broken':profile.itemCondition};
  }
  return super.resolveAttack(actorId,targetId,label,profile,defense);
 }
 inspect(){return {...super.inspect(),grapples:clone(this.s.grapples),pendingManeuver:clone(this.s.pendingManeuver),
  maneuverDefinitions:clone(MANEUVERS),dirtyTricks:clone(this.s.dirtyTricks),pendingOverrun:clone(this.s.pendingOverrun),overrideLog:clone(this.s.overrideLog),combatManeuvers:Object.fromEntries(this.s.creatures.map(c=>[c.id,{
   sizeCategory:this.sizeCategory(c.id),cmb:this.stat(c.id,'cmb'),cmd:this.stat(c.id,'cmd'),
   equipment:clone(c.equipment||[])}]))};}
 removeEffect(id,options){
  const removed=super.removeEffect(id,options);
  if(removed&&this.s.dirtyTricks)this.s.dirtyTricks=this.s.dirtyTricks.filter(x=>x.effectId!==id);
  return removed;
 }
 checkManeuver(actor,target,kind,{bonus=0,penalty=0}={}){
  this.find(actor);this.find(target);
  this.assert(Object.hasOwn(MANEUVERS,kind)||['escape','pull','push'].includes(kind),'Unknown combat maneuver');
  this.assert(Number.isInteger(bonus)&&Math.abs(bonus)<=100,'Invalid maneuver bonus');
  const d20=this.rollDie(20),cmb=this.cmbFor(actor,kind)+bonus-penalty+(this.hasCondition(target,'stunned')?4:0);
  const cmd=this.cmdFor(target,kind),total=d20+cmb;
  const success=d20===20||(d20!==1&&total>=cmd);
  this.note(`${this.find(actor).name} ${kind.replaceAll('_',' ')}: d20 ${d20} + ${cmb} = ${total} vs CMD ${cmd}: ${success?'success':'failure'}.`);
  return {d20,cmb,cmd,total,margin:total-cmd,success};
 }
 grappleFor(id){return this.s.grapples.find(g=>g.holder===id||g.target===id)||null;}
 syncGrappleConditions(g,add){
  if(add){g.conditionEffects=[];
   for(const id of [g.holder,g.target]){
    if(!this.hasCondition(id,'grappled')){
     const v=this.applyCondition({condition:'grappled',target:id});g.conditionEffects.push({target:id,effectId:v.effectId});
    }
   }
  } else {
   if(g.pinnedEffect)this.removeEffect(g.pinnedEffect);
   for(const a of g.conditionEffects||[])this.removeEffect(a.effectId);
  }
 }
 releaseGrapple(holder,reason='released'){
  const g=this.s.grapples.find(g=>g.holder===holder);
  this.assert(!!g,`${holder} is not maintaining a grapple`);
  this.syncGrappleConditions(g,false);
  this.s.grapples=this.s.grapples.filter(x=>x!==g);
  this.note(`${this.find(holder).name} ${reason} ${this.find(g.target).name}.`);
  return {released:true,holder,target:g.target};
 }
 adjacentPlacement(holder,target){
  const h=this.find(holder),t=this.find(target);
  if(this.distance(h,t)===1)return true;
  const positions=[];
  for(let y=0;y<=this.s.height-t.size;y++)for(let x=0;x<=this.s.width-t.size;x++)
   if(this.distance(h,t,h.x,h.y,x,y)===1&&this.legalPosition(target,x,y)&&this.canTraverse(target,t,{x,y}))positions.push({x,y,d:Math.hypot(x-t.x,y-t.y)});
  positions.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);
  if(!positions.length)return false;
  const p=positions[0],before={x:t.x,y:t.y};t.x=p.x;t.y=p.y;this.onSpatialMovement(t,before);
  this.note(`Grappled target moved adjacent to its grappler at (${p.x},${p.y}).`);
  this.syncZones();return true;
 }
 validateManeuver(command,{allowFullAttack=false}={}){
  const {actor,target,kind}=command;
  this.assert(Object.hasOwn(MANEUVERS,kind),'Unknown maneuver');
  this.assert(MANEUVERS[kind].implemented,`${kind} defined but not mechanically implemented`);
  this.assert(!this.s.pendingMove&&!this.s.pendingCharge&&(!this.s.pendingFullAttack||allowFullAttack)&&!this.s.pendingManeuver&&!this.s.pendingOverrun&&!this.s.interrupt,'Resolve pending operation first');
  this.assert(this.active().id===actor,'Not this creature\'s turn');
  const a=this.find(actor),b=this.find(target);
  this.assert(this.canAct(a.id)&&this.canAct(b.id)&&a.id!==b.id,'Maneuver requires two conscious distinct creatures');
  this.assert((this.distance(a,b)>=1||this.collectiveKind?.(actor)==='troop')&&this.distance(a,b)<=a.reach,'Target outside melee reach');
  if(MANEUVERS[kind].sizeLimit!==undefined)
   this.assert(SIZE_NAMES.indexOf(this.sizeCategory(target))-SIZE_NAMES.indexOf(this.sizeCategory(actor))<=MANEUVERS[kind].sizeLimit,'Target too large for maneuver');
  if(kind==='trip')this.assert(!b.tripImmune&&b.legs!==0&&!b.flying,'Target cannot be tripped by ordinary maneuver');
  if(kind==='grapple')this.assert(!this.grappleFor(actor)&&!this.grappleFor(target),'Grapple already in progress; use maintain/escape');
  if(kind==='disarm')this.assert((b.equipment||[]).some(x=>x.location==='held'),'Target has no registered held equipment');
  if(kind==='dirty_trick')this.assert(DIRTY_TRICK_CONDITIONS.includes(command.condition),'Dirty Trick requires one of six legal conditions');
  if(kind==='steal'){
   const item=(b.equipment||[]).find(i=>i.id===command.item);
   this.assert(item&&item.location!=='held'&&item.location!=='dropped'&&item.accessible===true,'Steal requires an explicitly accessible, non-held item');
   this.assert(a.freeHands===undefined||a.freeHands>=1,'Steal requires a free hand');
  }
  if(kind==='drag')this.assert(this.distance(a,b)===1,'Current Drag geometry requires adjacent combatants');
  if(kind==='reposition'){
   this.assert(Array.isArray(command.path)&&command.path.length>=1&&command.path.length<=20,'Reposition requires a destination path');
   let x=b.x,y=b.y;for(const [i,p] of command.path.entries()){
    this.assert(Number.isInteger(p.x)&&Number.isInteger(p.y)&&Math.max(Math.abs(p.x-x),Math.abs(p.y-y))===1,'Invalid Reposition step');
    this.assert(this.legalPosition(target,p.x,p.y)&&this.canTraverse(target,{x,y},p),'Reposition destination or boundary blocked');
    this.assert(!this.footprint(b,p.x,p.y).some(cell=>this.tileKind(cell.x,cell.y)==='hazard'),'Reposition cannot enter an intrinsically dangerous tile');
    const d=this.distance(a,b,a.x,a.y,p.x,p.y);
    this.assert(i===command.path.length-1?d<=a.reach+1:d<=a.reach,'Reposition path exceeds reach');
    x=p.x;y=p.y;
   }
  }
  if(kind==='overrun'){
   this.assert(this.distance(a,b)===1,'Basic Overrun requires an adjacent target');
   const dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y);
   this.assert(this.legalPosition(actor,b.x+dx,b.y+dy)&&this.canTraverse(actor,a,{x:b.x+dx,y:b.y+dy}),'No legal square or path beyond target for Overrun');
  }
  if(kind==='sunder'){
   const item=(b.equipment||[]).find(x=>x.id===command.item);
   this.assert(item&&['held','worn'].includes(item.location)&&Number.isInteger(item.hp)&&Number.isInteger(item.maxHp)&&Number.isInteger(item.hardness),'Sunder requires a held/worn item with known HP, maximum HP and hardness');
  }
 }
 maneuver(command,{replaceFullAttack=false}={}){
  this.validateManeuver(command,{allowFullAttack:replaceFullAttack});
  const kind=command.kind,actor=command.actor,target=command.target;
  if(!replaceFullAttack)this.spendAction(actor,'standard',`combat maneuver: ${kind}`);
  // Maneuvers provoke ONLY from the target by default, unless actor has the relevant improvement.
  const trained=Boolean(this.find(actor).maneuverImprovements?.includes(kind)||kind==='grapple'&&this.find(actor).grab);
  if(!trained && this.canTakeAoO(target,actor)){
   this.s.pendingManeuver=clone(command);
   this.s.interrupt={type:'maneuver_aoo',reactor:target,target:actor,maneuver:kind};
   this.note(`${this.find(target).name} may take an AoO before ${this.find(actor).name}'s ${kind}.`);
   return {status:'interrupt',interrupt:clone(this.s.interrupt)};
  }
  return this.completeManeuver(command);
 }
 completeManeuver(command,penalty=0){
  this.s.pendingManeuver=null;
  const {actor,target,kind}=command;
  if(kind==='overrun' && !this.find(actor).maneuverImprovements?.includes('overrun')){
   this.s.pendingOverrun={command:clone(command),penalty};
   this.s.interrupt={type:'overrun_avoid',reactor:target,target:actor};
   this.note(`${this.find(target).name} may choose to avoid ${this.find(actor).name}'s Overrun.`);
   return {status:'interrupt',interrupt:clone(this.s.interrupt)};
  }
  if(!this.canAct(actor))return {status:'stopped',reason:'maneuver initiator incapacitated by AoO'};
  const handPenalty=kind==='grapple'&&this.find(actor).freeHands!==undefined&&this.find(actor).freeHands<2?-4:0;
  const unarmedPenalty=kind==='disarm'&&command.unarmed?-4:0;
  const situational=(kind==='steal'&&this.find(target).equipment.find(x=>x.id===command.item)?.fastened)?5:0;
  const result=this.checkManeuver(actor,target,kind,{bonus:(command.bonus??0)+handPenalty+unarmedPenalty-situational,penalty});
  if(!result.success){
   if(kind==='trip'&&result.margin<=-10){this.applyCondition({condition:'prone',target:actor});result.backfire='attacker_prone';}
   if(kind==='disarm'&&result.margin<=-10){
    const held=(this.find(actor).equipment||[]).find(x=>x.location==='held');
    if(held){held.location='dropped';result.backfire=`dropped_${held.id}`;}
    else result.advisory='Disarmer would drop their weapon, but no held weapon is registered';
   }
   return result;
  }
  if(kind==='trip'){this.applyCondition({condition:'prone',target});result.effect='prone';}
  if(kind==='dirty_trick'){
   const greater=this.find(actor).greaterManeuvers?.includes('dirty_trick');
   const rounds=(greater?this.rollDie(4):1)+Math.max(0,Math.floor(result.margin/5));
   const applied=this.applyCondition({condition:command.condition,target,source:actor,rounds});
   if(applied.effectId){
    this.s.dirtyTricks=this.s.dirtyTricks.filter(x=>x.effectId!==applied.effectId);
    this.s.dirtyTricks.push({effectId:applied.effectId,target,source:actor,condition:command.condition,removalAction:greater?'standard':'move'});
    result.condition=command.condition;result.rounds=rounds;result.effectId=applied.effectId;
   }else result.advisory=`Dirty Trick check succeeded but ${command.condition} was not applied: target retains ${applied.retained||'its existing condition'}. No removal action was registered.`;
  }
  if(kind==='steal'){
   const stolen=this.find(target).equipment.find(x=>x.id===command.item);
   this.find(target).equipment=this.find(target).equipment.filter(x=>x!==stolen);
   const inventory=this.find(actor).equipment||[];
   if(inventory.some(x=>x.id===stolen.id))stolen.id=`stolen_${++this.s.maneuverSequence}`;
   stolen.location='held';this.find(actor).equipment=[...inventory,stolen];
   result.stolen=stolen.id;result.advisory='Defender is aware of theft unless Greater Steal or another exception applies';
  }
  if(kind==='drag'){
   const a=this.find(actor),b=this.find(target),dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y);
   const count=1+Math.max(0,Math.floor(result.margin/5));let moved=0;
   for(let n=0;n<count&&moved*5<a.speed;n++){
    if(!this.legalPosition(actor,a.x-dx,a.y-dy)||!this.canTraverse(actor,a,{x:a.x-dx,y:a.y-dy}))break;
    const old={x:a.x,y:a.y};a.x-=dx;a.y-=dy;
    if(!this.legalPosition(target,old.x,old.y)||!this.canTraverse(target,b,old)){a.x=old.x;a.y=old.y;break;}
    const previous={x:b.x,y:b.y};b.x=old.x;b.y=old.y;this.onSpatialMovement(a,old);this.onSpatialMovement(b,previous);moved++;
   }
   this.syncZones();if(moved)this.s.actions.moved=true;result.draggedSquares=moved;
   result.advisory='Basic straight-line Drag; other creatures’ movement AoOs and complex terrain need GM adjudication';
  }
  if(kind==='reposition'){
   const allowed=1+Math.max(0,Math.floor(result.margin/5));let moved=0;const b=this.find(target);
   for(const p of command.path.slice(0,allowed)){
    if(!this.legalPosition(target,p.x,p.y)||!this.canTraverse(target,b,p))break;
    const previous={x:b.x,y:b.y};b.x=p.x;b.y=p.y;this.onSpatialMovement(b,previous);moved++;
   }
   this.syncZones();result.repositionedSquares=moved;
   result.advisory='Basic Reposition; Greater Reposition AoOs and exotic spatial cases require GM adjudication';
  }
  if(kind==='overrun')return this.completeOverrun(command,penalty,false,result);
  if(kind==='disarm'){
   const chosen=(this.find(target).equipment||[]).find(x=>x.id===command.item&&x.location==='held')||(this.find(target).equipment||[]).find(x=>x.location==='held');
   chosen.location='dropped';const dropped=[chosen.id];
   if(result.margin>=10){const other=this.find(target).equipment.find(x=>x.location==='held');if(other){other.location='dropped';dropped.push(other.id);}}
   result.dropped=dropped;
  }
  if(kind==='sunder'){
   const item=this.find(target).equipment.find(x=>x.id===command.item);
   const raw=Number.isInteger(command.damage)?command.damage:Math.max(0,this.rollDie(this.find(actor).damageDie)+this.stat(actor,'damage'));
   this.assert(Number.isInteger(raw)&&raw>=0&&raw<=100000,'Invalid sunder damage');
   const hardness=item.hardness??(item.material?materialHardness(item.material):0);
   result.damage=raw;result.hardness=hardness;result.applied=hardnessDamage(raw,hardness,{weaponMaterial:this.find(actor).weaponMaterial}).applied;item.hp=Math.max(0,item.hp-result.applied);
   if(item.hp<=Math.floor(item.maxHp/2))item.broken=true;
   if(item.hp===0){if(command.destroy)item.destroyed=true;else item.hp=1;}
   result.item=clone(item);
  }
  if(kind==='bull_rush'){
   const a=this.find(actor),b=this.find(target),dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y);
   this.assert(dx||dy,'Bull rush requires a direction');
   const distance=1+Math.max(0,Math.floor(result.margin/5));let moved=0;
   for(let n=0;n<distance;n++){
    if(!this.legalPosition(target,b.x+dx,b.y+dy)||!this.canTraverse(target,b,{x:b.x+dx,y:b.y+dy}))break;
    const previous={x:b.x,y:b.y};b.x+=dx;b.y+=dy;this.onSpatialMovement(b,previous);moved++;
   }
   this.syncZones();result.pushedSquares=moved;
   if(moved<distance)result.advisory='Further push blocked; multi-creature bull rush is not yet automated';
  }
  if(kind==='grapple'){
   if(!this.adjacentPlacement(actor,target)){result.success=false;result.advisory='No open adjacent square: grapple fails';return result;}
   const g={holder:actor,target,createdRound:this.s.round,maintainedRound:null,conditionEffects:[]};
   this.s.grapples.push(g);this.syncGrappleConditions(g,true);result.grapple=clone(g);
  }
  this.note(`${this.find(actor).name} resolves ${kind} against ${this.find(target).name}.`);
  return result;
 }
 completeOverrun(command,penalty=0,avoided=false,previousResult=null){
  const {actor,target}=command,a=this.find(actor),b=this.find(target);
  const dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y);
  const landing={x:b.x+dx,y:b.y+dy};
  const result=previousResult||(!avoided?this.checkManeuver(actor,target,'overrun',{bonus:command.bonus??0,penalty}):{success:true,avoided:true});
  if(!result.success)return result;
  this.assert(this.legalPosition(actor,landing.x,landing.y)&&this.canTraverse(actor,a,landing),'Overrun exit or boundary is blocked');
  const previous={x:a.x,y:a.y};a.x=landing.x;a.y=landing.y;this.onSpatialMovement(a,previous);
  this.s.actions.moved=true;
  if(!avoided&&result.margin>=5){this.applyCondition({condition:'prone',target});result.prone=true;}
  this.syncZones();
  result.overran=true;
  result.advisory='Basic Overrun crosses one occupied square; ongoing movement/charge and other AoOs require later integration';
  return result;
 }
 removeDirtyTrick(command){
  this.assert(!this.s.interrupt&&!this.s.pendingMove&&!this.s.pendingManeuver&&!this.s.pendingOverrun,'Resolve pending operations first');
  this.assert(this.active().id===command.actor,'Not this creature’s turn');
  const active=this.s.dirtyTricks.find(x=>x.effectId===command.effectId&&x.target===command.actor&&this.s.effects.some(e=>e.id===x.effectId));
  this.assert(!!active,'No removable Dirty Trick effect for this actor');
  this.spendAction(command.actor,active.removalAction,'remove Dirty Trick');
  this.removeEffect(active.effectId);
  this.s.dirtyTricks=this.s.dirtyTricks.filter(x=>x.effectId!==active.effectId);
  return {removed:active.condition,effectId:active.effectId,spent:active.removalAction};
 }
 gmAdjudicate(command){
  const {kind,reason}=command;
  this.assert(typeof reason==='string'&&reason.trim().length>=3&&reason.length<=240,'GM override requires a brief reason');
  this.assert(!this.s.interrupt&&!this.s.pendingManeuver&&!this.s.pendingOverrun,'Resolve the pending decision first');
  let result;
  if(kind==='move_free'){
   this.assert(!this.s.pendingMove&&!this.s.pendingCharge&&!this.s.pendingFullAttack,'Finish pending movement or attacks first');
   result=this.startMove(command.actor,command.path,{action:'gm_free',allowanceFeet:command.allowanceFeet??5});
  } else if(kind==='relocate')result=this.dispatch({op:'teleport',target:command.target,x:command.x,y:command.y,reason},'gm');
  else if(kind==='modifier')result=this.dispatch({op:'gm_modifier',target:command.target,stat:command.stat,value:command.value,type:command.type??'untyped',rounds:command.rounds??null,name:reason},'gm');
  else if(kind==='condition')result=this.dispatch({op:'apply_condition',target:command.target,condition:command.condition,rounds:command.rounds??null,source:command.source??null},'gm');
  else if(kind==='remove_condition')result=this.dispatch({op:'remove_condition',target:command.target,condition:command.condition},'gm');
  else if(kind==='grant_action')result=this.dispatch({op:'admin_grant_action',actor:command.actor,type:command.type,count:command.count??1,source:reason},'gm');
  else if(kind==='remove_effect')result=this.dispatch({op:'remove_effect',id:command.id},'gm');
  else if(kind==='health'&&this.adjudicateHealth)result=this.adjudicateHealth(command);
  else if(kind==='damage'||kind==='healing')result=this.dispatch({op:'gm_roll',kind:kind==='damage'?'damage':'healing',target:command.target,count:command.count??1,sides:command.sides??6,bonus:command.bonus??0,damageType:command.damageType??'untyped',label:reason,cause:'environment'},'gm');
  else throw Error('Unknown GM adjudication operation');
  const entry={id:++this.s.overrideSeq,round:this.s.round,kind,reason,actor:command.actor??null,target:command.target??null};
  this.s.overrideLog.push(entry);if(this.s.overrideLog.length>100)this.s.overrideLog.shift();
  this.note(`GM adjudication #${entry.id}: ${kind} — ${reason}`);
  return {adjudicationId:entry.id,result};
 }
 grappleAction(command){
  const {actor,kind='maintain',target}=command;
  this.assert(!this.s.interrupt&&!this.s.pendingMove&&!this.s.pendingFullAttack&&!this.s.pendingManeuver&&!this.s.pendingOverrun,'Finish pending action first');
  this.assert(this.active().id===actor,'Not this creature\'s turn');
  const g=this.grappleFor(actor);this.assert(!!g,'No grapple relationship');
  if(kind==='maintain')this.assert(!command.option||['hold','pin','damage'].includes(command.option),'Unsupported grapple maintenance option');
  if(kind==='release'){
   this.assert(g.holder===actor,'Only grappler can freely release the grapple');
   return this.releaseGrapple(actor);
  }
  this.assert(['maintain','escape','reverse'].includes(kind),'Unknown grapple action');
  if(kind==='maintain')this.assert(g.holder===actor,'Only grappler can maintain hold');
  else this.assert(g.target===actor,'Only the grabbed creature can attempt escape/reversal');
  this.spendAction(actor,'standard',`grapple ${kind}`);
  const opponent=g.holder===actor?g.target:g.holder;
  const result=command.escapeArtist ? (()=>{
   this.assert(kind==='escape'&&this.find(actor).skills&&Object.hasOwn(this.find(actor).skills,'Escape Artist'),'Registered Escape Artist required');
   const check=this.check(actor,'skill','Escape Artist',this.cmdFor(opponent,'grapple'));
   return {...check,margin:check.total-this.cmdFor(opponent,'grapple')};
  })():this.checkManeuver(actor,opponent,kind==='maintain'?'grapple':'escape',{bonus:kind==='maintain'?5:0});
  if(!result.success)return result;
  if(kind==='escape'){this.releaseGrapple(g.holder,'loses hold of');result.escaped=true;}
  if(kind==='reverse'){
   this.syncGrappleConditions(g,false);g.holder=actor;g.target=opponent;g.createdRound=this.s.round;g.maintainedRound=null;
   this.syncGrappleConditions(g,true);result.reversed=true;
  }
  if(kind==='maintain'){
   g.maintainedRound=this.s.round;
   if(command.option==='pin'){
    if(!this.hasCondition(g.target,'pinned')){const applied=this.applyCondition({condition:'pinned',target:g.target});g.pinnedEffect=applied.effectId;}
    result.pinned=true;
   } else if(command.option==='damage'){
    const amount=Math.max(0,this.rollDie(this.find(actor).damageDie)+this.stat(actor,'damage'));
    result.damage=this.damage(g.target,amount,'bludgeoning',actor,'weapon');
   } else if(command.option&&command.option!=='hold')throw Error('Grapple maintenance option is not yet implemented');
   result.maintained=true;
  }
  return result;
 }
 resolveInterrupt(take){
  const i=this.s.interrupt;
  if(i?.type==='overrun_avoid'){
   const pending=this.s.pendingOverrun;this.assert(!!pending,'No pending Overrun');
   this.s.pendingOverrun=null;this.s.interrupt=null;
   this.note(`${this.find(i.reactor).name} ${take?'avoids':'does not avoid'} the Overrun.`);
   return this.completeOverrun(pending.command,pending.penalty,!!take);
  }
  if(i?.type==='maneuver_aoo'){
   const cmd=this.s.pendingManeuver;
   this.assert(!!cmd,'No pending maneuver');
   this.s.interrupt=null;let penalty=0;
   if(take){
    this.assert((this.s.aooUsed[i.reactor]||0)<this.aooLimit(i.reactor),'No AoO uses remaining');
    this.s.aooUsed[i.reactor]=(this.s.aooUsed[i.reactor]||0)+1;
    const before=this.find(i.target).hp;
    super.resolveAttack(i.reactor,i.target,'Maneuver-provoking AoO');
    penalty=before-this.find(i.target).hp;
    if(this.s.interrupt){this.s.pendingManeuverAoOPenalty=penalty;return {status:'interrupt',interrupt:clone(this.s.interrupt)};}
   } else this.note(`${this.find(i.reactor).name} declines the maneuver AoO.`);
   return this.completeManeuver(cmd,penalty);
  }
  const result=super.resolveInterrupt(take);
  if(this.s.pendingManeuver&&!this.s.interrupt&&this.s.pendingManeuverAoOPenalty!==undefined){
   const cmd=this.s.pendingManeuver,penalty=this.s.pendingManeuverAoOPenalty;
   delete this.s.pendingManeuverAoOPenalty;
   return this.completeManeuver(cmd,penalty);
  }
  return result;
 }
 endTurn(){
  const ending=this.active().id;
  for(const g of [...this.s.grapples])if(g.holder===ending&&g.createdRound<this.s.round&&g.maintainedRound!==this.s.round)
   this.releaseGrapple(ending,'fails to maintain the grapple against');
  return super.endTurn();
 }
 dispatch(command,role='actor'){
  if(command?.op==='list_maneuvers')return clone({maneuvers:MANEUVERS,sizes:COMBAT_SIZES});
  if(!['maneuver','grapple_action','gm_maneuver_check','remove_dirty_trick','gm_adjudicate'].includes(command?.op))return super.dispatch(command,role);
  this.assert(['actor','player','gm'].includes(role),'Invalid command role');
  if(role==='player')this.assert(command.actor==='hero'&&this.active().id==='hero','Player controls Explorer only');
  if(['gm_maneuver_check','gm_adjudicate'].includes(command.op))this.assert(role==='gm','Only GM may use administrative operations');
  return this.transaction(()=>{
   switch(command.op){
    case 'maneuver':
     if(role!=='gm')this.assert(!['bonus','damage','destroy','noProvoke'].some(k=>Object.hasOwn(command,k)),'Manual maneuver modifiers require GM authorization');
     return this.maneuver(command);
    case 'grapple_action':return this.grappleAction(command);
    case 'remove_dirty_trick':return this.removeDirtyTrick(command);
    case 'gm_adjudicate':return this.gmAdjudicate(command);
    case 'gm_maneuver_check':return this.checkManeuver(command.actor,command.target,command.kind,{bonus:command.bonus??0});
   }
  });
 }
}
