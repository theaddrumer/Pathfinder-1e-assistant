import assert from 'node:assert/strict';
import {Kernel as MagicGame} from './kernel.mjs';
import {ConditionAilmentGame} from './condition_ailment_game.mjs';
import {initialState,clone} from './core.mjs';
const gm=(g,c)=>g.dispatch(c,'gm');
const make=()=>{const s=initialState();s.tiles={};Object.assign(s.creatures[1],{x:5,y:4,size:1,reach:1});return new MagicGame(s);};
const effect=(g,id,mods,extra={})=>gm(g,{op:'apply_effect',effect:{id,name:id,target:'hero',mods,...extra}});
let passed=0,failed=0;
const test=(name,fn)=>{try{fn();passed++;console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,'\n',e.stack);}};

test('generic and skill-specific modifiers share one stacking calculation',()=>{
 const g=make();g.find('hero').skills={Perception:4};
 effect(g,'general',[{stat:'skill_checks',value:3,type:'competence'}]);
 effect(g,'specific',[{stat:'skill:Perception',value:5,type:'competence'}]);
 assert.equal(g.skillBonus('hero','Perception'),9);
});
test('ability-check stacking is consistent in the condition layer and full kernel',()=>{
 for(const g of [new ConditionAilmentGame(),make()]){
  effect(g,'first',[{stat:'ability_checks',value:3,type:'morale'}]);
  effect(g,'second',[{stat:'ability_checks',value:5,type:'morale'}]);
  g.s.abilityDamage.hero={str:2};g.s.testRolls=[10];
  assert.equal(gm(g,{op:'check',target:'hero',kind:'ability',subject:'str',dc:20}).bonus,7);
 }
});
test('automatic effect removal preserves its activity flag through every override',()=>{
 const g=make();effect(g,'temporary',[]);g.s.actions.activity=0;
 g.removeEffect('temporary',{countAsAction:false});assert.equal(g.s.actions.activity,0);
});
test('ranged ability substitution swaps ability damage dependencies as well as modifiers',()=>{
 const g=make();g.s.abilityDamage.hero={str:4,dex:2};
 assert.equal(g.completedAttackBonus('hero',{}, {attackMode:'ranged'}),6);
 assert.equal(g.completedDamageBonus('hero',{}, {attackMode:'ranged'}),0);
});
test('rolled and direct healing restore the same lethal and nonlethal damage',()=>{
 const g=make(),h=make();for(const x of [g,h]){x.find('hero').hp=25;x.s.nonlethalDamage.hero=8;}
 g.s.testRolls=[5];gm(g,{op:'gm_roll',kind:'healing',target:'hero',count:1,sides:6});
 gm(h,{op:'gm_heal_hp',target:'hero',amount:5});
 assert.equal(g.find('hero').hp,h.find('hero').hp);assert.equal(g.nonlethalTotal('hero'),h.nonlethalTotal('hero'));
});
test('undo after a manual heal selects the current turn',()=>{
 const g=make();g.find('hero').hp=20;g.dispatch({op:'end_turn'});
 gm(g,{op:'gm_heal_hp',target:'hero',amount:5});gm(g,{op:'undo_turn'});
 assert.equal(g.active().id,'warden');assert.equal(g.find('hero').hp,20);
});
test('spawned traits apply before entry-zone effects',()=>{
 const g=make();g.installRule({id:'fire_zone',owner:'hero',on:'zone_enter',zone:{radius:10,affects:'others'},when:[],actions:[{op:'deal_damage',target:{ref:'event.target'},amount:6,damageType:'fire'}]});
 gm(g,{op:'register_creature',definition:{id:'devil',name:'Devil',creatureType:'outsider',subtypes:['devil'],stats:{maxHp:20}}});
 gm(g,{op:'spawn_creature',definition:'devil',id:'new_devil',x:3,y:4});assert.equal(g.find('new_devil').hp,20);
});
test('a summon defeated by an entry effect departs without rolling back its arrival',()=>{
 const g=make();g.installRule({id:'doom_zone',owner:'hero',on:'zone_enter',zone:{radius:10,affects:'others'},when:[{left:{ref:'event.target'},op:'eq',right:'pet'}],actions:[{op:'deal_damage',target:{ref:'event.target'},amount:100,damageType:'force'}]});
 gm(g,{op:'register_creature',definition:{id:'animal',name:'Animal',stats:{maxHp:10}}});
 gm(g,{op:'spawn_creature',definition:'animal',id:'pet',x:3,y:4,summon:{duration:{count:3,unit:'round'}}});
 assert(!g.s.creatures.some(c=>c.id==='pet'));assert(g.s.pendingEventHistory.some(e=>e.kind==='summon'&&e.reason==='summon defeated'));
});
test('nonlethal incapacitation during an AoO stops suspended movement',()=>{
 const g=make();Object.assign(g.find('warden'),{x:2,y:4,damageIntent:'nonlethal',damageOther:100});
 assert.equal(g.dispatch({op:'move',actor:'hero',path:[{x:1,y:3}]}).status,'interrupt');
 g.s.testRolls=[19,8];const result=gm(g,{op:'resolve_interrupt',take:true});
 assert.equal(result.status,'stopped');assert.equal(g.find('hero').y,4);assert.equal(g.s.pendingMove,null);
});
test('turn-start callbacks observe the advanced world clock',()=>{
 const g=make(),seen=[],emit=g.emit;
 g.emit=function(name,payload){if(name==='turn_start')seen.push([payload.actor,this.s.worldRounds]);return emit.call(this,name,payload);};
 g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});
 assert.deepEqual(seen,[['warden',0],['hero',1]]);
});
test('a due world-time decision defers automatic turn effects until acknowledged',()=>{
 const g=make();g.installRule({id:'start_bonus',owner:'hero',on:'turn_start',when:[{left:{ref:'event.actor'},op:'eq',right:'hero'}],actions:[{op:'grant_action',target:'hero',type:'swift',count:1}]});
 gm(g,{op:'gm_schedule_time_event',id:'bell',label:'Bell',after:{count:1,unit:'round'}});
 g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});
 assert(g.s.pendingTimeEvent);assert.equal(g.s.actions.resources.swift,1);
 assert.throws(()=>g.dispatch({op:'use_action',actor:'hero',type:'standard'}),/checkpoint|acknowledge|pre-turn/i);
 gm(g,{op:'gm_acknowledge_time_event',reason:'Bell heard'});assert.equal(g.s.actions.resources.swift,2);assert.equal(g.s.deferredTurnStart,null);
});
test('all read-only views remain available and pure during a pre-turn checkpoint',()=>{
 const g=make();gm(g,{op:'gm_begin_initiative',scores:{hero:20,warden:10}});
 gm(g,{op:'gm_schedule_initiative_event',id:'stop',label:'Stop',afterRounds:1,requiresInput:true});g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});
 const before=clone(g.s);
 for(const op of ['inspect','gm_get_lifecycle','gm_get_game_clock','gm_get_pending_events','gm_get_spellcasting','gm_get_summons','list_conditions','list_trait_library'])gm(g,{op});
 assert.deepEqual(g.s,before);
});
test('a departed fear source leaves a usable condition and controller view',()=>{
 const g=make();gm(g,{op:'apply_condition',condition:'frightened',target:'hero',source:'warden'});
 gm(g,{op:'gm_mark_summon',target:'warden',duration:{count:2,unit:'round'},reason:'Summon'});
 gm(g,{op:'gm_dismiss_summon',target:'warden',reason:'Dismissed'});
 assert(g.hasCondition('hero','frightened'));assert.doesNotThrow(()=>g.statusWarnings({op:'move',actor:'hero',path:[{x:2,y:4}]}));
 assert.doesNotThrow(()=>gm(g,{op:'inspect'}));
});
test('a failing nested automation restores state, RNG, and every undo checkpoint',()=>{
 const g=make();g.installRule({id:'fail_after_roll',on:'ping',when:[],actions:[{op:'deal_damage',target:'hero',amount:2},{op:'save',target:'hero',save:'fort',dc:10,success:[],failure:[]},{op:'deal_damage',target:'missing',amount:1}]});
 const before={s:clone(g.s),turnStart:clone(g.turnStart),roundStart:clone(g.roundStart),previousTurnStart:clone(g.previousTurnStart)};
 assert.throws(()=>g.emit('ping'),/Unknown creature/);
 for(const [k,v] of Object.entries(before))assert.deepEqual(g[k],v);
});
test('maneuver bonuses stack across attack/CMB and AC/CMD input categories',()=>{
 const g=make(),cmb=g.cmbFor('hero','trip'),cmd=g.cmdFor('hero','trip');
 effect(g,'cmb_bonus',[{stat:'cmb',value:3,type:'morale'},{stat:'cmd',value:3,type:'morale'}]);
 effect(g,'attack_bonus',[{stat:'attack',value:5,type:'morale'},{stat:'ac',value:5,type:'morale'}]);
 assert.equal(g.cmbFor('hero','trip'),cmb+5);assert.equal(g.cmdFor('hero','trip'),cmd+5);
});
test('Tiny derived CMB uses Dexterity damage instead of Strength damage',()=>{
 const g=make();g.find('hero').sizeCategory='tiny';g.s.abilityDamage.hero={str:4,dex:2};
 assert.equal(g.stat('hero','cmb'),4);
});
test('derived spell DC includes mental ability damage while fixed DC stays authoritative',()=>{
 const g=make();g.s.abilityDamage.hero={wis:4};
 assert.equal(gm(g,{op:'gm_calculate_dc',actor:'hero',definition:{basis:'spell',ability:'wis',spellLevel:1}}).dc,10);
 assert.equal(gm(g,{op:'gm_calculate_dc',actor:'hero',definition:{basis:'fixed',fixed:17}}).dc,17);
});
test('caught nested transaction errors cannot commit partial state',()=>{
 const g=make(),before=clone(g.s);
 assert.throws(()=>g.transaction(()=>{
  try{g.transaction(()=>{g.find('hero').hp=1;g.rollDie(20);throw Error('nested abort');});}catch{}
  g.find('warden').hp=1;
 }),/nested abort/);assert.deepEqual(g.s,before);
});
test('one command copies each rollback state once; read-only lifecycle copies none',()=>{
 const g=make(),stringify=JSON.stringify;
 const copies=command=>{
  let count=0;JSON.stringify=function(value,...args){if(value?.creatures&&value?.actions&&value?.seed!==undefined)count++;return stringify(value,...args);};
  try{gm(g,command);}finally{JSON.stringify=stringify;}return count;
 };
 assert.equal(copies({op:'use_action',actor:'hero',type:'move'}),3);
 assert.equal(copies({op:'gm_get_lifecycle'}),0);
});
test('deferred turn ailments resolve once and the undo checkpoint includes their result',()=>{
 const g=make();gm(g,{op:'register_ailment',definition:{id:'dot',name:'Dot',kind:'dot',initialEffect:false,frequency:{every:{count:1,unit:'round'},maxTicks:2},effects:[{kind:'hp',dice:{count:0,sides:2,bonus:2},damageType:'force'}]}});
 gm(g,{op:'expose_ailment',target:'hero',definition:'dot'});
 gm(g,{op:'gm_schedule_time_event',id:'bell',label:'Bell',after:{count:1,unit:'round'}});
 g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});assert.equal(g.find('hero').hp,40);
 gm(g,{op:'gm_acknowledge_time_event',reason:'Heard'});assert.equal(g.find('hero').hp,38);assert.equal(g.s.actions.activity,0);
 g.dispatch({op:'use_action',actor:'hero',type:'move'});gm(g,{op:'undo_turn'});assert.equal(g.find('hero').hp,38);
 g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});assert.equal(g.find('hero').hp,36);
});
test('simultaneous time checkpoints drain in order and start the turn once',()=>{
 const g=make();for(const [id,requiresInput] of [['a',true],['b',false],['c',true]])gm(g,{op:'gm_schedule_time_event',id,label:id,after:{count:1,unit:'round'},requiresInput});
 g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});assert.equal(g.s.pendingTimeEvent.id,'a');
 gm(g,{op:'gm_acknowledge_time_event',reason:'First'});assert.equal(g.s.pendingTimeEvent.id,'c');assert(g.s.deferredTurnStart);
 gm(g,{op:'gm_acknowledge_time_event',reason:'Last'});assert.equal(g.s.deferredTurnStart,null);assert.equal(g.s.scheduledTimeEvents.length,0);
 assert.equal(g.s.log.filter(x=>x==="Explorer's turn begins.").length,1);
});
test('offhand and multiplied Strength bonuses never scale a negative modifier',()=>{
 for(const mode of ['half_str','one_half_str','imported_offhand','imported_natural']){
  const g=make(),hero=g.find('hero');g.find('warden').x=2;hero.str=4;hero.bab=30;
  hero.attacks=[{label:'Weapon',damageDie:8,damageAbility:mode.startsWith('imported')?'str':mode}];
  let index=0;
  if(mode.startsWith('imported')){
   hero.statTotals={attack:30,damage:-3};
   if(mode==='imported_offhand'){hero.attacks.push({label:'Offhand',damageDie:8});hero.attackPlan={mainIndex:0,offhandIndex:1,mainAttackCount:1};index=1;}
   else{Object.assign(hero.attacks[0],{attackKind:'natural',naturalAttack:'bite'});hero.attackPlan={naturalIndices:[0]};}
  }
  g.s.testRolls=[19,8];assert.equal(g.dispatch({op:'attack',actor:'hero',target:'warden',index}).weaponDamage,5,mode);
 }
});
console.log(`V3.29 architecture audit: ${passed} passed, ${failed} failed`);
if(failed)process.exitCode=1;
