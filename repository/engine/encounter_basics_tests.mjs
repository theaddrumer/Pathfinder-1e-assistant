import assert from 'node:assert/strict';
import {Kernel} from './kernel.mjs';
import {clone} from './core.mjs';
let count=0;
const test=(name,fn)=>{try{fn();console.log('PASS '+name);count++;}catch(e){console.error('FAIL '+name);throw e;}};
const gm=(g,op,extra={})=>g.dispatch({op,...extra},'gm');
const hit=(g,amount,target='hero',damageType='untyped',metadata={})=>gm(g,'gm_resolve_damage',{target,amount,damageType,metadata});
const heal=(g,amount,target='hero')=>gm(g,'gm_heal_hp',{target,amount});
const time=(g,count=1)=>gm(g,'gm_advance_time',{count,unit:'round'});
const rounds=(g)=>{g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});};
const regen=g=>gm(g,'gm_set_recovery',{target:'hero',recovery:{regeneration:{amount:2,bypass:['acid','fire']}}});
test('negative HP, Constitution death threshold and ordinary healing never resurrect',()=>{
 const g=new Kernel();hit(g,43);assert.equal(g.find('hero').hp,-3);assert(g.hasCondition('hero','dying'));assert(!g.canAct('hero'));
 heal(g,1);assert.equal(g.healthState('hero').status,'stable');heal(g,2);assert.equal(g.healthState('hero').status,'disabled');assert(g.canAct('hero'));
 heal(g,1);assert.equal(g.healthState('hero').status,'healthy');hit(g,15);assert.equal(g.find('hero').hp,-14);assert(g.hasCondition('hero','dead'));
 assert.equal(heal(g,100).hpHealed,0);assert.equal(g.find('hero').hp,-14);
});
test('failed stabilization loses 1 HP; natural 20 succeeds even with a huge penalty',()=>{
 const g=new Kernel();hit(g,43);g.s.testRolls=[1];rounds(g);assert.equal(g.find('hero').hp,-4);assert.equal(g.s.testRolls.length,0);
 hit(g,9);g.s.testRolls=[20];rounds(g);assert.equal(g.healthState('hero').status,'stable');assert(!g.hasCondition('hero','dead'));assert.equal(g.s.testRolls.length,0);
});
test('continuous damage prevents stabilization and does not consume a d20',()=>{
 const g=new Kernel();hit(g,43);gm(g,'gm_set_continuous_damage',{target:'hero',active:true});g.s.testRolls=[20];rounds(g);
 assert.equal(g.find('hero').hp,-4);assert.deepEqual(g.s.testRolls,[20]);
});
test('healing stabilizes; subsequent HP damage restarts dying',()=>{
 const g=new Kernel();hit(g,45);heal(g,1);assert.equal(g.healthState('hero').status,'stable');hit(g,1);assert.equal(g.healthState('hero').status,'dying');
});
test('hourly aided and unaided recovery share the clock, and conscious negative HP is disabled',()=>{
 const g=new Kernel();hit(g,42);gm(g,'gm_stabilize',{target:'hero',aided:false});g.s.testRolls=[1];time(g,600);assert.equal(g.find('hero').hp,-3);
 g.s.testRolls=[20];time(g,600);assert.equal(g.healthState('hero').status,'disabled');assert(g.canAct('hero'));assert.equal(g.find('hero').hp,-3);
 const h=new Kernel();hit(h,42);gm(h,'gm_stabilize',{target:'hero'});h.s.testRolls=[1];time(h,600);assert.equal(h.find('hero').hp,-2);
});
test('disabled move is allowed, standard action applies strain afterward, self-healing avoids strain',()=>{
 const g=new Kernel();hit(g,40);g.dispatch({op:'use_action',actor:'hero',type:'move',label:'Draw potion'});assert.equal(g.find('hero').hp,0);
 assert.throws(()=>g.dispatch({op:'use_action',actor:'hero',type:'standard',label:'Attack'}),/already taken/);
 const h=new Kernel();hit(h,40);h.dispatch({op:'use_action',actor:'hero',type:'standard',label:'Strenuous action'});assert.equal(h.find('hero').hp,-1);
 const k=new Kernel();hit(k,40);k.dispatch({op:'cast_spell',actor:'hero',spell:{name:'Healing',level:1,casterLevel:1,targets:['hero'],healing:{amount:3}}});assert.equal(k.find('hero').hp,3);
});
test('fast healing runs once per creature turn and catches up during downtime, then removes its deadline',()=>{
 const g=new Kernel();gm(g,'gm_set_recovery',{target:'hero',recovery:{fastHealing:2}});hit(g,10);g.dispatch({op:'end_turn'});assert.equal(g.find('hero').hp,30);g.dispatch({op:'end_turn'});assert.equal(g.find('hero').hp,32);
 time(g,10000);assert.equal(g.find('hero').hp,40);assert(!gm(g,'gm_get_lifecycle').deadlines.some(e=>e.kind==='health'));
});
test('recovery respects declared excluded HP and still heals nonlethal at the full rate',()=>{
 const g=new Kernel();gm(g,'gm_set_recovery',{target:'hero',recovery:{fastHealing:5,excludedDamage:4}});hit(g,5);
 gm(g,'gm_apply_nonlethal',{target:'hero',amount:10});time(g);assert.equal(g.find('hero').hp,36);assert.equal(g.nonlethalTotal('hero'),5);
 time(g);assert.equal(g.find('hero').hp,36);assert.equal(g.nonlethalTotal('hero'),0);
});
test('regeneration prevents HP death, matching damage suppresses and can kill immediately',()=>{
 const g=new Kernel();regen(g);hit(g,100);assert(!g.hasCondition('hero','dead'));assert.equal(g.find('hero').hp,-60);
 hit(g,1,'hero','acid');assert(g.hasCondition('hero','dead'));time(g,2);assert(g.hasCondition('hero','dead'));assert.equal(heal(g,100).hpHealed,0);
});
test('immune damage does not suppress; packet component tags and explicit suppression do',()=>{
 const g=new Kernel();regen(g);g.find('hero').protections={immunities:['fire']};hit(g,4,'hero','fire');assert(!g.healthState('hero').suppressed);
 gm(g,'gm_resolve_packet',{target:'hero',components:[{damageType:'acid',amount:1},{damageType:'fire',amount:9}]});assert(g.healthState('hero').suppressed);
 const h=new Kernel();regen(h);gm(h,'gm_suppress_regeneration',{target:'hero',rounds:2,reason:'GM confirms special shutdown'});time(h);assert(h.healthState('hero').suppressed);time(h);assert(!h.healthState('hero').suppressed);
});
test('regeneration bypass tags can describe aligned weapons; repeated shutdown preserves longer timers',()=>{
 const g=new Kernel();gm(g,'gm_set_recovery',{target:'hero',recovery:{regeneration:{amount:2,bypass:['good']}}});
 gm(g,'gm_suppress_regeneration',{target:'hero',rounds:4,reason:'Special attack'});time(g);hit(g,1,'hero','slashing',{weaponTags:['good']});
 time(g,2);assert(g.healthState('hero').suppressed);time(g);assert(!g.healthState('hero').suppressed);
});
test('regenerating creatures do not convert excess nonlethal damage into lethal',()=>{
 const g=new Kernel();regen(g);gm(g,'gm_apply_nonlethal',{target:'hero',amount:45});gm(g,'gm_apply_nonlethal',{target:'hero',amount:10});
 assert.equal(g.find('hero').hp,40);assert.equal(g.nonlethalTotal('hero'),55);assert(g.hasCondition('hero','unconscious'));
});
test('construct and undead destruction at zero, Constitution loss and permanent death survive restore',()=>{
 const g=new Kernel();g.find('hero').creatureType='undead';hit(g,40);assert(g.hasCondition('hero','dead'));
 const h=new Kernel();gm(h,'apply_ability_damage',{target:'hero',ability:'con',amount:14});assert(h.hasCondition('hero','dead'));
 gm(h,'heal_ability_damage',{target:'hero',ability:'con',amount:14});assert(new Kernel(h.exportState()).hasCondition('hero','dead'));
});
test('Summons still depart at zero HP; ordinary disabled tokens remain',()=>{
 const g=new Kernel();gm(g,'gm_mark_summon',{target:'warden',duration:{count:5,unit:'round'},reason:'Test summon'});hit(g,65,'warden');assert(!g.s.creatures.some(c=>c.id==='warden'));
 hit(g,40);assert(g.s.creatures.some(c=>c.id==='hero'));assert.equal(g.healthState('hero').status,'disabled');
});
test('own-turn immediate consumes current swift, off-turn immediate owes coming swift through turn end',()=>{
 const g=new Kernel();g.dispatch({op:'use_immediate',actor:'hero',label:'Response'});assert.equal(g.s.actions.resources.swift,0);
 assert.throws(()=>g.dispatch({op:'use_immediate',actor:'hero'}),/unavailable/);
 g.dispatch({op:'use_immediate',actor:'warden'});assert(g.nativeBasicEvent('immediate','warden'));
 assert.throws(()=>g.dispatch({op:'use_immediate',actor:'warden'}),/unavailable/);g.dispatch({op:'end_turn'});assert.equal(g.s.actions.resources.swift,0);
 assert.throws(()=>g.dispatch({op:'use_action',actor:'warden',type:'swift',label:'Swift'}),/already spent/);
 g.dispatch({op:'end_turn'});assert(!g.nativeBasicEvent('immediate','warden'));g.dispatch({op:'use_immediate',actor:'warden'});
});
test('flat-footed immediate is rejected atomically; owing a swift survives export and undo',()=>{
 const g=new Kernel();gm(g,'apply_condition',{target:'warden',condition:'flat_footed'});const before=clone(g.s);
 assert.throws(()=>g.dispatch({op:'use_immediate',actor:'warden'}),/Flat-footed/);assert.deepEqual(g.s,before);
 gm(g,'remove_condition',{target:'warden',condition:'flat_footed'});g.dispatch({op:'use_immediate',actor:'warden'});
 const h=new Kernel(g.exportState());h.dispatch({op:'end_turn'});assert.equal(h.s.actions.resources.swift,0);h.dispatch({op:'use_action',actor:'warden',type:'move'});gm(h,'undo_turn');assert.equal(h.s.actions.resources.swift,0);
});
test('cooldown is one nonblocking native event, cannot be generic-triggered, and emits readiness',()=>{
 const g=new Kernel();const e=gm(g,'gm_set_cooldown',{target:'hero',ability:'Breath weapon',rounds:2});
 assert.equal(gm(g,'gm_get_cooldowns')[0].label,'Breath weapon unavailable!');assert.equal(g.pendingEventsWarning(),null);
 assert.throws(()=>gm(g,'gm_trigger_pending_event',{id:e.id}),/expires automatically/);
 assert.throws(()=>gm(g,'gm_set_cooldown',{target:'hero',ability:'breath weapon',rounds:2}),/already cooling/);
 time(g);assert.equal(g.cooldownsOverview().length,1);time(g);assert.equal(g.cooldownsOverview().length,0);assert(g.s.log.some(x=>x.includes('Breath weapon ready')));
});
test('cooldowns use initiative deadlines and preserve remaining time when initiative ends',()=>{
 const g=new Kernel();gm(g,'gm_begin_initiative',{scores:{hero:20,warden:10}});const e=gm(g,'gm_set_cooldown',{target:'hero',ability:'Gaze',rounds:2});assert.equal(e.duration.type,'initiative');
 rounds(g);assert.equal(g.cooldownsOverview().length,1);gm(g,'gm_end_initiative');time(g);assert.equal(g.cooldownsOverview().length,0);
});
const stone=(g,extra={})=>gm(g,'gm_spawn_object',{id:'stone',name:'Stone panel',x:2,y:1,thicknessInches:2,...extra});
test('stone estimate, explicit overrides, and material/size validation',()=>{
 const g=new Kernel();const p=gm(g,'gm_preview_object',{material:'stone',thicknessInches:2});assert.equal(p.maxHp,30);assert.equal(p.objectProfile.hardness,8);assert.equal(p.objectProfile.ac,3);
 const q=gm(g,'gm_preview_object',{material:'stone',thicknessInches:12,maxHp:90,hardness:7,sizeCategory:'large'});assert.equal(q.maxHp,90);assert.equal(q.objectProfile.hardness,7);assert.equal(q.objectProfile.ac,2);
 assert.throws(()=>stone(g,{material:'unknown'}));assert(!g.s.creatures.some(c=>c.id==='stone'));
});
test('objects share tokens and damage; energy is halved before hardness; broken and destroyed are derived',()=>{
 const g=new Kernel();stone(g);hit(g,20,'stone','fire');assert.equal(g.find('stone').hp,28);
 hit(g,23,'stone','slashing');assert.equal(g.find('stone').hp,13);assert.equal(g.healthState('stone').status,'broken');
 gm(g,'gm_repair_object',{target:'stone',amount:5});assert.equal(g.healthState('stone').status,'intact');hit(g,26,'stone','bludgeoning');assert.equal(g.healthState('stone').status,'destroyed');
 assert.throws(()=>gm(g,'gm_repair_object',{target:'stone',amount:10}),/reconstruction/);assert.equal(heal(g,20,'stone').hpHealed,0);
});
test('hardness applies once to a mixed packet; ranged and declared vulnerabilities are explicit',()=>{
 const g=new Kernel();stone(g);
 const result=gm(g,'gm_resolve_packet',{target:'stone',components:[{damageType:'fire',amount:10},{damageType:'cold',amount:10}]});assert.equal(result.applied,2);
 hit(g,20,'stone','piercing',{rangedWeapon:true});assert.equal(g.find('stone').hp,26);
 hit(g,10,'stone','fire',{objectMultiplier:2,ignoreHardness:true});assert.equal(g.find('stone').hp,6);
});
test('object immunities, unattended failed saves, attended and magical saves',()=>{
 const g=new Kernel();stone(g);assert(g.criticalDefenses('stone').criticalImmune);assert(g.criticalDefenses('stone').precisionImmune);
 gm(g,'gm_apply_nonlethal',{target:'stone',amount:100});assert.equal(g.find('stone').hp,30);g.s.testRolls=[20];assert.equal(g.savingThrow('stone','fort',1).success,false);assert.deepEqual(g.s.testRolls,[20]);
 g.find('stone').objectProfile.magicCasterLevel=10;g.s.testRolls=[10];assert.equal(g.savingThrow('stone','fort',17).success,true);
 g.find('stone').objectProfile.attendedBy='hero';g.find('hero').statTotals={fort:20};g.s.testRolls=[2];assert.equal(g.savingThrow('stone','fort',22).success,true);
});
test('objects cannot act or threaten, take no turns, and are excluded from initiative',()=>{
 const g=new Kernel();stone(g);assert(!g.canAct('stone'));assert(!g.threatens('stone','hero'));rounds(g);assert.equal(g.active().id,'hero');
 gm(g,'gm_begin_initiative',{scores:{hero:20,warden:10}});assert(!g.s.initiative.entries.some(e=>e.id==='stone'));assert.throws(()=>gm(g,'gm_set_initiative',{id:'stone',score:5}),/Objects/);
});
test('read-only views preserve state and remain available at checkpoints; rejected mutations are atomic',()=>{
 const g=new Kernel();g.s.pendingTimeEvent={id:'decision'};const before=g.exportState();for(const op of ['gm_get_health','gm_get_cooldowns','gm_preview_object','inspect'])gm(g,op);assert.deepEqual(g.exportState(),before);
 assert.throws(()=>gm(g,'gm_set_recovery',{target:'hero',recovery:{fastHealing:2}}),/checkpoint/);assert.deepEqual(g.exportState(),before);
});
test('persistent areas continue affecting unconscious living occupants and can heal them',()=>{
 const g=new Kernel();hit(g,43);const area={shape:'sphere',mode:'burst',origin:{x:1,y:4},sizeFeet:5};
 gm(g,'gm_resolve_spell',{actor:'warden',spell:{name:'Healing field',level:1,casterLevel:1,area,healing:{amount:2},persistent:{duration:{count:2,unit:'round'},triggers:['create','turn_start']}}});
 assert.equal(g.find('hero').hp,-1);assert.equal(g.healthState('hero').status,'stable');time(g);assert.equal(g.find('hero').hp,1);
});
test('dying creatures cannot Delay, while explicit Free Mode restoration is logged',()=>{
 const g=new Kernel();gm(g,'gm_begin_initiative',{scores:{hero:20,warden:10}});hit(g,43);assert.throws(()=>g.dispatch({op:'delay_turn'}),/incapacitated/);
 hit(g,100);const state=g.exportState();assert.throws(()=>gm(g,'gm_adjudicate',{kind:'health',target:'hero',hp:10,revive:true,reason:''}),/reason/);assert.deepEqual(g.exportState(),state);
 gm(g,'gm_adjudicate',{kind:'health',target:'hero',hp:10,revive:true,reason:'GM has resolved the restoration effect'});assert.equal(g.healthState('hero').status,'healthy');assert.equal(g.s.overrideLog.at(-1).kind,'health');
});
test('off-turn immediate debt expires in elapsed time and is honored if initiative starts first',()=>{
 const g=new Kernel();g.dispatch({op:'use_immediate',actor:'warden'});time(g);assert(!g.nativeBasicEvent('immediate','warden'));
 const h=new Kernel();h.dispatch({op:'use_immediate',actor:'warden'});gm(h,'gm_begin_initiative',{scores:{hero:10,warden:20}});assert.equal(h.s.actions.resources.swift,0);
});
test('an actual weapon hit shares object hardness across its base and energy damage',()=>{
 const g=new Kernel();stone(g,{x:2,y:4});g.find('hero').damageOther=-3;
 g.find('hero').attacks=[{label:'Flaming test weapon',damageDie:8,attackOffset:0,extraDamage:[{damageType:'fire',count:1,sides:6,bonus:0}]}];
 g.s.testRolls=[10,8,6];g.dispatch({op:'attack',actor:'hero',target:'stone',index:0});
 assert.equal(g.find('stone').hp,27);assert.equal(g.s.testRolls.length,0);
});
test('invalid recovery configuration rolls back without changing state',()=>{
 const g=new Kernel();const before=g.exportState();assert.throws(()=>gm(g,'gm_set_recovery',{target:'hero',recovery:{regeneration:{amount:2,bypass:['invented']}}}),/known/);assert.deepEqual(g.exportState(),before);
});
test('temporary HP absorbs damage but does not prevent a qualifying regeneration shutdown',()=>{
 for(const packet of [false,true]){
  const g=new Kernel();regen(g);g.grantEnergyTempHp('hero',10);
  if(packet)gm(g,'gm_resolve_packet',{target:'hero',components:[{damageType:'acid',amount:3}]});else hit(g,3,'hero','acid');
  assert.equal(g.find('hero').hp,40);assert.equal(g.s.energyTempHp.hero[0].amount,7);assert(g.healthState('hero').suppressed);
 }
});
console.log(`V3.31: ${count} encounter integration groups passed.`);
