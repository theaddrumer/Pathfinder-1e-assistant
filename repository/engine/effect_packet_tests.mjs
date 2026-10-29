import assert from 'node:assert/strict';
import {FoundationsGame} from './foundations.mjs';
import {initialState} from './core.mjs';
import {DAMAGE_TYPES,DR_BYPASS_TAGS} from './trait_library.mjs';
let count=0;
const t=(name,fn)=>{fn();console.log('PASS',name);count++;};
function make(){const s=initialState();s.tiles={};s.creatures=s.creatures.slice(0,1);return new FoundationsGame(s);}
function creature(g,id,{alignment,creatureType='outsider',subtypes=[],protections={},stats={}}={},x=4,y=4){
 const definition={id,name:id,creatureType,subtypes,stats:{maxHp:300,hp:300,hitDiceCount:8,str:16,dex:12,con:14,
  statTotals:{ac:18,touchAc:11,flatFootedAc:17},...stats},protections,...(alignment?{alignment}:{})};
 g.dispatch({op:'register_creature',definition},'gm');g.dispatch({op:'spawn_creature',definition:id,id,x,y},'gm');return id;
}
const packet=(g,target,components,opts={})=>g.dispatch({op:'gm_resolve_packet',target,components,cause:opts.cause||'spell',source:opts.source||null,metadata:opts.metadata||{}},'gm');
const dmg=(g,target,damageType,amount=20,source=null,cause='environment',metadata={})=>g.dispatch({op:'gm_resolve_damage',target,damageType,amount,source,cause,metadata},'gm');

