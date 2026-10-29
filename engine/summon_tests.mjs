import assert from 'node:assert/strict';
import {MagicGame} from './magic.mjs';
import {initialState,clone} from './core.mjs';
const gm=(g,c)=>g.dispatch(c,'gm');
const make=(init=false)=>{const s=initialState();s.tiles={};Object.assign(s.creatures[1],{x:5,y:4,size:1,reach:1});const g=new MagicGame(s);if(init)gm(g,{op:'gm_begin_initiative',scores:{hero:20,warden:10}});return g;};
const mark=(g,target='warden',count=2,extra={})=>gm(g,{op:'gm_mark_summon',target,duration:{count,unit:'round'},reason:'Test summon',...extra});
const advance=(g,count=1)=>gm(g,{op:'gm_advance_time',count,unit:'round'});
const turn=g=>g.dispatch({op:'end_turn'});
const exists=(g,id)=>g.s.creatures.some(c=>c.id===id);
let tests=0;const test=(name,fn)=>{try{fn();tests++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}};
test('marker preserves creature stats, type and defensive subtypes; one native timer',()=>{
 const g=make();g.find('warden').creatureType='outsider';g.find('warden').subtypes=['devil'];const before=g.traits('warden');
 const max=g.find('warden').maxHp;mark(g);assert.equal(g.find('warden').maxHp,max);assert.equal(g.find('warden').creatureType,'outsider');
 assert.deepEqual(g.find('warden').subtypes,['devil','summon']);assert.deepEqual(g.traits('warden').immunities,before.immunities);
 assert.equal(g.s.pendingEvents.length,1);assert.equal(g.s.pendingEvents[0].kind,'summon');assert.equal(g.lifecycleStatus().deadlines.length,1);
 assert.equal(g.inspect().summons.length,1);assert(!('summonTimers' in g.s));
});
test('Fast Forward removes exactly at expiry without a narrative confirmation',()=>{
 const g=make();mark(g);assert.equal(advance(g).status,'done');assert(exists(g,'warden'));advance(g);assert(!exists(g,'warden'));
 assert.equal(g.s.pendingEvents.length,0);assert.equal(g.lifecycleStatus().deadlines.length,0);assert.equal(g.s.pendingEventHistory.at(-1).outcome,'expired');
});
test('time-to-next-event stops at summon expiry and calendar edits do not extend it',()=>{
 const g=make();mark(g);gm(g,{op:'gm_set_game_clock',day:20,hour:7});const out=gm(g,{op:'gm_advance_to_event'});
 assert.equal(out.advancedRounds,2);assert(!exists(g,'warden'));
});
test('ordinary conditional events retain their existing Fast Forward warning',()=>{
 const g=make();mark(g);gm(g,{op:'gm_register_pending_event',id:'watch',label:'Watch',trigger:'Someone arrives'});
 assert.equal(advance(g).status,'pending_events_warning');assert.equal(g.s.worldRounds,0);
});
test('spawn accepts per-instance summon setup and subtype imports demand a timer',()=>{
 const g=make();gm(g,{op:'register_creature',definition:{id:'test',name:'Test animal',creatureType:'animal',subtypes:['summon'],stats:{maxHp:10}}});
 const before=clone(g.s);assert.throws(()=>gm(g,{op:'spawn_creature',definition:'test',id:'pet',x:3,y:4}),/require/);assert.deepEqual(g.s,before);
 gm(g,{op:'spawn_creature',definition:'test',id:'pet',x:3,y:4,summon:{duration:{count:1,unit:'minute'},source:'hero'}});
 assert.equal(g.summonEvent('pet').duration.at,10);assert.equal(g.summonEvent('pet').payload.source,'hero');
});
test('invalid, repeated, unauthorized and malformed setup is atomic',()=>{
 for(const extra of [{duration:{count:0,unit:'round'}},{duration:{count:1,unit:'banana'}},{duration:{count:1,unit:'round',atScore:5}},
  {source:'missing'},{reason:''},{duration:{count:100000,unit:'day'}}]){
  const g=make(),before=clone(g.s);assert.throws(()=>mark(g,'warden',2,extra));assert.deepEqual(g.s,before);
 }
 const g=make();assert.throws(()=>g.dispatch({op:'gm_mark_summon',target:'warden',duration:{count:1,unit:'round'},reason:'x'}),/GM/);
 mark(g);const before=clone(g.s);assert.throws(()=>mark(g),/already/);assert.deepEqual(g.s,before);
 assert.throws(()=>gm(g,{op:'gm_register_pending_event',id:'cheat',label:'Cheat',trigger:'Cheat',kind:'summon',actor:'hero'}),/gm_mark_summon/);
});
test('generic trigger is blocked; cancellation dismisses instead of making immortal',()=>{
 const g=make();const e=mark(g);assert.throws(()=>gm(g,{op:'gm_trigger_pending_event',id:e.eventId}),/expire automatically/);
 gm(g,{op:'gm_cancel_pending_event',id:e.eventId,reason:'Dismissal'});assert(!exists(g,'warden'));assert.equal(g.s.pendingEvents.length,0);
});
test('initiative expires at the summoner count, including an empty count',()=>{
 const g=make(true);mark(g,'warden',1,{source:'hero'});turn(g);assert(exists(g,'warden'));turn(g);
 assert(!exists(g,'warden'));assert.equal(g.active().id,'hero');assert.equal(g.s.round,2);assert.equal(g.s.worldRounds,1);
 assert.deepEqual(g.s.initiative.entries.map(e=>e.id),['hero']);
 const h=make(true);mark(h,'warden',1,{duration:{count:1,unit:'round',atScore:15}});turn(h);turn(h);assert(exists(h,'warden'));turn(h);
 assert(!exists(h,'warden'));assert.equal(h.active().id,'hero');assert.equal(h.s.round,3);assert.equal(h.s.worldRounds,2);
});
test('ending initiative migrates the same timer to downtime',()=>{
 const g=make(true);const e=mark(g,'warden',3,{source:'hero'});turn(g);turn(g);gm(g,{op:'gm_end_initiative'});
 assert.equal(g.summonEvent('warden').id,e.eventId);assert.equal(g.summonEvent('warden').duration.at,3);advance(g,2);assert(!exists(g,'warden'));
});
test('lethal damage, damage packets and explicit dead condition remove; ordinary down creatures stay',()=>{
 for(const command of [{op:'deal_damage',target:'warden',amount:999,damageType:'force'},
  {op:'gm_resolve_packet',target:'warden',components:[{amount:999,damageType:'force'}]},
  {op:'apply_condition',target:'warden',condition:'dead'}]){
  const g=make();mark(g);gm(g,command);assert(!exists(g,'warden'));assert.equal(g.s.pendingEvents.length,0);assert.throws(()=>gm(g,{op:'gm_heal_hp',target:'warden',amount:10}));
 }
 const g=make();gm(g,{op:'deal_damage',target:'warden',amount:999,damageType:'force'});assert(exists(g,'warden'));
});
test('nonlethal unconsciousness does not dismiss a living summon',()=>{
 const g=make();mark(g);gm(g,{op:'gm_apply_nonlethal',target:'warden',amount:70});assert(exists(g,'warden'));assert(g.summonEvent('warden'));
});
test('removing active summon advances turn without giving another actor duplicate actions',()=>{
 const g=make(true);mark(g,'hero',5);gm(g,{op:'gm_dismiss_summon',target:'hero',reason:'Dismiss'});
 assert.equal(g.active().id,'warden');assert.equal(g.s.round,1);assert.deepEqual(g.s.actions.resources,{standard:1,move:1,swift:1});turn(g);assert.equal(g.s.round,2);
});
test('last summon can depart; inspect, clock and new spawning remain usable',()=>{
 const g=make();g.s.creatures=g.s.creatures.slice(0,1);mark(g,'hero',1);advance(g);assert.equal(g.s.creatures.length,0);
 assert.equal(g.inspect().creatures.length,0);assert.equal(advance(g).status,'done');
 gm(g,{op:'register_creature',definition:{id:'new',name:'New',stats:{maxHp:5}}});gm(g,{op:'spawn_creature',definition:'new',id:'new',x:1,y:4});assert.equal(g.active().id,'new');
});
test('summoner disappearance does not cancel someone else’s summon',()=>{
 const g=make();mark(g,'hero',1);mark(g,'warden',3,{source:'hero'});advance(g);assert(!exists(g,'hero'));assert(exists(g,'warden'));advance(g,2);assert.equal(g.s.creatures.length,0);
});
test('native spell effects cast by departing summon expire and unlink deadlines',()=>{
 const g=make(true);mark(g);gm(g,{op:'gm_resolve_spell',actor:'warden',spell:{name:'Ward',level:1,casterLevel:2,targets:['hero'],effect:{rounds:8,mods:[{stat:'attack',value:2}]}}});
 assert.equal(g.s.effects.length,1);gm(g,{op:'gm_dismiss_summon',target:'warden',reason:'Dismiss'});assert.equal(g.s.effects.length,0);assert.equal(g.s.initiativeEvents.length,0);
});
test('grapples, conditions, ready events, held charges and ailments leave no orphan',()=>{
 const g=make();mark(g);g.s.grapples.push({holder:'warden',target:'hero',conditionEffects:[]});
 gm(g,{op:'gm_register_pending_event',id:'owned',label:'Owned event',trigger:'Something',actor:'warden'});
 gm(g,{op:'apply_condition',target:'warden',condition:'shaken'});
 gm(g,{op:'gm_resolve_spell',actor:'warden',spell:{name:'Touch',level:1,casterLevel:2,delivery:{type:'touch'},components:[{amount:2,damageType:'force'}]}});
 gm(g,{op:'gm_dismiss_summon',target:'warden',reason:'Dismiss'});
 assert.equal(g.s.grapples.length,0);assert.equal(g.s.conditionInstances.length,0);assert.equal(g.s.pendingEvents.length,0);assert.doesNotThrow(()=>g.inspect());
});
test('summon defeat during a melee hit lets the living full attacker retarget',()=>{
 const g=make();g.find('warden').x=2;g.find('warden').hp=1;g.find('hero').attacks=[{label:'One',damageDie:8},{label:'Two',damageDie:8}];mark(g);
 g.s.testRolls=[19,8];const result=g.dispatch({op:'full_attack',actor:'hero',target:'warden'});assert(!exists(g,'warden'));assert(g.s.pendingFullAttack);assert(result);
 g.dispatch({op:'finish_full_attack',actor:'hero'});assert.equal(g.s.pendingFullAttack,null);
});
test('a lost summoning actor cannot leave a suspended casting or its resources behind',()=>{
 const g=make();mark(g,'hero',5);g.dispatch({op:'cast_spell',actor:'hero',spell:{name:'Slow',level:1,casterLevel:2,castingTime:'1_round',targets:['warden'],components:[{amount:2,damageType:'force'}]}});
 gm(g,{op:'deal_damage',target:'hero',amount:999,damageType:'force'});assert(!exists(g,'hero'));assert.equal(g.s.activeSpellCasts.length,0);assert.equal(g.s.pendingSpellCast,null);assert.doesNotThrow(()=>g.inspect());
});
test('saving and reconstruction preserve the same countdown; undo restores dismissal',()=>{
 const g=make();mark(g);const h=new MagicGame(g.s);assert.deepEqual(h.summonsOverview(),g.summonsOverview());advance(h,2);assert(!exists(h,'warden'));
 g.turnStart=clone(g.s);gm(g,{op:'gm_dismiss_summon',target:'warden',reason:'Dismiss'});gm(g,{op:'undo_turn'});assert(exists(g,'warden'));assert(g.summonEvent('warden'));
});
test('defeat during a movement AoO finishes the reaction and removes the mover',()=>{
 const g=make();g.find('warden').x=2;g.find('hero').hp=1;mark(g,'hero',4);
 const moved=g.dispatch({op:'move',actor:'hero',path:[{x:0,y:4}]});assert.equal(moved.status,'interrupt');
 g.s.testRolls=[19,8];g.dispatch({op:'resolve_interrupt',take:true});assert(!exists(g,'hero'));assert.equal(g.s.interrupt,null);assert.equal(g.s.pendingMove,null);assert.equal(g.active().id,'warden');
});
test('last ranked participant departure migrates timers when an unranked creature remains',()=>{
 const g=make();g.s.creatures=g.s.creatures.slice(0,1);gm(g,{op:'gm_begin_initiative',scores:{hero:20}});mark(g,'hero',1);
 gm(g,{op:'register_creature',definition:{id:'test',name:'Test',stats:{maxHp:10}}});gm(g,{op:'spawn_creature',definition:'test',id:'pet',x:3,y:4});
 gm(g,{op:'gm_schedule_initiative_event',id:'later',label:'Later event',afterRounds:4,requiresInput:false});
 turn(g);assert(!exists(g,'hero'));assert.equal(g.active().id,'pet');assert.equal(g.s.initiative.enabled,false);assert.equal(g.s.scheduledTimeEvents.length,1);advance(g,3);assert.equal(g.s.scheduledTimeEvents.length,0);
});
test('simultaneous narrative decision does not postpone automatic expiry',()=>{
 const g=make();mark(g,'warden',2);gm(g,{op:'gm_schedule_time_event',id:'story',label:'Story',after:{count:2,unit:'round'},requiresInput:true});
 const result=advance(g,5);assert.equal(result.status,'needs_gm');assert.equal(result.advancedRounds,2);assert(!exists(g,'warden'));assert.equal(g.s.pendingTimeEvent.id,'story');
});
test('expiry before a summon turn suppresses its automatic turn-start action',()=>{
 const g=make(true);gm(g,{op:'gm_set_initiative',id:'warden',score:20});mark(g,'warden',1,{source:'hero'});
 g.installRule({id:'ward_turn',owner:'warden',on:'turn_start',when:[{op:'eq',left:{ref:'event.actor'},right:'warden'}],actions:[{op:'set_hp',target:'hero',hp:1}]});
 turn(g);assert.equal(g.find('hero').hp,1);g.find('hero').hp=40;turn(g);assert.equal(g.find('hero').hp,40);assert(!exists(g,'warden'));
});
test('automatic duplicates inherit exact summon expiry instead of becoming permanent',()=>{
 const g=make();mark(g,'warden',3);advance(g);g.installRule({id:'split',owner:'warden',on:'ping',when:[],actions:[{op:'duplicate_entity',target:'warden'}]});
 g.emit('ping');const copy=g.s.creatures.find(c=>c.id.startsWith('warden-copy'));assert(copy);assert.deepEqual(g.summonEvent(copy.id).duration,g.summonEvent('warden').duration);
 advance(g,2);assert(!exists(g,'warden'));assert(!exists(g,copy.id));
});
console.log(`V3.28 summons: ${tests} groups passed`);
