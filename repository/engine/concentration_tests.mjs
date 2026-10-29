import assert from 'node:assert/strict';
import {Kernel,initialState} from './kernel.mjs';
import {clone} from './core.mjs';
const gm=(g,c)=>g.dispatch(c,'gm');
const make=(init=true)=>{const s=initialState();s.tiles={};Object.assign(s.creatures[0],{x:1,y:3,hp:100,maxHp:100});Object.assign(s.creatures[1],{x:7,y:3,size:1,hp:100,maxHp:100});const g=new Kernel(s);if(init)gm(g,{op:'gm_begin_initiative',scores:{hero:20,warden:10}});return g;};
const spell=(extra={})=>({name:'Synthetic maintained spell',level:2,casterLevel:5,concentrationBonus:20,targets:['warden'],concentration:{},effect:{conditions:['dazzled'],mods:[{stat:'ac',value:2,type:'luck'}]},...extra});
const start=(g,extra={})=>g.dispatch({op:'cast_spell',actor:'hero',spell:spell(extra)});
const turn=g=>g.dispatch({op:'end_turn'});
const round=g=>{turn(g);turn(g);};
const maintain=g=>g.dispatch({op:'maintain_concentration',actor:'hero'});
const stop=g=>g.dispatch({op:'stop_concentration',actor:'hero'});
const advance=(g,n=1)=>gm(g,{op:'gm_advance_time',count:n,unit:'round',maintainConcentration:true});
const region=(g,extra={})=>{const s=spell({area:{shape:'sphere',origin:{x:7,y:3},sizeFeet:10},persistent:{triggers:['create','enter','turn_start']},...extra});delete s.targets;return gm(g,{op:'gm_resolve_spell',actor:'hero',spell:s});};
const dispel=(g,target='warden',effectId)=>gm(g,{op:'gm_resolve_spell',actor:'hero',spell:{name:'Dispel',level:3,casterLevel:5,targets:[target],dispel:effectId?{effectId}:{}}});
let count=0;const test=(name,fn)=>{try{fn();count++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}};
test('one native Pending Event owns maintenance and shared lifetime',()=>{
 const g=make(),r=start(g);assert(r.resolution.concentrationId);assert.equal(g.concentrationEvents().length,1);assert.equal(g.s.activeSpellCasts.length,0);assert.equal(g.s.initiativeEvents.length,0);assert(g.s.effects.every(e=>e.remaining===null));assert.equal(g.s.actions.resources.standard,0);
 assert.throws(()=>maintain(g),/already covered/);round(g);g.find('warden').x=2;assert(g.concentrationFor('hero').payload.needsMaintenance);maintain(g);assert.equal(g.s.actions.resources.standard,0);assert.equal(g.s.pendingSpellCast,null);assert.equal(g.s.interrupt,null);
});
test('missing upkeep ends all linked effects, while movement remains available',()=>{
 const g=make();start(g);g.dispatch({op:'move',actor:'hero',path:[{x:1,y:4}]});round(g);turn(g);assert.equal(g.concentrationEvents().length,0);assert.equal(g.s.effects.length,0);assert(!g.hasCondition('warden','dazzled'));
});
test('delay cannot skip required upkeep',()=>{const g=make();start(g);round(g);g.dispatch({op:'delay_turn'});assert.equal(g.concentrationEvents().length,0);});
test('another spell is blocked before any action or resource expenditure',()=>{
 const g=make();start(g);const before=clone(g.s);for(const castingTime of ['swift','standard','1_round']){assert.throws(()=>g.dispatch({op:'cast_spell',actor:'hero',spell:{name:'Other',level:1,casterLevel:5,castingTime,targets:['warden'],healing:{amount:1}}}),/Stop concentration/);assert.deepEqual(g.s,before);}
 stop(g);g.dispatch({op:'cast_spell',actor:'hero',spell:{name:'Other',level:1,casterLevel:5,castingTime:'swift',targets:['hero'],healing:{amount:1}}});
});
test('maintenance spends actions but never re-spends or resizes a spell slot',()=>{
 const g=make();g.find('hero').int=18;gm(g,{op:'gm_set_spellcasting',actor:'hero',reason:'Test book',book:{id:'focus',name:'Test caster',mode:'spontaneous',ability:'int',casterLevel:5,pools:[{id:'general',allotment:{type:'derived',abilityScore:18,base:{2:1}}}],spells:[{id:'focus_spell',name:'Synthetic maintained spell',level:2}]}});
 start(g,{resource:{book:'focus',spell:'focus_spell',pool:'general',slotLevel:2}});const resources=clone(g.s.spellResources);round(g);maintain(g);round(g);maintain(g);assert.deepEqual(g.s.spellResources,resources);
});
test('multi-component damage checks once; failure ends concentration and native effects',()=>{
 const g=make();start(g,{concentrationBonus:0});g.s.testRolls=[1];const r=gm(g,{op:'gm_resolve_packet',target:'hero',components:[{damageType:'force',amount:2},{damageType:'fire',amount:3}]});assert.equal(r.casting.concentration.dc,17);assert.equal(g.s.testRolls.length,0);assert.equal(g.concentrationEvents().length,0);assert.equal(g.s.effects.length,0);assert.equal(g.find('hero').hp,95);
});
test('temporary HP counts as damage; fully resisted hits do not check',()=>{
 const g=make();g.s.energyTempHp.hero=[{amount:10,expiresAt:100}];start(g);g.s.testRolls=[10];let r=gm(g,{op:'gm_resolve_damage',target:'hero',amount:4,damageType:'force'});assert.equal(r.applied,0);assert.equal(r.casting.concentration.dc,16);
 g.find('hero').protections={resistances:{fire:10}};g.s.testRolls=[1];gm(g,{op:'gm_resolve_damage',target:'hero',amount:4,damageType:'fire'});assert.deepEqual(g.s.testRolls,[1]);assert.equal(g.concentrationFor('hero').payload.injuries.length,1);
});
test('one weapon hit groups physical and extra energy damage',()=>{
 const g=make();start(g,{concentrationBonus:100});g.find('warden').x=2;g.find('warden').damageOther=0;g.find('warden').str=10;g.s.testRolls=[10,2,3,1];const r=g.resolveAttack('warden','hero','Test hit',{attackOffset:100,damageDie:6,extraDamage:[{damageType:'fire',count:1,sides:6}]});assert(r.hit);assert.equal(r.casting.concentration.dc,17);assert.equal(g.concentrationFor('hero').payload.injuries.length,1);
});
test('continuous damage reuses the half-damage check, including during Fast Forward',()=>{
 const g=make(false);start(g,{concentrationBonus:0});gm(g,{op:'register_ailment',definition:{id:'pain',name:'Pain',kind:'dot',initialEffect:false,frequency:{every:{count:1,unit:'round'},maxTicks:3},effects:[{kind:'hp',dice:{count:0,sides:2,bonus:4},damageType:'force'}]}});gm(g,{op:'expose_ailment',target:'hero',definition:'pain'});g.s.testRolls=[1];advance(g);assert.equal(g.concentrationEvents().length,0);assert.equal(g.find('hero').hp,96);
 assert(g.s.log.some(x=>String(x).includes('DC 14')));
});
test('incapacitation and explicit environmental checks use the same termination path',()=>{
 const g=make();start(g);gm(g,{op:'apply_condition',target:'hero',condition:'dazed'});assert.equal(g.concentrationEvents().length,0);assert(!g.hasCondition('warden','dazzled'));
 const h=make();start(h,{concentrationBonus:0});h.s.testRolls=[1];const r=gm(h,{op:'gm_interrupt_spell',actor:'hero',dc:18,reason:'Violent motion'});assert.equal(r.status,'lost');assert.equal(h.s.effects.length,0);
});
test('voluntary stop costs no action and can create a bounded lingering tail',()=>{
 const g=make();start(g,{concentration:{afterRounds:2}});const budget=clone(g.s.actions.resources);assert.equal(stop(g).status,'lingering');assert.deepEqual(g.s.actions.resources,budget);assert.equal(g.concentrationFor('hero'),undefined);assert(g.hasCondition('warden','dazzled'));
 round(g);assert(g.hasCondition('warden','dazzled'));round(g);assert.equal(g.s.effects.length,0);assert.equal(g.concentrationEvents().length,0);
});
test('damage failure permits declared lingering effects; dispelling does not add a tail',()=>{
 const g=make();start(g,{concentration:{afterRounds:2},concentrationBonus:0});g.s.testRolls=[1];gm(g,{op:'gm_resolve_damage',target:'hero',amount:1,damageType:'force'});assert.equal(g.concentrationEvents()[0].payload.phase,'lingering');dispel(g);assert.equal(g.concentrationEvents().length,0);assert.equal(g.s.effects.length,0);
});
test('maximum is a native deadline and includes any lingering tail',()=>{
 const g=make();start(g,{concentration:{maxRounds:2,afterRounds:5}});round(g);maintain(g);stop(g);round(g);assert.equal(g.s.effects.length,0);assert.equal(g.concentrationEvents().length,0);
 const h=make(false);start(h,{concentration:{maxRounds:4}});gm(h,{op:'gm_advance_to_event',maintainConcentration:true});assert.equal(h.s.worldRounds,4);assert.equal(h.s.effects.length,0);
});
test('Fast Forward needs explicit maintenance, migrates deadlines and preserves pure views',()=>{
 const g=make();start(g,{concentration:{maxRounds:5}});gm(g,{op:'gm_end_initiative'});const before=clone(g.s);assert.throws(()=>gm(g,{op:'gm_advance_time',count:2,unit:'round'}),/maintainConcentration/);assert.deepEqual(g.s,before);
 const inspect=clone(g.s);gm(g,{op:'gm_get_spellcasting'});g.inspect();assert.deepEqual(g.s,inspect);advance(g,2);assert(g.concentrationFor('hero').payload.needsMaintenance);assert.equal(g.s.actions.resources.standard,1);advance(g,3);assert.equal(g.s.effects.length,0);
});
test('partial dispel preserves other recipients and stops maintenance only after the last link',()=>{
 const g=make();start(g,{targets:['hero','warden']});dispel(g);assert(g.concentrationFor('hero'));assert(g.hasCondition('hero','dazzled'));dispel(g,'hero');assert.equal(g.concentrationEvents().length,0);
});
test('ordinary overlapping spell effects survive concentration termination',()=>{
 const g=make();gm(g,{op:'gm_resolve_spell',actor:'hero',spell:{name:'Ordinary',level:1,casterLevel:1,targets:['warden'],effect:{rounds:5,conditions:['dazzled']}}});start(g);stop(g);assert(g.hasCondition('warden','dazzled'));assert.equal(g.getConditions('warden').length,1);
});
test('fixed regions share the concentration lifetime and keep occupancy semantics',()=>{
 const g=make(false),r=region(g,{concentration:{afterRounds:1}});assert.equal(g.s.pendingEvents.length,2);assert.equal(g.persistentAreaEvent(r.areaId).duration.type,'indefinite');gm(g,{op:'teleport',target:'warden',x:4,y:3,reason:'Exit'});assert(!g.hasCondition('warden','dazzled'));gm(g,{op:'teleport',target:'warden',x:7,y:3,reason:'Enter'});assert(g.hasCondition('warden','dazzled'));stop(g);assert(g.persistentAreaEvent(r.areaId));advance(g);assert.equal(g.s.pendingEvents.length,0);assert.equal(g.s.effects.length,0);
});
test('dispelling a region ends concentration without disturbing a separate region',()=>{
 const g=make(false),a=region(g);gm(g,{op:'gm_resolve_spell',actor:'warden',spell:{name:'Other region',level:1,casterLevel:1,area:{shape:'sphere',origin:{x:7,y:3},sizeFeet:5},components:[{damageType:'force',amount:1}],persistent:{duration:{count:2,unit:'round'}}}});dispel(g,a.areaId);assert.equal(g.concentrationEvents().length,0);assert.equal(g.persistentAreaEvents().length,1);
});
test('area self-damage interruption cannot leave orphaned condition effects',()=>{
 const g=make(false);g.find('hero').x=6;region(g,{concentrationBonus:0,components:[{damageType:'force',amount:1}]});g.s.testRolls=[1];advance(g);assert.equal(g.concentrationEvents().length,0);assert.equal(g.persistentAreaEvents().length,0);assert.equal(g.s.effects.length,0);
});
test('summoned caster departure ends maintained regions through native cleanup',()=>{
 const g=make(false);gm(g,{op:'gm_mark_summon',target:'hero',duration:{count:1,unit:'round'},reason:'Test source'});region(g);advance(g);assert(!g.s.creatures.some(c=>c.id==='hero'));assert.equal(g.s.effects.length,0);assert.equal(g.persistentAreaEvents().length,0);assert.equal(g.concentrationEvents().length,0);
});
test('a new entry condition that breaks its own concentration leaves no unbound effect',()=>{
 const g=make(false);region(g,{effect:{conditions:['dazed','shaken']}});gm(g,{op:'teleport',target:'hero',x:6,y:3,reason:'Caster enters own region'});assert.equal(g.concentrationEvents().length,0);assert.equal(g.persistentAreaEvents().length,0);assert.equal(g.s.effects.length,0);assert.equal(g.s.conditionInstances.length,0);
});
test('long casting completion establishes concentration without charging the deferred turn twice',()=>{
 const g=make();start(g,{castingTime:'1_round'});round(g);assert(g.s.deferredTurnStart);g.dispatch({op:'complete_spell',actor:'hero'});assert(g.concentrationFor('hero'));assert.equal(g.concentrationFor('hero').payload.needsMaintenance,false);assert.equal(g.s.actions.resources.standard,1);round(g);assert(g.concentrationFor('hero').payload.needsMaintenance);
});
test('restore and undo retain native maintenance and remove its links together',()=>{
 const g=make();start(g,{concentration:{maxRounds:3}});const h=new Kernel(g.exportState());round(h);maintain(h);assert(h.concentrationFor('hero'));gm(g,{op:'undo_turn'});assert.equal(g.concentrationEvents().length,0);assert.equal(g.s.effects.length,0);
});
test('invalid payloads and forged event commands reject atomically',()=>{
 for(const extra of [{concentration:true},{concentration:{maxRounds:0}},{concentration:{afterRounds:-1}},{concentration:{guess:true}},{effect:{rounds:2,conditions:['dazed']}},{delivery:{type:'ray',rangeFeet:60}}]){const g=make(),s=clone(g.s);assert.throws(()=>start(g,extra));assert.deepEqual(g.s,s);}
 const g=make(),s=clone(g.s);assert.throws(()=>gm(g,{op:'gm_register_pending_event',id:'fake',label:'Fake',kind:'concentration',actor:'hero',trigger:'Fake',requiresInput:false,payload:{actor:'hero'}}),/through its spell/);assert.deepEqual(g.s,s);
 start(g);const event=g.concentrationEvents()[0],before=clone(g.s);assert.throws(()=>gm(g,{op:'gm_trigger_pending_event',id:event.id}),/generic triggering/);assert.deepEqual(g.s,before);assert.throws(()=>g.dispatch({op:'maintain_concentration',actor:'warden'}),/active creature/);
});
console.log(`V3.33 concentration: ${count} groups passed`);
