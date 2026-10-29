import {validateFortification,validateCriticalProfile} from './critical_rules.mjs';
import {WEAPON_MATERIALS, ITEM_CONDITIONS, materialWeaponTags} from './weapon_materials.mjs';
/** V3.7: inherited traits, effect classification and reusable damage/DC calculation.
 * Does NOT choose tactics or silently infer missing input fields.
 */
import {ConditionAilmentGame} from './condition_ailment_game.mjs';
import {clone,abilityMod} from './core.mjs';
import {ABILITIES} from './stats.mjs';
import {ATTACK_KINDS,ATTACK_MODES,NATURAL_ATTACKS,ATTACK_RIDERS,attackDescription,validateAttackProfile} from './attack_library.mjs';
import {CREATURE_TYPES,TYPE_TRAITS,SUBTYPE_TRAITS,SUBTYPE_CATALOG,EFFECT_TAGS,ENERGY_TYPES,PHYSICAL_TYPES,CONDITION_TAGS,DAMAGE_TYPES,DR_BYPASS_TAGS,ALIGNMENT_TAGS} from './trait_library.mjs';
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const foundationObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const foundationIdent=x=>typeof x==='string'&&/^[a-z][a-z0-9_-]{0,63}$/i.test(x);
const n=(x,lo,hi)=>Number.isInteger(x)&&x>=lo&&x<=hi;
const TAGS=new Set(EFFECT_TAGS), EN=new Set(ENERGY_TYPES), PH=new Set(PHYSICAL_TYPES), DAMAGE=new Set(DAMAGE_TYPES);
const DR_TAGS=new Set(DR_BYPASS_TAGS), ALIGN=new Set(ALIGNMENT_TAGS);
const unique=(arr,label,valid,max=64)=>{
 if(!Array.isArray(arr)||arr.length>max||arr.some(x=>!valid(x))||new Set(arr).size!==arr.length)throw new Error(`Invalid ${label}`);
};
function validateProtection(p){
 if(!foundationObject(p))throw new Error('Protections must be an object');
 if(Object.keys(p).some(k=>!['immunities','resistances','dr','fortification','criticalNegationChance','precisionNegationChance'].includes(k)))throw new Error('Unsupported protection field');
 for(const field of ['fortification','criticalNegationChance','precisionNegationChance'])if(p[field]!==undefined)validateFortification(p[field],field);
 if(p.immunities!==undefined)unique(p.immunities,'immunity tags',x=>TAGS.has(x));
 if(p.resistances!==undefined){
  if(!foundationObject(p.resistances)||Object.keys(p.resistances).some(k=>!EN.has(k)||!n(p.resistances[k],0,10000)))throw new Error('Invalid energy resistance');
 }
 if(p.dr!==undefined){
  if(!Array.isArray(p.dr)||p.dr.length>20)throw new Error('Invalid DR list');
  for(const dr of p.dr){
   if(!foundationObject(dr)||Object.keys(dr).some(k=>!['amount','bypass'].includes(k))||!n(dr.amount,0,1000))throw new Error('Invalid DR entry');
   unique(dr.bypass,'DR bypass descriptors',x=>DR_TAGS.has(x),12);
  }
 }
}
function validateDC(spec){
 if(!foundationObject(spec)||Object.keys(spec).some(k=>!['basis','ability','bonus','published','spellLevel','className','fixed','numerator','denominator','base'].includes(k)))throw new Error('Invalid DC definition');
 if(!['half_hd','half_racial_hd','class_level','bab','spell','fixed'].includes(spec.basis))throw new Error('Unsupported DC basis');
 if(spec.ability!==undefined&&!ABILITIES.includes(spec.ability))throw new Error('Invalid DC ability');
 if(spec.bonus!==undefined&&!n(spec.bonus,-500,500))throw new Error('Invalid DC bonus');
 if(spec.base!==undefined&&!n(spec.base,-100,500))throw new Error('Invalid DC base');
 if(spec.published!==undefined&&!n(spec.published,0,10000))throw new Error('Invalid printed DC');
 if(spec.basis==='spell'&&!n(spec.spellLevel,0,10))throw new Error('Spell level required');
 if(spec.basis==='fixed'&&!n(spec.fixed,0,10000))throw new Error('Fixed DC required');
 if(spec.basis==='class_level'&&!foundationIdent(spec.className))throw new Error('Class name required');
 if(spec.numerator!==undefined&&!n(spec.numerator,0,20))throw new Error('Invalid DC scale numerator');
 if(spec.denominator!==undefined&&!n(spec.denominator,1,20))throw new Error('Invalid DC scale denominator');
}
export class FoundationsGame extends ConditionAilmentGame {
 validateCreature(def){
  if(!foundationObject(def))throw new Error('Invalid creature definition');
  const copy=clone(def);
  for(const k of ['creatureType','subtypes','protections','traitExceptions','dcDefinitions','progression','mindless','alignment'])delete copy[k];
  super.validateCreature(copy);
  this.validateImportAt('definition.stats',()=>validateAttackProfile(def.stats));
  if(def.stats.attackTraits!==undefined)this.validateImportAt('definition.stats.attackTraits',()=>this.validateDamageMetadata(def.stats.attackTraits));
  for(const [i,attack] of (def.stats.attacks||[]).entries()){
   const path=`definition.stats.attacks[${i}]`;
   this.validateImportAt(path,()=>validateAttackProfile(attack));
   if(attack.damageType!==undefined&&!PH.has(attack.damageType))throw Error(`${path}.damageType must be physical; use an effect packet for extra energy damage`);
   if(attack.attackTraits!==undefined)this.validateImportAt(`${path}.attackTraits`,()=>this.validateDamageMetadata(attack.attackTraits));
  }
  if(def.alignment!==undefined&&!['LG','NG','CG','LN','N','CN','LE','NE','CE'].includes(def.alignment))throw new Error('Invalid creature alignment');
  if(def.creatureType!==undefined&&!CREATURE_TYPES.includes(def.creatureType))throw new Error('Unknown creature type');
  if(def.subtypes!==undefined){
   unique(def.subtypes,'definition.subtypes (expected up to 24 unique lowercase IDs)',x=>typeof x==='string',24);
   for(const [i,id] of def.subtypes.entries())if(!own(SUBTYPE_CATALOG,id))
    throw Error(`Unsupported definition.subtypes[${i}]: ${JSON.stringify(id)}. Use a listed lowercase ID (spaces become underscores); query list_trait_library for subtypes and subtypeCoverage. Unknown labels do not install mechanics.`);
  }
  if(def.protections!==undefined)validateProtection(def.protections);
  if(def.traitExceptions!==undefined){
   if(!foundationObject(def.traitExceptions)||Object.keys(def.traitExceptions).some(k=>!['suppressImmunities','suppressResistances'].includes(k)))throw new Error('Invalid trait exceptions');
   if(def.traitExceptions.suppressImmunities!==undefined)unique(def.traitExceptions.suppressImmunities,'suppressed immunities',x=>TAGS.has(x));
   if(def.traitExceptions.suppressResistances!==undefined)unique(def.traitExceptions.suppressResistances,'suppressed resistances',x=>EN.has(x));
  }
  if(def.mindless!==undefined&&typeof def.mindless!=='boolean')throw new Error('Invalid mindless flag');
  if(def.dcDefinitions!==undefined){
   if(!foundationObject(def.dcDefinitions)||Object.keys(def.dcDefinitions).length>100)throw new Error('Invalid ability DC catalog');
   for(const [k,v] of Object.entries(def.dcDefinitions)){if(!foundationIdent(k))throw new Error('Invalid DC identifier');validateDC(v);}
  }
  if(def.progression!==undefined){
   if(!foundationObject(def.progression)||Object.keys(def.progression).some(k=>!['racialHitDice','classLevels'].includes(k)))throw new Error('Invalid progression');
   if(def.progression.racialHitDice!==undefined&&!n(def.progression.racialHitDice,0,500))throw new Error('Invalid racial Hit Dice');
   if(def.progression.classLevels!==undefined){
    const cls=def.progression.classLevels;
    if(!foundationObject(cls)||Object.keys(cls).some(k=>!foundationIdent(k)||!n(cls[k],0,100)))throw new Error('Invalid class levels');
   }
  }
 }
 initializeCreature(creature,def){
  super.initializeCreature(creature,def);
  for(const k of ['creatureType','subtypes','protections','traitExceptions','dcDefinitions','progression','mindless','alignment'])if(own(def,k))creature[k]=clone(def[k]);
  if(!own(def,'mindless')&&['ooze','vermin'].includes(def.creatureType))creature.mindless=!own(def.stats,'int');
 }
 classification(id){
  const c=this.find(id),subtypes=[...(c.subtypes||[])];
  return {creatureType:c.creatureType||null,subtypes,
   classificationOnlySubtypes:subtypes.filter(subtype=>!own(SUBTYPE_TRAITS,subtype))};
 }
 traits(id){
  const c=this.find(id),sources=[];
  if(c.creatureType && own(TYPE_TRAITS,c.creatureType))sources.push({name:`type:${c.creatureType}`,...TYPE_TRAITS[c.creatureType]});
  for(const subtype of c.subtypes||[])if(own(SUBTYPE_TRAITS,subtype))sources.push({name:`subtype:${subtype}`,...SUBTYPE_TRAITS[subtype]});
  if(c.protections)sources.push({name:'explicit',...c.protections});
  if(c.mindless||(!own(c,'mindless')&&sources.some(s=>s.mindlessIfNoInt)&&c.int==null))sources.push({name:'mindless',...SUBTYPE_TRAITS.mindless});
  const sup=c.traitExceptions||{}, suppressedImmunities=new Set(sup.suppressImmunities||[]), suppressedResistances=new Set(sup.suppressResistances||[]);
  const immune=[...new Set(sources.flatMap(s=>s.immunities||[]))].filter(x=>!suppressedImmunities.has(x));
  if(sources.some(s=>s.physicalAbilityDamageImmune))immune.push('physical_ability_damage');
  const resistances={};
  for(const s of sources)for(const [kind,value] of Object.entries(s.resistances||{}))if(!suppressedResistances.has(kind))resistances[kind]=Math.max(resistances[kind]||0,value);
  const dr=sources.flatMap(s=>(s.dr||[]).map(rule=>({...rule,source:s.name})));
  const weaponAlignments=[...new Set(sources.flatMap(s=>s.weaponAlignments||[]))];
  const classification=this.classification(id);
  const classificationNotes=classification.classificationOnlySubtypes.length?
   [`Classification-only subtypes: ${classification.classificationOnlySubtypes.join(', ')}. No automatic subtype abilities; import applicable mechanics separately and adjudicate the remainder.`]:[];
  return {...classification,weaponAlignments,alignment:c.alignment??null,immunities:[...new Set(immune)],resistances,dr,
   noCon:sources.some(s=>s.noCon),conSubstitute:sources.find(s=>s.conSubstitute)?.conSubstitute||null,
   incorporeal:sources.some(s=>s.incorporeal),fortObjectExemption:sources.some(s=>s.fortObjectExemption),
   notes:[...new Set([...sources.flatMap(s=>s.notes||[]),...classificationNotes])],sources:sources.map(s=>s.name)};
 }
 criticalDefenses(targetId){
  const c=this.find(targetId),traits=this.traits(targetId);
  const worn=(c.equipment||[]).filter(item=>item.location==='worn'&&!item.destroyed&&item.hp!==0);
  const armorFortification=Math.max(0,...worn.map(item=>item.fortification||0));
  const native=c.protections||{};
  const fortification=Math.max(native.fortification||0,armorFortification);
  return {criticalImmune:traits.immunities.includes('critical'),precisionImmune:traits.immunities.includes('precision'),
   criticalNegationChance:Math.max(fortification,native.criticalNegationChance||0),
   precisionNegationChance:Math.max(fortification,native.precisionNegationChance||0),
   fortification, sources:[...traits.sources,...worn.filter(i=>i.fortification).map(i=>`item:${i.id}`)]};
 }
 evaluateEffect({target,tags=[],save=null,worksOnObjects=false,harmless=false}={}){
  this.find(target);unique(tags,'effect tags',x=>TAGS.has(x));
  const t=this.traits(target);let blockedBy=[];
  for(const tag of tags)if(t.immunities.includes(tag))blockedBy.push(tag);
  if(save==='fort'&&t.fortObjectExemption&&!worksOnObjects&&!harmless)blockedBy.push('type-based Fortitude immunity');
  return {target,blocked:blockedBy.length>0,blockedBy:[...new Set(blockedBy)],advisories:t.notes};
 }
 calculateDC({actor,abilityId,definition}={}){
  const c=this.find(actor),spec=definition??c.dcDefinitions?.[abilityId];
  if(!spec)throw new Error('Unknown DC definition');
  validateDC(spec);
  if(spec.basis==='fixed')return {dc:spec.fixed,basis:'fixed',published:spec.published??null,advisories:[]};
  let quantity=0;
  if(spec.basis==='half_hd'){if(!n(c.hitDiceCount,1,500))throw new Error('DC requires creature hitDiceCount');quantity=c.hitDiceCount;}
  if(spec.basis==='half_racial_hd'){if(!n(c.progression?.racialHitDice,0,500))throw new Error('DC requires racialHitDice');quantity=c.progression.racialHitDice;}
  if(spec.basis==='class_level'){if(!n(c.progression?.classLevels?.[spec.className],0,100))throw new Error('DC requires registered class level');quantity=c.progression.classLevels[spec.className];}
  if(spec.basis==='bab')quantity=c.bab;
  if(spec.basis==='spell')quantity=spec.spellLevel;
  const numerator=spec.numerator??(spec.basis.startsWith('half_')?1:1),denominator=spec.denominator??(spec.basis.startsWith('half_')?2:1);
  let mod=0;const advisers=[];
  if(spec.ability){
   const trait=this.traits(actor);let ab=spec.ability;
   if(ab==='con'&&trait.noCon){
    if(trait.conSubstitute)ab=trait.conSubstitute;
    else ab=null;
   }
   mod=ab?abilityMod(this.stat(actor,ab)):0;
   if(spec.basis==='spell'&&['int','wis','cha'].includes(ab))mod+=this.damagePenalty(actor,ab);
  }
  const dc=(spec.base??10)+Math.floor(quantity*numerator/denominator)+mod+(spec.bonus??0);
  if(spec.published!==undefined&&dc!==spec.published)advisers.push(`Calculated DC ${dc} differs from published ${spec.published}; check feats, omitted modifiers or source overrides.`);
  return {dc,basis:spec.basis,published:spec.published??null,scale:{quantity,numerator,denominator},abilityModifier:mod,advisories:advisers};
 }
 // Only a wielder's alignment SUBTYPES grant DR-bypass alignment to its attacks.
 weaponBypassTags(sourceId,metadata={}){
  const tags=new Set([...(metadata.weaponTags||[]),...(metadata.damageTypes||[]),...materialWeaponTags(metadata.weaponMaterial||'steel')]);
  if(metadata.magical===true||(metadata.enhancementBonus??0)>=1)tags.add('magic');
  if((metadata.enhancementBonus??0)>=3){tags.add('silver');tags.add('cold_iron');}
  if((metadata.enhancementBonus??0)>=4)tags.add('adamantine');
  if((metadata.enhancementBonus??0)>=5)for(const a of ALIGN)tags.add(a);
  if(Math.max(metadata.enhancementBonus??0,metadata.enhancementEquivalent??0)>=6)tags.add('epic');
  if(sourceId!==null&&metadata.sourceKind!=='projectile_detached')for(const a of this.traits(sourceId).weaponAlignments)tags.add(a);
  return [...tags];
 }
 resolveDR(targetId,amount,metadata={},sourceId=null){
  const tags=new Set(this.weaponBypassTags(sourceId,metadata));let strongest=0;
  for(const r of this.traits(targetId).dr)if(!r.bypass.length||!r.bypass.some(tag=>tags.has(tag)))strongest=Math.max(strongest,r.amount);
  return Math.min(amount,strongest);
 }
 // Creature's own alignment affects targets of alignment-sensitive effects; subtype is independent.
 alignmentTags(targetId){
  const c=this.find(targetId),tag=new Set();
  const a=c.alignment;
  if(a){if(a.includes('G'))tag.add('good');if(a.includes('E'))tag.add('evil');
    if(a.includes('L'))tag.add('lawful');if(a.includes('C'))tag.add('chaotic');}
  for(const x of this.traits(targetId).weaponAlignments)tag.add(x);
  return [...tag];
 }
 validateDamageMetadata(metadata){
  if(!foundationObject(metadata))throw new Error('Invalid damage metadata');
  if(Object.keys(metadata).some(k=>!['tags','weaponTags','magical','ghostTouch','incorporealSource','sourceKind','enhancementBonus','enhancementEquivalent','damageTypes','weaponMaterial','rangedWeapon','ignoreHardness','objectMultiplier','areaEffect','targeting'].includes(k)))throw new Error('Unsupported damage metadata');
  if(metadata.areaEffect!==undefined&&typeof metadata.areaEffect!=='boolean')throw new Error('Invalid areaEffect flag');
  if(metadata.targeting!==undefined&&!['creatures','area','unrestricted'].includes(metadata.targeting))throw new Error('Invalid damage targeting');
  if(metadata.weaponMaterial!==undefined&&!Object.hasOwn(WEAPON_MATERIALS,metadata.weaponMaterial))throw new Error('Invalid weapon material');
  if(metadata.tags!==undefined)unique(metadata.tags,'damage tags',x=>TAGS.has(x));
  if(metadata.weaponTags!==undefined)unique(metadata.weaponTags,'weapon tags',x=>DR_TAGS.has(x));
  if(metadata.damageTypes!==undefined)unique(metadata.damageTypes,'physical damage types',x=>PH.has(x),3);
  if(metadata.objectMultiplier!==undefined&&!([0,0.5,1,2].includes(metadata.objectMultiplier)))throw Error('Invalid object damage multiplier');
  for(const k of ['magical','ghostTouch','incorporealSource','rangedWeapon','ignoreHardness'])if(metadata[k]!==undefined&&typeof metadata[k]!=='boolean')throw new Error('Invalid damage metadata flag');
  if(metadata.sourceKind!==undefined&&!['weapon','spell','supernatural','environment','projectile_detached'].includes(metadata.sourceKind))throw new Error('Invalid source kind');
  for(const k of ['enhancementBonus','enhancementEquivalent'])if(metadata[k]!==undefined&&!n(metadata[k],0,30))throw new Error('Invalid enhancement bonus');
 }
 // No arbitrary traits on a damage packet. The GM must explicitly characterize a magical weapon or spell.
 resolveProtection(targetId,amount,damageType,cause,metadata={},sourceId=null,skipDR=false){
  const traits=this.traits(targetId),tags=new Set(metadata.tags||[]),steps=[];
  if(EN.has(damageType))tags.add(damageType);
  const outcome=this.evaluateEffect({target:targetId,tags:[...tags]});
  if(outcome.blocked)return {applied:0,prevented:amount,steps:[`Immunity: ${outcome.blockedBy.join(', ')}`],advisories:outcome.advisories};
  let result=amount;
  if(traits.incorporeal){
   const bypass=damageType==='force'||metadata.ghostTouch||metadata.incorporealSource;
   if(!bypass){
    const magical=metadata.magical===true||(metadata.enhancementBonus??0)>=1||metadata.sourceKind==='spell'||metadata.sourceKind==='supernatural'||cause==='spell'||cause==='supernatural';
    if(!magical&&cause==='weapon'){result=0;steps.push('Incorporeal: nonmagical weapon has no effect');}
    else if(!magical&&cause!=='weapon')steps.push('ADVISORY: Unclassified source against incorporeal target; GM review required');
    else {result=Math.floor(result/2);steps.push('Incorporeal: magical corporeal source, 50% damage');}
   }
  }
  if(EN.has(damageType)){
   const resist=traits.resistances[damageType]||0;
   if(resist){const absorbed=Math.min(result,resist);result-=absorbed;steps.push(`Resistance ${damageType} ${resist}: -${absorbed}`);}
  }
  if(PH.has(damageType)&&cause==='weapon'&&!skipDR){
   const absorbed=this.resolveDR(targetId,result,metadata,sourceId);
   if(absorbed){result-=absorbed;steps.push(`DR: -${absorbed}`);}
  }
  return {applied:result,prevented:amount-result,steps,advisories:outcome.advisories};
 }
 damage(targetId,amount,damageType='bludgeoning',sourceId=null,cause='weapon',metadata={}){
  const target=this.find(targetId);
  this.assert(n(amount,0,100000),'Invalid damage');
  if(sourceId!==null)this.find(sourceId);
  this.assert(DAMAGE.has(damageType),'Unsupported damage type');
  this.validateDamageMetadata(metadata);
  if(metadata.damageTypes!==undefined)this.assert(PH.has(damageType)&&metadata.damageTypes.includes(damageType),'Primary weapon damage type must appear in physical damage types');
  const evt=this.emit('damage_before',{target:targetId,source:sourceId,amount,damageType,damageTypes:metadata.damageTypes||[damageType],cause});
  if(evt.cancelled){this.note(`${amount} ${damageType} damage prevented by triggered rule.`);return {cancelled:true,applied:0,raw:amount};}
  const mitigation=this.resolveProtection(targetId,amount,damageType,cause,metadata,sourceId);
  if(this.applyObjectHardness){const object=this.applyObjectHardness(targetId,mitigation.applied,metadata);if(object){mitigation.applied=object.applied;mitigation.prevented=amount-object.applied;mitigation.steps.push(object.step);}}
  const tempHpAbsorbed=typeof this.absorbTemporaryHp==='function'?this.absorbTemporaryHp(targetId,mitigation.applied):0;
  if(tempHpAbsorbed){mitigation.applied-=tempHpAbsorbed;mitigation.prevented+=tempHpAbsorbed;mitigation.tempHpAbsorbed=tempHpAbsorbed;mitigation.steps.push(`Temporary HP: -${tempHpAbsorbed}`);}
  this.applyHpLoss(targetId,mitigation.applied,{damageType,metadata,source:sourceId,cause,tempHpAbsorbed,components:[{damageType,applied:mitigation.applied+tempHpAbsorbed}]});
  this.note(`${target.name}: ${amount} ${damageType} incoming; ${mitigation.applied} applied (${mitigation.steps.join('; ')||'no mitigation'}), ${target.hp} HP remaining.`);
  this.syncZones();
  return {cancelled:false,raw:amount,applied:mitigation.applied,...mitigation};
 }
 // Shared, read-only packet preflight also used before paying casting costs.
 validatePacketComponents(components){
  this.assert(Array.isArray(components)&&components.length>0&&components.length<=30,'Invalid packet components');
  const planned=[];
  for(const comp of components){
   this.assert(foundationObject(comp)&&Object.keys(comp).every(k=>['damageType','damageTypes','amount','dice','tags','alignmentMultipliers','defaultMultiplier','precision'].includes(k)),'Unknown damage component field');
   this.assert(DAMAGE.has(comp.damageType),'Invalid damage type');
   if(comp.damageTypes!==undefined){unique(comp.damageTypes,'damage component physical types',x=>PH.has(x),3);
    this.assert(PH.has(comp.damageType)&&comp.damageTypes.includes(comp.damageType),'Physical types must include the component primary type');}
   if(comp.precision!==undefined)validateCriticalProfile({precision:comp.precision});
   this.assert((comp.amount!==undefined)!==(comp.dice!==undefined),'Supply component amount OR dice');
   if(comp.amount!==undefined)this.assert(n(comp.amount,0,100000),'Invalid damage component amount');
   if(comp.dice!==undefined){this.assert(foundationObject(comp.dice)&&Object.keys(comp.dice).every(k=>['count','sides','bonus'].includes(k))&&n(comp.dice.count,1,100)&&n(comp.dice.sides,2,1000)&&n(comp.dice.bonus??0,-10000,10000),'Invalid damage dice');}
   if(comp.defaultMultiplier!==undefined)this.assert([0,0.5,1,1.5,2,3,4].includes(comp.defaultMultiplier),'Invalid default multiplier');
   if(comp.tags!==undefined)unique(comp.tags,'component tags',x=>TAGS.has(x));
   if(comp.alignmentMultipliers!==undefined){
    this.assert(Array.isArray(comp.alignmentMultipliers)&&comp.alignmentMultipliers.length<=8,'Invalid alignment multipliers');
    const seen=new Set();for(const r of comp.alignmentMultipliers){
     this.assert(foundationObject(r)&&Object.keys(r).every(k=>['alignment','factor'].includes(k))&&ALIGN.has(r.alignment)&&[0,0.5,1,1.5,2,3,4].includes(r.factor)&&!seen.has(r.alignment),'Invalid alignment multiplier');seen.add(r.alignment);
    }
   }
   planned.push({...comp});
  }
  return planned;
 }
 // A single multi-component attack/area damage event. No tactical choices are inferred.
 resolvePacket({target,source=null,cause='spell',metadata={},components}={}){
  const victim=this.find(target);if(source!==null)this.find(source);
  this.assert(['spell','weapon','environment','supernatural'].includes(cause),'Invalid packet cause');
  this.validateDamageMetadata(metadata);
  const planned=this.validatePacketComponents(components);let raw=0;
  // The GM's inclusion of precision dice in a packet certifies their eligibility.
  // One defensive roll applies to this packet's precision contributions; they inherit
  // their parent component's damage type and go through its mitigation ONCE.
  const precisionDefense=this.criticalDefenses(target);
  const hasPrecision=planned.some(c=>c.precision);
  const precisionRoll=hasPrecision&&!precisionDefense.precisionImmune&&precisionDefense.precisionNegationChance>0
    ?this.rollDie(100):null;
  const precisionBlocked=precisionDefense.precisionImmune||(precisionRoll!==null&&precisionRoll<=precisionDefense.precisionNegationChance);
  // Full validation above precedes random rolls; dispatch restores the RNG on failure.
  for(const comp of planned){const rolls=comp.dice?Array.from({length:comp.dice.count},()=>this.rollDie(comp.dice.sides)):null;
   const base=rolls?Math.max(0,rolls.reduce((sum,value)=>sum+value,comp.dice.bonus??0)):comp.amount;
   const precisionRolls=comp.precision&&!precisionBlocked?Array.from({length:comp.precision.count},()=>this.rollDie(comp.precision.sides)):[];
   const precisionDamage=comp.precision&&!precisionBlocked?precisionRolls.reduce((sum,value)=>sum+value,comp.precision.bonus??0):0;
   const amount=base+precisionDamage;
   raw+=amount;comp.baseAmount=base;comp.precisionDamage=precisionDamage;comp.precisionRolls=precisionRolls;
   comp.precisionBlocked=!!comp.precision&&precisionBlocked;comp.resolvedAmount=amount;comp.rolls=rolls;}
  this.assert(raw<=1000000,'Packet raw damage exceeds limit');
  // Resolve applicable target multipliers before checking that creature's defenses.
  const alignments=new Set(this.alignmentTags(target)),results=[];let total=0,physical=0,scaledTotal=0,targetAmplified=0;
  for(const comp of planned){
   const rules=(comp.alignmentMultipliers||[]).filter(r=>alignments.has(r.alignment));
   const factors=[...new Set(rules.map(r=>r.factor))];
   if(factors.length>1)throw new Error('Conflicting target alignment modifiers: GM must adjudicate the exception');
   const factor=factors[0]??comp.defaultMultiplier??1;const scaled=Math.floor(comp.resolvedAmount*factor);scaledTotal+=scaled;
   const merged={...metadata,tags:[...new Set([...(metadata.tags||[]),...(comp.tags||[])]) ],
    damageTypes:comp.damageTypes|| (PH.has(comp.damageType)?[comp.damageType]:metadata.damageTypes)};
   const result=this.resolveProtection(target,scaled,comp.damageType,cause,merged,source,true);
   targetAmplified+=result.amplified||0;
   const row={damageType:comp.damageType,tags:merged.tags,damageTypes:merged.damageTypes||null,raw:comp.resolvedAmount,rolls:comp.rolls,
    precisionDamage:comp.precisionDamage,precisionRolls:comp.precisionRolls,precisionBlocked:comp.precisionBlocked,
    alignmentFactor:factor,scaled:scaled+(result.amplified||0),applied:result.applied,steps:[...result.steps],advisories:result.advisories};
   results.push(row);total+=row.applied;if(PH.has(comp.damageType)&&cause==='weapon')physical+=row.applied;
  }
  // A weapon's DR applies only once to the total physical damage of this one attack.
  const drMetadata={...metadata,damageTypes:[...new Set(results.flatMap(r=>r.damageTypes||[]))]};
  const drPrevented=cause==='weapon'?this.resolveDR(target,physical,drMetadata,source):0;
  if(drPrevented){let remaining=drPrevented;for(const r of results)if(PH.has(r.damageType)){const used=Math.min(remaining,r.applied);r.applied-=used;remaining-=used;if(used)r.steps.push(`Shared weapon DR: -${used}`);}}
  total-=drPrevented;
  const objectHardness=this.applyObjectHardness?.(target,total,metadata);
  if(objectHardness){let left=total-objectHardness.applied;for(const r of results){const used=Math.min(left,r.applied);r.applied-=used;left-=used;}total=objectHardness.applied;}
  // Existing subscriptions are presented one event, before HP changes.
  const evt=this.emit('damage_before',{target,source,amount:raw,damageType:components.length===1?components[0].damageType:'mixed',cause,components:clone(planned),damageTypes:[...new Set(planned.flatMap(c=>c.damageTypes||[c.damageType]))]});
  if(evt.cancelled){this.note(`Damage packet prevented by triggered rule.`);return {cancelled:true,raw,applied:0,components:results};}
  const tempHpAbsorbed=typeof this.absorbTemporaryHp==='function'?this.absorbTemporaryHp(target,total):0;
  total-=tempHpAbsorbed;
  this.applyHpLoss(target,total,{metadata,source,cause,tempHpAbsorbed,components:results});this.s.actions.activity++;
  this.note(`${victim.name}: packet ${raw} raw / ${total} applied${hasPrecision?`; precision ${precisionBlocked?'negated or immune':'included'}${precisionRoll!==null?' (d% '+precisionRoll+')':''}`:''}; ${victim.hp} HP remaining.`);this.syncZones();
  return {cancelled:false,raw,scaled:scaledTotal+targetAmplified,applied:total,precisionBlocked,precisionDefenseRoll:precisionRoll,amplified:Math.max(0,scaledTotal+targetAmplified-raw),prevented:Math.max(0,scaledTotal+targetAmplified-total),drPrevented,tempHpAbsorbed,objectHardness:objectHardness||null,components:results,advisories:[...new Set(results.flatMap(c=>c.advisories||[]))]};
 }
 applyCondition(cmd){
  const tags=CONDITION_TAGS[cmd.condition]||[];
  const outcome=this.evaluateEffect({target:cmd.target,tags});
  if(outcome.blocked){this.note(`${this.find(cmd.target).name} is immune to ${cmd.condition}: ${outcome.blockedBy.join(', ')}.`);return {immune:true,blockedBy:outcome.blockedBy};}
  return super.applyCondition(cmd);
 }
 exposeAilment(cmd){
  const def=this.s.ailmentCatalog?.[cmd.definition];
  if(def){const effect=this.evaluateEffect({target:cmd.target,tags:[def.kind==='poison'?'poison':def.kind==='disease'?'disease':'nonlethal'].filter(x=>def.kind!=='dot')});
   if(effect.blocked){this.note(`${this.find(cmd.target).name} is immune to ${def.name}.`);return {immune:true,blockedBy:effect.blockedBy};}}
  return super.exposeAilment(cmd);
 }
 applyAbilityDamage(target,ability,amount){
  const traits=this.traits(target);
  if(traits.immunities.includes('ability_damage')||(traits.immunities.includes('physical_ability_damage')&&['str','dex','con'].includes(ability)))return {immune:true,applied:0};
  return super.applyAbilityDamage(target,ability,amount);
 }
 applyAbilityDrain(command){
  if(this.traits(command.target).immunities.includes('ability_drain'))return {immune:true,applied:0};
  return super.applyAbilityDrain(command);
 }
 inspect(){return {...super.inspect(),traits:Object.fromEntries(this.s.creatures.map(c=>[c.id,this.traits(c.id)])),
  calculatedDCs:Object.fromEntries(this.s.creatures.map(c=>[c.id,Object.fromEntries(Object.keys(c.dcDefinitions||{}).map(k=>{
   try{return [k,this.calculateDC({actor:c.id,abilityId:k})];}catch(err){return [k,{error:err.message}];}
  }))]))};}
 dispatch(command,role='actor'){
  const ops=new Set(['gm_resolve_damage','gm_resolve_packet','gm_evaluate_effect','gm_calculate_dc','gm_describe_attack','list_trait_library']);
  if(!ops.has(command?.op))return super.dispatch(command,role);
  if(command.op==='list_trait_library')return clone({types:CREATURE_TYPES,subtypes:Object.keys(SUBTYPE_CATALOG).sort(),subtypeCoverage:SUBTYPE_CATALOG,effectTags:EFFECT_TAGS,damageTypes:DAMAGE_TYPES,weaponBypassTags:DR_BYPASS_TAGS,attackKinds:ATTACK_KINDS,attackModes:ATTACK_MODES,naturalAttacks:NATURAL_ATTACKS,attackRiders:ATTACK_RIDERS,weaponMaterials:WEAPON_MATERIALS,itemConditions:ITEM_CONDITIONS});
  this.assert(role==='gm','Foundational GM adjudications are GM-only');
  return this.transaction(()=>{
   if(command.op==='gm_evaluate_effect')return this.evaluateEffect(command);
   if(command.op==='gm_describe_attack'){
    const c=this.find(command.actor),routine=this.attackRoutine(command.actor);
    this.assert(Number.isInteger(command.index)&&command.index>=0&&command.index<routine.length,'Invalid attack index');
    return clone({actor:c.id,index:command.index,label:routine[command.index].label,...attackDescription({...c,...routine[command.index]})});
   }
   if(command.op==='gm_calculate_dc')return this.calculateDC(command);
   if(command.op==='gm_resolve_packet'){
    this.assert(!this.s.interrupt&&!this.s.pendingMove&&!this.s.pendingFullAttack&&!this.s.pendingCharge,'Resolve pending operation first');
    return this.resolvePacket(command);
   }
   if(command.op==='gm_resolve_damage'){
    this.assert(!this.s.interrupt&&!this.s.pendingMove&&!this.s.pendingFullAttack&&!this.s.pendingCharge,'Resolve pending operation first');
    return this.damage(command.target,command.amount,command.damageType,command.source||null,command.cause||'environment',command.metadata||{});
   }
  });
 }
}
