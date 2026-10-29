import assert from 'node:assert/strict';
import {MagicGame} from './magic.mjs';
import {initialState,clone} from './core.mjs';
const make=(init=true)=>{
 const s=initialState();s.tiles={};
 Object.assign(s.creatures[0],{x:1,y:3,skills:{Spellcraft:20}});
 Object.assign(s.creatures[1],{x:5,y:3,size:1,reach:1,skills:{Spellcraft:20},hp:200,maxHp:200});
 const g=new MagicGame(s);if(init)g.dispatch({op:'gm_begin_initiative',scores:{hero:20,warden:10}},'gm');return g;
};
const buff=(extra={})=>({name:'Synthetic ward',level:2,casterLevel:5,targets:['hero'],effect:{rounds:5,mods:[{stat:'attack',value:2,type:'morale'}]},...extra});
const blast=(extra={})=>({name:'Synthetic blast',level:3,casterLevel:6,targets:['hero'],components:[{damageType:'force',amount:10}],...extra});
const counter=(extra={})=>({name:'Synthetic blast',level:3,casterLevel:5,rangeFeet:60,targets:['warden'],counterspell:{mode:'same'},...extra});
const dispel=(extra={})=>({name:'Dispel magic',level:3,casterLevel:5,targets:['hero'],dispel:{},...extra});
const gm=(g,cmd)=>g.dispatch(cmd,'gm');
const apply=(g,spell,actor='warden')=>gm(g,{op:'gm_resolve_spell',actor,spell});
const cast=(g,spell,actor=g.active().id)=>g.dispatch({op:'cast_spell',actor,spell});
const ready=(g,spell=counter(),id='counter')=>g.dispatch({op:'ready_counterspell',actor:g.active().id,id,spell});
const react=(g,extra={})=>gm(g,{op:'gm_resolve_counterspell',id:'counter',take:true,perceived:true,...extra});
const resume=g=>gm(g,{op:'gm_continue_spell'});
const turn=g=>g.dispatch({op:'end_turn'});
const setup=(spell=counter(),incoming=blast())=>{const g=make();ready(g,spell);turn(g);cast(g,incoming);return g;};
let count=0;const test=(name,fn)=>{try{fn();count++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}};
test('ongoing spell index derives native effects with one casting identity per cast',()=>{
 const g=make();const a=apply(g,buff({targets:['hero','warden']}));const b=apply(g,buff());
 assert.notEqual(a.castingId,b.castingId);assert.equal(g.s.effects[0].spellSource.id,g.s.effects[1].spellSource.id);
 const before=clone(g.s),index=gm(g,{op:'gm_get_spellcasting'}).effects;
 assert.equal(index.length,3);assert.deepEqual(g.s,before);assert(!('activeSpellEffects' in g.s));
});
test('basic dispel uses original caster level, removes one effect and its deadline',()=>{
 const g=make(),base=g.stat('hero','attack');apply(g,buff({casterLevel:12}));apply(g,buff({name:'Lesser ward',casterLevel:6,effect:{rounds:5,mods:[{stat:'attack',value:1,type:'luck'}]}}));
 g.s.testRolls=[14];const r=cast(g,dispel()).resolution;
 assert.equal(r.checks.length,2);assert.equal(r.checks[0].dc,23);assert.equal(r.checks[1].dc,17);assert.equal(r.checks[0].d20,r.checks[1].d20);
 assert.equal(r.dispelled[0].spell,'Lesser ward');assert.equal(g.stat('hero','attack'),base+2);assert.equal(g.s.initiativeEvents.length,1);assert.equal(g.s.actions.resources.standard,0);assert.equal(g.s.testRolls.length,0);
});
test('successful highest-level dispel leaves lower spells intact',()=>{
 const g=make();apply(g,buff({casterLevel:12}));apply(g,buff({name:'Lesser ward',casterLevel:6}));g.s.testRolls=[20];
 const r=cast(g,dispel()).resolution;assert.equal(r.checks.length,1);assert.equal(r.dispelled[0].spell,'Synthetic ward');assert.equal(g.s.effects[0].name,'Lesser ward');
});
test('a specific failed dispel does not fall through to another spell',()=>{
 const g=make(),a=apply(g,buff({casterLevel:20}));apply(g,buff({name:'Easy ward',casterLevel:1}));g.s.testRolls=[10];
 const r=cast(g,dispel({dispel:{effectId:a.targets[0].effectId}})).resolution;assert.equal(r.checks.length,1);assert.equal(r.dispelled.length,0);assert.equal(g.s.effects.length,2);
});
test('multiple modifiers from one recipient and casting end together',()=>{
 const g=make();apply(g,buff());const e=clone(g.s.effects[0]);e.id='extra_part';g.s.effects.push(e);
 g.scheduleInitiativeEvent({id:'extra_expiry',label:'Extra part',afterRounds:3,atScore:10,requiresInput:false,expireEffectId:e.id});g.s.testRolls=[20];
 const r=cast(g,dispel()).resolution;assert.equal(r.dispelled.length,1);assert.equal(r.dispelled[0].effectIds.length,2);assert.equal(g.s.effects.length,0);assert.equal(g.s.initiativeEvents.length,0);
});
test('dispel of one recipient preserves other recipients of the same casting',()=>{
 const g=make();apply(g,buff({targets:['hero','warden']}));g.s.testRolls=[20];cast(g,dispel());
 assert.equal(g.s.effects.length,1);assert.equal(g.s.effects[0].target,'warden');assert.equal(g.s.initiativeEvents.length,1);
});
test('identically named overlapping casts retain separate identities and deadlines',()=>{
 const g=make();const a=apply(g,buff()),b=apply(g,buff());g.s.testRolls=[20];cast(g,dispel({dispel:{effectId:a.targets[0].effectId}}));
 assert.equal(g.s.effects.length,1);assert.equal(g.s.effects[0].spellSource.id,b.castingId);assert.equal(g.s.initiativeEvents.length,1);
});
test('self-dispel succeeds automatically with no RNG or retroactive damage healing',()=>{
 const g=make();apply(g,buff({casterLevel:100}),'hero');apply(g,blast());g.s.testRolls=[1];const hp=g.find('hero').hp;
 const r=cast(g,dispel({casterLevel:1})).resolution;assert(r.checks[0].automatic);assert.equal(r.checks[0].d20,null);assert.equal(g.s.testRolls.length,1);assert.equal(g.find('hero').hp,hp);
});
test('dispel ignores SR and AC, and rolls no saving throw',()=>{
 const g=make();g.find('hero').spellResistance=1000;g.find('hero').armor=100;apply(g,buff());g.s.testRolls=[20,1];cast(g,dispel());assert.equal(g.s.effects.length,0);assert.deepEqual(g.s.testRolls,[1]);
});
test('caster-level checks have no automatic natural 1 or 20 result',()=>{
 const g=make();apply(g,buff({casterLevel:50}));g.s.testRolls=[20];assert.equal(cast(g,dispel({casterLevel:1})).resolution.dispelled.length,0);
 const h=make();apply(h,buff({casterLevel:1}));h.s.testRolls=[1];assert.equal(cast(h,dispel({casterLevel:30})).resolution.dispelled.length,1);
});
test('undispellable spells and generic modifiers are preserved',()=>{
 const g=make();apply(g,buff({effect:{rounds:5,dispellable:false,mods:[{stat:'attack',value:2,type:'morale'}]}}));
 g.addEffect({id:'ordinary',name:'Ordinary modifier',target:'hero',mods:[{stat:'attack',value:1,type:'luck'}]});g.s.testRolls=[20];const r=cast(g,dispel()).resolution;
 assert.equal(r.checks.length,0);assert.equal(g.s.effects.length,2);assert.equal(g.s.testRolls.length,1);
});
test('spell-like ongoing effects can be dispelled',()=>{
 const g=make();apply(g,buff({sourceKind:'spell_like'}));g.s.testRolls=[20];assert.equal(cast(g,dispel()).resolution.dispelled.length,1);
});
test('an instantaneous-only target consumes the dispel without undoing its result',()=>{
 const g=make();apply(g,blast());const hp=g.find('hero').hp;g.s.testRolls=[20];const r=cast(g,dispel()).resolution;
 assert.equal(r.dispelled.length,0);assert.equal(g.find('hero').hp,hp);assert.equal(g.s.actions.resources.standard,0);assert.equal(g.s.testRolls.length,1);
});
test('held charge dispels remove the native Pending Event and use its history',()=>{
 const g=make();const r=apply(g,{name:'Touch charge',level:1,casterLevel:5,delivery:{type:'touch'},components:[{damageType:'force',amount:1}]},'warden');
 g.s.testRolls=[20];const d=cast(g,dispel({targets:['warden'],dispel:{effectId:r.eventId}})).resolution;
 assert.equal(d.dispelled.length,1);assert(!g.heldTouch('warden'));assert.equal(g.s.pendingEventHistory.at(-1).outcome,'dispelled');
});
test('ray volleys and repeated touches keep their casting identity across payloads',()=>{
 const g=make();g.s.testRolls=[10,10];apply(g,{...buff({targets:['warden','warden']}),delivery:{type:'ray',rangeFeet:60}},'hero');
 assert.equal(new Set(g.s.effects.map(e=>e.spellSource.id)).size,1);assert.equal(g.ongoingSpellEffects('warden')[0].effectIds.length,2);
 const h=make();apply(h,{...buff({targets:[]}),delivery:{type:'touch',charges:2}},'hero');
 gm(h,{op:'gm_discharge_touch_spell',actor:'hero',target:'hero',reason:'Self contact'});gm(h,{op:'gm_discharge_touch_spell',actor:'hero',target:'hero',reason:'Self contact'});
 assert.equal(new Set(h.s.effects.map(e=>e.spellSource.id)).size,1);
});
test('greater targeted dispel uses one roll and a caster-level-based spell limit',()=>{
 const g=make();for(let i=0;i<4;i++)apply(g,buff({name:'Ward '+i,casterLevel:5+i}));g.s.testRolls=[20];
 const r=cast(g,dispel({casterLevel:8,dispel:{greater:true}})).resolution;assert.equal(r.dispelled.length,2);assert.equal(r.checks.length,2);assert.equal(g.s.effects.length,2);assert.equal(g.s.testRolls.length,0);
});
test('invalid range, wall, visibility or specific target reject before costs and RNG',()=>{
 for(const mode of ['range','wall','effect','invisible']){
  const g=make();apply(g,buff({targets:['warden']}));let spell=dispel({targets:['warden']});
  if(mode==='range')spell.rangeFeet=5;if(mode==='wall')g.s.tiles['3,3']='wall';if(mode==='effect')spell.dispel.effectId='missing';if(mode==='invisible')g.applyCondition({target:'warden',condition:'invisible'});
  const before=clone(g.s);assert.throws(()=>cast(g,spell),/range|line of effect|No such|perceived/);assert.deepEqual(g.s,before);
 }
});
test('dispel casting still handles its normal opportunity and concentration failure',()=>{
 const g=make();apply(g,buff());g.find('warden').x=2;assert.equal(cast(g,dispel()).status,'needs_gm');
 g.s.testRolls=[1];const r=gm(g,{op:'gm_continue_spell',aooResolved:true,damageTaken:10});assert.equal(r.status,'lost');assert.equal(g.s.effects.length,1);
});
test('dispel target invalidated during casting spends its action with no effect',()=>{
 const g=make();apply(g,buff({targets:['warden']}));g.find('warden').x=2;cast(g,dispel({targets:['warden'],rangeFeet:5}));g.find('warden').x=5;
 const r=gm(g,{op:'gm_continue_spell',aooResolved:true});assert.equal(r.status,'blocked');assert.equal(g.s.effects.length,1);assert.equal(g.s.actions.resources.standard,0);
});
test('native Ready costs one standard action and stores no duplicate counter queue',()=>{
 const g=make();const r=ready(g);assert.equal(r.kind,'ready');assert.equal(r.duration.type,'turn_start');assert(r.payload.counterspell);assert.equal(g.s.actions.resources.standard,0);assert(!('readiedCounterspells' in g.s));
});
test('matching counterspell identifies, negates before effects and uses Ready initiative',()=>{
 const g=setup();const budget=clone(g.s.actions);g.s.testRolls=[1];const r=react(g);assert.equal(r.counterspell,'countered');assert.equal(r.check,null);
 assert.deepEqual(g.s.actions,budget);assert.equal(g.active().id,'warden');assert.equal(g.s.pendingEvents.length,0);assert.equal(g.s.pendingReadyAction,null);assert.equal(g.s.pendingEventDecisions.length,0);
 const order=g.sortedInitiative();assert.equal(order[0].id,'hero');assert.equal(order[0].score,10);assert.equal(resume(g).status,'lost');assert.equal(g.find('hero').hp,40);
});
test('failed free identification preserves Ready, with no repeat for the same casting',()=>{
 const g=setup();g.find('hero').skills.Spellcraft=0;g.s.testRolls=[1];const r=react(g);assert.equal(r.reason,'identification failed');assert.equal(r.spellExpended,false);assert.equal(g.s.pendingEvents[0].status,'active');assert.throws(()=>react(g),/No counterspell/);assert.equal(g.sortedInitiative()[0].score,20);assert.equal(resume(g).status,'resolved');assert.equal(g.find('hero').hp,30);
});
test('a mismatched identified spell does not cancel the incoming casting',()=>{
 const g=setup(counter({name:'Wrong spell'}));g.s.testRolls=[10];const r=react(g);assert.equal(r.reason,'spell does not match');assert.equal(r.spellExpended,false);resume(g);assert.equal(g.find('hero').hp,30);
});
test('canonical identity handles metamagic and declared specific counter exceptions',()=>{
 for(const mode of ['identity','exception']){
  const c=mode==='identity'?counter({name:'Empowered blast',spellId:'blast'}):counter({name:'Opposing spell',counterspell:{mode:'same',matches:['blast']}});
  const g=setup(c,blast({spellId:'blast'}));g.s.testRolls=[10];assert.equal(react(g).counterspell,'countered');assert.equal(resume(g).status,'lost');
 }
});
test('dispel counter needs no registered Spellcraft or identification roll',()=>{
 const g=setup(counter({name:'Dispel magic',counterspell:{mode:'dispel'}}));delete g.find('hero').skills;g.s.testRolls=[12];
 const r=react(g);assert.equal(r.identification,null);assert.equal(r.check.dc,17);assert.equal(r.check.total,17);assert.equal(r.counterspell,'countered');assert.equal(g.s.testRolls.length,0);assert.equal(resume(g).status,'lost');
});
test('a failed dispel counter allows the original spell to resolve',()=>{
 const g=setup(counter({name:'Dispel magic',casterLevel:1,counterspell:{mode:'dispel'}}));g.s.testRolls=[1];assert.equal(react(g).counterspell,'failed');assert.equal(resume(g).status,'resolved');assert.equal(g.find('hero').hp,30);
});
test('greater dispel receives its +4 counterspell bonus',()=>{
 const g=setup(counter({counterspell:{mode:'dispel',greater:true}}));g.s.testRolls=[8];const r=react(g);assert.equal(r.check.total,17);assert.equal(r.counterspell,'countered');
});
test('declining retains Ready for a later casting but cannot repeat on the same cast',()=>{
 const g=setup();assert.equal(react(g,{take:false}).status,'declined');assert.equal(g.s.pendingEvents[0].status,'active');assert.throws(()=>react(g),/No counterspell/);resume(g);
 g.grantAction('warden','standard',1,'Test extra action');cast(g,blast());g.s.testRolls=[10];assert.equal(react(g).counterspell,'countered');
});
test('an unused Ready expires through existing next-turn lifecycle',()=>{
 const g=make();ready(g);turn(g);turn(g);assert.equal(g.s.pendingEvents.length,0);assert.equal(g.s.pendingEventHistory.at(-1).outcome,'expired');
});
test('counterspell decisions cannot be bypassed by the external-AoO confirmation',()=>{
 const g=setup();const before=clone(g.s);assert.throws(()=>gm(g,{op:'gm_continue_spell',aooResolved:true}),/counterspell/);assert.deepEqual(g.s,before);assert.throws(()=>turn(g),/Resolve/);
});
test('normal identification includes shared skill modifiers, distance and GM circumstances',()=>{
 const g=setup();g.addEffect({id:'skill_penalty',name:'Skill penalty',target:'hero',mods:[{stat:'skill:Spellcraft',value:-4,type:'untyped'}]});g.s.testRolls=[4];
 const r=react(g,{identificationModifier:2});assert.equal(r.identification.bonus,16);assert.equal(r.identification.dc,22);assert.equal(r.identification.distancePenalty,2);assert.equal(r.identification.success,false);
});
test('counterspell target, perception and condition failures are atomic',()=>{
 for(const mode of ['perception','range','nauseated','blinded','wall']){
  const g=setup();if(mode==='range')g.find('warden').x=30;if(mode==='wall')g.s.tiles['3,3']='wall';if(['nauseated','blinded'].includes(mode))g.applyCondition({target:'hero',condition:mode});
  const before=clone(g.s);assert.throws(()=>react(g,mode==='perception'?{perceived:false}:{}),/perceived|range|counterspell|identify|line of effect/);assert.deepEqual(g.s,before);
 }
});
test('counterspell casting reuses AoOs, concentration and the parent continuation',()=>{
 const g=make();g.find('warden').x=2;ready(g);turn(g);cast(g,blast());gm(g,{op:'gm_resolve_casting_aoo',actor:'hero',take:false});g.s.testRolls=[10];const r=react(g);
 // The original caster is already casting, so cannot threaten. A third party can.
 assert.equal(r.counterspell,'countered');assert.equal(resume(g).status,'lost');
 const h=make();const third=clone(h.find('warden'));Object.assign(third,{id:'third',name:'Third',x:2,y:3,team:'enemy'});h.s.creatures.push(third);
 ready(h);turn(h);cast(h,blast());h.s.testRolls=[10];assert.equal(react(h).status,'needs_gm');assert.equal(h.s.pendingSpellCast.actor,'hero');assert.equal(h.s.pendingSpellCast.parentCasting.actor,'warden');
 h.s.testRolls=[10,3,1];gm(h,{op:'gm_resolve_casting_aoo',actor:'third',take:true});assert(h.s.pendingSpellCast.lostReason);const nested=resume(h);assert.equal(nested.counterspell,'lost');assert.equal(h.s.pendingSpellCast.actor,'warden');assert.equal(resume(h).status,'resolved');assert.equal(h.find('hero').hp<40,true);
});
test('defensive counterspell failure preserves parent spell and consumes no active action',()=>{
 const g=setup(counter({defensive:true,concentrationBonus:0}));const budget=clone(g.s.actions);g.s.testRolls=[10,1];assert.equal(react(g).counterspell,'lost');assert.deepEqual(g.s.actions,budget);assert.equal(resume(g).status,'resolved');
});
test('a new counterspell casting dissipates the countercaster’s held charge',()=>{
 const g=make();apply(g,{name:'Touch',level:1,casterLevel:5,delivery:{type:'touch'},components:[{damageType:'force',amount:1}]},'hero');ready(g);turn(g);cast(g,blast());g.s.testRolls=[10];react(g);assert(!g.heldTouch('hero'));
});
test('a spell-like activation is dispellable afterward but cannot be counterspelled',()=>{
 const g=make();ready(g);turn(g);const r=cast(g,blast({sourceKind:'spell_like'}));assert.equal(r.status,'resolved');assert.equal(g.s.pendingEvents[0].status,'active');
});
test('counterspell cancels a long casting before it enters the ongoing registry',()=>{
 const g=setup(counter(),blast({castingTime:'1_round'}));g.s.testRolls=[10];react(g);assert.equal(resume(g).status,'lost');assert.equal(g.s.activeSpellCasts.length,0);
});
test('ordinary casts cannot execute a counterspell payload or trigger one by text',()=>{
 const g=make();assert.throws(()=>cast(g,counter()),/ready_counterspell/);ready(g);assert.throws(()=>gm(g,{op:'gm_trigger_pending_event',id:'counter'}),/counterspell/);
});
test('actor authority cannot adjudicate another caster’s reaction or GM bypass',()=>{
 const g=setup();const before=clone(g.s);assert.throws(()=>g.dispatch({op:'gm_resolve_counterspell',id:'counter',take:true,perceived:true}),/Only the GM/);assert.deepEqual(g.s,before);
});
test('invalid schemas and unregistered matching skill do not consume Ready resources',()=>{
 for(const spell of [counter({counterspell:{mode:'unknown'}}),counter({castingTime:'full_round'}),counter({rangeFeet:undefined}),counter({components:[{damageType:'fire',amount:1}]})]){
  const g=make(),before=clone(g.s);assert.throws(()=>ready(g,spell));assert.deepEqual(g.s,before);
 }
 const h=make();delete h.find('hero').skills;const before=clone(h.s);assert.throws(()=>ready(h),/skill/);assert.deepEqual(h.s,before);
});
test('malformed native Ready payload and generic event spoofing reject atomically',()=>{
 const g=make(),before=clone(g.s);assert.throws(()=>gm(g,{op:'gm_register_pending_event',id:'bad',label:'Bad',trigger:'Cast',kind:'ready',actor:'hero',action:'Counter',duration:{type:'turn_start'},payload:{evil:true}}));assert.deepEqual(g.s,before);
});
test('a counterspell can itself be counterspelled through the same casting continuation',()=>{
 const s=initialState();s.tiles={};Object.assign(s.creatures[0],{x:1,y:3,skills:{Spellcraft:20}});Object.assign(s.creatures[1],{x:5,y:3,size:1,reach:1});
 const third=clone(s.creatures[0]);Object.assign(third,{id:'third',name:'Third',x:8,team:'enemy'});s.creatures.push(third);
 const g=new MagicGame(s);gm(g,{op:'gm_begin_initiative',scores:{hero:20,third:15,warden:10}});
 ready(g);turn(g);ready(g,counter({targets:['hero']}),'second_counter');turn(g);cast(g,blast());g.s.testRolls=[10,10];
 assert.equal(react(g).status,'needs_gm');assert.equal(g.s.pendingSpellCast.actor,'hero');
 assert.equal(react(g,{id:'second_counter'}).counterspell,'countered');assert.deepEqual(g.sortedInitiative().map(e=>e.id),['third','hero','warden']);
 assert.equal(resume(g).counterspell,'lost');assert.equal(g.s.pendingSpellCast.actor,'warden');assert.equal(resume(g).status,'resolved');assert.equal(g.find('hero').hp,30);
 assert.equal(g.s.pendingEvents.length,0);assert.equal(g.s.pendingReadyAction,null);assert.equal(g.s.pendingEventDecisions.length,0);
});
test('counterspell invalidated during its own AoO cannot retroactively regain the reaction',()=>{
 const g=make();const third=clone(g.find('warden'));Object.assign(third,{id:'third',name:'Third',x:2,y:3});g.s.creatures.push(third);
 ready(g,counter({rangeFeet:20}));turn(g);cast(g,blast());g.s.testRolls=[10];react(g);assert.equal(g.s.pendingSpellCast.actor,'hero');
 gm(g,{op:'gm_resolve_casting_aoo',actor:'third',take:false});g.find('warden').x=9;assert.equal(resume(g).counterspell,'lost');assert.equal(resume(g).status,'resolved');assert.equal(g.s.pendingEvents.length,0);
});
test('unexpected counterspell errors restore initiative, RNG and the Ready record',()=>{
 const g=setup(),before=clone(g.s);g.initialCastingChecks=()=>{throw Error('Synthetic fault');};assert.throws(()=>react(g),/Synthetic fault/);assert.deepEqual(g.s,before);
});
test('counterspell waiting through its AoO survives state reconstruction',()=>{
 const g=make();const third=clone(g.find('warden'));Object.assign(third,{id:'third',name:'Third',x:2,y:3});g.s.creatures.push(third);
 ready(g);turn(g);cast(g,blast());g.s.testRolls=[10];react(g);const h=new MagicGame(clone(g.s));gm(h,{op:'gm_resolve_casting_aoo',actor:'third',take:false});
 assert.equal(resume(h).counterspell,'countered');assert.equal(resume(h).status,'lost');assert.equal(h.s.pendingEvents.length,0);
});
test('world-clock dispel has no separate countdown and stays removed after Fast Forward',()=>{
 const g=make(false);apply(g,buff());g.s.testRolls=[20];cast(g,dispel());gm(g,{op:'gm_advance_time',count:1,unit:'hour'});assert.equal(g.s.effects.length,0);assert.equal(g.ongoingSpellEffects().length,0);
});
test('undo and state reconstruction retain dispel identities and remove no other timers',()=>{
 const g=make();apply(g,buff());g.turnStart=clone(g.s);g.s.testRolls=[20];cast(g,dispel());assert.equal(g.s.effects.length,0);gm(g,{op:'undo_turn'});assert.equal(g.s.effects.length,1);
 const h=new MagicGame(clone(g.s));assert.equal(h.ongoingSpellEffects().length,1);h.s.testRolls=[20];cast(h,dispel());assert.equal(h.s.initiativeEvents.length,0);
});
console.log(`V3.26 spell interactions: ${count} groups passing`);
