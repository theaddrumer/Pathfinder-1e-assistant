import assert from 'node:assert/strict';
import {MagicGame} from './magic.mjs';
import {initialState,clone} from './core.mjs';
const make=(init=true)=>{
 const s=initialState();s.tiles={};Object.assign(s.creatures[0],{x:1,y:3,reach:1});Object.assign(s.creatures[1],{x:4,y:3,size:1,reach:1,hp:200,maxHp:200});
 const g=new MagicGame(s);if(init)g.dispatch({op:'gm_begin_initiative',scores:{hero:20,warden:5}},'gm');return g;
};
const touch=(extra={})=>({name:'Synthetic touch',level:1,casterLevel:5,castingTime:'standard',delivery:{type:'touch'},components:[{damageType:'force',amount:7}],...extra});
const ray=(extra={})=>({name:'Synthetic ray',level:1,casterLevel:5,castingTime:'standard',delivery:{type:'ray',rangeFeet:60},targets:['warden'],components:[{damageType:'force',amount:7}],...extra});
const cast=(g,spell)=>g.dispatch({op:'cast_spell',actor:'hero',spell});
const deliver=(g,target='warden',more={},role='actor')=>g.dispatch({op:'deliver_touch_spell',actor:'hero',target,...more},role);
const round=g=>{g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});};
const adjacent=g=>{g.find('warden').x=2;};
let count=0;function test(name,fn){try{fn();count++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}}
test('held charge is one indefinite Pending Event, with no duplicate state tracker',()=>{
 const g=make(),r=cast(g,touch());assert.equal(r.status,'holding_charge');const e=g.heldTouch('hero');assert.equal(g.s.pendingEvents.length,1);assert.equal(e.kind,'held_spell');assert.equal(e.duration.type,'indefinite');assert.equal(e.requiresInput,false);assert.equal(g.s.activeSpellCasts.length,0);assert.equal(g.find('warden').hp,200);assert.equal(g.s.actions.resources.standard,0);assert(!('heldCharges' in g.s));
 assert.equal(g.dispatch({op:'gm_get_spellcasting'},'gm').held[0].id,e.id);
});
test('casting, moving into reach and delivering spends no second standard action',()=>{
 const g=make();g.find('warden').x=3;cast(g,touch());g.dispatch({op:'move',actor:'hero',path:[{x:2,y:3}]});g.s.testRolls=[10];const r=deliver(g);assert.equal(r.status,'resolved');assert.equal(r.attack.hit,true);assert.equal(g.find('warden').hp,193);assert.equal(g.s.actions.resources.standard,0);assert.equal(g.s.actions.resources.move,0);assert(!g.s.interrupt);assert(!g.heldTouch('hero'));assert.equal(g.s.pendingEventHistory.at(-1).outcome,'discharged');
});
test('touch uses touch AC, not armor AC, and never adds weapon damage or Strength',()=>{
 const g=make();cast(g,touch());adjacent(g);g.find('warden').armor=90;g.find('warden').natural=90;g.s.testRolls=[2];const r=deliver(g);assert(r.attack.hit);assert.equal(g.find('warden').hp,193);assert.equal(g.s.testRolls.length,0);
});
test('a missed touch preserves its charge, but consumes the one free attempt',()=>{
 const g=make();cast(g,touch());adjacent(g);g.s.testRolls=[1];assert.equal(deliver(g).status,'holding_charge');assert.equal(g.heldTouch('hero').payload.freeAttempt,false);const before=clone(g.s);assert.throws(()=>deliver(g),/standard action unavailable/);assert.deepEqual(g.s,before);
});
test('later-turn delivery uses a standard action while keeping the stored charge',()=>{
 const g=make();cast(g,touch());round(g);adjacent(g);g.s.testRolls=[10];deliver(g);assert.equal(g.s.actions.resources.standard,0);assert.equal(g.find('warden').hp,193);
});
test('a second natural 20 check cannot bypass range or a solid wall',()=>{
 const g=make();cast(g,touch());let before=clone(g.s);assert.throws(()=>deliver(g),/reach/);assert.deepEqual(g.s,before);
 adjacent(g);g.s.tiles['2,3']='wall';before=clone(g.s);assert.throws(()=>deliver(g),/cover/);assert.deepEqual(g.s,before);
});
test('concealment miss keeps the charge and uses the shared miss-chance resolver',()=>{
 const g=make();cast(g,touch());adjacent(g);g.find('warden').defenseProfile={concealment:50};g.s.testRolls=[10,1];const r=deliver(g);assert.equal(r.attack.missedByConcealment,true);assert(g.heldTouch('hero'));assert.equal(g.find('warden').hp,200);
});
test('a damaging touch critical repeats spell damage dice and its flat bonus',()=>{
 const g=make();cast(g,touch({components:[{damageType:'force',dice:{count:1,sides:6,bonus:2}}]}));adjacent(g);g.s.testRolls=[20,10,2,4];const r=deliver(g);assert(r.attack.criticalHit);assert.equal(r.resolution.targets[0].packet.raw,10);assert.equal(g.find('warden').hp,190);
});
test('fortification negates touch criticals through the shared defense check',()=>{
 const g=make();cast(g,touch());adjacent(g);g.find('warden').protections={fortification:100};g.s.testRolls=[20,10,1];const r=deliver(g);assert(r.attack.criticalNegated);assert.equal(g.find('warden').hp,193);assert.equal(g.s.testRolls.length,0);
});
test('self-touch healing is automatic and does not roll a critical',()=>{
 const g=make();g.find('hero').hp=20;cast(g,touch({components:[],healing:{amount:8}}));g.s.testRolls=[1];const r=deliver(g,'hero');assert(r.attack.automatic);assert.equal(g.find('hero').hp,28);assert.equal(g.s.testRolls.length,1);
});
test('GM-confirmed willing contact heals another creature without an attack roll',()=>{
 const g=make();cast(g,touch({components:[],healing:{amount:8}}));adjacent(g);g.find('warden').hp=150;const before=clone(g.s);assert.throws(()=>deliver(g,'warden',{willing:true}),/GM/);assert.deepEqual(g.s,before);g.s.testRolls=[1];assert(deliver(g,'warden',{willing:true},'gm').attack.automatic);assert.equal(g.find('warden').hp,158);assert.equal(g.s.testRolls.length,1);
});
test('contact discharges even when SR or a saving throw defeats the spell',()=>{
 const g=make();cast(g,touch({spellResistance:true}));adjacent(g);g.find('warden').spellResistance=99;g.s.testRolls=[10,20];const r=deliver(g);assert.equal(r.resolution.targets[0].spellResistance.success,false);assert.equal(g.find('warden').hp,200);assert(!g.heldTouch('hero'));
 const h=make();cast(h,touch({save:{type:'will',dc:1,onSuccess:'negates'}}));adjacent(h);h.s.testRolls=[10,20];deliver(h);assert(!h.heldTouch('hero'));assert.equal(h.find('warden').hp,200);
});
test('another casting dissipates the charge even if defensive concentration fails',()=>{
 const g=make();cast(g,touch());round(g);g.s.testRolls=[1];const r=cast(g,ray({defensive:true,concentrationBonus:0}));assert.equal(r.status,'lost');assert(!g.heldTouch('hero'));assert.match(g.s.pendingEventHistory.at(-1).reason,/another spell/);
});
test('invalid new spell requests do not cancel a charge or spend an action',()=>{
 const g=make();cast(g,touch());round(g);const before=clone(g.s);assert.throws(()=>cast(g,ray({delivery:{type:'ray',rangeFeet:0}})));assert.deepEqual(g.s,before);
});
test('held spell survives injuries, encounter end and time; old free touch is not retained',()=>{
 const g=make();cast(g,touch());g.dispatch({op:'gm_resolve_damage',target:'hero',amount:2,damageType:'force'},'gm');assert(g.heldTouch('hero'));g.dispatch({op:'gm_end_initiative'},'gm');g.dispatch({op:'gm_advance_time',count:1,unit:'hour',confirmPendingEvents:true},'gm');assert(g.heldTouch('hero'));assert.equal(g.freeTouchAttempt(g.heldTouch('hero')),false);
});
test('downtime expires the free touch and restores a usable action budget',()=>{
 const g=make(false);cast(g,touch());g.dispatch({op:'gm_advance_time',count:1,unit:'minute',confirmPendingEvents:true},'gm');adjacent(g);g.s.testRolls=[10];deliver(g);assert.equal(g.s.actions.resources.standard,0);assert.equal(g.find('warden').hp,193);
});
test('GM application of a delayed spell effect does not pretend a new casting began',()=>{
 const g=make();cast(g,touch());g.dispatch({op:'gm_resolve_spell',actor:'hero',spell:{name:'Earlier delayed effect',level:1,casterLevel:5,targets:['warden'],components:[{damageType:'force',amount:1}]}},'gm');assert(g.heldTouch('hero'));assert.equal(g.find('warden').hp,199);
});
test('generic Pending Event cancellation and history also remove a held charge',()=>{
 const g=make();cast(g,touch());const e=g.heldTouch('hero');assert.throws(()=>g.dispatch({op:'gm_trigger_pending_event',id:e.id},'gm'),/spell delivery/);g.dispatch({op:'gm_cancel_pending_event',id:e.id,reason:'GM removes the effect'},'gm');assert(!g.heldTouch('hero'));assert.equal(g.s.pendingEventHistory.at(-1).id,e.id);
});
test('unintended creature contact and object contact reuse Pending Event discharge',()=>{
 const g=make();cast(g,touch());adjacent(g);g.dispatch({op:'gm_discharge_touch_spell',actor:'hero',target:'warden',reason:'Creature brushed caster'},'gm');assert.equal(g.find('warden').hp,193);assert(!g.heldTouch('hero'));
 const h=make();cast(h,touch());h.dispatch({op:'gm_discharge_touch_spell',actor:'hero',reason:'Touched a door'},'gm');assert(!h.heldTouch('hero'));assert.equal(h.find('warden').hp,200);
});
test('natural weapon contact adds the held spell without charging another action',()=>{
 const g=make();g.find('hero').attacks=[{label:'Claw',attackKind:'natural',naturalAttack:'claw',damageDie:4}];cast(g,touch({castingTime:'swift'}));adjacent(g);g.s.testRolls=[10,2];const r=g.dispatch({op:'attack',actor:'hero',target:'warden'});assert(r.touchSpell);assert.equal(g.find('warden').hp,188);assert.equal(g.s.actions.resources.standard,0);assert(!g.heldTouch('hero'));
});
test('a natural-weapon critical does not double a separately discharged spell',()=>{
 const g=make();g.find('hero').attacks=[{label:'Claw',attackKind:'natural',naturalAttack:'claw',damageDie:4}];cast(g,touch({castingTime:'swift'}));adjacent(g);g.s.testRolls=[20,10,2,3];g.dispatch({op:'attack',actor:'hero',target:'warden'});assert.equal(g.find('warden').hp,182);
});
test('a weapon hit does not pretend the caster made physical contact',()=>{
 const g=make();cast(g,touch({castingTime:'swift'}));adjacent(g);g.s.testRolls=[10,2];g.dispatch({op:'attack',actor:'hero',target:'warden'});assert(g.heldTouch('hero'));
});
test('explicit multi-charge spells decrement the same event and cache SR per target',()=>{
 const g=make();cast(g,touch({castingTime:'swift',delivery:{type:'touch',charges:2},spellResistance:true}));adjacent(g);g.find('warden').spellResistance=1;g.s.testRolls=[10,10];deliver(g);const id=g.heldTouch('hero').id;g.s.testRolls=[10];deliver(g);assert(!g.heldTouch('hero'));assert.equal(g.s.pendingEventHistory.at(-1).id,id);assert.equal(g.find('warden').hp,186);assert.equal(g.s.testRolls.length,0);
});
test('ray uses ranged touch statistics and applies only the spell payload',()=>{
 const g=make();g.find('hero').dex=20;g.find('hero').str=8;g.find('warden').armor=100;g.find('warden').natural=100;g.s.testRolls=[2];const r=cast(g,ray());assert.equal(r.status,'resolved');assert.equal(r.resolution.rays[0].attack.total,12);assert.equal(g.find('warden').hp,193);assert.equal(g.s.actions.resources.standard,0);assert(!g.heldTouch('hero'));
});
test('ray misses spend casting and cannot be held or retried',()=>{
 const g=make();g.s.testRolls=[1];const r=cast(g,ray());assert.equal(r.resolution.rays[0].attack.hit,false);assert.equal(g.find('warden').hp,200);assert(!g.heldTouch('hero'));assert.throws(()=>deliver(g),/No held/);
});
test('ray maximum range and solid-wall failures are atomic before casting',()=>{
 for(const blocked of ['range','wall']){const g=make();if(blocked==='wall')g.s.tiles['3,3']='wall';const before=clone(g.s);assert.throws(()=>cast(g,ray(blocked==='range'?{delivery:{type:'ray',rangeFeet:5}}:{})),/range|cover/);assert.deepEqual(g.s,before);}
});
test('multiple rays roll independently and make one SR check per creature for the same casting',()=>{
 const g=make();g.find('warden').spellResistance=1;g.s.testRolls=[10,2,10,10,3];const r=cast(g,ray({targets:['warden','warden'],spellResistance:true,components:[{damageType:'fire',dice:{count:1,sides:6}}]}));assert.equal(r.resolution.rays.length,2);assert.equal(g.find('warden').hp,195);assert.equal(g.s.testRolls.length,0);
});
test('a simultaneous ray volley does not roll back when an earlier ray downs its target',()=>{
 const g=make();g.find('warden').hp=3;g.s.testRolls=[10,10];const r=cast(g,ray({targets:['warden','warden']}));assert.equal(r.resolution.rays.length,2);assert.equal(g.find('warden').hp,-11);assert.equal(g.healthState('warden').status,'dying');assert.equal(g.s.actions.resources.standard,0);
});
test('separate rays mitigate their own damage separately',()=>{
 const g=make();g.find('warden').protections={resistances:{fire:5}};g.s.testRolls=[10,10];cast(g,ray({targets:['warden','warden'],components:[{damageType:'fire',amount:7}]}));assert.equal(g.find('warden').hp,196);
});
test('ray delivery provokes after defensive casting but costs no additional action',()=>{
 const g=make();adjacent(g);g.s.testRolls=[20];const r=cast(g,ray({defensive:true,concentrationBonus:100}));assert.equal(r.status,'interrupt');assert.equal(g.s.interrupt.type,'ranged_action_aoo');assert.equal(g.s.pendingRangedAction.kind,'spell');g.s.testRolls=[10];const out=g.dispatch({op:'resolve_interrupt',take:false});assert.equal(out.status,'resolved');assert.equal(g.find('warden').hp,193);assert.equal(g.s.actions.resources.standard,0);
});
test('casting and ray delivery are two distinct opportunities with real per-creature budgets',()=>{
 const g=make();adjacent(g);g.find('warden').flags.combatReflexes=true;g.find('warden').dex=14;let r=cast(g,ray());assert.equal(r.status,'needs_gm');g.s.testRolls=[1];g.dispatch({op:'gm_resolve_casting_aoo',actor:'warden',take:true},'gm');r=g.dispatch({op:'gm_continue_spell'},'gm');assert.equal(r.status,'interrupt');g.s.testRolls=[1,10];r=g.dispatch({op:'resolve_interrupt',take:true});assert.equal(g.s.aooUsed.warden,2);assert.equal(r.status,'resolved');assert.equal(g.find('warden').hp,193);
});
test('one ray volley offers one delivery opportunity, not one per ray',()=>{
 const g=make();adjacent(g);g.s.testRolls=[20];cast(g,ray({defensive:true,concentrationBonus:100,targets:['warden','warden']}));g.s.testRolls=[1,10,10];const r=g.dispatch({op:'resolve_interrupt',take:true});assert.equal(r.rays.length,2);assert.equal(g.s.aooUsed.warden,1);assert.equal(g.find('warden').hp,186);
});
test('delivery opportunity damage does not retroactively require casting concentration',()=>{
 const g=make();adjacent(g);g.s.testRolls=[20];cast(g,ray({defensive:true,concentrationBonus:100}));g.s.testRolls=[10,1,10];const r=g.dispatch({op:'resolve_interrupt',take:true});assert.equal(r.status,'resolved');assert.equal(g.find('hero').hp,31);assert.equal(g.s.testRolls.length,0);
});
test('a barrier introduced during the opportunity blocks rays without refunding the cast',()=>{
 const g=make();adjacent(g);g.s.testRolls=[20];cast(g,ray({defensive:true,concentrationBonus:100}));g.s.tiles['2,3']='wall';const r=g.dispatch({op:'resolve_interrupt',take:false});assert.equal(r.rays[0].status,'blocked');assert.equal(g.find('warden').hp,200);assert.equal(g.s.actions.resources.standard,0);assert.equal(g.s.pendingRangedAction,null);
});
test('incapacitating the caster at delivery prevents all rays',()=>{
 const g=make();adjacent(g);g.find('hero').hp=1;g.s.testRolls=[20];cast(g,ray({defensive:true,concentrationBonus:100}));g.s.testRolls=[10,1];const r=g.dispatch({op:'resolve_interrupt',take:true});assert.equal(r.status,'stopped');assert.equal(g.find('warden').hp,200);assert.equal(g.s.pendingRangedAction,null);
});
test('long touch casting can deliver as part of completion without spending the next turn',()=>{
 const g=make();cast(g,touch({castingTime:'1_round',delivery:{type:'touch',attemptOnCast:true},targets:['warden']}));round(g);adjacent(g);g.s.testRolls=[10];const r=g.dispatch({op:'complete_spell',actor:'hero'});assert.equal(r.status,'resolved');assert.equal(g.find('warden').hp,193);assert.equal(g.s.deferredTurnStart,null);assert.equal(g.s.actions.resources.standard,1);
});
test('long ray casting holds the pre-turn checkpoint through the delivery opportunity',()=>{
 const g=make();cast(g,ray({castingTime:'1_round'}));round(g);adjacent(g);const r=g.dispatch({op:'complete_spell',actor:'hero'});assert.equal(r.status,'interrupt');assert(g.s.deferredTurnStart);g.s.testRolls=[10];g.dispatch({op:'resolve_interrupt',take:false});assert.equal(g.s.deferredTurnStart,null);assert.equal(g.find('warden').hp,193);assert.equal(g.s.actions.resources.standard,1);
});
test('holding and ray-delivery suspension survive serialization and undo',()=>{
 const g=make();cast(g,touch());const h=new MagicGame(g.exportState());assert.equal(h.heldTouch('hero').payload.spell.name,'Synthetic touch');g.dispatch({op:'undo_turn'},'gm');assert.equal(g.s.pendingEvents.length,0);assert.equal(g.s.actions.resources.standard,1);
 adjacent(g);g.s.testRolls=[20];cast(g,ray({defensive:true,concentrationBonus:100}));const j=new MagicGame(g.exportState());j.s.testRolls=[10];assert.equal(j.dispatch({op:'resolve_interrupt',take:false}).status,'resolved');
});
test('a caster does not threaten while performing a long casting',()=>{
 const g=make();cast(g,touch({castingTime:'1_round'}));adjacent(g);assert.equal(g.threatens('hero','warden'),false);round(g);g.dispatch({op:'complete_spell',actor:'hero'});assert.equal(g.threatens('hero','warden'),true);
});
test('continuing a long casting does not offer another casting AoO',()=>{
 const g=make();cast(g,touch({castingTime:{count:2,unit:'round'}}));round(g);adjacent(g);assert.equal(g.dispatch({op:'continue_spell',actor:'hero'}).status,'casting');assert.equal(g.s.pendingSpellCast,null);
});
test('spell precision shares one fortification roll and is not multiplied by a critical',()=>{
 const g=make();g.find('warden').protections={fortification:25};g.s.testRolls=[20,10,90,2,3,4];const r=cast(g,ray({components:[{damageType:'fire',dice:{count:1,sides:6},precision:{count:1,sides:6}}]}));assert(r.resolution.rays[0].attack.criticalHit);assert.equal(g.find('warden').hp,191);assert.equal(g.s.testRolls.length,0);
});
test('concealment suppresses attached spell precision even on a successful hit',()=>{
 const g=make();g.find('warden').defenseProfile={concealment:20};g.s.testRolls=[10,90];cast(g,ray({components:[{damageType:'fire',amount:7,precision:{count:1,sides:6}}]}));assert.equal(g.find('warden').hp,193);assert.equal(g.s.testRolls.length,0);
});
test('nauseated cannot turn a charged free touch or a move-action spell into an attack',()=>{
 const g=make();cast(g,touch());adjacent(g);g.dispatch({op:'apply_condition',target:'hero',condition:'nauseated'},'gm');const before=clone(g.s);
 assert.throws(()=>deliver(g),/Nauseated/);assert.deepEqual(g.s,before);assert.throws(()=>cast(g,ray({castingTime:'move'})),/Nauseated/);assert.deepEqual(g.s,before);
});
test('ray delivery uses the same condition gate as pending ranged attacks',()=>{
 const g=make();g.dispatch({op:'apply_condition',target:'hero',condition:'nauseated'},'gm');g.s.testRolls=[10];const r=g.dispatch({op:'gm_resolve_spell',actor:'hero',spell:ray()},'gm');assert.equal(r.status,'stopped');assert.equal(g.find('warden').hp,200);assert.equal(g.s.testRolls.length,1);
});
test('shared condition context lowers a prone target defense for melee touch delivery',()=>{
 const g=make();cast(g,touch({delivery:{type:'touch',attackOffset:-2}}));adjacent(g);g.dispatch({op:'apply_condition',target:'warden',condition:'prone'},'gm');g.s.testRolls=[2];const r=deliver(g);assert(r.attack.hit);assert.equal(r.attack.targetDefense,6);assert.equal(g.find('warden').hp,193);assert.equal(g._attackContext,undefined);
});
test('the same condition context raises prone target defense against ray attacks',()=>{
 const g=make();g.dispatch({op:'apply_condition',target:'warden',condition:'prone'},'gm');g.s.testRolls=[3];const r=cast(g,ray());assert.equal(r.resolution.rays[0].attack.hit,false);assert.equal(g.find('warden').hp,200);assert.equal(g._attackContext,undefined);
});
test('malformed deliveries cannot spend resources or install a held event',()=>{
 for(const delivery of [{type:'touch',extra:true},{type:'touch',charges:0},{type:'ray',rangeFeet:30,charges:2},{type:'ray'},{type:'touch',rangeFeet:30}]){const g=make(),before=clone(g.s);assert.throws(()=>cast(g,touch({delivery})));assert.deepEqual(g.s,before);}
});
console.log(`V3.25 spell delivery: ${count} groups passing`);
