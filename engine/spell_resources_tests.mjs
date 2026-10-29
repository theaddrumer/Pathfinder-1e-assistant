import assert from 'node:assert/strict';
import {MagicGame} from './magic.mjs';
import {calculateSpellAllotment} from './spell_resources.mjs';
import {initialState,clone,newTurnActions} from './core.mjs';
const make=(init=true)=>{
 const s=initialState();s.tiles={};Object.assign(s.creatures[0],{x:1,y:3,int:18,wis:18,cha:18,skills:{Spellcraft:20}});Object.assign(s.creatures[1],{x:5,y:3,size:1,reach:1,int:18,wis:18,cha:18,skills:{Spellcraft:20},hp:200,maxHp:200});
 const g=new MagicGame(s);if(init)g.dispatch({op:'gm_begin_initiative',scores:{hero:20,warden:10}},'gm');return g;
};
const book=(mode='prepared',extra={})=>({id:'wizard',name:'Test caster',mode,ability:'int',casterLevel:7,
 pools:[{id:'general',allotment:{type:'imported',totals:{0:2,1:2,2:1,3:1}}}],
 spells:[{id:'bolt',name:'Synthetic bolt',level:1},{id:'spark',name:'Synthetic spark',level:0},{id:'dispel',name:'Dispel magic',level:3}],
 ...(mode==='prepared'?{preparations:[{id:'bolt_1',spell:'bolt',slotLevel:1},{id:'bolt_2',spell:'bolt',slotLevel:1},{id:'spark_1',spell:'spark',slotLevel:0},{id:'dispel_1',spell:'dispel',slotLevel:3}]}:{}),...extra});
