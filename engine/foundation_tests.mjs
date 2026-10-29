import assert from 'node:assert/strict';
import {FoundationsGame} from './foundations.mjs';
import {initialState} from './core.mjs';

let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS',name);};
function game(){const s=initialState();s.tiles={};s.creatures=s.creatures.slice(0,1);return new FoundationsGame(s);}
function def(id,opts={}){
 return {id,name:id,creatureType:opts.creatureType??'humanoid',subtypes:opts.subtypes??[],
  stats:{maxHp:50,hp:50,hitDiceCount:opts.hd??12,reach:1,size:1,speed:30,str:16,dex:12,con:14,int:10,wis:12,cha:22,bab:8,
    statTotals:{ac:19,touchAc:11,flatFootedAc:18,fort:8,ref:5,will:4,attack:12},
    abilityLinks:{attack:['str'],fort:['con']},...opts.stats},
   ...(opts.protections?{protections:opts.protections}:{}),...(opts.traitExceptions?{traitExceptions:opts.traitExceptions}:{}),
   ...(opts.mindless!==undefined?{mindless:opts.mindless}:{}),
   ...(opts.dcDefinitions?{dcDefinitions:opts.dcDefinitions}:{}),
   ...(opts.progression?{progression:opts.progression}:{})};
}
function spawn(g,d,x=4,y=4){g.dispatch({op:'register_creature',definition:d},'gm');g.dispatch({op:'spawn_creature',definition:d.id,id:d.id,x,y},'gm');return d.id;}
function apply(g,target,damageType,amount=20,metadata={},cause='environment'){
 return g.dispatch({op:'gm_resolve_damage',target,amount,damageType,cause,metadata},'gm');
}

