import assert from 'node:assert/strict';
import {Kernel,initialState} from './kernel.mjs';
import {clone} from './core.mjs';
const gm=(g,c)=>g.dispatch(c,'gm');
const make=(init=false)=>{const s=initialState();s.tiles={};Object.assign(s.creatures[0],{x:0,y:3,hp:200,maxHp:200});Object.assign(s.creatures[1],{x:5,y:3,size:1,reach:1,hp:200,maxHp:200});const g=new Kernel(s);if(init)gm(g,{op:'gm_begin_initiative',scores:{hero:20,warden:10}});return g;};
const spell=(effect={},extra={})=>({name:'Synthetic condition bundle',level:2,casterLevel:5,targets:['warden'],effect:{rounds:3,conditions:['shaken'],...effect},...extra});
const resolve=(g,e={},extra={})=>gm(g,{op:'gm_resolve_spell',actor:'hero',spell:spell(e,extra)});
const advance=(g,count=1)=>gm(g,{op:'gm_advance_time',count,unit:'round'});
const turn=g=>g.dispatch({op:'end_turn'});
const dispel=(g,effectId,target='warden')=>gm(g,{op:'gm_resolve_spell',actor:'hero',spell:{name:'Dispel magic',level:3,casterLevel:5,targets:[target],dispel:effectId?{effectId}:{}}});
const relocate=(g,x)=>gm(g,{op:'teleport',target:'warden',x,y:3,reason:'Test entry and exit'});
const region=(g,effect={},persistent={},extra={})=>{const s=spell(effect,{area:{shape:'sphere',origin:{x:5,y:3},sizeFeet:10},persistent:{duration:{count:4,unit:'round'},...persistent},...extra});delete s.targets;return gm(g,{op:'gm_resolve_spell',actor:'hero',spell:s});};
let count=0;const test=(name,fn)=>{try{fn();count++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}};
test('native condition-only payload, identity and clock',()=>{
 const g=make(),base=g.stat('warden','attack'),r=resolve(g),row=r.targets[0];
 assert(row.conditions[0].applied);assert.equal(row.effectId,row.conditions[0].effectId);assert.deepEqual(row.effectIds,[row.effectId]);assert.equal(g.stat('warden','attack'),base-2);
 assert.equal(g.getConditions('warden')[0].applicationKey,r.castingId);assert.equal(g.s.effects.length,1);assert.equal(g.s.pendingEvents.length,0);
 advance(g,3);assert(!g.hasCondition('warden','shaken'));assert.equal(g.s.effects.length,0);
});
test('save outcomes govern ongoing bundles; negation always wins',()=>{
 for(const [onSuccess,applyOnSaveSuccess,expected] of [['negates',false,false],['negates',true,false],['half',false,false],['half',true,true],['none',true,true]]){
  const g=make();g.s.testRolls=[20];const r=resolve(g,{applyOnSaveSuccess,mods:[{stat:'ac',value:1,type:'luck'}]},{save:{type:'will',dc:999,onSuccess},components:[{damageType:'force',amount:8}]});
  assert.equal(g.hasCondition('warden','shaken'),expected);assert.equal(r.targets[0].effectIds.length,expected?2:0);assert.equal(g.find('warden').hp,onSuccess==='negates'?200:onSuccess==='half'?196:192);
 }
 const g=make();g.s.testRolls=[1];resolve(g,{}, {save:{type:'will',dc:1,onSuccess:'negates'}});assert(g.hasCondition('warden','shaken'));
});
test('failed SR blocks conditions before saves',()=>{
 const g=make();g.find('warden').spellResistance=99;g.s.testRolls=[20,1];const r=resolve(g,{}, {spellResistance:true,save:{type:'will',dc:15,onSuccess:'negates'}});
 assert.equal(r.targets[0].spellResistance.success,false);assert.equal(g.s.effects.length,0);assert.deepEqual(g.s.testRolls,[1]);
});
test('native immunity and descriptor immunity use existing traits',()=>{
 const g=make();g.find('warden').creatureType='undead';let r=resolve(g,{conditions:['paralyzed','dazzled']});assert(r.targets[0].conditions[0].immune);assert(!g.hasCondition('warden','paralyzed'));assert(g.hasCondition('warden','dazzled'));
 r=resolve(g,{conditions:['unconscious'],tags:['mind_affecting','sleep'],mods:[{stat:'attack',value:-5}]},{components:[{damageType:'force',amount:2}]});assert(r.targets[0].effectImmunity.blocked);assert(!g.hasCondition('warden','unconscious'));assert.equal(g.find('warden').hp,198);
});
test('overlapping spells keep independent sources without duplicate penalties',()=>{
 const g=make(),attack=g.stat('warden','attack'),save=g.stat('warden','will'),a=resolve(g,{rounds:1}),b=resolve(g,{rounds:4});assert.equal(g.getConditions('warden').length,2);assert.notEqual(a.castingId,b.castingId);
 assert.equal(g.stat('warden','attack'),attack-2);assert.equal(g.stat('warden','will'),save-2);advance(g);assert.equal(g.getConditions('warden').length,1);assert.equal(g.stat('warden','attack'),attack-2);
 dispel(g,b.targets[0].effectId);assert.equal(g.getConditions('warden').length,0);assert.equal(g.stat('warden','attack'),attack);
});
test('manual conditions cannot be stolen, refreshed or erased by spell ownership',()=>{
 const g=make(),base=g.stat('warden','attack');gm(g,{op:'apply_condition',target:'warden',condition:'shaken',rounds:8});const manual=g.getConditions('warden')[0].effectId,r=resolve(g,{rounds:1});assert.equal(g.s.effects.find(e=>e.id===manual).remaining,8);
 dispel(g,r.targets[0].effectId);assert.equal(g.getConditions('warden')[0].effectId,manual);assert.equal(g.stat('warden','attack'),base-2);resolve(g);gm(g,{op:'apply_condition',target:'warden',condition:'shaken',rounds:9});assert.equal(g.getConditions('warden').length,2);
 gm(g,{op:'remove_condition',target:'warden',condition:'shaken'});assert.equal(g.getConditions('warden').length,0);
});
test('stronger fear/fatigue preserves weaker sources; spell fatigue does not infer escalation',()=>{
 const g=make(),attack=g.stat('warden','attack'),str=g.stat('warden','str');resolve(g,{rounds:5});resolve(g,{conditions:['panicked'],rounds:1});assert.equal(g.stat('warden','attack'),attack-2);advance(g);assert(g.hasCondition('warden','shaken'));assert(!g.hasCondition('warden','panicked'));
 resolve(g,{conditions:['fatigued'],rounds:5});resolve(g,{conditions:['exhausted'],rounds:1});assert.equal(g.stat('warden','str'),str-6);advance(g);assert.equal(g.stat('warden','str'),str-2);resolve(g,{conditions:['fatigued']});assert.equal(g.stat('warden','str'),str-2);assert(!g.hasCondition('warden','exhausted'));
});
test('different conditions still combine penalties',()=>{const g=make(),base=g.stat('warden','attack');resolve(g,{conditions:['shaken','sickened']});assert.equal(g.stat('warden','attack'),base-4);});
test('dispel ends all linked recipient components, preserving other sources/recipients',()=>{
 const g=make(true),r=resolve(g,{conditions:['shaken','dazzled'],mods:[{stat:'ac',value:2,type:'luck'}]},{targets:['hero','warden']}),other=resolve(g);assert.equal(g.s.initiativeEvents.length,7);
 const d=dispel(g,r.targets[1].conditions[0].effectId);assert.equal(d.dispelled[0].effectIds.length,3);assert.equal(g.getConditions('hero').length,2);assert.equal(g.getConditions('warden').length,1);assert.equal(g.getConditions('warden')[0].effectId,other.targets[0].effectId);assert.equal(g.s.initiativeEvents.length,4);
});
test('caster initiative expiry and world-clock migration',()=>{
 const g=make(true);resolve(g,{rounds:1});turn(g);assert(g.hasCondition('warden','shaken'));turn(g);assert(!g.hasCondition('warden','shaken'));resolve(g,{rounds:2,conditions:['dazed']});gm(g,{op:'gm_end_initiative'});advance(g,2);assert(!g.hasCondition('warden','dazed'));assert.equal(g.nextTimeEvent(),null);
});
test('non-dispellable conditions still expire normally',()=>{const g=make();resolve(g,{dispellable:false,rounds:1});assert.equal(dispel(g).dispelled.length,0);assert(g.hasCondition('warden','shaken'));advance(g);assert(!g.hasCondition('warden','shaken'));});
test('incapacitation interrupts an ongoing cast through the native hook',()=>{
 const g=make(true);g.dispatch({op:'cast_spell',actor:'hero',spell:spell({}, {castingTime:'1_round'})});assert.equal(g.s.activeSpellCasts.length,1);gm(g,{op:'gm_resolve_spell',actor:'warden',spell:spell({conditions:['dazed']},{targets:['hero']})});assert.equal(g.s.activeSpellCasts.length,0);assert(g.s.spellCastHistory.some(c=>c.status==='lost'));
});
test('entry condition stops movement and ends with its region',()=>{
 const g=make();g.find('hero').x=2;g.find('warden').x=8;region(g,{conditions:['dazed']},{triggers:['enter']},{area:{shape:'sphere',origin:{x:4,y:3},sizeFeet:5}});g.dispatch({op:'move',actor:'hero',path:[{x:3,y:3},{x:4,y:3},{x:5,y:3}]});
 assert(g.hasCondition('hero','dazed'));assert.equal(g.find('hero').x,3);assert.equal(g.s.pendingMove,null);assert.equal(g._spellConditionApplication,undefined);advance(g,4);assert(!g.hasCondition('hero','dazed'));
});
test('same-round re-entry restores conditions without new saves or damage',()=>{
 const g=make();g.s.testRolls=[1];const r=region(g,{conditions:['shaken','dazzled']},{},{save:{type:'will',dc:99,onSuccess:'negates'},components:[{damageType:'force',amount:2}]});assert.equal(g.getConditions('warden').length,2);relocate(g,8);assert.equal(g.getConditions('warden').length,0);
 g.s.testRolls=[20];relocate(g,5);assert.equal(g.getConditions('warden').length,2);assert.deepEqual(g.s.testRolls,[20]);assert.equal(g.find('warden').hp,198);dispel(g,null,r.areaId);assert.equal(g.getConditions('warden').length,0);assert.equal(g.s.effects.length,0);
});
test('re-entry cannot grant a previously immune part when another part qualified',()=>{
 const g=make();g.find('warden').creatureType='undead';region(g,{conditions:['paralyzed','dazzled'],mods:[{stat:'attack',value:1,type:'luck'}]});assert(!g.hasCondition('warden','paralyzed'));relocate(g,8);g.find('warden').creatureType='humanoid';relocate(g,5);assert(!g.hasCondition('warden','paralyzed'));assert(g.hasCondition('warden','dazzled'));assert.equal(g.s.effects.length,2);
});
test('area pulses do not duplicate/escalate fatigue; regions end independently',()=>{
 const g=make(),str=g.stat('warden','str'),a=region(g,{conditions:['fatigued']}),b=region(g,{conditions:['fatigued']});advance(g);assert.equal(g.getConditions('warden').length,2);assert.equal(g.stat('warden','str'),str-2);assert(!g.hasCondition('warden','exhausted'));gm(g,{op:'gm_cancel_pending_event',id:a.areaId,reason:'Test removal'});assert.equal(g.getConditions('warden').length,1);assert(g.persistentAreaEvent(b.areaId));
});
test('duration conditions survive exit/removal and then expire',()=>{const g=make(),r=region(g,{rounds:2},{effectScope:'duration'});relocate(g,8);gm(g,{op:'gm_cancel_pending_event',id:r.areaId,reason:'Test removal'});assert(g.hasCondition('warden','shaken'));advance(g,2);assert(!g.hasCondition('warden','shaken'));});
test('persistent conditions survive summoned source departure and restore',()=>{
 const g=make();gm(g,{op:'gm_mark_summon',target:'hero',duration:{count:1,unit:'round'},reason:'Test source'});region(g);advance(g);assert(!g.s.creatures.some(c=>c.id==='hero'));assert.equal(g.getConditions('warden')[0].source,null);const restored=new Kernel(g.exportState());advance(restored,3);assert.equal(restored.getConditions('warden').length,0);
});
test('held touch condition discharges during natural full attack; manual guards remain',()=>{
 const g=make();g.find('hero').attacks=[{label:'Claw',attackKind:'natural',naturalAttack:'claw',damageDie:4},{label:'Second claw',attackKind:'natural',naturalAttack:'claw',damageDie:4}];g.dispatch({op:'cast_spell',actor:'hero',spell:spell({conditions:['dazzled']},{castingTime:'swift',delivery:{type:'touch'}})});g.find('warden').x=1;g.s.testRolls=[15,2];g.dispatch({op:'full_attack',actor:'hero',target:'warden'});
 assert(g.hasCondition('warden','dazzled'));assert(!g.heldTouch('hero'));assert.equal(g._spellConditionApplication,undefined);assert.throws(()=>gm(g,{op:'apply_condition',target:'warden',condition:'sickened'}),/pending|Finish/);
});
test('ray misses do not apply conditions; repeated hits retain one source/deadline',()=>{
 const g=make(true);g.s.testRolls=[1,15,15];const r=resolve(g,{conditions:['dazzled']},{delivery:{type:'ray',rangeFeet:60},targets:['warden','warden','warden']});assert.equal(r.rays[0].attack.hit,false);assert.equal(g.getConditions('warden').length,1);assert.equal(g.s.initiativeEvents.length,1);assert.equal(g.ongoingSpellEffects('warden').length,1);
});
test('pure inspection, state restore and undo retain native ownership',()=>{
 const g=make(true);resolve(g);resolve(g,{conditions:['dazzled']});const restored=new Kernel(g.exportState()),before=clone(restored.s);restored.inspect();assert.deepEqual(restored.s,before);assert.equal(restored.getConditions('warden').length,2);gm(restored,{op:'gm_end_initiative'});advance(restored,3);assert.equal(restored.getConditions('warden').length,0);gm(g,{op:'undo_turn'});assert.equal(g.getConditions('warden').length,0);assert.equal(g.s.initiativeEvents.length,0);
});
test('invalid bundles reject atomically before resources or RNG',()=>{
 for(const effect of [{conditions:['imaginary']},{conditions:['dead']},{conditions:['stable']},{conditions:['shaken','shaken']},{conditions:[]},{conditions:'shaken'},{tags:['invented']},{tags:['sleep','sleep']},{rounds:0},{unknown:true}]){const g=make(),before=clone(g.s);assert.throws(()=>g.dispatch({op:'cast_spell',actor:'hero',spell:spell(effect)}));assert.deepEqual(g.s,before);assert.equal(g._spellConditionApplication,undefined);}
});
console.log(`V3.32 spell conditions: ${count} groups passed`);
