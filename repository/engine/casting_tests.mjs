import assert from 'node:assert/strict';
import {initialState,clone} from './core.mjs';
import {MagicGame} from './magic.mjs';
const make=(initiative=true)=>{
 const s=initialState();s.tiles={};s.creatures[0].x=1;s.creatures[0].y=3;s.creatures[1].size=1;s.creatures[1].x=7;s.creatures[1].y=3;
 const g=new MagicGame(s);if(initiative)g.dispatch({op:'gm_begin_initiative',scores:{hero:20,warden:5}},'gm');return g;
};
const spell=(extra={})=>({name:'Casting test',level:1,casterLevel:5,castingTime:'1_round',targets:['warden'],components:[{damageType:'force',amount:3}],concentrationBonus:20,...extra});
const start=(g,extra={})=>g.dispatch({op:'cast_spell',actor:'hero',spell:spell(extra)},'actor');
const nextRound=g=>{g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});};
let count=0;function test(name,fn){try{fn();count++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}}
test('1-round cast spends full-round action and has no immediate effect',()=>{
 const g=make(),r=start(g);assert.equal(r.status,'casting');assert.equal(g.find('warden').hp,65);assert.deepEqual(g.s.actions.resources,{standard:0,move:0,swift:1});
 assert.throws(()=>g.dispatch({op:'complete_spell',actor:'hero'}),/completion point/);
});
test('full_round action remains immediate and differs from 1_round',()=>{
 const g=make();assert.equal(start(g,{castingTime:'full_round'}).status,'resolved');assert.equal(g.find('warden').hp,62);assert.equal(g.s.activeSpellCasts.length,0);
});
test('completion is before next caster turn and leaves normal actions available',()=>{
 const g=make();start(g);g.installRule({id:'start_hit',owner:'hero',on:'turn_start',when:[{op:'eq',left:{ref:'event.actor'},right:'hero'}],actions:[{op:'deal_damage',target:'warden',amount:2,damageType:'force'}]},{persistSnapshot:false});
 nextRound(g);assert.equal(g.s.activeSpellCasts[0].status,'ready');assert(g.s.deferredTurnStart);assert.equal(g.find('warden').hp,65);
 assert.throws(()=>g.dispatch({op:'attack',actor:'hero',target:'warden'}),/pre-turn|Complete/);
 const r=g.dispatch({op:'complete_spell',actor:'hero'});assert.equal(r.status,'resolved');assert.equal(g.find('warden').hp,60);assert.equal(g.s.deferredTurnStart,null);assert.equal(g.s.actions.resources.standard,1);
});
test('targets can change at completion, preserving other spell fields',()=>{
 const g=make();start(g);nextRound(g);g.dispatch({op:'complete_spell',actor:'hero',targets:['hero']});assert.equal(g.find('hero').hp,37);assert.equal(g.find('warden').hp,65);
});
test('bad completion is atomic and can be retried',()=>{
 const g=make();start(g);nextRound(g);const before=clone(g.s);assert.throws(()=>g.dispatch({op:'complete_spell',actor:'hero',targets:['missing']}),/targets/);assert.deepEqual(g.s,before);g.dispatch({op:'complete_spell',actor:'hero'});
});
test('multi-round casts pay one full-round action on each consecutive turn',()=>{
 const g=make();start(g,{castingTime:{count:3,unit:'round'}});nextRound(g);
 assert.throws(()=>g.dispatch({op:'use_action',actor:'hero',type:'standard',label:'Other'}),/Continue or cancel/);
 let r=g.dispatch({op:'continue_spell',actor:'hero'});assert.equal(r.cast.roundsPaid,2);
 assert.throws(()=>g.dispatch({op:'continue_spell',actor:'hero'}),/already paid/);
 nextRound(g);g.dispatch({op:'continue_spell',actor:'hero'});nextRound(g);assert.equal(g.s.activeSpellCasts[0].status,'ready');g.dispatch({op:'complete_spell',actor:'hero'});assert.equal(g.find('warden').hp,62);
});
test('skipping continuation loses the spell instead of preserving free progress',()=>{
 const g=make();start(g,{castingTime:{count:2,unit:'round'}});nextRound(g);g.dispatch({op:'end_turn'});assert.equal(g.s.activeSpellCasts.length,0);assert.match(g.s.spellCastHistory.at(-1).reason,/skipped/);assert.equal(g.find('warden').hp,65);
});
test('another spell, delay, or encounter mode change cannot bypass casting',()=>{
 const g=make();start(g);
 for(const cmd of [{op:'cast_spell',actor:'hero',spell:spell({castingTime:'swift'})},{op:'delay_turn'},{op:'gm_end_initiative'}]){
  const before=clone(g.s);assert.throws(()=>g.dispatch(cmd,'gm'),/concentrating|ongoing casting/);assert.deepEqual(g.s,before);
 }
});
test('five-foot step remains available during the paid full-round casting action',()=>{
 const g=make();start(g);g.dispatch({op:'move',actor:'hero',path:[{x:2,y:3}],step:true});assert.equal(g.find('hero').x,2);assert.equal(g.s.activeSpellCasts.length,1);
});
test('failed automatic injury concentration loses an in-progress spell',()=>{
 const g=make();start(g,{concentrationBonus:0});g.s.testRolls=[1];const r=g.dispatch({op:'gm_resolve_damage',target:'hero',source:'warden',amount:4,damageType:'force'},'gm');assert.equal(r.casting.status,'lost');assert.equal(r.casting.concentration.dc,15);assert.equal(g.s.activeSpellCasts.length,0);assert.equal(g.find('hero').hp,36);
});
test('separate damage sources each check concentration and keep successful casting',()=>{
 const g=make();start(g);g.s.testRolls=[1,2];
 for(const amount of [3,7]){const r=g.dispatch({op:'gm_resolve_damage',target:'hero',amount,damageType:'force'},'gm');assert.equal(r.casting.concentration.dc,11+amount);assert.equal(r.casting.status,'casting');}
 assert.equal(g.s.activeSpellCasts[0].injuries.length,2);
});
test('fully resisted damage does not roll concentration',()=>{
 const g=make();g.find('hero').protections={resistances:{fire:10}};start(g);g.s.testRolls=[1];g.dispatch({op:'gm_resolve_damage',target:'hero',amount:4,damageType:'fire'},'gm');assert.equal(g.s.testRolls.length,1);assert.equal(g.s.activeSpellCasts[0].injuries.length,0);
});
test('multi-component packet causes one check after mitigation',()=>{
 const g=make();start(g);g.s.testRolls=[10];const r=g.dispatch({op:'gm_resolve_packet',target:'hero',components:[{damageType:'force',amount:2},{damageType:'fire',amount:3}]},'gm');assert.equal(r.casting.concentration.dc,16);assert.equal(g.s.activeSpellCasts[0].injuries.length,1);
});
test('temporary HP damage still requires concentration',()=>{
 const g=make();g.s.energyTempHp.hero=[{amount:10,expiresAt:100}];start(g);g.s.testRolls=[10];const r=g.dispatch({op:'gm_resolve_damage',target:'hero',amount:4,damageType:'force'},'gm');assert.equal(r.applied,0);assert.equal(r.tempHpAbsorbed,4);assert.equal(r.casting.concentration.dc,15);
});
test('a weapon hit with extra energy damage uses one concentration check',()=>{
 const g=make();g.find('warden').x=2;g.find('warden').damageOther=0;g.find('warden').str=10;start(g,{defensive:true,concentrationBonus:100});
 g.s.testRolls=[10,2,3,1];const r=g.resolveAttack('warden','hero','Test hit',{attackOffset:100,damageDie:6,extraDamage:[{damageType:'fire',count:1,sides:6}]});assert(r.hit);assert.equal(r.casting.concentration.dc,16);assert.equal(g.s.activeSpellCasts[0].injuries.length,1);assert.equal(g.s.testRolls.length,0);
});
test('resumed ranged attacks still group weapon and bonus damage into one check',()=>{
 const g=make();start(g);g.dispatch({op:'end_turn'});
 const guard=clone(g.find('hero'));Object.assign(guard,{id:'guard',name:'Guard',x:6,y:3});g.s.creatures.push(guard);
 const profile={attackMode:'ranged',rangedKind:'projectile',rangeIncrementFeet:100,attackOffset:100,damageDie:6,extraDamage:[{damageType:'fire',count:1,sides:6}]};
 const r=g.resolveAttack('warden','hero','Ranged test',profile);assert.equal(r.status,'interrupt');
 g.s.testRolls=[10,2,3,10];const shot=g.dispatch({op:'resolve_interrupt',take:false},'gm');
 assert(shot.casting);assert.equal(g.s.activeSpellCasts[0].injuries.length,1);assert.equal(g.s.testRolls.length,0);
});
test('two threatening enemies are handled individually and spend real AoOs',()=>{
 const g=make();g.find('warden').x=2;g.find('warden').y=3;
 const enemy=clone(g.find('warden'));Object.assign(enemy,{id:'other',name:'Other',x:1,y:2});g.s.creatures.push(enemy);
 const r=start(g);assert.equal(r.status,'needs_gm');assert.deepEqual(r.threats,['warden','other']);
 g.s.testRolls=[2];g.dispatch({op:'gm_resolve_casting_aoo',actor:'warden',take:true},'gm');assert.equal(g.s.aooUsed.warden,1);
 assert.throws(()=>g.dispatch({op:'gm_resolve_casting_aoo',actor:'warden',take:true},'gm'),/unresolved/);
 assert.throws(()=>g.dispatch({op:'gm_continue_spell'},'gm'),/confirm/);
 g.dispatch({op:'gm_resolve_casting_aoo',actor:'other',take:false},'gm');assert.equal(g.dispatch({op:'gm_continue_spell'},'gm').status,'casting');assert.equal(g.s.pendingSpellCast,null);
});
test('successful automatic AoO injury is not rolled again on resumption',()=>{
 const g=make();g.find('warden').x=2;start(g,{concentrationBonus:100});g.s.testRolls=[10];g.dispatch({op:'gm_resolve_damage',target:'hero',amount:3,damageType:'force'},'gm');
 const before=clone(g.s);assert.throws(()=>g.dispatch({op:'gm_continue_spell',aooResolved:true,damageTaken:3},'gm'),/already checked/);assert.deepEqual(g.s,before);
 assert.equal(g.dispatch({op:'gm_continue_spell',aooResolved:true},'gm').status,'casting');assert.equal(g.s.activeSpellCasts[0].injuries.length,1);
});
test('swift casting does not provoke even while threatened',()=>{
 const g=make();g.find('warden').x=2;assert.equal(start(g,{castingTime:'swift'}).status,'resolved');assert.equal(g.s.pendingSpellCast,null);
});
test('allies and creatures without remaining AoOs are not offered attacks',()=>{
 const g=make();g.find('warden').x=2;g.find('warden').team='party';assert.equal(start(g,{castingTime:'standard'}).status,'resolved');
 const h=make();h.find('warden').x=2;h.s.aooUsed.warden=1;assert.equal(start(h,{castingTime:'standard'}).status,'resolved');
});
test('entangled casting checks concentration and consumes the action on failure',()=>{
 const g=make();g.dispatch({op:'apply_condition',target:'hero',condition:'entangled'},'gm');g.s.testRolls=[1];assert.equal(start(g,{concentrationBonus:0}).reason,'failed entangled concentration');assert.equal(g.s.actions.resources.standard,0);assert.equal(g.s.activeSpellCasts.length,0);
});
test('unconsciousness breaks casting without requiring an injury roll',()=>{
 const g=make();start(g);g.s.testRolls=[1];g.dispatch({op:'apply_condition',target:'hero',condition:'unconscious'},'gm');assert.equal(g.s.activeSpellCasts.length,0);assert.equal(g.s.testRolls.length,1);
});
test('continuous damage concentration can be supplied without dealing damage twice',()=>{
 const g=make();start(g);g.s.testRolls=[10];const hp=g.find('hero').hp;const r=g.dispatch({op:'gm_interrupt_spell',actor:'hero',kind:'continuous_damage',damage:9},'gm');assert.equal(r.concentration.dc,15);assert.equal(g.find('hero').hp,hp);
});
test('explicit unusual distraction can break casting and GM-only commands stay restricted',()=>{
 const g=make();start(g);assert.throws(()=>g.dispatch({op:'gm_interrupt_spell',actor:'hero',dc:100,reason:'Distraction'}),/Only the GM/);g.s.testRolls=[20];assert.equal(g.dispatch({op:'gm_interrupt_spell',actor:'hero',dc:100,reason:'Distraction'},'gm').status,'lost');
});
test('cancellation resolves completion checkpoint without spending normal actions',()=>{
 const g=make();start(g);nextRound(g);g.dispatch({op:'cancel_spell',actor:'hero'});assert.equal(g.s.deferredTurnStart,null);assert.equal(g.s.activeSpellCasts.length,0);assert.equal(g.s.actions.resources.standard,1);
});
test('an imported incapacitated ready caster cannot leave a stuck pre-turn checkpoint',()=>{
 const g=make();start(g);nextRound(g);g.find('hero').hp=-1;const h=new MagicGame(g.exportState());
 assert.equal(h.dispatch({op:'complete_spell',actor:'hero'},'gm').status,'lost');assert.equal(h.s.deferredTurnStart,null);assert.equal(h.s.activeSpellCasts.length,0);
});
test('clock-indexed minute casting finishes at 10 rounds and stops Fast Forward for targeting',()=>{
 const g=make(false);start(g,{castingTime:{count:1,unit:'minute'}});assert(g.dispatch({op:'gm_get_lifecycle'},'gm').deadlines.some(d=>d.kind==='spell_cast'&&d.at===10));
 const r=g.dispatch({op:'gm_advance_time',count:1,unit:'hour'},'gm');assert.equal(r.status,'needs_gm');assert.equal(r.advancedRounds,10);assert.equal(r.remainingRounds,590);assert.equal(g.s.worldRounds,10);assert.equal(g.find('warden').hp,65);
 const before=clone(g.s);assert.throws(()=>g.dispatch({op:'gm_advance_time',count:1,unit:'round'},'gm'),/Finish/);assert.deepEqual(g.s,before);
 g.dispatch({op:'complete_spell',actor:'hero'},'gm');assert.equal(g.find('warden').hp,62);assert.equal(g.s.actions.resources.standard,1);
});
test('Fast Forward can pause before casting completion and resume without losing its deadline',()=>{
 const g=make(false);start(g,{castingTime:{count:1,unit:'minute'}});g.dispatch({op:'gm_schedule_time_event',id:'noise',label:'Noise',after:{count:3,unit:'round'},requiresInput:true},'gm');
 const a=g.dispatch({op:'gm_advance_time',count:1,unit:'minute'},'gm');assert.equal(a.advancedRounds,3);assert.equal(g.s.activeSpellCasts[0].status,'casting');g.dispatch({op:'gm_acknowledge_time_event',reason:'Nothing interrupts casting'},'gm');
 const b=g.dispatch({op:'gm_advance_to_event'},'gm');assert.equal(b.advancedRounds,7);assert.equal(g.s.activeSpellCasts[0].status,'ready');
});
test('partial downtime casting preserves progress if play resumes in turns',()=>{
 const g=make(false);start(g,{castingTime:{count:4,unit:'round'}});g.dispatch({op:'gm_advance_time',count:2,unit:'round'},'gm');
 assert.equal(g.s.activeSpellCasts[0].roundsPaid,2);assert.equal(g.s.activeSpellCasts[0].deadlineAt,4);
 assert.equal(g.dispatch({op:'continue_spell',actor:'hero'}).cast.roundsPaid,3);nextRound(g);g.dispatch({op:'continue_spell',actor:'hero'});nextRound(g);assert.equal(g.s.activeSpellCasts[0].status,'ready');
});
test('failed automatic damage during downtime cancels the pending casting deadline',()=>{
 const g=make(false);start(g,{castingTime:{count:1,unit:'minute'},concentrationBonus:0});g.dispatch({op:'register_ailment',definition:{id:'pain',name:'Pain',kind:'dot',initialEffect:false,frequency:{every:{count:2,unit:'round'},maxTicks:2},effects:[{kind:'hp',dice:{count:0,sides:2,bonus:2},damageType:'force'}]}},'gm');g.dispatch({op:'expose_ailment',target:'hero',definition:'pain'},'gm');g.s.testRolls=[1];
 const r=g.dispatch({op:'gm_advance_time',count:1,unit:'minute'},'gm');assert.equal(r.status,'done');assert.equal(g.s.activeSpellCasts.length,0);assert(!g.dispatch({op:'gm_get_lifecycle'},'gm').deadlines.some(d=>d.kind==='spell_cast'));assert.equal(g.find('warden').hp,65);
});
test('registered continuous damage uses half its last damage for concentration',()=>{
 const g=make(false);g.dispatch({op:'register_ailment',definition:{id:'acid',name:'Acid',kind:'dot',frequency:{every:{count:1,unit:'round'},maxTicks:3},effects:[{kind:'hp',dice:{count:0,sides:2,bonus:9},damageType:'force'}]}},'gm');
 g.dispatch({op:'expose_ailment',target:'hero',definition:'acid'},'gm');g.s.testRolls=[10];start(g,{castingTime:{count:1,unit:'minute'}});assert.equal(g.s.activeSpellCasts[0].injuries[0].concentration.dc,15);
 g.s.testRolls=[10];g.dispatch({op:'gm_advance_time',count:1,unit:'round'},'gm');assert.equal(g.s.activeSpellCasts[0].injuries.at(-1).concentration.dc,15);
});
test('final continuous pulse deals damage but no longer distracts casting',()=>{
 const g=make(false);start(g,{castingTime:{count:1,unit:'minute'},concentrationBonus:0});g.dispatch({op:'register_ailment',definition:{id:'last',name:'Last pulse',kind:'dot',initialEffect:false,frequency:{every:{count:1,unit:'round'},maxTicks:1},effects:[{kind:'hp',dice:{count:0,sides:2,bonus:2},damageType:'force'}]}},'gm');g.dispatch({op:'expose_ailment',target:'hero',definition:'last'},'gm');g.s.testRolls=[1];g.dispatch({op:'gm_advance_time',count:1,unit:'round'},'gm');assert.equal(g.find('hero').hp,38);assert.equal(g.s.testRolls.length,1);assert.equal(g.s.activeSpellCasts.length,1);
});
test('undo restores casting, its paid action, and concentration RNG together',()=>{
 const g=make();start(g);g.dispatch({op:'undo_turn'},'gm');assert.equal(g.s.activeSpellCasts.length,0);assert.equal(g.s.actions.resources.standard,1);
 start(g);nextRound(g);g.dispatch({op:'complete_spell',actor:'hero'});g.dispatch({op:'undo_turn'},'gm');assert.equal(g.find('warden').hp,65);assert.equal(g.s.activeSpellCasts[0].status,'casting');assert.equal(g.active().id,'warden');
});
test('serialization preserves multiple casters and paid progress independently',()=>{
 const g=make();start(g);g.dispatch({op:'end_turn'});g.dispatch({op:'cast_spell',actor:'warden',spell:spell({targets:['hero'],castingTime:{count:2,unit:'round'}})});const h=new MagicGame(g.exportState());assert.equal(h.s.activeSpellCasts.length,2);h.dispatch({op:'end_turn'});h.dispatch({op:'complete_spell',actor:'hero'});assert.equal(h.s.activeSpellCasts.length,1);assert.equal(h.s.activeSpellCasts[0].actor,'warden');
});
test('invalid damage and modifier payloads are rejected before paying a long casting action',()=>{
 for(const extra of [{components:[{damageType:'bogus',amount:1}]},{components:[{damageType:'force',dice:{count:0,sides:6}}]},{components:[],effect:{mods:[{stat:'bogus',value:2}],rounds:1}}]){
  const g=make(),before=clone(g.s);assert.throws(()=>start(g,extra));assert.deepEqual(g.s,before);
 }
});
test('malformed casting duration cannot consume actions or RNG',()=>{
 for(const castingTime of [{count:0,unit:'round'},{count:1,unit:'second'},{count:1,unit:'round',extra:true},'minute',{count:100000,unit:'day'}]){const g=make(),before=clone(g.s);assert.throws(()=>start(g,{castingTime}));assert.deepEqual(g.s,before);}
});
console.log(`V3.24 casting: ${count} groups passing`);