const gm=(g,command)=>g.dispatch(command,'gm');
const setup=(g,definition=book(),actor='hero',more={})=>gm(g,{op:'gm_set_spellcasting',actor,book:definition,reason:'Initialize test daily allotment',...more});
const spell=(resource={book:'wizard',preparation:'bolt_1'},extra={})=>({name:'Synthetic bolt',level:1,casterLevel:7,targets:['warden'],components:[{damageType:'force',amount:4}],resource,...extra});
const cast=(g,s=spell(),actor=g.active().id)=>g.dispatch({op:'cast_spell',actor,spell:s});
const available=(g,actor='hero',id='wizard',level=1,pool='general')=>gm(g,{op:'gm_get_spell_resources',actor}).books.find(b=>b.id===id).pools.find(p=>p.id===pool).levels.find(l=>l.level===level);
const nextRound=g=>{g.dispatch({op:'end_turn'});g.dispatch({op:'end_turn'});};
let n=0;function test(name,fn){try{fn();n++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}}
test('bonus slots match the core table across successive ability modifier bands',()=>{
 for(const [score,expected] of [[10,[0,0,0,0,0,0,0,0,0]],[12,[1,0,0,0,0,0,0,0,0]],[18,[1,1,1,1,0,0,0,0,0]],[20,[2,1,1,1,1,0,0,0,0]],[28,[3,2,2,2,2,1,1,1,1]],[36,[4,3,3,3,3,2,2,2,2]]]){
  const r=calculateSpellAllotment({type:'derived',abilityScore:score,base:Object.fromEntries(Array.from({length:10},(_,i)=>[i,0]))});assert.deepEqual(Array.from({length:9},(_,i)=>r.bonus[i+1]),expected);assert.equal(r.bonus[0],0);
 }
});
test('missing or null levels stay inaccessible; zero base slots can gain bonus slots',()=>{
 const r=calculateSpellAllotment({type:'derived',abilityScore:30,base:{0:3,1:0,2:null}});assert.equal(r.totals[1],3);assert.equal(r.totals[2],null);assert(!Object.hasOwn(r.totals,3));assert.equal(r.totals[0],3);
});
test('imported totals remain authoritative and cannot be combined with bonus calculations',()=>{
 const g=make();setup(g,book('spontaneous'));assert.equal(available(g).total,2);
 assert.throws(()=>calculateSpellAllotment({type:'imported',totals:{1:4},abilityScore:18}),/cannot also add/);
 assert.throws(()=>calculateSpellAllotment({type:'derived',base:{1:2}}),/explicit fixed/);
});
test('derived daily allotment stores its explicit score and visible base/bonus breakdown',()=>{
 const g=make();setup(g,book('spontaneous',{pools:[{id:'general',allotment:{type:'derived',base:{0:2,1:2,2:1},abilityScore:18}}]}));
 const p=g.spellBook('hero','wizard').pools[0];assert.equal(p.allotment.base[1],2);assert.equal(p.allotment.bonus[1],1);assert.equal(p.allotment.totals[1],3);assert.equal(p.allotment.abilityScore,18);
});
test('live ability buffs, damage, drain and their removal never change slots or refill uses',()=>{
 for(const mode of ['prepared','spontaneous']){
  const g=make();setup(g,book(mode,{pools:[{id:'general',allotment:{type:'derived',base:{0:2,1:2,2:1,3:1},abilityScore:18}}]}));
  cast(g,spell(mode==='prepared'?{book:'wizard',preparation:'bolt_1'}:{book:'wizard',spell:'bolt'}));const resources=clone(g.s.spellResources);
  gm(g,{op:'gm_modifier',target:'hero',stat:'int',value:10,name:'Temporary Intelligence'});assert.deepEqual(g.s.spellResources,resources);
  g.s.abilityDamage.hero={int:6};g.s.abilityDrain.hero={int:6};g.stat('hero','int');assert.deepEqual(g.s.spellResources,resources);
  for(const e of [...g.s.effects])g.removeEffect(e.id);g.s.abilityDamage.hero={};g.s.abilityDrain.hero={};g.find('hero').int=30;assert.deepEqual(g.s.spellResources,resources);
 }
});
test('refresh uses stored allotments even after the underlying ability score changes',()=>{
 const g=make();setup(g,book('spontaneous',{pools:[{id:'general',allotment:{type:'derived',base:{1:2},abilityScore:18}}]}));cast(g,spell({book:'wizard',spell:'bolt'}));g.find('hero').int=30;
 gm(g,{op:'gm_refresh_spellcasting',actor:'hero',book:'wizard',reason:'GM confirms daily preparation'});assert.equal(available(g).total,3);assert.equal(available(g).spent,0);assert.equal(g.spellBook('hero','wizard').pools[0].allotment.abilityScore,18);
});
test('daily recalculation requires explicit replacement and never happens during inspection',()=>{
 const g=make();setup(g);const before=clone(g.s);assert.throws(()=>setup(g,book()),/replace:true/);assert.deepEqual(g.s,before);
 const newer=book('spontaneous',{pools:[{id:'general',allotment:{type:'derived',base:{1:2},abilityScore:26}}]});setup(g,newer,'hero',{replace:true});assert.equal(available(g).total,4);
 const stored=clone(g.s);gm(g,{op:'gm_get_spellcasting'});gm(g,{op:'gm_get_spell_resources'});assert.deepEqual(g.s,stored);
});
test('prepared casting consumes its exact copy and leaves other copies ready',()=>{
 const g=make();setup(g);const r=cast(g);assert.equal(r.resourceSpent.preparation,'bolt_1');assert.equal(available(g).spent,1);assert.equal(available(g).available,1);assert.equal(g.spellBook('hero','wizard').preparations.find(p=>p.id==='bolt_2').spent,false);
 nextRound(g);const before=clone(g.s);assert.throws(()=>cast(g),/already expended/);assert.deepEqual(g.s,before);cast(g,spell({book:'wizard',preparation:'bolt_2'}));assert.equal(available(g).spent,2);
});
test('spontaneous casting uses a shared level pool and blocks further casts at exhaustion',()=>{
 const g=make();setup(g,book('spontaneous'));cast(g,spell({book:'wizard',spell:'bolt'}));nextRound(g);cast(g,spell({book:'wizard',spell:'bolt'}));nextRound(g);
 const before=clone(g.s);assert.throws(()=>cast(g,spell({book:'wizard',spell:'bolt'})),/No spell slots/);assert.deepEqual(g.s,before);assert.equal(available(g).spent,2);
});
test('spontaneous upcasting spends only the explicitly selected higher-level slot',()=>{
 const g=make();setup(g,book('spontaneous'));cast(g,spell({book:'wizard',spell:'bolt',slotLevel:2}));assert.equal(available(g).spent,0);assert.equal(available(g,'hero','wizard',2).spent,1);
});
test('prepared lower-level spells may occupy higher slots but cannot move at cast time',()=>{
 const g=make();setup(g,book('prepared',{preparations:[{id:'high',spell:'bolt',slotLevel:2}]}));const before=clone(g.s);assert.throws(()=>cast(g,spell({book:'wizard',preparation:'high',slotLevel:1})),/cannot be changed/);assert.deepEqual(g.s,before);cast(g,spell({book:'wizard',preparation:'high'}));assert.equal(available(g,'hero','wizard',2).spent,1);
});
test('catalogue slot costs are independent of effective spell level for metamagic variants',()=>{
 const g=make();setup(g,book('spontaneous',{spells:[{id:'metabolt',name:'Empowered synthetic bolt',spellId:'bolt',level:1,slotLevel:3}]}));
 const s=spell({book:'wizard',spell:'metabolt',slotLevel:1},{name:'Empowered synthetic bolt',spellId:'bolt'});assert.throws(()=>cast(g,s),/too low/);s.resource.slotLevel=3;cast(g,s);assert.equal(available(g,'hero','wizard',3).spent,1);
});
test('cantrips are reusable while still requiring prepared or known access',()=>{
 for(const mode of ['prepared','spontaneous']){
  const g=make();setup(g,book(mode));const r=mode==='prepared'?{book:'wizard',preparation:'spark_1'}:{book:'wizard',spell:'spark'};
  cast(g,spell(r,{name:'Synthetic spark',level:0}));nextRound(g);cast(g,spell(r,{name:'Synthetic spark',level:0}));assert.equal(available(g,'hero','wizard',0).spent,0);
 }
});
test('zero-level spells in higher slots and explicitly finite cantrip policies expend slots',()=>{
 const g=make();setup(g,book('prepared',{preparations:[{id:'spark_high',spell:'spark',slotLevel:1}]}));cast(g,spell({book:'wizard',preparation:'spark_high'},{name:'Synthetic spark',level:0}));assert.equal(available(g).spent,1);
 const h=make();setup(h,book('spontaneous',{cantripsAtWill:false}));cast(h,spell({book:'wizard',spell:'spark'},{name:'Synthetic spark',level:0}));assert.equal(available(h,'hero','wizard',0).spent,1);
});
test('restricted pools cannot be spent on unrelated spells',()=>{
 const g=make();setup(g,book('spontaneous',{pools:[{id:'domain',allotment:{type:'imported',totals:{1:1}},allowedSpells:['bolt']}]}));
 assert.throws(()=>cast(g,spell({book:'wizard',spell:'spark',pool:'domain',slotLevel:1},{name:'Synthetic spark',level:0})),/restricted pool/);cast(g,spell({book:'wizard',spell:'bolt',pool:'domain'}));assert.equal(available(g,'hero','wizard',1,'domain').spent,1);
});
test('declared prepared conversions consume the original preparation and respect pool limits',()=>{
 const g=make();const b=book();b.spells.push({id:'cure',name:'Synthetic cure',level:1});b.conversions=['cure'];setup(g,b);
 cast(g,spell({book:'wizard',preparation:'bolt_1',spell:'cure'},{name:'Synthetic cure',components:[],healing:{amount:1},targets:['hero']}));assert.equal(available(g).spent,1);assert.equal(g.spellBook('hero','wizard').preparations[0].spell,'bolt');
 const h=make();b.pools[0].allowConversion=false;setup(h,b);assert.throws(()=>cast(h,spell({book:'wizard',preparation:'bolt_1',spell:'cure'},{name:'Synthetic cure'})),/permitted spontaneous conversion/);
});
test('configured actors cannot bypass resources through missing selectors or spoofed identities',()=>{
 for(const change of [s=>delete s.resource,s=>s.name='Unregistered spell',s=>s.level=0,s=>s.sourceKind='spell_like',s=>s.casterLevel=8,s=>s.ability='cha']){
  const g=make();setup(g);const s=spell();change(s);const before=clone(g.s);assert.throws(()=>cast(g,s));assert.deepEqual(g.s,before);
 }
});
test('caster books and multiclass pools remain separate',()=>{
 const g=make();setup(g,book('spontaneous'));setup(g,book('spontaneous',{id:'cleric',ability:'wis'}));cast(g,spell({book:'cleric',spell:'bolt'}));assert.equal(available(g).spent,0);assert.equal(available(g,'hero','cleric').spent,1);
 setup(g,book('spontaneous'),'warden');assert.equal(available(g,'warden').spent,0);
});
test('book ability determines concentration and low current scores block casting without altering allotments',()=>{
 const g=make();setup(g,book('spontaneous',{ability:'wis'}));g.find('hero').wis=10;const b=clone(g.s.spellResources);assert.throws(()=>cast(g,spell({book:'wizard',spell:'bolt'})),/ability is too low/);assert.deepEqual(g.s.spellResources,b);
 g.find('hero').wis=18;g.s.testRolls=[20];cast(g,spell({book:'wizard',spell:'bolt'},{defensive:true}));assert.match(g.s.log.join('\n'),/concentration 20 \+ 11/);
});
test('failed defensive casting expends its slot once',()=>{
 const g=make();setup(g);g.s.testRolls=[1];assert.equal(cast(g,spell(undefined,{defensive:true,concentrationBonus:0})).status,'lost');assert.equal(available(g).spent,1);
});
test('casting AoOs and injury failure never refund or double-spend the slot',()=>{
 const g=make();setup(g);g.find('warden').x=2;cast(g);assert.equal(available(g).spent,1);g.s.testRolls=[1];assert.equal(gm(g,{op:'gm_continue_spell',aooResolved:true,damageTaken:10}).status,'lost');assert.equal(available(g).spent,1);
});
test('long casting pays only on initiation, not continuation or completion',()=>{
 const g=make();setup(g);cast(g,spell(undefined,{castingTime:{count:2,unit:'round'}}));assert.equal(available(g).spent,1);nextRound(g);g.dispatch({op:'continue_spell',actor:'hero'});assert.equal(available(g).spent,1);nextRound(g);g.dispatch({op:'complete_spell',actor:'hero'});assert.equal(available(g).spent,1);
});
test('held touch delivery and ray volleys use the single casting payment',()=>{
 const g=make();setup(g);cast(g,spell(undefined,{targets:[],delivery:{type:'touch'}}));assert.equal(available(g).spent,1);g.dispatch({op:'deliver_touch_spell',actor:'hero',target:'hero'});assert.equal(available(g).spent,1);
 const h=make();setup(h);h.s.testRolls=[10,10];cast(h,spell(undefined,{targets:['warden','warden'],delivery:{type:'ray',rangeFeet:60}}));assert.equal(available(h).spent,1);
});
test('invalid payload, impossible range or unavailable action rolls back resources atomically',()=>{
 for(const mode of ['payload','range','action']){
  const g=make();setup(g);const s=spell();if(mode==='payload')s.badField=true;if(mode==='range')s.delivery={type:'ray',rangeFeet:5};if(mode==='action')g.s.actions.resources.standard=0;
  const before=clone(g.s);assert.throws(()=>cast(g,s));assert.deepEqual(g.s,before);
 }
});
test('GM effect-only resolution remains an explicit no-resource override',()=>{
 const g=make();setup(g);const resources=clone(g.s.spellResources);gm(g,{op:'gm_resolve_spell',actor:'hero',spell:spell()});assert.deepEqual(g.s.spellResources,resources);assert.equal(g.s.actions.resources.standard,1);
});
const ready=(g,def=spell(undefined,{counterspell:{mode:'same'},components:[],rangeFeet:60}))=>g.dispatch({op:'ready_counterspell',actor:'hero',id:'counter',spell:def});
test('Readying, declining and failed identification do not expend or reserve a slot',()=>{
 const g=make();setup(g);ready(g);assert.equal(available(g).spent,0);g.dispatch({op:'end_turn'});cast(g,spell(undefined,{resource:undefined,targets:['hero']}),'warden');g.find('hero').skills.Spellcraft=0;g.s.testRolls=[1];
 gm(g,{op:'gm_resolve_counterspell',id:'counter',take:true,perceived:true});assert.equal(available(g).spent,0);gm(g,{op:'gm_continue_spell'});
});
test('successful or failed counterspell casting spends the countercaster’s resource only',()=>{
 for(const fail of [false,true]){
  const g=make();setup(g);setup(g,book('spontaneous'),'warden');ready(g,spell(undefined,{counterspell:{mode:'same'},components:[],rangeFeet:60,...(fail?{defensive:true,concentrationBonus:0}:{})}));g.dispatch({op:'end_turn'});
  cast(g,spell({book:'wizard',spell:'bolt'},{targets:['hero']}),'warden');g.s.testRolls=fail?[10,1]:[10];gm(g,{op:'gm_resolve_counterspell',id:'counter',take:true,perceived:true});assert.equal(available(g).spent,1);assert.equal(available(g,'warden').spent,1);gm(g,{op:'gm_continue_spell'});assert.equal(available(g).spent,1);
 }
});
test('a slot used after Ready declaration is unavailable at the actual counterspell trigger',()=>{
 const g=make();setup(g);ready(g);g.spellBook('hero','wizard').preparations[0].spent=true;g.dispatch({op:'end_turn'});cast(g,spell(undefined,{resource:undefined,targets:['hero']}),'warden');const before=clone(g.s);
 assert.throws(()=>gm(g,{op:'gm_resolve_counterspell',id:'counter',take:true,perceived:true}),/already expended/);assert.deepEqual(g.s,before);gm(g,{op:'gm_resolve_counterspell',id:'counter',take:false});gm(g,{op:'gm_continue_spell'});
});
test('explicit restoration cannot exceed spent uses or silently change totals',()=>{
 const g=make();setup(g,book('spontaneous'));cast(g,spell({book:'wizard',spell:'bolt'}));gm(g,{op:'gm_restore_spell_resource',actor:'hero',book:'wizard',slotLevel:1,reason:'Test pearl equivalent'});assert.equal(available(g).spent,0);assert.equal(available(g).total,2);
 assert.throws(()=>gm(g,{op:'gm_restore_spell_resource',actor:'hero',book:'wizard',slotLevel:1,reason:'Duplicate restoration'}),/more slots/);
 const h=make();setup(h);cast(h);gm(h,{op:'gm_restore_spell_resource',actor:'hero',book:'wizard',preparation:'bolt_1',reason:'Prepared spell restored'});assert.equal(available(h).spent,0);
});
test('open slots can be filled but spent preparations still occupy daily capacity',()=>{
 const g=make();setup(g,book('prepared',{preparations:[]}));gm(g,{op:'gm_prepare_spell',actor:'hero',book:'wizard',preparation:{id:'a',spell:'bolt'},reason:'GM confirms preparation time'});cast(g,spell({book:'wizard',preparation:'a'}));gm(g,{op:'gm_prepare_spell',actor:'hero',book:'wizard',preparation:{id:'b',spell:'bolt'},reason:'Fill another open slot'});
 const before=clone(g.s);assert.throws(()=>gm(g,{op:'gm_prepare_spell',actor:'hero',book:'wizard',preparation:{id:'c',spell:'bolt'},reason:'Try spent slot'}),/No unprepared/);assert.deepEqual(g.s,before);
});
test('refresh can replace daily preparations explicitly and rolls back an invalid replacement',()=>{
 const g=make();setup(g);cast(g);const before=clone(g.s);assert.throws(()=>gm(g,{op:'gm_refresh_spellcasting',actor:'hero',book:'wizard',preparations:[{id:'bad',spell:'unknown'}],reason:'New daily preparations'}));assert.deepEqual(g.s,before);
 gm(g,{op:'gm_refresh_spellcasting',actor:'hero',book:'wizard',preparations:[{id:'new',spell:'bolt'}],reason:'GM confirms new daily preparation'});assert.equal(g.spellBook('hero','wizard').preparations[0].id,'new');assert.equal(available(g).spent,0);
});
test('time, encounter transitions and midnight never refresh resources automatically',()=>{
 const g=make();setup(g,book('spontaneous'));cast(g,spell({book:'wizard',spell:'bolt'}));gm(g,{op:'gm_end_initiative'});gm(g,{op:'gm_advance_time',count:2,unit:'day'});assert.equal(available(g).spent,1);
});
test('GM updates require authority and reasons, and cannot replace a casting’s live resources',()=>{
 const g=make();setup(g);const before=clone(g.s);assert.throws(()=>g.dispatch({op:'gm_refresh_spellcasting',actor:'hero',book:'wizard',reason:'Unauthorized'}),/Only GM/);assert.throws(()=>gm(g,{op:'gm_refresh_spellcasting',actor:'hero',book:'wizard'}),/reason/);assert.deepEqual(g.s,before);
 cast(g,spell(undefined,{castingTime:'1_round'}));assert.throws(()=>gm(g,{op:'gm_refresh_spellcasting',actor:'hero',book:'wizard',reason:'During cast'}),/Finish or cancel/);
});
test('at-will SLA access must be registered; changing sourceKind cannot fake free casting',()=>{
 const g=make();const b=book('spontaneous');b.spells.push({id:'sla',name:'Synthetic SLA',level:1,sourceKind:'spell_like',atWill:true});setup(g,b);
 cast(g,spell({book:'wizard',spell:'sla'},{name:'Synthetic SLA',sourceKind:'spell_like'}));assert.equal(available(g).spent,0);
});
test('state reconstruction and undo preserve both frozen totals and expended slots',()=>{
 const g=make();setup(g,book('spontaneous'));g.turnStart=clone(g.s);cast(g,spell({book:'wizard',spell:'bolt'}));const h=new MagicGame(clone(g.s));assert.equal(available(h).spent,1);assert.equal(available(h).total,2);
 gm(g,{op:'undo_turn'});assert.equal(available(g).spent,0);assert.equal(available(g).total,2);
});
test('restricted extra pools cannot accidentally apply a second ability bonus table',()=>{
 const g=make(),b=book('spontaneous');b.pools=[{id:'general',allotment:{type:'derived',base:{1:2},abilityScore:18}},{id:'special',allotment:{type:'derived',base:{1:1},abilityScore:18},allowedSpells:['bolt']}];
 const before=clone(g.s);assert.throws(()=>setup(g,b),/Only one pool/);assert.deepEqual(g.s,before);
 b.pools[1].allotment={type:'imported',totals:{1:1}};setup(g,b);assert.equal(available(g).total,3);assert.equal(available(g,'hero','wizard',1,'special').total,1);
});
test('unsupported/ambiguous allotments and over-preparation reject atomically',()=>{
 const g=make(),before=clone(g.s);
 for(const b of [book('spontaneous',{pools:[{id:'general',allotment:{type:'derived',base:{1:2}}}]}),book('prepared',{preparations:[{id:'a',spell:'bolt'},{id:'b',spell:'bolt'},{id:'c',spell:'bolt'}]}),book('spontaneous',{pools:[{id:'general',allotment:{type:'imported',totals:{10:1}}}]})]){
  assert.throws(()=>setup(g,b));assert.deepEqual(g.s,before);
 }
});
console.log(`V3.27 spell resources: ${n} groups passing`);
