import assert from 'node:assert/strict';
import {initialState,clone} from './core.mjs';
import {MagicGame} from './magic.mjs';
import {spellArea,spellGridDistance} from './spell_geometry.mjs';
let n=0;function test(name,fn){try{fn();n++;console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}}
const make=()=>{const s=initialState();s.tiles={};s.creatures[0].x=1;s.creatures[0].y=3;s.creatures[1].size=1;s.creatures[1].x=5;s.creatures[1].y=3;return new MagicGame(s);};
const area=(shape='sphere',extra={})=>({shape,mode:'burst',origin:{x:3,y:3},sizeFeet:15,...extra});
const testSpell=(extra={})=>({name:'Fireball test',level:3,casterLevel:7,castingTime:'standard',targets:['warden'],save:{type:'ref',dc:16,onSuccess:'half'},components:[{damageType:'fire',amount:20}],...extra});
test('grid distance follows 5-10-5 diagonal rule',()=>{assert.equal(spellGridDistance(2,2),3);assert.equal(spellGridDistance(4,3),5);});
test('sphere includes whole far-edge square and excludes near-edge-only',()=>{
 const g=make(),a=g.previewSpellArea(area('sphere',{origin:{x:3,y:3},sizeFeet:10}));
 assert(a.cells.some(c=>c.x===3&&c.y===3));assert(a.cells.some(c=>c.x===4&&c.y===3));
 assert(!a.cells.some(c=>c.x===5&&c.y===5));
});
test('cone quarter-circle faces chosen octant and does not affect behind',()=>{
 const g=make(),a=g.previewSpellArea(area('cone',{direction:'E'}));
 assert(a.cells.some(c=>c.x===4&&c.y===3));assert(!a.cells.some(c=>c.x===1&&c.y===3));
});
test('line stops at wall and five-foot-wide template does not occupy two full rows',()=>{
 const g=make();g.s.tiles['5,3']='wall';const a=g.previewSpellArea(area('line',{direction:'E',sizeFeet:30}));
 assert.deepEqual(a.cells.map(x=>[x.x,x.y]),[[3,3],[4,3]]);
});
test('burst blocked by wall while spread goes around obstacle',()=>{
 const g=make();for(let y=0;y<=5;y++)g.s.tiles[`4,${y}`]='wall';
 const a=g.previewSpellArea(area('sphere',{origin:{x:3,y:3},sizeFeet:35}));
 const b=g.previewSpellArea(area('sphere',{mode:'spread',origin:{x:3,y:3},sizeFeet:35}));
 assert(!a.cells.some(c=>c.x===5&&c.y===3));
 assert(b.cells.some(c=>c.x===5&&c.y===6));
});
test('multi-square creature is affected if any occupied square in area',()=>{
 const g=make(),w=g.find('warden');w.size=2;w.x=4;w.y=3;
 const a=g.previewSpellArea(area('sphere',{sizeFeet:10}));assert(a.affected.includes('warden'));
});
test('invalid area definitions reject without modifying game',()=>{
 const g=make(),save=clone(g.s);
 assert.throws(()=>g.dispatch({op:'gm_preview_spell_area',area:area('cone',{direction:'UP'})},'gm'),/direction/);
 assert.deepEqual(g.s,save);
});
test('normal saving throw 20 succeeds on extreme DC; half damage before mitigation',()=>{
 const g=make();g.s.testRolls=[20];const r=g.dispatch({op:'gm_resolve_spell',actor:'hero',spell:testSpell({save:{type:'ref',dc:999,onSuccess:'half'}})},'gm');
 assert.equal(r.targets[0].save.success,true);assert.equal(r.targets[0].packet.raw,10);
});
test('single damage roll for area spell shared across different creatures',()=>{
 const g=make();g.s.testRolls=[5,1,1]; // 1 damage die, then two Reflex saves
 const spell=testSpell({targets:['hero','warden'],components:[{damageType:'fire',dice:{count:1,sides:6}}],save:{type:'ref',dc:40,onSuccess:'half'}});
 const r=g.dispatch({op:'gm_resolve_spell',actor:'hero',spell},'gm');
 assert.equal(r.rolled[0].amount,5);assert.equal(r.targets.length,2);assert.equal(r.targets[0].packet.raw,5);assert.equal(r.targets[1].packet.raw,5);
});
test('SR check is a caster-level check without natural 20 automatic success',()=>{
 const g=make();g.find('warden').spellResistance=40;g.s.testRolls=[20];
 const r=g.dispatch({op:'gm_resolve_spell',actor:'hero',spell:testSpell({spellResistance:true})},'gm');
 assert.equal(r.targets[0].spellResistance.success,false);assert.equal(r.targets[0].packet,null);
});
test('spell resistance succeeds numerically; save negates damage',()=>{
 const g=make();g.find('warden').spellResistance=15;g.s.testRolls=[12,20];
 const r=g.dispatch({op:'gm_resolve_spell',actor:'hero',spell:testSpell({spellResistance:true,save:{type:'ref',dc:999,onSuccess:'negates'}})},'gm');
 assert.equal(r.targets[0].spellResistance.success,true);assert.equal(r.targets[0].save.success,true);assert.equal(r.targets[0].packet,null);
});
test('defensive casting uses 15 + 2x spell level with NO natural-20 guarantee',()=>{
 const g=make();g.s.testRolls=[20];let spell=testSpell({defensive:true,concentrationBonus:-10});
 const r=g.dispatch({op:'cast_spell',actor:'hero',spell},'actor');
 assert.equal(r.status,'lost');assert.equal(r.concentration.dc,21);assert.equal(g.s.actions.resources.standard,0);
});
test('defensive cast success resolves and spends action',()=>{
 const g=make();g.s.testRolls=[20,1];const r=g.dispatch({op:'cast_spell',actor:'hero',spell:testSpell({defensive:true,concentrationBonus:15})},'actor');
 assert.equal(r.status,'resolved');assert.equal(g.find('warden').hp,45);
});
test('provoking spell defers outcome until GM confirms AoOs and damage concentration',()=>{
 const g=make();g.find('warden').x=2;g.find('warden').y=3;
 const spell=testSpell();const a=g.dispatch({op:'cast_spell',actor:'hero',spell},'actor');
 assert.equal(a.status,'needs_gm');assert.deepEqual(a.threats,['warden']);assert.equal(g.find('warden').hp,65);
 assert.throws(()=>g.dispatch({op:'gm_continue_spell',damageTaken:0},'gm'),/confirm/);
 g.s.testRolls=[1];const result=g.dispatch({op:'gm_continue_spell',aooResolved:true,damageTaken:10},'gm');
 assert.equal(result.status,'lost');assert.equal(g.find('warden').hp,65);assert.equal(g.s.pendingSpellCast,null);
});
test('cast error restores action, RNG, and state',()=>{
 const g=make(),before=clone(g.s);
 assert.throws(()=>g.dispatch({op:'cast_spell',actor:'hero',spell:testSpell({targets:['missing']})},'actor'),/Invalid spell targets/);
 assert.deepEqual(g.s,before);
});
test('magic and Pending Events share state and undo without losing registrations',()=>{
 const g=make();g.dispatch({op:'gm_register_pending_event',id:'ritual',label:'Ritual',trigger:'The moon rises'},'gm');
 assert.equal(g.s.pendingEvents.length,1);assert.equal(g.dispatch({op:'gm_preview_spell_area',area:area()},'gm').area.shape,'sphere');
});
console.log(`V3.22 magic foundations: ${n} groups passing`);
test('timed spell modifier expires at caster initiative count, not victim turn end',()=>{
 const g=make();g.dispatch({op:'gm_begin_initiative',scores:{hero:20,warden:5}},'gm');
 const spell=testSpell({effect:{mods:[{stat:'ac',value:2,type:'dodge'}],rounds:1},components:[],save:undefined});
 // Save field absent rather than undefined still accepted by validator.
 const r=g.dispatch({op:'cast_spell',actor:'hero',spell:{...spell,defensive:true,concentrationBonus:25}},'actor');
 assert.equal(r.status,'resolved');assert.equal(g.s.effects.length,1);
 assert.equal(g.s.initiativeEvents.length,1);assert.equal(g.s.effects[0].initiativeTimed,true);
 g.dispatch({op:'end_turn'});assert.equal(g.s.effects.length,1);
 g.dispatch({op:'end_turn'});assert.equal(g.s.effects.length,0);
});
test('initiative-timed spell converts to world-clock expiry on encounter end',()=>{
 const g=make();g.dispatch({op:'gm_begin_initiative',scores:{hero:20,warden:5}},'gm');
 const s=testSpell({effect:{mods:[{stat:'ac',value:2,type:'dodge'}],rounds:3},components:[],save:undefined});
 g.dispatch({op:'cast_spell',actor:'hero',spell:{...s,defensive:true,concentrationBonus:25}},'actor');
 g.dispatch({op:'gm_end_initiative'},'gm');
 assert.equal(g.s.effects[0].remaining,3);
 g.dispatch({op:'gm_advance_time',count:3,unit:'round'},'gm');
 assert.equal(g.s.effects.length,0);
});
test('pending casting blocks end turn until resolved',()=>{
 const g=make();g.find('warden').x=2;g.find('warden').y=3;
 g.dispatch({op:'cast_spell',actor:'hero',spell:testSpell()},'actor');
 assert.throws(()=>g.dispatch({op:'end_turn'},'actor'),/Resolve the provoking spell/);
 g.dispatch({op:'gm_continue_spell',aooResolved:true,damageTaken:0},'gm');
 g.dispatch({op:'end_turn'});
});
test('diagonal line length uses 5-10-5, not one square per five feet',()=>{
 const g=make();const r=g.previewSpellArea(area('line',{origin:{x:2,y:2},direction:'SE',sizeFeet:30}));
 assert.deepEqual(r.cells.map(c=>[c.x,c.y]),[[2,2],[3,3],[4,4],[5,5]]);
});
test('healing spells reuse lethal and nonlethal healing, roll once per spell',()=>{
 const g=make();g.find('warden').hp=30;g.s.nonlethalDamage['warden']=4;g.s.testRolls=[5];
 const result=g.dispatch({op:'gm_resolve_spell',actor:'hero',spell:{name:'Healing light',level:1,casterLevel:3,targets:['warden'],healing:{dice:{count:1,sides:8,bonus:3}}}},'gm');
 assert.equal(result.healingAmount,8);assert.equal(result.targets[0].healing.hpHealed,8);
 assert.equal(g.find('warden').hp,38);assert.equal(g.s.nonlethalDamage.warden,0);
});
