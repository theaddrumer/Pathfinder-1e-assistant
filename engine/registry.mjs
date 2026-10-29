import {DAMAGE_TYPES} from './trait_library.mjs';
/**
 * Tabletop Kernel V3.4 — validated runtime definitions and instantiation.
 * The interpreting GM provides JSON data. This module never retrieves rules,
 * evaluates code, or attempts tactical decisions.
 */
import {AutomationGame} from './automation.mjs';
import {clone} from './core.mjs';
import {validateAttackPlan,validateAmmo} from './attack_routine_rules.mjs';
import {ABILITIES, TOTALS, MODIFIER_TYPES,modifierTarget,SKILL_NAME,skillAbility} from './stats.mjs';

const object = v => v!==null && typeof v==='object' && !Array.isArray(v);
const ident = v => typeof v==='string' && /^[a-z][a-z0-9_-]{0,63}$/i.test(v);
const label = v => typeof v==='string' && v.trim().length>0 && v.length<=120;
const statNames=TOTALS;
const abilityNames=ABILITIES;
const modifierTypes=new Set(MODIFIER_TYPES);
const types = new Set(DAMAGE_TYPES);
const numeric = (n,min,max) => Number.isInteger(n)&&n>=min&&n<=max;
const numericOptional = (obj,field,min,max) => !Object.hasOwn(obj,field)||numeric(obj[field],min,max);

