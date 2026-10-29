import assert from 'node:assert/strict';
import {Kernel,initialState} from './kernel.mjs';
import {clone} from './core.mjs';
const gm=(g,c)=>g.dispatch(c,'gm');
const make=(init=false)=>{const s=initialState();s.tiles={};Object.assign(s.creatures[0],{x:0,y:3,hp:200,maxHp:200});Object.assign(s.creatures[1],{x:5,y:3,size:1,reach:1,hp:200,maxHp:200});const g=new Kernel(s);if(init)gm(g,{op:'gm_begin_initiative',scores:{hero:20,warden:10}});return g;};
const shape={shape:'sphere',mode:'spread',origin:{x:5,y:3},sizeFeet:10};
const spell=(persistent={},extra={})=>({name:'Synthetic lingering region',level:2,casterLevel:5,area:clone(shape),components:[{damageType:'fire',amount:2}],persistent:{duration:{count:3,unit:'round'},...persistent},...extra});
const create=(g,p={},extra={},actor='hero')=>gm(g,{op:'gm_resolve_spell',actor,spell:spell(p,extra)});
const advance=(g,count=1)=>gm(g,{op:'gm_advance_time',count,unit:'round'});
const teleport=(g,target,x,y=3)=>gm(g,{op:'teleport',target,x,y,reason:'Regression relocation'});
const turn=g=>g.dispatch({op:'end_turn'});
const cancel=(g,id)=>gm(g,{op:'gm_cancel_pending_event',id,reason:'Remove region'});
const dispel=(g,target,actor='hero',extra={})=>gm(g,{op:'gm_resolve_spell',actor,spell:{name:'Dispel magic',level:3,casterLevel:5,targets:[target],dispel:{},...extra}});
let count=0;const test=(name,fn)=>{try{fn();count++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}};
test('one native Pending Event owns geometry, payload and expiration; inspection is pure',()=>{
 const g=make(),r=create(g),e=g.persistentAreaEvent(r.areaId);assert.equal(g.s.pendingEvents.length,1);assert.equal(e.kind,'persistent_area');assert.equal(e.actor,null);
 assert(!('persistentAreas' in g.s));assert.equal(g.find('warden').hp,198);
 const before=clone(g.s),v=gm(g,{op:'gm_get_persistent_areas'});assert.equal(v[0].id,r.areaId);assert(v[0].cells.length);assert.deepEqual(g.s,before);
 assert(g.lifecycleStatus().deadlines.some(d=>d.kind==='pending_event'&&d.id===r.areaId));
 assert.throws(()=>g.dispatch({op:'gm_get_persistent_areas'},'actor'),/Only GM/);
});
test('normal casting pays a standard action, repeat exposures do not',()=>{
 const g=make(),r=g.dispatch({op:'cast_spell',actor:'hero',spell:spell()});assert.equal(r.resolution.status,'persistent_area');assert.equal(g.s.actions.resources.standard,0);
 const budget=clone(g.s.actions.resources);advance(g);assert.deepEqual(g.s.actions.resources,budget);assert.equal(g.find('warden').hp,196);
});
test('registered casting expends one slot and keeps capacity frozen across repeated exposures',()=>{
 const g=make();g.find('hero').int=18;
 gm(g,{op:'gm_set_spellcasting',actor:'hero',reason:'Regression spell book',book:{id:'clouds',name:'Test caster',mode:'spontaneous',ability:'int',casterLevel:5,
 pools:[{id:'general',allotment:{type:'derived',abilityScore:18,base:{2:1}}}],spells:[{id:'cloud',name:'Synthetic lingering region',level:2}]}});
 g.dispatch({op:'cast_spell',actor:'hero',spell:spell({}, {resource:{book:'clouds',spell:'cloud',pool:'general',slotLevel:2}})});
 const after=clone(g.s.spellResources);advance(g,2);assert.deepEqual(g.s.spellResources,after);assert.equal(g.s.spellResources[0].pools[0].spent[2],1);
});
test('creation can be disabled; entry does not retroactively hit initial occupants',()=>{
 const g=make(),r=create(g,{triggers:['enter']});assert.equal(r.initial,null);assert.equal(g.find('warden').hp,200);g.syncZones();assert.equal(g.find('warden').hp,200);
 teleport(g,'warden',8);teleport(g,'warden',5);assert.equal(g.find('warden').hp,198);
});
test('movement within an area does not count as another entry',()=>{
 const g=make();create(g);teleport(g,'warden',6);teleport(g,'warden',5);assert.equal(g.find('warden').hp,198);
});
test('default cooldown prevents same-round exit/re-entry and turn-start damage duplication',()=>{
 const g=make();create(g);teleport(g,'warden',8);teleport(g,'warden',5);turn(g);assert.equal(g.find('warden').hp,198);turn(g);turn(g);assert.equal(g.find('warden').hp,196);
});
test('each_trigger explicitly permits repeated entry and turn exposures',()=>{
 const g=make();create(g,{frequency:'each_trigger'});teleport(g,'warden',8);teleport(g,'warden',5);turn(g);assert.equal(g.find('warden').hp,194);
});
test('turn-start-only areas affect the occupant at its own turn, not another turn',()=>{
 const g=make(true);create(g,{triggers:['turn_start']});assert.equal(g.find('warden').hp,200);turn(g);assert.equal(g.find('warden').hp,198);turn(g);assert.equal(g.find('warden').hp,198);turn(g);assert.equal(g.find('warden').hp,196);
});
test('Fast Forward resolves all occupied-round exposures and expires before a final same-time pulse',()=>{
 const g=make();create(g);const r=advance(g,10);assert.equal(r.status,'done');assert.equal(r.advancedRounds,10);assert.equal(g.find('warden').hp,194);assert.equal(g.persistentAreaEvents().length,0);assert.equal(g.nextTimeEvent(),null);
});
test('empty long-lived areas jump directly to expiry without per-round ticks',()=>{
 const g=make();teleport(g,'warden',8);create(g,{duration:{count:100000,unit:'round'}});const r=gm(g,{op:'gm_advance_to_event'});assert.equal(r.advancedRounds,100000);assert.equal(g.persistentAreaEvents().length,0);
});
test('inside-only modifiers end on exit and restore on re-entry without another damage roll',()=>{
 const g=make(),base=g.stat('warden','attack');create(g,{}, {effect:{rounds:9,mods:[{stat:'attack',value:2,type:'luck'}]}});assert.equal(g.stat('warden','attack'),base+2);
 teleport(g,'warden',8);assert.equal(g.stat('warden','attack'),base);teleport(g,'warden',5);assert.equal(g.stat('warden','attack'),base+2);assert.equal(g.find('warden').hp,198);assert.equal(g.s.effects.length,1);
 advance(g);assert.equal(g.s.effects.length,1);advance(g,2);assert.equal(g.stat('warden','attack'),base);assert.equal(g.s.effects.length,0);
});
test('independently timed exposure modifiers survive exit and region removal, then expire normally',()=>{
 const g=make(),base=g.stat('warden','attack');const r=create(g,{effectScope:'duration'},{effect:{rounds:2,mods:[{stat:'attack',value:2,type:'luck'}]}});
 teleport(g,'warden',8);cancel(g,r.areaId);assert.equal(g.stat('warden','attack'),base+2);advance(g,2);assert.equal(g.stat('warden','attack'),base);assert.equal(g.nextTimeEvent(),null);
});
test('overlapping regions retain separate identities and remove only their own modifiers',()=>{
 const g=make(),base=g.stat('warden','attack'),extra={effect:{rounds:4,mods:[{stat:'attack',value:2,type:'luck'}]}};
 const a=create(g,{},extra),b=create(g,{},extra);assert.notEqual(a.areaId,b.areaId);assert.notEqual(a.castingId,b.castingId);assert.equal(g.s.effects.length,2);assert.equal(g.stat('warden','attack'),base+2);
 cancel(g,a.areaId);assert.equal(g.s.effects.length,1);assert.equal(g.stat('warden','attack'),base+2);cancel(g,b.areaId);assert.equal(g.stat('warden','attack'),base);assert.equal(g.find('warden').hp,196);
});
test('initiative expiry honors an empty count before the next occupant turn',()=>{
 const g=make(true);create(g,{duration:{count:1,unit:'round',atScore:15},triggers:['turn_start']});turn(g);assert.equal(g.find('warden').hp,198);turn(g);assert.equal(g.persistentAreaEvents().length,1);turn(g);assert.equal(g.persistentAreaEvents().length,0);assert.equal(g.find('warden').hp,198);
});
test('ending initiative migrates the same area timer and permits downtime exposures',()=>{
 const g=make(true),r=create(g);gm(g,{op:'gm_end_initiative'});assert.equal(g.persistentAreaEvent(r.areaId).duration.type,'time');assert.equal(g.s.pendingEvents.length,1);advance(g,3);assert.equal(g.persistentAreaEvents().length,0);assert.equal(g.find('warden').hp,194);
});
test('caster movement and defeat do not move or terminate its fixed region',()=>{
 const g=make(),r=create(g);teleport(g,'hero',1);gm(g,{op:'admin_damage',target:'hero',amount:200,damageType:'fire'});assert.equal(g.persistentAreaEvents().length,1);assert.deepEqual(g.persistentAreaEvent(r.areaId).payload.spell.area.origin,shape.origin);advance(g);assert.equal(g.find('warden').hp,196);
});
test('summoned caster removal preserves the area and bound modifiers, including after restore',()=>{
 const g=make();gm(g,{op:'gm_mark_summon',target:'hero',duration:{count:1,unit:'round'},reason:'Test summoned caster'});
 const r=create(g,{}, {effect:{rounds:8,mods:[{stat:'attack',value:2,type:'luck'}]}});advance(g);assert(!g.s.creatures.some(c=>c.id==='hero'));assert(g.persistentAreaEvent(r.areaId));assert.equal(g.s.effects.length,1);assert.equal(g.s.effects[0].source,null);assert.equal(g.find('warden').hp,196);
 const restored=new Kernel(g.exportState());advance(restored,2);assert.equal(restored.find('warden').hp,194);assert.equal(restored.s.effects.length,0);assert.equal(restored.persistentAreaEvents().length,0);
});
test('SR result is cached for one region/recipient while repeat saves and mitigation use existing resolvers',()=>{
 const g=make();g.find('warden').spellResistance=30;g.s.testRolls=[1];create(g,{}, {spellResistance:true});assert.equal(g.find('warden').hp,200);g.s.testRolls=[20];advance(g,2);assert.equal(g.find('warden').hp,200);assert.deepEqual(g.s.testRolls,[20]);
 const h=make();h.s.testRolls=[20,1];create(h,{}, {save:{type:'ref',dc:15,onSuccess:'half'}});assert.equal(h.find('warden').hp,199);advance(h);assert.equal(h.find('warden').hp,197);
});
test('damage dice are shared across simultaneous targets and rerolled at the next exposure',()=>{
 const g=make();teleport(g,'hero',4);g.s.testRolls=[3,5];create(g,{}, {components:[{damageType:'fire',dice:{count:1,sides:6}}]});assert.equal(g.find('hero').hp,197);assert.equal(g.find('warden').hp,197);advance(g);assert.equal(g.find('hero').hp,192);assert.equal(g.find('warden').hp,192);assert.deepEqual(g.s.testRolls,[]);
});
test('team filtering and wall-aware spread geometry are reused',()=>{
 const g=make();teleport(g,'hero',4);create(g,{affects:'enemies'});assert.equal(g.find('hero').hp,200);assert.equal(g.find('warden').hp,198);
 const h=make();for(let y=0;y<h.s.height;y++)h.s.tiles[`4,${y}`]='wall';create(h,{}, {area:{...shape,mode:'burst',origin:{x:3,y:3},sizeFeet:30}});assert.equal(h.find('warden').hp,200);
});
test('area entry immediately stops movement if its payload defeats the mover',()=>{
 const g=make();teleport(g,'hero',2);teleport(g,'warden',8);create(g,{triggers:['enter']},{area:{shape:'sphere',origin:{x:4,y:3},sizeFeet:5},components:[{damageType:'fire',amount:300}]});
 g.dispatch({op:'move',actor:'hero',path:[{x:3,y:3},{x:4,y:3},{x:5,y:3}]});assert.equal(g.find('hero').hp,-100);assert.equal(g.healthState('hero').status,'dead');assert.equal(g.find('hero').x,3);assert.equal(g.s.pendingMove,null);
});
test('self-dispel targets a region through the existing spell resolver and clears bound effects',()=>{
 const g=make(),r=create(g,{}, {effect:{rounds:9,mods:[{stat:'attack',value:2,type:'luck'}]}});const out=dispel(g,r.areaId);assert.equal(out.dispelled.length,1);assert(out.checks[0].automatic);assert.equal(g.persistentAreaEvents().length,0);assert.equal(g.s.effects.length,0);assert.equal(g.find('warden').hp,198);
});
test('hostile dispels use the original caster level; failure and non-dispellable regions persist',()=>{
 const g=make(),r=create(g,{}, {},'warden');g.s.testRolls=[1];assert.equal(dispel(g,r.areaId).dispelled.length,0);g.s.testRolls=[20];assert.equal(dispel(g,r.areaId).dispelled.length,1);
 const h=make(),a=create(h,{dispellable:false});assert.equal(dispel(h,a.areaId).checks.length,0);assert(h.persistentAreaEvent(a.areaId));
});
test('area dispels respect range and line of effect',()=>{
 const g=make(),r=create(g);assert.equal(dispel(g,r.areaId,'hero',{rangeFeet:5}).status,'blocked');
 for(let y=0;y<g.s.height;y++)g.s.tiles[`3,${y}`]='wall';assert.equal(dispel(g,r.areaId).status,'blocked');assert(g.persistentAreaEvent(r.areaId));
});
test('area expiry during long dispel casting resolves as a lost target rather than an invalid command',()=>{
 const g=make(true),r=create(g,{duration:{count:1,unit:'round'}});g.dispatch({op:'cast_spell',actor:'hero',spell:{name:'Slow dispel',level:3,casterLevel:5,castingTime:'1_round',targets:[r.areaId],dispel:{}}});turn(g);turn(g);
 const out=g.dispatch({op:'complete_spell',actor:'hero'});assert.equal(out.resolution.status,'blocked');assert.match(out.resolution.reason,/no longer exists/);assert.equal(g.s.activeSpellCasts.length,0);
});
test('area modifier expiration precedes an ailment saving throw at the same clock deadline',()=>{
 const g=make();create(g,{duration:{count:1,unit:'round'}},{components:[],effect:{rounds:9,mods:[{stat:'fort',value:100,type:'luck'}]}});
 gm(g,{op:'register_ailment',definition:{id:'poison',name:'Test poison',kind:'poison',delivery:'contact',save:{type:'fort',dc:30,initial:false},frequency:{every:{count:1,unit:'round'},maxTicks:1},effects:[{kind:'hp',dice:{count:1,sides:2},damageType:'untyped'}]}});
 gm(g,{op:'expose_ailment',definition:'poison',target:'warden'});const hp=g.find('warden').hp;g.s.testRolls=[10,2];const r=advance(g);assert.equal(r.ticks.length,1);assert.equal(r.ticks[0].save.success,false);assert.equal(g.find('warden').hp,hp-2);
});
test('spawning a creature inside a region uses its initialized traits before entry damage',()=>{
 const g=make();create(g,{triggers:['enter']});gm(g,{op:'register_creature',definition:{id:'devil',name:'Test devil',creatureType:'outsider',subtypes:['devil'],stats:{maxHp:10}}});
 gm(g,{op:'spawn_creature',definition:'devil',id:'visitor',x:5,y:2});assert.equal(g.find('visitor').hp,10);assert(g.persistentAreaEvents()[0].payload.present.includes('visitor'));
});
test('time checkpoints see expired inside-only modifiers and read-only views remain accessible',()=>{
 const g=make(),r=create(g,{duration:{count:1,unit:'round'}},{effect:{rounds:9,mods:[{stat:'attack',value:2,type:'luck'}]}});
 gm(g,{op:'gm_schedule_time_event',id:'review',label:'Review at expiry',after:{count:1,unit:'round'}});const result=advance(g);assert.equal(result.status,'needs_gm');assert(!g.persistentAreaEvent(r.areaId));assert.equal(g.s.effects.length,0);const before=clone(g.s);gm(g,{op:'gm_get_persistent_areas'});assert.deepEqual(g.s,before);
});
test('undo and restored states preserve exact occupancy, cooldown and deadlines',()=>{
 const g=make(),r=create(g);const saved=g.exportState(),restored=new Kernel(saved);teleport(restored,'warden',8);teleport(restored,'warden',5);assert.equal(restored.find('warden').hp,198);advance(restored);assert.equal(restored.find('warden').hp,196);
 gm(g,{op:'undo_turn'});assert.equal(g.persistentAreaEvents().length,0);assert.equal(g.s.effects.length,0);assert.equal(g.nextTimeEvent(),null);assert(!g.s.pendingEvents.some(e=>e.id===r.areaId));
});
test('invalid setup and forged native timers roll back state and RNG',()=>{
 for(const p of [{duration:{count:0,unit:'round'}},{triggers:['leave']},{triggers:[]},{frequency:'guess'},{effectScope:'forever'},{duration:{count:1,unit:'round',atScore:10}},{unknown:1}]){
  const g=make(),before=clone(g.s);assert.throws(()=>create(g,p));assert.deepEqual(g.s,before);
 }
 const g=make(),before=clone(g.s);assert.throws(()=>gm(g,{op:'gm_register_pending_event',id:'forged',label:'Forged',trigger:'timer',kind:'persistent_area',duration:{type:'time',count:1,unit:'round'},requiresInput:false,payload:{}}),/through a spell/);assert.deepEqual(g.s,before);
 const r=create(g);const after=clone(g.s);assert.throws(()=>gm(g,{op:'gm_trigger_pending_event',id:r.areaId}),/trigger mechanically/);assert.deepEqual(g.s,after);
});
console.log(`V3.30 persistent areas: ${count} groups passed`);
