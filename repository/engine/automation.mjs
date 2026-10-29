import {silverDamagePenalty} from './weapon_materials.mjs';
/**
 * Tabletop Kernel V2 -- integrated, DATA-DRIVEN automatic effects.
 * This is a limited demonstrator, NOT an authoritative PF1e implementation.
 * No eval, injected functions, online dependencies, or dynamic code execution.
 */
import {attackDescription} from './attack_library.mjs';
import {Game, clone} from './core.mjs';
import {MODIFIER_TYPES,modifierTarget,DEFENSES} from './stats.mjs';
const REF=/^(event|owner|rule|effect)(\.[A-Za-z_][A-Za-z_0-9]*){1,5}$/;
const ACTIONS=new Set(['save','apply_effect','mark','remove_effect','cancel_event','set_hp','duplicate_entity','random_relocate','offer_interrupt','deal_damage','grant_action']);
const EVENTS=new Set(['zone_enter','damage_before','hit','turn_start','round_start','tile_enter','ping']);
const isObj=x=>!!x && typeof x==='object' && !Array.isArray(x);

export class AutomationGame extends Game {
  constructor(state){
    super(state);
    this.s.automationRules ||= [];
    this.s.zonePresence ||= {};
    this.s.marks ||= [];
    this.s.autoSeq ||= 0;
    this._depth=0;
    this._syncing=false;
    this._operations=0;
    this.turnStart=clone(this.s);this.roundStart=clone(this.s);
  }
  validateActions(actions,depth=0){
    this.assert(Array.isArray(actions)&&actions.length<=24 && depth<=5,'Invalid actions or nesting');
    for(const a of actions){
      this.assert(isObj(a)&&ACTIONS.has(a.op),'Unsupported automation operation');
      if(a.op==='save'){
        this.assert(['fort','ref','will'].includes(a.save),'Unsupported save');
        this.validateActions(a.success||[],depth+1);
        this.validateActions(a.failure||[],depth+1);
      }
      if(a.op==='apply_effect'){
        this.assert(Array.isArray(a.mods)&&a.mods.length<=24,'Invalid effect modifiers');
        for(const m of a.mods){
          this.assert(modifierTarget(m.stat)&&MODIFIER_TYPES.includes(m.type||'untyped'),'Bad modifier target/type');
          this.assert(Number.isFinite(m.value)&&Math.abs(m.value)<=100,'Bad modifier value');
        }
        if(a.onEnd)this.validateActions(a.onEnd,depth+1);
      }
      if(a.op==='mark')this.assert(typeof a.tag==='string'&&a.tag.length<=80,'Invalid mark tag');
      if(a.op==='random_relocate')this.assert((a.squaresPerDie||1)<=10 && (a.die||20)<=100,'Bad relocation randomizer');
      if(a.op==='offer_interrupt')this.validateActions(a.accept||[],depth+1);
      if(a.op==='grant_action'){
        this.assert(['standard','move','swift'].includes(a.type),'Invalid granted action type');
        this.assert(a.count===undefined||(Number.isInteger(a.count)&&a.count>=1&&a.count<=4),'Invalid granted action count');
      }
    }
  }
  installRule(rule,{persistSnapshot=true}={}){
    this.assert(isObj(rule)&&typeof rule.id==='string'&&/^[\w-]{1,80}$/.test(rule.id),'Invalid rule id');
    this.validateExposure?.(rule.exposure);
    this.assert(rule.exposure===undefined||['tile_enter','zone_enter','turn_start'].includes(rule.on),'Exposure is supported on entry/turn-start rules');
    this.assert(EVENTS.has(rule.on)&&(rule.owner===undefined||!!this.s.creatures.find(c=>c.id===rule.owner)),'Invalid rule event or owner');
    this.assert(!this.s.automationRules.some(r=>r.id===rule.id),'Duplicate rule');
    this.assert(this.s.automationRules.length<250,'Too many rules');
    this.assert(Array.isArray(rule.when)&&rule.when.length<=20,'Invalid conditions');
    this.validateActions(rule.actions);
    // Generic optional offers are safe only at scheduler boundaries in V2.
    // AoOs retain the existing specialized mid-movement suspension logic.
    if(JSON.stringify(rule.actions).includes('\"offer_interrupt\"'))
      this.assert(['turn_start','ping'].includes(rule.on),'Mid-resolution generic interrupts not yet supported');
    if(rule.on==='zone_enter'){
      this.assert(!!rule.owner,'Zone rules require a creature source');
      this.assert(isObj(rule.zone)&&Number.isInteger(rule.zone.radius)&&rule.zone.radius>0&&rule.zone.radius<=10000,'Invalid zone radius');
      this.assert(['enemies','allies','others'].includes(rule.zone.affects),'Invalid zone target filter');
    }
    this.s.automationRules.push(clone(rule));
    this.note(`Registered automation: ${rule.id}.`);
    // Installation is encounter setup; future Undo should not delete the rule.
    if(persistSnapshot){this.turnStart=clone(this.s);this.roundStart=clone(this.s);}
  }
  expression(value,ctx){
    if(Array.isArray(value))return value.map(v=>this.expression(v,ctx));
    if(!isObj(value))return value;
    if('ref' in value){
      this.assert(typeof value.ref==='string'&&REF.test(value.ref),'Forbidden reference');
      const [root,...path]=value.ref.split('.');
      let node=ctx[root];
      for(const p of path){
        this.assert(node!==null && node!==undefined && Object.prototype.hasOwnProperty.call(node,p),`Unknown reference ${value.ref}`);
        node=node[p];
      }
      return node;
    }
    if('calc' in value){
      const a=this.expression(value.a,ctx),b=this.expression(value.b,ctx);
      this.assert(Number.isFinite(a)&&Number.isFinite(b),'Non-numeric expression');
      switch(value.calc){
        case 'floor_div':this.assert(b!==0,'Division by zero');return Math.floor(a/b);
        case 'add':return a+b;
        case 'multiply':return a*b;
        default:throw new Error(`Unsupported calculation ${value.calc}`);
      }
    }
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,this.expression(v,ctx)]));
  }
  marker(source,target,tag){return this.s.marks.some(m=>m.source===source&&m.target===target&&m.tag===tag&&m.expiresRound>this.s.round);}
  conditions(conditions,ctx){
    return conditions.every(w=>{
      if(w.op==='not_marked')return !this.marker(this.expression(w.source,ctx),this.expression(w.target,ctx),w.tag);
      if(w.op==='not_affected')return !this.s.effects.some(e=>e.source===this.expression(w.source,ctx)&&e.target===this.expression(w.target,ctx)&&e.name===w.name);
      const a=this.expression(w.left,ctx),b=this.expression(w.right,ctx);
      switch(w.op){
        case 'eq':return a===b;
        case 'ne':return a!==b;
        case 'gt':return a>b;
        case 'lte':return a<=b;
        case 'in':return Array.isArray(b)&&(Array.isArray(a)?a.some(x=>b.includes(x)):b.includes(a));
        default:throw new Error(`Unsupported condition ${w.op}`);
      }
    });
  }
  doActions(actions,ctx){
    for(const a of actions){
      if(++this._operations>150)throw new Error('Automation operation budget exhausted');
      switch(a.op){
        case 'save':{
          const target=this.expression(a.target,ctx),dc=this.expression(a.dc,ctx);
          this.find(target);this.assert(Number.isFinite(dc)&&dc>=0&&dc<=1000,'Invalid save DC');
          const result=this.savingThrow(target,a.save,dc);
          this.doActions(result.success?(a.success||[]):(a.failure||[]),ctx);
          break;
        }
        case 'apply_effect':{
          const target=this.expression(a.target,ctx),source=this.expression(a.source,ctx);
          const id=`auto-${++this.s.autoSeq}`;
          this.addEffect({id,name:a.name,source,target,mods:a.mods,rounds:a.rounds||null});
          const effect=this.s.effects.find(e=>e.id===id);
          if(a.endOn)effect.endOn=clone(a.endOn);
          if(a.onEnd)effect.onEnd=clone(a.onEnd);
          break;
        }
        case 'mark':{
          const source=this.expression(a.source,ctx),target=this.expression(a.target,ctx);
          this.find(source);this.find(target);
          const rounds=this.expression(a.rounds,ctx);
          this.assert(Number.isInteger(rounds)&&rounds>0&&rounds<=1000000,'Invalid mark duration');
          this.s.marks=this.s.marks.filter(m=>!(m.source===source&&m.target===target&&m.tag===a.tag));
          this.s.marks.push({source,target,tag:a.tag,expiresRound:this.s.round+rounds});
          this.note(`${this.find(target).name} gains ${a.tag} from ${this.find(source).name} (${rounds} rounds).`);
          break;
        }
        case 'remove_effect':{
          const id=this.expression(a.id,ctx);this.removeEffect(id);break;
        }
        case 'cancel_event':ctx.event.cancelled=true;break;
        case 'deal_damage':{
          const target=this.expression(a.target,ctx);
          const amount=a.die?this.rollDie(a.die):this.expression(a.amount,ctx);
          this.assert(Number.isInteger(amount)&&amount>=0&&amount<=100000,'Invalid automated damage');
          this.damage(target,amount,a.damageType||'untyped',null,'hazard');
          break;
        }
        case 'set_hp':{
          const target=this.find(this.expression(a.target,ctx));const hp=this.expression(a.hp,ctx);
          this.assert(Number.isInteger(hp)&&hp>=0&&hp<=1000000,'Invalid HP assignment');
          target.hp=hp;this.note(`${target.name} HP set to ${hp}.`);break;
        }
        case 'duplicate_entity':{
          const id=this.expression(a.target,ctx),original=this.find(id);
          const copy=clone(original);copy.id=`${id}-copy-${++this.s.autoSeq}`;copy.name=`${original.name} (split)`;
          // Clone intrinsic rules; do not give the copy a free immediate turn.
          this.s.creatures.push(copy);
          const where=this.nearestFreeAnchor(copy.id,original.x+original.size,original.y);
          this.assert(where!==null,'No legal location for copied entity');
          copy.x=where.x;copy.y=where.y;
          for(const r of [...this.s.automationRules].filter(r=>r.owner===id)){
            const rc=clone(r);rc.owner=copy.id;rc.id=`${r.id}-copy-${this.s.autoSeq}`;
            this.s.automationRules.push(rc);
          }
          this.onCreatureDuplicated?.(original,copy);
          this.note(`${copy.name} created at (${copy.x},${copy.y}) with ${copy.hp} HP.`);
          break;
        }
        case 'random_relocate':{
          const target=this.expression(a.target,ctx);const c=this.find(target);
          const die=a.die||20,mult=a.squaresPerDie||1;
          this.assert(Number.isInteger(die)&&die>=2&&die<=100&&Number.isInteger(mult)&&mult>=1&&mult<=10,'Invalid relocation dice');
          const direction=this.rollDie(8)-1,steps=this.rollDie(die)*mult;
          const dirs=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
          const [dx,dy]=dirs[direction],wantedX=c.x+dx*steps,wantedY=c.y+dy*steps;
          const dest=this.nearestFreeAnchor(target,wantedX,wantedY);
          this.assert(dest!==null,'No safe landing square');
          this.teleport(target,dest.x,dest.y,a.label||'automatic random displacement');
          this.note(`Direction ${direction+1}/8; distance ${steps*5} ft; proposed (${wantedX},${wantedY}); safe (${dest.x},${dest.y}).`);
          break;
        }
        case 'grant_action':{
          const target=this.expression(a.target,ctx);
          this.grantAction(target,a.type,a.count??1,ctx.rule?.id||'automatic rule');
          break;
        }
        case 'offer_interrupt':{
          const reactor=this.expression(a.actor,ctx);this.find(reactor);
          this.assert(!this.s.interrupt,'Another interrupt must resolve first');
          this.s.interrupt={type:'rule_offer',reactor,text:a.text||'Optional ability',accept:clone(a.accept||[]),context:clone(ctx),rule:ctx.rule?.id};
          this.note(`${this.find(reactor).name} is offered: ${a.text||'optional ability'}.`);
          break;
        }
      }
    }
  }
  fireRule(rule,event){
    if(this._depth===0)this._operations=0;
    if(this._depth>=12)throw new Error('Automation recursion limit');
    const owner=rule.owner?this.find(rule.owner):{id:'environment'},ctx={rule,owner,event};
    if(['tile_enter','zone_enter'].includes(rule.on)||rule.on==='turn_start'&&rule.exposure){
      if(event.elevationChange&&rule.exposure?.mode==='volume')return;
      const target=this.find(event.target||event.actor);
      if(!this.exposureAllowed(target,rule.exposure||(rule.on==='tile_enter'?{mode:'surface'}:undefined)))return;
    }
    if(!this.conditions(rule.when||[],ctx))return;
    this._depth++;
    try {this.doActions(rule.actions,ctx);}finally{this._depth--;}
  }
  emit(name,payload={}){
    if(this._depth===0)this._operations=0;
    return this.transaction(()=>{
    // Core's old manually registered effect termination remains compatible.
    super.emit(name,payload);
    const event={name,...clone(payload),cancelled:false};
    for(const e of [...this.s.effects]){
      const end=e.endOn;
      if(!end||end.name!==name)continue;
      const ctx={effect:e,event,owner:e.source?this.find(e.source):this.find(e.target),rule:{owner:e.source}};
      if(!this.conditions(end.when||[],ctx))continue;
      this.removeEffect(e.id);
      if(e.onEnd)this.doActions(e.onEnd,ctx);
    }
    for(const rule of [...this.s.automationRules])if(rule.on===name&&name!=='zone_enter')this.fireRule(rule,event);
    return event;
    });
  }
  syncZones(){
    if(this._syncing)return;
    this._syncing=true;
    try{
     return this.transaction(()=>{
      for(let attempt=0;attempt<24;attempt++){
        let changed=false;
        for(const r of [...this.s.automationRules].filter(r=>r.on==='zone_enter')){
          const source=this.find(r.owner);
          for(const target of [...this.s.creatures]){
            if(source.id===target.id)continue;
            const k=`${r.id}|${target.id}`;
            const eligible=source.hp>0&&target.hp>0&&
              (r.zone.affects==='others'||(r.zone.affects==='enemies'&&source.team!==target.team)||(r.zone.affects==='allies'&&source.team===target.team));
            const inside=eligible&&this.distance(source,target)<=r.zone.radius&&this.exposureAllowed(target,r.exposure);
            const before=!!this.s.zonePresence[k];
            this.s.zonePresence[k]=!!inside;
            if(inside&&!before){
              changed=true;
              this.note(`${target.name} enters ${source.name}'s ${r.id} zone.`);
              this.fireRule(r,{name:'zone_enter',source:source.id,target:target.id});
            }
            if(this.s.interrupt)return;
          }
        }
        if(!changed)break;
        if(attempt===23)throw new Error('Zone trigger iteration limit');
      }
     });
    }finally{this._syncing=false;}
  }
  nearestFreeAnchor(id,x,y){
    const c=this.find(id);
    const candidates=[];
    for(let ty=0;ty<this.s.height;ty++)for(let tx=0;tx<this.s.width;tx++){
      // Exact target if possible; otherwise nearest legal origin-square position.
      if(this.legalPosition(id,tx,ty))candidates.push({x:tx,y:ty,d:Math.max(Math.abs(tx-x),Math.abs(ty-y))});
    }
    candidates.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);
    return candidates[0]||null;
  }
  damage(targetId,amount,damageType='bludgeoning',sourceId=null,cause='weapon'){
    const target=this.find(targetId);
    this.assert(Number.isInteger(amount)&&amount>=0&&amount<=100000,'Invalid damage');
    const evt=this.emit('damage_before',{target:targetId,source:sourceId,amount,damageType,cause});
    if(evt.cancelled){this.note(`${amount} ${damageType} damage prevented by triggered rule.`);return {cancelled:true,applied:0};}
    this.applyHpLoss(targetId,amount,{damageType,source:sourceId,cause});
    this.note(`${target.name} takes ${amount} ${damageType} damage (${target.hp} HP remaining).`);
    this.syncZones();
    return {cancelled:false,applied:amount};
  }
  resolveAttackCheck(actorId,targetId,label='Attack',profile=null,defense='ac',options={}){
    const actor=this.find(actorId),target=this.find(targetId);
    this.assert(this.canAct(actorId)&&(this.canBeAttacked(targetId)||options.allowDownTarget===true),'Combatant is down');
    const attackDistance=this.distance(actor,target);
    const mode=profile?.attackMode||actor.attackMode||'melee';
    if(mode==='melee'||mode==='melee_touch')this.assert(this.meleeReach(actorId,targetId),'Target out of reach');
    this.assert(DEFENSES.includes(defense),'Unknown attack defense');
    const description=attackDescription(options.standalone?profile:{...actor,...profile});
    const range=typeof this.attackRangeInfo==='function'?this.attackRangeInfo(actorId,targetId,profile,description):null;
    this.assert(description.damageMode!=='choice','Selectable weapon damage requires an explicit GM choice');
    const defenseCheck=typeof this.attackDefenseContext==='function'?this.attackDefenseContext(actorId,targetId,description,defense):{acBonus:0,missChance:0};
    this.assert(!defenseCheck.totalCover,'Target has total cover; ordinary direct attacks cannot target it');
    const effectiveDefense=description.attackMode==='ranged_touch'||description.attackMode==='melee_touch'?(defense==='ac'?'touchAc':defense):defense;
    const combat=this.combatAttackAdjustments?.(actorId,targetId,profile||{},description)||{attack:0,damage:0,confirmation:0};
    const targetDefense=this.stat(targetId,effectiveDefense)+(defenseCheck.acBonus||0);
    const bonus=(options.attackBonus??(typeof this.completedAttackBonus==='function'?this.completedAttackBonus(actorId,profile,description):this.stat(actorId,'attack')))+
      (profile?.attackOffset||0)+(combat.attack||0)+description.penalties.attack+(range?.rangePenalty||0)+(range?.meleePenalty||0)+
      (typeof this.nonlethalAttackPenalty==='function'?this.nonlethalAttackPenalty(profile,description):0);
    this.recordCombatAttack?.(actorId);
    const d20=this.rollDie(20),total=d20+bonus;
    const hit=d20===20||(d20!==1&&total>=targetDefense);
    if(!hit){this.note(`${label}: ${actor.name} rolls ${d20} (${total}) vs AC ${targetDefense}: miss.`);return {d20,total,bonus,hit:false,combat,targetDefense};}
    if(defenseCheck.missChance){
      const first=this.rollDie(100);let second=null;let missed=first<=defenseCheck.missChance;
      if(missed&&defenseCheck.reroll){second=this.rollDie(100);missed=second<=defenseCheck.missChance;}
      this.note(`${label}: miss chance ${defenseCheck.missChance}% (${first}${second===null?'':', reroll '+second}): ${missed?'MISS':'hit'}.`);
      if(missed)return {d20,total,hit:false,attackRollHit:true,missChance:defenseCheck.missChance,missRolls:[first,...(second===null?[]:[second])],missedByConcealment:true,defenseContext:defenseCheck};
    }
    const critical=description.critical;
    const threat=options.canCritical!==false&&d20>=critical.threat;
    let confirmation=null,confirmed=false;
    const defenseInfo=typeof this.criticalDefenses==='function'?this.criticalDefenses(targetId):{
      criticalImmune:false,precisionImmune:false,criticalNegationChance:0,precisionNegationChance:0};
    // A 19 in an expanded threat range is not automatically a hit; hit was checked above.
    if(threat&&!defenseInfo.criticalImmune){
      const confirmationRoll=this.rollDie(20),confirmationTotal=confirmationRoll+bonus+(combat.confirmation||0);
      confirmed=confirmationRoll===20||(confirmationRoll!==1&&confirmationTotal>=targetDefense);
      confirmation={d20:confirmationRoll,total:confirmationTotal,confirmed};
    }
    const automaticPrecision=!!combat.flanking?.flanking||(this.helpless?.(targetId)&&(!range||range.distanceFeet<=30));
    const precisionEnabled=(options.precisionEligible??profile?._precisionEligible??this._precisionEligible??automaticPrecision)===true&&!!profile?.precision&&!(defenseCheck.missChance>0); // Concealment ordinarily forbids precision, even when the miss chance succeeds.
    let negationRoll=null,criticalNegated=false,precisionNegated=false;
    const criticalChance=confirmed?defenseInfo.criticalNegationChance:0;
    const precisionChance=precisionEnabled&&!defenseInfo.precisionImmune?defenseInfo.precisionNegationChance:0;
    // A single defensive d% roll for this hit: one fortification effect can reject both outcomes.
    if(criticalChance||precisionChance){
      negationRoll=this.rollDie(100);
      criticalNegated=confirmed&&negationRoll<=criticalChance;
      precisionNegated=precisionEnabled&&negationRoll<=precisionChance;
    }
    const criticalHit=confirmed&&!criticalNegated;
    const multiplier=criticalHit?critical.multiplier:1;
    return {d20,total,bonus,hit:true,threat,confirmation,criticalHit,criticalNegated,criticalMultiplier:multiplier,
      precisionEligible:precisionEnabled,precisionImmune:defenseInfo.precisionImmune,precisionNegated,
      defenseContext:defenseCheck,defenseRoll:negationRoll,range,targetDefense,combat,
      context:{description,defenseCheck,defenseInfo,critical,criticalChance,precisionChance,confirmed}};
  }
  resolveAttack(actorId,targetId,label='Attack',profile=null,defense='ac'){
    const check=this.resolveAttackCheck(actorId,targetId,label,profile,defense);
    if(!check.hit)return check;
    const actor=this.find(actorId),target=this.find(targetId);
    const {d20,total,threat,confirmation,criticalHit,criticalNegated,criticalMultiplier:multiplier,
      precisionEligible:precisionEnabled,precisionNegated,defenseRoll:negationRoll,range,targetDefense}=check;
    const {description,defenseCheck,defenseInfo,critical,criticalChance,precisionChance,confirmed}=check.context;
    const types=description.damageTypes;
    const physical=types.every(x=>['bludgeoning','piercing','slashing'].includes(x));
    const silverPenalty=silverDamagePenalty(description.weaponMaterial,description.damageTypes);
    const damageDice=typeof this.weaponDamageDice==='function'?this.weaponDamageDice(actorId,profile):{count:1,sides:profile?.damageDie||actor.damageDie};
    const staticBonus=(typeof this.completedDamageBonus==='function'?this.completedDamageBonus(actorId,profile,description):this.stat(actorId,'damage'))+
      (profile?.damageOffset||0)+(check.combat?.damage||0)+description.penalties.damage+silverPenalty;
    // PF1e critical damage is rolled repeatedly, with usual static bonuses each time.
    const weaponRolls=Array.from({length:multiplier},()=>damageDice.count===1?this.rollDie(damageDice.sides):
      Array.from({length:damageDice.count},()=>this.rollDie(damageDice.sides)));
    const vitalRolls=Array.from({length:(profile?._vitalStrike||0)*damageDice.count},()=>this.rollDie(damageDice.sides));
    const vitalDamage=vitalRolls.reduce((a,b)=>a+b,0);
    const weaponDamage=vitalDamage+Math.max(0,weaponRolls.reduce((sum,rolls)=>sum+Math.max(1,(Array.isArray(rolls)?rolls.reduce((a,b)=>a+b,0):rolls)+staticBonus),0));
    let precisionRolls=[],precisionDamage=0;
    const precisionApplied=precisionEnabled&&!defenseInfo.precisionImmune&&!precisionNegated;
    if(precisionApplied){
      const p=profile.precision;
      precisionRolls=Array.from({length:p.count},()=>this.rollDie(p.sides));
      precisionDamage=precisionRolls.reduce((sum,x)=>sum+x,p.bonus||0);
    }
    const metadata={...(actor.attackTraits||{}),...(profile?.attackTraits||{}),weaponMaterial:description.weaponMaterial,rangedWeapon:['ranged','ranged_touch'].includes(description.attackMode)};
    if(physical)metadata.damageTypes=types;
    if(typeof this.attackDealsNonlethal==='function'?this.attackDealsNonlethal(actorId,profile):(profile?.damageIntent||actor.damageIntent)==='nonlethal')metadata.nonlethal=true;
    // Precision inherits the same physical damage and is reduced by DR exactly once.
    const damageGroup=this.beginAttackDamage?.(actorId,targetId);
    let damage,casting,damageComplete=false;const extraDamage=[];
    try{
     damage=this.damage(targetId,weaponDamage+precisionDamage,types[0],actorId,'weapon',metadata);
     for(const extra of profile?.extraDamage||[]){
      const rolls=Array.from({length:extra.count},()=>this.rollDie(extra.sides));
      const amount=rolls.reduce((sum,x)=>sum+x,extra.bonus||0);
      const extraMetadata={...metadata};delete extraMetadata.damageTypes;
       extraDamage.push({type:extra.damageType,rolls,amount,damage:this.damage(targetId,amount,extra.damageType,actorId,'weapon',extraMetadata)});
     }
     damageComplete=true;
    }finally{if(damageGroup)casting=this.endAttackDamage(damageGroup,damageComplete);}
    this.note(`${label}: ${actor.name} rolls ${d20} (${total}) vs AC ${targetDefense}: HIT${criticalHit?' (CRITICAL x'+multiplier+')':''}.`);
    if(threat){
      if(defenseInfo.criticalImmune)this.note(`${target.name} is immune to critical hits; weapon damage is normal.`);
      else this.note(`${label}: threat confirmation ${confirmation.d20} (${confirmation.total}) ${confirmed?'succeeded':'failed'}${criticalNegated?'; critical negated by defense':''}.`);
    }
    if(negationRoll!==null)this.note(`${target.name} critical/precision defense d% ${negationRoll} (critical ${criticalChance}%, precision ${precisionChance}%).`);
    if(precisionEnabled)this.note(`${label}: precision ${precisionApplied?precisionDamage+' applied':defenseInfo.precisionImmune?'immune':'negated'}.`);
    if(description.riders.length)this.note(`${actor.name} qualifying hit: optional riders ${description.riders.map(r=>r.id).join(', ')} require GM/controller adjudication.`);
    const touchSpell=this.onAttackHit?.({actor:actorId,target:targetId,attackKind:description.attackKind,profile,attack:check});
    this.emit('hit',{actor:actorId,target:targetId});
    return {d20,total,hit:true,threat,confirmation,criticalHit,criticalNegated,criticalMultiplier:multiplier,
      precisionEligible:precisionEnabled,precisionImmune:defenseInfo.precisionImmune,precisionNegated,
      defenseContext:defenseCheck,defenseRoll:negationRoll,range,targetDefense,combat:check.combat,damageDice,weaponRolls,vitalRolls,vitalDamage,weaponDamage,precisionRolls,precisionDamage,damage,extraDamage,...(casting?{casting}:{}),...(touchSpell?{touchSpell}:{})};
  }
  onMovementSquare(c){
    this.emit('tile_enter',{actor:c.id,x:c.x,y:c.y,tile:this.tileKind(c.x,c.y)});
    this.syncZones();
  }
  teleport(id,x,y,reason='teleportation'){
    super.teleport(id,x,y,reason);this.syncZones();
  }
  resolveInterrupt(take){
    const i=this.s.interrupt;
    if(i?.type!=='rule_offer')return super.resolveInterrupt(take);
    this.s.interrupt=null;
    if(take){this._operations=0;this.note(`${this.find(i.reactor).name} accepts ${i.text}.`);this.doActions(i.accept,i.context);}
    else this.note(`${this.find(i.reactor).name} declines ${i.text}.`);
    return this.s.pendingMove?this.continueMove():{status:'done'};
  }
  advanceTurnClock(rounds){
    super.advanceTurnClock(rounds);
    this.s.marks=this.s.marks.filter(m=>m.expiresRound>this.s.round);
  }
  beginTurnEffects(context){
    const result=super.beginTurnEffects(context);
    if(context.roundChanged)this.emit('round_start',{round:this.s.round});
    this.emit('turn_start',{actor:context.actor});this.syncZones();
    return result;
  }
  dispatch(command,role='actor'){
    if(command?.op==='deal_damage'||command?.op==='admin_damage'){
      this.assert(role==='gm','Only GM can direct damage');
      return this.transaction(()=>this.damage(command.target,command.amount,command.damageType,command.source||null,command.cause||'weapon'));
    }
    return super.dispatch(command,role);
  }
}