t('complete vocabulary lists baseline and named exceptional damage classes, excluding magic/epic properties',()=>{
 for(const type of ['electricity','sonic','bludgeoning','piercing','slashing','force','untyped','divine','holy','unholy','good','evil','lawful','chaotic'])assert(DAMAGE_TYPES.includes(type),type);
 assert(!DAMAGE_TYPES.includes('magic'));assert(!DAMAGE_TYPES.includes('epic'));
 assert(DR_BYPASS_TAGS.includes('magic'));assert(DR_BYPASS_TAGS.includes('epic'));
 const listed=make().dispatch({op:'list_trait_library'},'actor');assert.deepEqual(listed.damageTypes,DAMAGE_TYPES);
});
t('all named categories can be entered through ordinary GM damage commands',()=>{
 const g=make(),id=creature(g,'dummy',{creatureType:'humanoid'});
 for(const type of DAMAGE_TYPES)assert.equal(dmg(g,id,type,1).applied,1,type);
 assert.throws(()=>dmg(g,id,'fire_but_not_real',2),/Unsupported damage type/);
});
t('flame strike style packet splits fire from resistance-ignoring divine portion',()=>{
 const g=make(),id=creature(g,'fiend',{subtypes:['devil']});
 const p=packet(g,id,[{damageType:'fire',amount:15},{damageType:'divine',amount:15}]);
 assert.equal(p.raw,30);assert.equal(p.applied,15);assert.equal(p.components[0].applied,0);assert.equal(p.components[1].applied,15);assert.equal(g.find(id).hp,285);
});
t('hellfire ray style unholy portion damages devil by default',()=>{
 const g=make(),id=creature(g,'fiend',{subtypes:['devil']});
 assert.equal(packet(g,id,[{damageType:'fire',amount:20},{damageType:'unholy',amount:20}],{metadata:{sourceKind:'spell',tags:['evil']}}).applied,20);
});
t('environment hellfire target-sensitive components are per effect, not universal',()=>{
 const g=make();const evil=creature(g,'evil_target',{alignment:'NE',creatureType:'humanoid'});
 const good=creature(g,'good_target',{alignment:'LG',creatureType:'humanoid'},6,5);
 const neutral=creature(g,'neutral_target',{alignment:'N',creatureType:'humanoid'},4,6);
 const components=[{damageType:'fire',amount:20},{damageType:'unholy',amount:20,alignmentMultipliers:[{alignment:'evil',factor:0},{alignment:'good',factor:2}]}];
 assert.equal(packet(g,evil,components).applied,20);
 assert.equal(packet(g,good,components).applied,60);
 assert.equal(packet(g,neutral,components).applied,40);
});
t('inherited Devil fire immunity and alignment-specific hellfire exception apply separately',()=>{
 const g=make(),devil=creature(g,'devil',{subtypes:['devil']});
 assert.equal(packet(g,devil,[{damageType:'fire',amount:20},{damageType:'unholy',amount:20,alignmentMultipliers:[{alignment:'evil',factor:0},{alignment:'good',factor:2}]}]).applied,0);
});
t('alignment subtype weapon property bypasses DR but does not add damage',()=>{
 const g=make(),target=creature(g,'good_guard',{creatureType:'humanoid',protections:{dr:[{amount:10,bypass:['evil']}]}});
 const outsider=creature(g,'outsider',{alignment:'NE',subtypes:[]},6,5);
 const evilSubtype=creature(g,'fiend',{alignment:'N',subtypes:['evil']},3,6);
 assert.equal(dmg(g,target,'slashing',20,outsider,'weapon').applied,10);
 assert.equal(dmg(g,target,'slashing',20,evilSubtype,'weapon').applied,20);
 assert.deepEqual(g.weaponBypassTags(evilSubtype,{}),['evil']);
 assert.equal(g.traits(evilSubtype).weaponAlignments.includes('evil'),true);
});
t('Devil natural and wielded weapons inherit both lawful and evil DR bypass',()=>{
 const g=make(),target=creature(g,'ward',{protections:{dr:[{amount:8,bypass:['lawful']},{amount:5,bypass:['evil']}]}}),source=creature(g,'devil',{subtypes:['devil']},6,5);
 assert.equal(dmg(g,target,'piercing',20,source,'weapon').applied,20);
});
t('DR applies once to physical total in one packet, not each component',()=>{
 const g=make(),target=creature(g,'armored',{protections:{dr:[{amount:5,bypass:['silver']}]}});
 const p=packet(g,target,[{damageType:'slashing',amount:10},{damageType:'piercing',amount:10},{damageType:'fire',amount:7}],{cause:'weapon'});
 assert.equal(p.applied,22);assert.equal(p.drPrevented,5);
 assert.equal(p.components.reduce((a,c)=>a+c.applied,0),22);
});
t('different component immunities and resistance use one atomic packet',()=>{
 const g=make(),target=creature(g,'devil',{subtypes:['devil']});
 const p=packet(g,target,[{damageType:'fire',amount:12},{damageType:'acid',amount:14},{damageType:'electricity',amount:8}]);
 assert.equal(p.applied,12);assert.equal(p.components[1].applied,4);
});
t('unholy holy and the four alignment-named damage labels are not universally resisted based on alignment',()=>{
 const g=make(),target=creature(g,'fiend',{alignment:'LE',subtypes:['devil']});
 assert.equal(packet(g,target,[{damageType:'unholy',amount:10},{damageType:'evil',amount:7},{damageType:'holy',amount:5},{damageType:'good',amount:3}]).applied,25);
});
t('enhancement values bypass DR but leave magic and Epic separate from damage type',()=>{
 const g=make(),target=creature(g,'tough',{protections:{dr:[{amount:10,bypass:['epic']},{amount:5,bypass:['cold_iron']}]}});
 assert.equal(dmg(g,target,'bludgeoning',20,null,'weapon').applied,10);
 assert.equal(dmg(g,target,'bludgeoning',20,null,'weapon',{enhancementBonus:3}).applied,10);
 assert.equal(dmg(g,target,'bludgeoning',20,null,'weapon',{enhancementBonus:1,enhancementEquivalent:6}).applied,15);
 assert.equal(dmg(g,target,'bludgeoning',20,null,'weapon',{enhancementBonus:6,enhancementEquivalent:6}).applied,20);
});
t('incorporeal recognized +1 weapon automatically counts as magic',()=>{
 const g=make(),target=creature(g,'ghost',{creatureType:'undead',subtypes:['incorporeal']});
 assert.equal(dmg(g,target,'slashing',13,null,'weapon',{enhancementBonus:1}).applied,6);
});
t('ambiguous subtype/actual alignment mismatches fail loudly, without HP mutation',()=>{
 const g=make(),target=creature(g,'converted',{alignment:'LG',subtypes:['evil']});const before=g.find(target).hp;
 assert.throws(()=>packet(g,target,[{damageType:'unholy',amount:12,alignmentMultipliers:[{alignment:'evil',factor:0},{alignment:'good',factor:2}]}]),/Conflicting target alignment/);
 assert.equal(g.find(target).hp,before);
});
t('invalid component and unknown metadata are atomic',()=>{
 const g=make(),target=creature(g,'dummy',{creatureType:'humanoid'}),hp=g.find(target).hp;
 assert.throws(()=>packet(g,target,[{damageType:'fire',amount:12},{damageType:'xyz',amount:10}]),/Invalid damage type/);
 assert.throws(()=>packet(g,target,[{damageType:'fire',amount:4}],{metadata:{secretScript:'arbitrary'}}),/Unsupported damage metadata/);
 assert.throws(()=>packet(g,target,[{damageType:'holy',amount:6,alignmentMultipliers:[{alignment:'neutral',factor:0}]}]),/Invalid alignment multiplier/);
 assert.equal(g.find(target).hp,hp);
});
t('GM packet permission gate is separate from actor action economy',()=>{
 const g=make(),target=creature(g,'dummy',{creatureType:'humanoid'}),before=g.s.actions.resources.standard;
 assert.throws(()=>g.dispatch({op:'gm_resolve_packet',target,components:[{damageType:'fire',amount:5}]},'actor'),/GM-only/);
 assert.equal(packet(g,target,[{damageType:'fire',amount:5}]).applied,5);
 assert.equal(g.s.actions.resources.standard,before);
});
t('dice components roll inside one validated and seed-replayable packet',()=>{
 const g=make(),target=creature(g,'rolltarget',{creatureType:'humanoid'});
 g.s.testRolls=[3,4];const p=packet(g,target,[{damageType:'fire',dice:{count:2,sides:6}},{damageType:'divine',amount:5}]);
 assert.equal(p.raw,12);assert.equal(p.applied,12);assert.deepEqual(p.components[0].rolls,[3,4]);
});
t('default alignment multiplier expresses neutrality without hardcoded alignment damage rules',()=>{
 const g=make(),evil=creature(g,'bad',{alignment:'CE',creatureType:'humanoid'}),neutral=creature(g,'middle',{alignment:'N',creatureType:'humanoid'},6,5);
 const component={damageType:'holy',amount:11,defaultMultiplier:0.5,alignmentMultipliers:[{alignment:'evil',factor:1},{alignment:'good',factor:0}]};
 assert.equal(packet(g,evil,[component]).applied,11);
 assert.equal(packet(g,neutral,[component]).applied,5);
});
console.log(`${count} V3.8 effect packet tests passed`);
// Regression: the same offensive trait resolution must work in the real attack command.
{
 const s=initialState();s.tiles={};s.creatures=s.creatures.slice(0,1);s.creatures[0].x=0;s.creatures[0].y=4;
 const g=new FoundationsGame(s);
 const target=creature(g,'target',{creatureType:'humanoid',protections:{dr:[{amount:50,bypass:['evil']}]},stats:{statTotals:{ac:1,touchAc:1,flatFootedAc:1}}},2,4);
 const source=creature(g,'evil_attacker',{alignment:'N',subtypes:['evil'],stats:{reach:2,damageDie:6,statTotals:{ac:11,touchAc:11,flatFootedAc:10}}},3,4);
 // GM-level attack uses ordinary hit/damage resolution without spending actions.
 g.s.testRolls=[20,5];
 const result=g.dispatch({op:'admin_attack',actor:source,target},'gm');
 assert.equal(result.hit,true);assert(result.damage.applied>0,'Subtype-derived Evil alignment must bypass DR/evil during an ordinary attack');
 console.log('PASS ordinary attack inherits subtype-based alignment bypass');
}