test('devil inherits fire immunity and acid/cold resistance with no double application',()=>{
 const g=game(),id=spawn(g,def('devil_1',{creatureType:'outsider',subtypes:['devil'],protections:{resistances:{acid:5,cold:15}}}));
 assert.equal(apply(g,id,'fire').applied,0);assert.equal(apply(g,id,'acid').applied,10);assert.equal(apply(g,id,'cold').applied,5);
 assert.equal(g.traits(id).resistances.cold,15);
});
test('subtype suppression explicitly overrides fire immunity',()=>{
 const g=game(),id=spawn(g,def('custom_devil',{creatureType:'outsider',subtypes:['devil'],traitExceptions:{suppressImmunities:['fire']}}));
 assert.equal(apply(g,id,'fire').applied,20);
});
test('demon and devil resistances do not add together',()=>{
 const g=game(),id=spawn(g,def('hybrid',{creatureType:'outsider',subtypes:['devil','demon']}));
 assert.equal(g.traits(id).resistances.acid,10);assert.equal(apply(g,id,'acid',18).applied,8);
});
test('incorporeal blocks mundane weapons, halves magical and takes full force and ghost touch',()=>{
 const g=game(),id=spawn(g,def('spirit',{creatureType:'undead',subtypes:['incorporeal']}));
 assert.equal(apply(g,id,'slashing',19,{},'weapon').applied,0);
 assert.equal(apply(g,id,'slashing',19,{magical:true},'weapon').applied,9);
 assert.equal(apply(g,id,'slashing',19,{magical:true,ghostTouch:true},'weapon').applied,19);
 assert.equal(apply(g,id,'force',8,{sourceKind:'spell'},'spell').applied,8);
});
test('DR sources do not stack; evaluate bypass for each before choosing highest',()=>{
 const g=game(),id=spawn(g,def('ironhide',{protections:{dr:[{amount:10,bypass:['silver']},{amount:5,bypass:['magic']}]}}));
 assert.equal(apply(g,id,'slashing',18,{},'weapon').applied,8);
 assert.equal(apply(g,id,'slashing',18,{weaponTags:['silver']},'weapon').applied,13);
 assert.equal(apply(g,id,'slashing',18,{weaponTags:['silver'],magical:true},'weapon').applied,18);
 assert.equal(apply(g,id,'fire',18,{},'spell').applied,18);
});
test('effect descriptors let subtype immunity operate before condition logic',()=>{
 const g=game(),id=spawn(g,def('skeletal',{creatureType:'undead'}));
 const result=g.dispatch({op:'apply_condition',target:id,condition:'shaken'},'gm');
 assert.equal(result.immune,true);assert.equal(g.hasCondition(id,'shaken'),false);
 assert.equal(g.dispatch({op:'gm_evaluate_effect',target:id,tags:['poison']},'gm').blocked,true);
});
test('undead poison/disease ailment blocked before rolling any exposure save',()=>{
 const g=game(),id=spawn(g,def('corpse',{creatureType:'undead'}));
 g.dispatch({op:'register_ailment',definition:{id:'vile_venom',name:'Vile Venom',kind:'poison',delivery:'injury',save:{type:'fort',dc:22},frequency:{every:{count:1,unit:'round'},maxTicks:5},cure:{successes:1,consecutive:true},effects:[{kind:'ability_damage',ability:'str',dice:{count:1,sides:4}}]}},'gm');
 const prior=g.s.seed,result=g.dispatch({op:'expose_ailment',definition:'vile_venom',target:id},'gm');
 assert.equal(result.immune,true);assert.equal(g.s.seed,prior);assert.equal(g.s.activeAilments.length,0);
});
test('undead physical ability damage immune, mental ability damage not automatically immune',()=>{
 const g=game(),id=spawn(g,def('wight',{creatureType:'undead'}));
 assert.equal(g.dispatch({op:'apply_ability_damage',target:id,ability:'str',amount:3},'gm').immune,true);
 assert.equal(g.dispatch({op:'apply_ability_damage',target:id,ability:'cha',amount:2},'gm').amount,2);
 assert.equal(g.s.abilityDamage[id]?.cha,2);
});
test('HD formula and Charisma drain recalculate DC',()=>{
 const g=game(),id=spawn(g,def('fearsinger',{dcDefinitions:{fear:{basis:'half_hd',ability:'cha',published:22}}}));
 assert.equal(g.calculateDC({actor:id,abilityId:'fear'}).dc,22);
 g.dispatch({op:'apply_ability_drain',target:id,ability:'cha',amount:2},'gm');
 assert.equal(g.calculateDC({actor:id,abilityId:'fear'}).dc,21);
 assert.equal(g.calculateDC({actor:id,abilityId:'fear'}).advisories.length,1);
});
test('spell/class/BAB/racial/fixed DC formulas handle alternate scale',()=>{
 const g=game(),id=spawn(g,def('scholar',{hd:10,stats:{bab:8},progression:{racialHitDice:6,classLevels:{wizard:4}},dcDefinitions:{
  breath:{basis:'half_racial_hd',ability:'con'},
  arcane:{basis:'spell',spellLevel:5,ability:'int'},
  classpower:{basis:'class_level',className:'wizard',numerator:1,denominator:1,ability:'cha'},
  swordcraft:{basis:'bab',numerator:1,denominator:2,ability:'str'},
  fixed:{basis:'fixed',fixed:17}
 }}));
 assert.equal(g.calculateDC({actor:id,abilityId:'breath'}).dc,15);
 assert.equal(g.calculateDC({actor:id,abilityId:'arcane'}).dc,15);
 assert.equal(g.calculateDC({actor:id,abilityId:'classpower'}).dc,20);
 assert.equal(g.calculateDC({actor:id,abilityId:'swordcraft'}).dc,17);
 assert.equal(g.calculateDC({actor:id,abilityId:'fixed'}).dc,17);
});
test('undead substitutes CHA for CON-based DC while construct uses +0',()=>{
 const g=game(),undead=spawn(g,def('lich',{creatureType:'undead',dcDefinitions:{ability:{basis:'half_hd',ability:'con'}}}));
 assert.equal(g.calculateDC({actor:undead,abilityId:'ability'}).dc,22);
 const construct=spawn(g,def('golem',{creatureType:'construct',dcDefinitions:{ability:{basis:'half_hd',ability:'con'}}}),6,5);
 assert.equal(g.calculateDC({actor:construct,abilityId:'ability'}).dc,16);
});
test('invalid definitions rejected and not retained',()=>{
 const g=game();let bad=def('bad',{subtypes:['unknown']});
 assert.throws(()=>g.dispatch({op:'register_creature',definition:bad},'gm'),/subtypes/);
 assert.equal(Object.keys(g.s.creatureCatalog).length,0);
 bad=def('bad',{protections:{resistances:{acid:'huge'}}});
 assert.throws(()=>g.dispatch({op:'register_creature',definition:bad},'gm'),/resistance/);
 assert.equal(Object.keys(g.s.creatureCatalog).length,0);
});
test('only GM may resolve raw damage and calculations without action costs',()=>{
 const g=game(),id=spawn(g,def('guard'));
 const before=g.s.actions.resources.standard;
 assert.throws(()=>g.dispatch({op:'gm_resolve_damage',target:id,amount:7,damageType:'fire'},'actor'),/GM-only/);
 assert.equal(apply(g,id,'fire',7).applied,7);
 assert.equal(g.s.actions.resources.standard,before);
});
test('persistent defenses save, restore and preserve source trace',()=>{
 const g=game(),id=spawn(g,def('devil_save',{creatureType:'outsider',subtypes:['devil']}));
 const restored=new FoundationsGame(JSON.parse(JSON.stringify(g.s)));
 assert.equal(restored.traits(id).sources.includes('subtype:devil'),true);
 assert.equal(apply(restored,id,'fire').applied,0);
});
test('mindless ooze default immunity can be overridden by an intelligent ooze',()=>{
 const g=game();
 const a=def('simple_ooze',{creatureType:'ooze'});delete a.stats.int;
 const id=spawn(g,a);assert.equal(g.traits(id).immunities.includes('mind_affecting'),true);
 const intelligent=spawn(g,def('intelligent_ooze',{creatureType:'ooze',mindless:false}),6,5);
 assert.equal(g.traits(intelligent).immunities.includes('mind_affecting'),false);
});
test('construct Fortitude-save immunity preserves harmless/object exceptions',()=>{
 const g=game(),id=spawn(g,def('clockwork',{creatureType:'construct'}));
 assert.equal(g.evaluateEffect({target:id,tags:[],save:'fort'}).blocked,true);
 assert.equal(g.evaluateEffect({target:id,tags:[],save:'fort',worksOnObjects:true}).blocked,false);
 assert.equal(g.evaluateEffect({target:id,tags:[],save:'fort',harmless:true}).blocked,false);
});
test('ordinary attack resolution forwards authored magical-weapon metadata to defenses',()=>{
 const s=initialState();s.tiles={};s.creatures=s.creatures.slice(0,1);s.creatures[0].x=1;s.creatures[0].y=4;
 s.creatures[0].attackTraits={magical:true};
 const g=new FoundationsGame(s),target=def('magic_target',{creatureType:'undead',subtypes:['incorporeal'],stats:{statTotals:{ac:10,touchAc:10,flatFootedAc:10}}});
 target.stats.abilityLinks={};const id=spawn(g,target,2,4);
 g.s.testRolls=[20,8];const hit=g.dispatch({op:'attack',actor:'hero',target:id},'actor');
 assert.equal(hit.hit,true);assert.equal(hit.damage.applied,5);assert.equal(g.find(id).hp,45);
});
console.log(`${passed} V3.7 foundational tests passed`);