export class RegistryGame extends AutomationGame {
  constructor(state){
    super(state);
    this.s.creatureCatalog ||= {};
    this.s.effectCatalog ||= {};
    this.s.registeredSeq ||= 0;
    this.turnStart=clone(this.s);this.roundStart=clone(this.s);
  }
  validateModifiers(mods) {
    this.assert(Array.isArray(mods)&&mods.length<=48,'Invalid modifier list');
    for(const m of mods){
      this.assert(object(m) && modifierTarget(m.stat) && modifierTypes.has(m.type||'untyped'),
        'Unsupported modifier stat/type');
      this.assert(Number.isFinite(m.value)&&Math.abs(m.value)<=100,'Invalid modifier value');
    }
  }
  importFieldPath(path,key) {
    return /^[a-zA-Z_$][\w$]*$/.test(key)?`${path}.${key}`:`${path}[${JSON.stringify(key)}]`;
  }
  assertKnownImportFields(value,allowed,path,message,hints={}) {
    const keys=allowed instanceof Set?allowed:new Set(allowed);
    const unknown=Object.keys(value).filter(k=>!keys.has(k));
    if(unknown.length)throw Error(`${message}: ${unknown.slice(0,8).map(k=>this.importFieldPath(path,k)).join(', ')}${unknown.length>8?' (additional unknown fields omitted)':''}. ${unknown.slice(0,8).map(k=>Object.hasOwn(hints,k)?hints[k]:'').filter(Boolean).join(' ')} Read kernel_reference topic registry; unsupported fields are not silently discarded.`);
  }
  validateImportAt(path,validate) {
    try{return validate();}catch(error){throw Error(`${path}: ${error.message}`);}
  }
  validateCreatureEnvelope(def) {
    this.assert(object(def),'definition must be a creature definition object');
    this.assert(ident(def.id),'definition.id must be a valid identifier (1–64 letters, digits, underscores or hyphens, starting with a letter)');
    this.assert(label(def.name),'definition.name must be nonblank text of at most 120 characters');
    this.assert(object(def.stats),'definition.stats must be an object');
    // Extension validators inspect attack metadata before reaching the base class.
    if(def.stats.attacks!==undefined){
      this.assert(Array.isArray(def.stats.attacks)&&def.stats.attacks.length>0&&def.stats.attacks.length<=20,'definition.stats.attacks must be an array of 1–20 attack entries');
      for(const [i,a] of def.stats.attacks.entries())this.assert(object(a),`definition.stats.attacks[${i}] must be an object`);
    }
  }
  validateCreature(def) {
    this.validateCreatureEnvelope(def);
    const c=def.stats;
    const fields={maxHp:[1,1000000],hp:[0,1000000],hitDiceCount:[1,500],size:[1,6],reach:[0,2000],speed:[0,1000],
      str:[1,250],dex:[1,250],con:[1,250],int:[1,250],wis:[1,250],cha:[1,250],
      bab:[-50,200],armor:[-100,200],shield:[-100,200],natural:[-100,200],deflection:[-100,200],dodge:[-100,200],maxDex:[-20,100],unarmoredMaxDex:[-20,1000],sizeAttack:[-20,20],sizeCMD:[-20,20],
      fortBase:[-100,200],refBase:[-100,200],willBase:[-100,200],damageDie:[2,100],damageOther:[-100,200],spellResistance:[0,1000],casterLevel:[1,100],concentrationBonus:[-100,400]};
    this.assert(numeric(c.maxHp,1,1000000),'definition.stats.maxHp requires a positive integer from 1 to 1000000');
    for(const [k,[min,max]] of Object.entries(fields))
      this.assert(numericOptional(c,k,min,max),`Invalid definition.stats.${k}: expected an integer from ${min} to ${max}`);
    this.assert((c.hp??c.maxHp)<=c.maxHp,'definition.stats.hp exceeds definition.stats.maxHp');
    if(c.damageType!==undefined)this.assert(types.has(c.damageType),'Unsupported definition.stats.damageType; query list_trait_library for damage types');
    if(c.flags!==undefined){
      this.assert(object(c.flags),'definition.stats.flags must be an object');
      this.assertKnownImportFields(c.flags,['combatReflexes','preciseShot'],'definition.stats.flags','Unsupported flag');
      for(const [k,v] of Object.entries(c.flags))this.assert(typeof v==='boolean',`definition.stats.flags.${k} must be boolean`);
    }
    if(c.equipmentACMode!==undefined)this.assert(['baseline','derived'].includes(c.equipmentACMode),'Invalid equipment AC mode');
    if(c.defenseProfile!==undefined)this.assert(typeof c.defenseProfile==='object'&&c.defenseProfile!==null&&!Array.isArray(c.defenseProfile),'Invalid defense profile');
    if(c.vision!==undefined){
      this.assert(object(c.vision),'definition.stats.vision must be an object');
      this.assertKnownImportFields(c.vision,['blindsight','blindsense','darkvision'],'definition.stats.vision','Unsupported vision field');
      for(const [k,v] of Object.entries(c.vision))this.assert(numeric(v,0,10000),`definition.stats.vision.${k} must be an integer from 0 to 10000`);
    }
    for(const k of ['blindFight','improvedPreciseShot'])if(c[k]!==undefined)this.assert(typeof c[k]==='boolean',`Invalid ${k}`);
    if(c.statTotals!==undefined){
      this.assert(object(c.statTotals),'definition.stats.statTotals must be an object');
      this.assertKnownImportFields(c.statTotals,statNames,'definition.stats.statTotals','Unsupported printed stat total');
      for(const [k,v] of Object.entries(c.statTotals))
        this.assert(numeric(v,-10000,10000),`definition.stats.statTotals.${k} must be an integer from -10000 to 10000`);
      if(['ac','touchAc','flatFootedAc'].some(k=>Object.hasOwn(c.statTotals,k)))
        this.assert(['ac','touchAc','flatFootedAc'].every(k=>Object.hasOwn(c.statTotals,k)),
          `Imported AC requires all three totals; missing ${['ac','touchAc','flatFootedAc'].filter(k=>!Object.hasOwn(c.statTotals,k)).map(k=>'definition.stats.statTotals.'+k).join(', ')}; never infer published defenses`);
    }
    if(c.abilityLinks!==undefined){
      this.assert(object(c.abilityLinks),'Invalid ability links');
      for(const [stat,links] of Object.entries(c.abilityLinks))
        this.assert(Object.hasOwn(c.statTotals||{},stat)&&Array.isArray(links)&&links.length<=3&&
          new Set(links).size===links.length&&links.every(x=>abilityNames.includes(x)),
          `${this.importFieldPath('definition.stats.abilityLinks',stat)} must reference an imported total and up to three unique valid abilities`);
    }
    if(c.skills!==undefined){
      this.assert(object(c.skills)&&Object.keys(c.skills).length<=100,'Invalid skill bonuses');
      for(const [k,v] of Object.entries(c.skills))
        this.assert(SKILL_NAME.test(k)&&numeric(v,-500,500),`${this.importFieldPath('definition.stats.skills',k)} requires a valid skill name and an integer bonus from -500 to 500`);
    }
    if(c.skillAbilityLinks!==undefined){
      this.assert(object(c.skillAbilityLinks),'Invalid skill ability links');
      for(const [skill,ability] of Object.entries(c.skillAbilityLinks))
        this.assert(Object.hasOwn(c.skills||{},skill)&&abilityNames.includes(ability),
          `${this.importFieldPath('definition.stats.skillAbilityLinks',skill)} must reference an imported skill and a valid ability`);
    }
    if(c.attackTraits!==undefined){
      this.assert(c.attackTraits && typeof c.attackTraits==='object'&&!Array.isArray(c.attackTraits),'Invalid attack metadata');
      this.assertKnownImportFields(c.attackTraits,['magical','ghostTouch','incorporealSource','weaponTags','tags','sourceKind','enhancementBonus','enhancementEquivalent'],'definition.stats.attackTraits','Unsupported attack metadata field');
    }
    if(c.attacks!==undefined){
      this.assert(Array.isArray(c.attacks)&&c.attacks.length>0&&c.attacks.length<=20,'Invalid attack routine');
      for(const [i,a] of c.attacks.entries()){
        const path=`definition.stats.attacks[${i}]`;
        this.assert(object(a)&&label(a.label),`${path}.label must be nonblank text of at most 120 characters`);
        for(const [k,min,max] of [['attackOffset',-100,100],['damageOffset',-100,100],['damageDie',2,100]])
          this.assert(numericOptional(a,k,min,max),`${path}.${k} must be an integer from ${min} to ${max}`);
        this.assertKnownImportFields(a,['label','attackOffset','damageOffset','damageDie','damageType','damageTypes','damageMode','attackKind','attackMode','naturalAttack','riders','attackTraits','weaponMaterial','itemCondition','improvisedProficient','itemId','constrictDie','constrictBonus','grabSizeAllowance','criticalThreat','criticalMultiplier','keen','improvedCritical','precision','extraDamage','poisonId','bleedAmount','paralysisDC','paralysisRounds','pullFeet','pushFeet','energyDrainLevels','energyDrainDC','energyDrainTempHp','damageIntent','nonlethalProficient','damageDiceCount','damageSizeSteps','damageAbility','rangedKind','rangeIncrementFeet','rangeFeet','firingIntoMelee','usableWhileProne','attackAbility','ammoId','limbId','naturalRole'],path,'Unknown attack field');
      }
    }
    this.validateImportAt('definition.stats.attackPlan',()=>validateAttackPlan(c));
    validateAmmo(c,'definition.stats.ammunition');
    for(const [i,attack] of (c.attacks||[]).entries())if(attack.ammoId!==undefined){
      const path=`definition.stats.attacks[${i}]`;
      this.assert(typeof attack.ammoId==='string',`${path}.ammoId must be a string`);
      this.assert(Object.hasOwn(c.ammunition||{},attack.ammoId),`${path}.ammoId references missing store ${JSON.stringify(attack.ammoId)} in definition.stats.ammunition; available IDs: ${Object.keys(c.ammunition||{}).join(', ')||'(none)'}`);
      this.assert(['ranged','ranged_touch'].includes(attack.attackMode),`${path}.attackMode must explicitly be ranged or ranged_touch when ammoId is present; the ammunition store exists`);
    }
    if(def.rules!==undefined){
      this.assert(Array.isArray(def.rules)&&def.rules.length<=20,'Invalid creature automation rules');
      const seen=new Set();
      for(const r of def.rules){
        this.assert(object(r)&&ident(r.id)&&!seen.has(r.id),'Invalid/duplicate intrinsic rule id');
        seen.add(r.id);
        this.assert(['zone_enter','damage_before','hit','turn_start','round_start','tile_enter','ping'].includes(r.on),'Unsupported intrinsic event');
        this.assert(Array.isArray(r.when)&&r.when.length<=20,'Invalid rule conditions');
        this.validateActions(r.actions);this.validateExposure?.(r.exposure);
        this.assert(r.exposure===undefined||['tile_enter','zone_enter','turn_start'].includes(r.on),'Exposure is supported on entry/turn-start rules');
        if(r.on==='zone_enter')this.assert(object(r.zone)&&numeric(r.zone.radius,1,10000)&&
          ['enemies','allies','others'].includes(r.zone.affects),'Invalid intrinsic zone');
      }
    }
    if(def.source!==undefined)this.assert(typeof def.source==='string'&&def.source.length<=300,'definition.source must be text of at most 300 characters');
    // Unknown fields must not be mistaken for working mechanics.
    const allowed=new Set([...Object.keys(fields),'sizeCategory','legs','tripImmune','flying','freeHands','equipment','equipmentACMode','defenseProfile','vision','blindFight','improvedPreciseShot','maneuverImprovements','maneuverModifiers','grab','damageType','damageTypes','damageMode','attackKind','attackMode','naturalAttack','riders','attackTraits','weaponMaterial','itemCondition','improvisedProficient','itemId','flags','statTotals','abilityLinks','skills','skillAbilityLinks','attacks','attackPlan','ammunition']);
    this.assertKnownImportFields(c,allowed,'definition.stats','Unsupported creature field',{initiative:'Use definition.stats.statTotals.initiative for a printed initiative bonus.',ac:'Use definition.stats.statTotals with all three AC totals.'});
    this.assertKnownImportFields(def,['id','name','stats','rules','source'],'definition','Unsupported creature definition field',Object.fromEntries([...allowed].map(k=>[k,`Use definition.stats.${k} for this field.`])));
  }
  validateEffectDefinition(def){
    this.assert(object(def)&&ident(def.id)&&label(def.name),'Invalid effect definition');
    this.validateModifiers(def.mods);
    if(def.defaultRounds!==undefined)this.assert(def.defaultRounds===null||numeric(def.defaultRounds,1,100000),
      'Invalid default duration');
    if(def.source!==undefined)this.assert(typeof def.source==='string'&&def.source.length<=300,'Invalid effect source note');
    this.assert(Object.keys(def).every(k=>['id','name','mods','defaultRounds','source'].includes(k)),
      'Unsupported effect definition field');
  }
  registerCreature(def){
    this.validateCreatureEnvelope(def);
    this.validateCreature(def);
    this.assert(Object.keys(this.s.creatureCatalog).length<250,'Creature catalog limit');
    this.assert(!Object.hasOwn(this.s.creatureCatalog,def.id),'Creature definition already exists; version IDs instead of overwriting');
    this.s.creatureCatalog[def.id]=clone(def);
    this.note(`Registered creature definition ${def.id} (${def.name}).`);
    return {registered:def.id};
  }
  registerEffect(def){
    this.validateEffectDefinition(def);
    this.assert(Object.keys(this.s.effectCatalog).length<500,'Effect catalog limit');
    this.assert(!Object.hasOwn(this.s.effectCatalog,def.id),'Effect definition already exists; version IDs instead of overwriting');
    this.s.effectCatalog[def.id]=clone(def);
    this.note(`Registered effect definition ${def.id} (${def.name}).`);
    return {registered:def.id};
  }
  initializeCreature(creature,definition){}
  onCreatureSpawned(creature,command){return {};}
  spawnCreature(command={}){
    const {definition,id,x,y,team='enemy',name}=command;
    this.assert(!this.s.pendingMove&&!this.s.interrupt&&!this.s.pendingFullAttack,
      'Finish pending resolution before spawning');
    this.assert(ident(id)&&ident(definition),'Invalid instance or definition ID');
    this.assert(['party','enemy','neutral'].includes(team),'Invalid faction; team must be party, enemy, or neutral (default: enemy)');
    this.assert(Number.isInteger(x)&&Number.isInteger(y),'Invalid spawn coordinates');
    if(name!==undefined)this.assert(label(name),'Invalid creature name');
    const def=this.s.creatureCatalog[definition];
    this.assert(Object.hasOwn(this.s.creatureCatalog,definition),'Unknown creature definition');
    this.assert(!this.s.creatures.some(c=>c.id===id),'Creature instance ID already exists');
    this.assert(this.s.creatures.length<100,'Creature encounter limit');
    const stats=clone(def.stats);
    const creature={
      id,name:name??def.name,team,x,y,definitionId:definition,
      size:1,reach:1,speed:30,hp:stats.maxHp,maxHp:stats.maxHp,
      str:10,dex:10,con:10,int:10,wis:10,cha:10,bab:0,
      armor:0,natural:0,sizeAttack:0,sizeCMD:0,
      fortBase:0,refBase:0,willBase:0,damageDie:6,damageOther:0,flags:{},
      ...stats
    };
    this.initializeCreature(creature,def);this.prepareSpatialSpawn?.(creature,command);
    if(typeof this.snapshotEquipmentDefense==='function')creature.defenseEquipmentBaseline=this.snapshotEquipmentDefense(creature);
    this.s.creatures.push(creature);
    this.assert(this.legalPosition(id,x,y),'Spawn square is blocked or out of bounds');
    for(const rule of def.rules||[]){
      const installed={...clone(rule),id:`${id}--${rule.id}`,owner:id};
      this.installRule(installed,{persistSnapshot:false});
    }
    this.s.actions.activity++;
    this.note(`${creature.name} spawned from ${definition} at (${x},${y}).`);
    const additions=this.onCreatureSpawned(creature,command);
    this.syncZones();
    return {spawned:id,definition,at:{x,y},...additions};
  }
  applyRegisteredEffect({definition,target,source=null,id,rounds}={}) {
    this.assert(!this.s.interrupt&&!this.s.pendingMove&&!this.s.pendingFullAttack,
      'Resolve pending operation first');
    this.assert(ident(definition),'Invalid effect definition ID');
    const def=this.s.effectCatalog[definition];
    this.assert(Object.hasOwn(this.s.effectCatalog,definition),'Unknown effect definition');
    this.find(target);if(source!==null)this.find(source);
    const duration=rounds===undefined?(def.defaultRounds??null):rounds;
    this.assert(duration===null||numeric(duration,1,100000),'Invalid effect duration');
    // Reapplying the same named condition to a creature refreshes that
    // definition rather than erroneously doubling its identical penalties.
    const existing=this.s.effects.find(e=>e.target===target&&e.definitionId===definition);
    if(existing){
      this.assert(id===undefined||id===existing.id,'Effect already active; omit id to refresh');
      existing.remaining=duration;
      existing.source=source;
      this.note(`${def.name} refreshed on ${this.find(target).name}.`);
      return {effectId:existing.id,refreshed:true,remaining:duration};
    }
    const effectId=id??`registered_${++this.s.registeredSeq}`;
    this.addEffect({id:effectId,name:def.name,source,target,mods:def.mods,rounds:duration});
    this.s.effects.find(e=>e.id===effectId).definitionId=definition;
    return {effectId,refreshed:false,remaining:duration};
  }
  gmRoll(command){
    this.assert(!this.s.interrupt&&!this.s.pendingMove&&!this.s.pendingFullAttack,
      'Resolve pending action before ad hoc adjudication');
    const {kind='plain',count=1,sides=6,bonus=0,target,damageType='bludgeoning',
      source=null,cause='environment',label='GM adjudication'}=command;
    this.assert(['plain','damage','healing'].includes(kind),'Unsupported roll kind. Use kind:"plain" for dice only, "damage" to apply damage, or "healing" to heal. Example: {op:"gm_roll",kind:"plain",count:1,sides:4}');
    const allowed=['op','kind','count','sides','bonus','label','reason',
      ...(kind==='plain'?[]:['target','damageType','source','cause','metadata'])];
    this.assert(Object.keys(command).every(k=>allowed.includes(k)),
      'Unsupported gm_roll field for this kind. Dice-only example: {op:"gm_roll",kind:"plain",count:1,sides:4}. Plain rolls do not accept a target or apply effects.');
    this.assert(numeric(count,1,100)&&numeric(sides,2,1000)&&numeric(bonus,-10000,10000),
      'Dice require bounded integer count, sides and bonus');
    this.assert(typeof label==='string'&&label.length>0&&label.length<=120,'Invalid roll label');
    const rolls=Array.from({length:count},()=>this.rollDie(sides));
    const total=rolls.reduce((a,b)=>a+b,bonus),applied=Math.max(0,total);
    let result={kind,rolls,bonus,total,applied:0};
    if(kind==='damage'){
      this.assert(types.has(damageType),'Unsupported damage type');
      this.assert(typeof target==='string','Damage requires a target');
      result.damage=this.damage(target,applied,damageType,source,cause,command.metadata||{});
      result.applied=result.damage.applied;
    } else if(kind==='healing'){
      result.healing=this.healHitPoints({target,amount:applied});
      result.applied=result.healing.hpHealed;
    } else this.note(`${label}: ${count}d${sides}${bonus>=0?'+':''}${bonus} = ${total}.`);
    return result;
  }
  healHitPoints({target,amount}={}){
    const c=this.find(target);this.assert(numeric(amount,0,100000),'Invalid HP healing');
    const before=c.hp;c.hp=Math.min(c.maxHp,c.hp+amount);
    const hpHealed=c.hp-before;
    this.s.actions.activity++;
    this.note(`${c.name} heals ${c.hp-before} HP (${c.hp}/${c.maxHp} HP).`);
    this.syncZones();
    return {target,hpHealed};
  }
  gmModifier(command){
    this.assert(!this.s.interrupt&&!this.s.pendingMove&&!this.s.pendingFullAttack,
      'Resolve pending action before modifier injection');
    const {target,stat,value,type='untyped',name='GM modifier',source=null,rounds=null}=command;
    this.assert(modifierTarget(stat)&&modifierTypes.has(type),'Unsupported modifier stat/type');
    this.assert(Number.isFinite(value)&&Math.abs(value)<=100,'Invalid modifier value');
    const id=command.id??`gm_modifier_${++this.s.registeredSeq}`;
    this.addEffect({id,name,source,target,rounds,mods:[{stat,value,type}]});
    return {effectId:id};
  }
  // A compact read-only controller view; the full exportState still exists for
  // save files and advanced debugging. No tactics or suggested decisions.
  inspect(){
    return clone({round:this.s.round,active:this.active()?.id,
      actions:this.s.actions,interrupt:this.s.interrupt,pendingMove:this.s.pendingMove,
      pendingFullAttack:this.s.pendingFullAttack,
      creatures:this.s.creatures.map(c=>({id:c.id,name:c.name,definitionId:c.definitionId,
        team:c.team,x:c.x,y:c.y,hp:c.hp,maxHp:c.maxHp,reach:c.reach,speed:c.speed,
        defenses:Object.fromEntries(['ac','touchAc','flatFootedAc'].map(k=>[k,this.stat(c.id,k)])),
      initiative:this.stat(c.id,'initiative'),attack:this.stat(c.id,'attack'),
        saves:{fort:this.stat(c.id,'fort'),ref:this.stat(c.id,'ref'),will:this.stat(c.id,'will')},
        skills:Object.fromEntries(Object.keys(c.skills||{}).map(k=>[k,this.skillBonus(c.id,k)])),
        attacks:this.attackRoutine(c.id)})),
      effects:this.s.effects,creatureDefinitions:Object.keys(this.s.creatureCatalog),
      effectDefinitions:Object.keys(this.s.effectCatalog)});
  }
  dispatch(command,role='actor'){
    this.assert(['gm','actor','player'].includes(role),'Unknown role');
    const ops=new Set(['register_creature','register_effect','spawn_creature','apply_registered_effect','gm_roll','gm_modifier','inspect']);
    if(!ops.has(command?.op))return super.dispatch(command,role);
    if(command.op==='inspect'){this.assert(role!=='player','Player cannot inspect hidden GM state');return this.inspect();}
    this.assert(role==='gm','Runtime definitions and effect injection are GM-only');
    return this.transaction(()=>{
      let result;
      switch(command.op){
        case 'register_creature':result=this.registerCreature(command.definition);break;
        case 'register_effect':result=this.registerEffect(command.definition);break;
        case 'spawn_creature':result=this.spawnCreature(command);break;
        case 'apply_registered_effect':result=this.applyRegisteredEffect(command);break;
        case 'gm_roll':result=this.gmRoll(command);break;
        case 'gm_modifier':result=this.gmModifier(command);break;
      }
      // Definition registration is persistent setup; unlike a physical action,
      // it must not disappear when restoring an encounter turn.
      if(command.op==='register_creature'||command.op==='register_effect'){
        for(const key of ['turnStart','roundStart','previousTurnStart']){
          if(this[key]){
            const catalog=command.op==='register_creature'?'creatureCatalog':'effectCatalog';
            this[key][catalog]=clone(this.s[catalog]);
          }
        }
      }
      return result;
    });
  }
}
