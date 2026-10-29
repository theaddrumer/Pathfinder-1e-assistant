import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AIAdapter,ENGINE_VERSION} from './ai_adapter.mjs';
import {callTool,REFERENCES} from './mcp_tools.mjs';
import {SUBTYPE_CATALOG} from './trait_library.mjs';
let groups=0,sequence=0;
const test=(name,fn)=>{fn();groups++;console.log('PASS',name)};
const send=(a,command)=>a.execute('gm',{command,expectedRevision:a.revision,requestId:`subtype_${++sequence}`,reason:'Subtype regression fixture'});
function definition(id,subtypes,creatureType='humanoid'){
 return {id,name:`Fictional ${id}`,creatureType,subtypes,stats:{maxHp:20,str:12,dex:12,con:12,int:10,wis:10,cha:10,sizeCategory:'small',skills:{Stealth:7},statTotals:{ac:15,touchAc:12,flatFootedAc:14,attack:3,damage:1,fort:2,ref:1,will:0}}};
}
function spawn(a,d,x=1,y=1){send(a,{op:'register_creature',definition:d});send(a,{op:'spawn_creature',definition:d.id,id:d.id,x,y,team:'enemy'});return a.game.find(d.id)}
test('goblinoid and reptilian imports retain identity without changing totals',()=>{
 const a=new AIAdapter();
 for(const [i,subtype] of ['goblinoid','reptilian'].entries()){
  const d=definition(subtype,[subtype]),c=spawn(a,d,i+1,1);
  assert.deepEqual(c.subtypes,[subtype]);assert.equal(c.creatureType,'humanoid');
  for(const [key,value] of Object.entries(d.stats.statTotals))assert.equal(a.game.stat(c.id,key),value);
  assert.deepEqual(c.skills,d.stats.skills);assert.deepEqual(a.game.traits(c.id).immunities,[]);
 }
 const b=new AIAdapter({saved:a.snapshot()});assert.deepEqual(b.game.s.creatureCatalog,a.game.s.creatureCatalog);
 assert.deepEqual(b.game.classification('goblinoid'),{creatureType:'humanoid',subtypes:['goblinoid'],classificationOnlySubtypes:['goblinoid']});
});
test('every advertised subtype validates and classification-only entries grant no traits',()=>{
 const a=new AIAdapter();
 for(const [id,coverage] of Object.entries(SUBTYPE_CATALOG))a.game.validateCreature(definition('probe',[id]));
 for(const [i,id] of ['angel','aquatic','mythic'].entries()){
  spawn(a,definition(id,[id]),i+1,1);const t=a.game.traits(id);
  assert.deepEqual(t.classificationOnlySubtypes,[id]);assert.deepEqual(t.immunities,[]);assert.deepEqual(t.resistances,{});assert.deepEqual(t.weaponAlignments,[]);
  assert(t.notes.some(n=>n.includes('No automatic subtype abilities')));
 }
});
test('passive labels coexist with prior defensive automation and explicit protections',()=>{
 const a=new AIAdapter();const d=definition('fiend',['devil','goblinoid'],'outsider');d.protections={resistances:{acid:20}};spawn(a,d);
 const t=a.game.traits('fiend');assert(t.immunities.includes('fire'));assert(t.immunities.includes('poison'));
 assert.equal(t.resistances.acid,20);assert.equal(t.resistances.cold,10);assert.deepEqual(t.weaponAlignments,['lawful','evil']);
 assert.deepEqual(t.classificationOnlySubtypes,['goblinoid']);
});
test('augmented original type remains distinct from the current creature type',()=>{
 const a=new AIAdapter();spawn(a,definition('changed',['augmented_humanoid','human'],'outsider'));
 const t=a.game.traits('changed');assert.equal(t.creatureType,'outsider');assert.deepEqual(t.subtypes,['augmented_humanoid','human']);
 assert(!t.sources.includes('type:humanoid'));assert.deepEqual(t.immunities,[]);
});
test('invalid subtype input rejects atomically with the actual offending location',()=>{
 const a=new AIAdapter();
 for(const subtypes of [['goblinoid','devli'],['Goblinoid'],['goblinoid','goblinoid'],[42],['__proto__'],Array(25).fill('human')]){
  const before=a.snapshot();assert.throws(()=>send(a,{op:'register_creature',definition:definition('bad',subtypes)}),/subtypes/);assert.deepEqual(a.snapshot(),before);
 }
 assert.throws(()=>a.game.validateCreature(definition('bad',['goblinoid','devli'])),/definition\.subtypes\[1\].*devli.*list_trait_library/);
});
test('tool discovery and focused status expose coverage without mutating the encounter',()=>{
 const a=new AIAdapter();spawn(a,definition('one',['goblinoid']));const before=a.snapshot();
 const entry=callTool(a,'kernel_catalog',{op:'list_trait_library'}).structuredContent;assert.equal(entry.referenceTopic,'subtypes');
 let offset=0,ids=[];
 do{const r=callTool(a,'kernel_query',{command:{op:'list_trait_library'},path:'/subtypes',offset,limit:20}).structuredContent;ids.push(...r.data);offset=r.page.nextOffset}while(offset!==null);
 assert.equal(ids.length,Object.keys(SUBTYPE_CATALOG).length);assert(ids.includes('goblinoid')&&ids.includes('reptilian'));
 const coverage=callTool(a,'kernel_query',{command:{op:'list_trait_library'},path:'/subtypeCoverage/angel'}).structuredContent;assert.equal(coverage.data.automation,'classification_only');
 const status=callTool(a,'kernel_status',{target:'one'}).structuredContent;assert.deepEqual(status.creatures[0].classification.subtypes,['goblinoid']);
 status.creatures[0].classification.subtypes.push('devil');coverage.data.automation='pretend';assert.deepEqual(a.snapshot(),before);
 assert.equal(SUBTYPE_CATALOG.angel.automation,'classification_only');assert.equal(REFERENCES.subtypes,'SUBTYPES_V3_41.md');
 const guide=readFileSync(REFERENCES.subtypes,'utf8');assert(guide.includes('not a published goblin'));assert(guide.includes('Bane'));
});
test('spawns own independent subtype arrays and V3.40 saves retain checkpoints/receipts',()=>{
 const a=new AIAdapter();spawn(a,definition('first',['human','elf']));send(a,{op:'spawn_creature',definition:'first',id:'second',x:2,y:1});
 a.game.find('first').subtypes.push('shapechanger');assert.deepEqual(a.game.find('second').subtypes,['human','elf']);assert.deepEqual(a.game.s.creatureCatalog.first.subtypes,['human','elf']);
 const old=a.snapshot();old.engineVersion='3.40.0';const b=new AIAdapter({saved:old});
 assert.equal(b.snapshot().engineVersion,ENGINE_VERSION);assert.deepEqual(b.snapshot().game,old.game);assert.deepEqual(b.snapshot().receipts,old.receipts);
});
test('published schema example runs through the GM integration boundary',()=>{
 const guide=readFileSync(REFERENCES.subtypes,'utf8'),json=guide.match(/```json\n([^]*?)\n```/)[1],a=new AIAdapter();
 const r=callTool(a,'kernel_gm',{command:JSON.parse(json),expectedRevision:a.revision,requestId:'guide_example',reason:'Documentation test'});assert(!r.isError,JSON.stringify(r));
 assert.deepEqual(a.game.s.creatureCatalog.classification_demo.subtypes,['goblinoid']);
});
console.log(`${groups} subtype classification groups passed`);
