import assert from 'node:assert/strict';
import {AIAdapter,ENGINE_VERSION} from './ai_adapter.mjs';
import {Kernel,initialState} from './kernel.mjs';
import {COMMANDS} from './integration_catalog.mjs';
import {callTool,REFERENCES} from './mcp_tools.mjs';
import {clone} from './core.mjs';
let groups=0,requests=0,examples=0;
const test=(name,fn)=>{fn();groups++;console.log('PASS',name);};
const gm=(g,c)=>g.dispatch(c,'gm');
function fixture(skipRegistration=false){
 const s=initialState();s.tiles={};Object.assign(s.creatures[0],{x:1,y:3,bab:11,hp:500,maxHp:500});Object.assign(s.creatures[1],{id:'foe',x:2,y:3,size:1,reach:1,hp:500,maxHp:500});
 const g=new Kernel(s);
 if(!skipRegistration){gm(g,clone(COMMANDS.register_creature.example));gm(g,{op:'spawn_creature',definition:'guard_v1',id:'guard_1',x:3,y:4});gm(g,{op:'spawn_creature',definition:'guard_v1',id:'caster',x:1,y:6});}
 return g;
}
const invoke=(a,command)=>{
 const c=COMMANDS[command.op];return callTool(a,'kernel_'+(c.channel==='query'?'query':c.channel),c.channel==='query'?{command}:{command,expectedRevision:a.revision,requestId:'clarity_'+ ++requests,...(c.channel==='gm'?{reason:'Exercise documented example'}:{})});
};
test('every supplied catalog example executes through MCP with declared prerequisite setup',()=>{
 for(const c of Object.values(COMMANDS).filter(c=>c.example)){
  const g=fixture(c.op==='register_creature'||c.op==='spawn_creature');
  if(c.op==='spawn_creature')gm(g,clone(COMMANDS.register_creature.example));
  if(c.op==='apply_registered_effect')gm(g,clone(COMMANDS.register_effect.example));
  if(c.op==='gm_cancel_pending_event')gm(g,clone(COMMANDS.gm_register_pending_event.example));
  if(['gm_load_map','gm_delete_map'].includes(c.op))gm(g,{op:'gm_save_map',id:'storehouse',reason:'Prepare saved map prerequisite'});
  if(c.op==='gm_load_map')gm(g,{op:'gm_clear_encounter',reason:'Empty encounter prerequisite'});
  if(c.op==='move')g.find('foe').x=7;
  if(['stand_up','crawl'].includes(c.op))gm(g,{op:'apply_condition',target:'hero',condition:'prone'});
  if(c.op==='gm_end_initiative')gm(g,{op:'gm_begin_initiative',roll:true});
  if(c.op==='cast_spell')g.s.turn=g.s.creatures.findIndex(c=>c.id==='caster');
  if(['full_attack_next','finish_full_attack'].includes(c.op)){g.s.testRolls=[1];g.dispatch(clone(COMMANDS.full_attack.example));}
  if(['resolve_interrupt','gm_resolve_casting_aoo','gm_continue_spell'].includes(c.op)){
   g.dispatch({op:'cast_spell',actor:'hero',spell:{name:'Example cast',level:1,casterLevel:3,targets:['foe'],components:[{damageType:'force',amount:4}]}});
   if(c.op==='gm_continue_spell')gm(g,{op:'gm_resolve_casting_aoo',actor:'foe',take:false});
   if(c.op==='resolve_interrupt'){
    // This example resolves a movement opportunity, not the separate casting checkpoint.
    gm(g,{op:'gm_resolve_casting_aoo',actor:'foe',take:false});gm(g,{op:'gm_continue_spell'});
    g.dispatch({op:'move',actor:'hero',path:[{x:1,y:4}]});assert(g.s.interrupt);
   }
  }
  const a=new AIAdapter({game:g}),r=invoke(a,clone(c.example));
  assert(!r.isError,`${c.op}: ${JSON.stringify(r.structuredContent)}`);examples++;
 }
});
test('all command entries have valid routing and honest partial-guide metadata',()=>{
 const a=new AIAdapter(),before=a.snapshot();let offset=0,listed=[];
 do{const p=callTool(a,'kernel_catalog',{offset,limit:50}).structuredContent;listed.push(...p.commands);offset=p.nextOffset;}while(offset!==null);
 assert.equal(listed.length,Object.keys(COMMANDS).length);
 for(const c of Object.values(COMMANDS)){
  assert(Object.hasOwn(REFERENCES,c.referenceTopic),c.op);
  assert(['reference_only','operating_notes'].includes(c.guidanceCoverage));
  assert(c.required===null||Array.isArray(c.required));assert(c.contract.includes('null means not catalogued'));
  const r=callTool(a,'kernel_reference',{topic:c.referenceTopic,limit:1});assert(!r.isError,c.op);
 }
 assert.deepEqual(a.snapshot(),before);
});
test('targeted inspection returns configured speed and derived stats without mutation',()=>{
 const a=new AIAdapter({game:fixture()});gm(a.game,{op:'apply_condition',target:'hero',condition:'exhausted'});
 const before=a.snapshot(),r=callTool(a,'kernel_status',{target:'hero'});assert(!r.isError);
 const c=r.structuredContent.creatures[0];assert.equal(c.stats.speed,a.game.find('hero').speed);assert.equal(c.stats.attack,a.game.stat('hero','attack'));assert.match(c.statNotes,/base feet/);assert.deepEqual(a.snapshot(),before);
});
test('invalid faction reports valid choices and links back to command-specific help',()=>{
 const a=new AIAdapter({game:fixture()});const before=a.snapshot(),r=invoke(a,{op:'spawn_creature',definition:'guard_v1',id:'bad',x:8,y:6,team:'ally'});
 assert(r.isError);assert.match(r.structuredContent.error.message,/party, enemy, or neutral/);assert.equal(r.structuredContent.help.catalog.op,'spawn_creature');assert.equal(r.structuredContent.help.reference.topic,'registry');assert.deepEqual(a.snapshot(),before);
 assert(callTool(a,'kernel_gm',{command:{op:'GM_Roll'},reason:'Typo test',expectedRevision:a.revision,requestId:'typo'}).isError);
});
test('documented reminder expires but does not pretend to enforce immunity or cooldown use',()=>{
 const a=new AIAdapter({game:fixture()});assert(!invoke(a,clone(COMMANDS.gm_register_pending_event.example)).isError);
 a.game.s.testRolls=[10];const save=invoke(a,clone(COMMANDS.save.example));assert(!save.isError);assert.equal(a.game.s.testRolls.length,0);
 assert(!invoke(a,clone(COMMANDS.gm_set_cooldown.example)).isError);assert.equal(a.game.cooldownsOverview().length,1);
 const advance=invoke(a,{op:'gm_advance_time',count:24,unit:'hour',confirmPendingEvents:true});assert(!advance.isError);
 assert(!a.game.s.pendingEvents.some(e=>e.id==='foe_guard1_immunity'));assert.equal(a.game.cooldownsOverview().length,0);
 assert.match(COMMANDS.gm_register_pending_event.limits,/does not automatically reject/);assert.match(COMMANDS.gm_set_cooldown.limits,/Does not hard-block/);
});
test('documented end-combat and discard-scene workflows have different map consequences',()=>{
 const a=new AIAdapter({game:fixture()});assert(!invoke(a,clone(COMMANDS.gm_set_map_features.example)).isError);assert(!invoke(a,clone(COMMANDS.gm_begin_initiative.example)).isError);
 assert(!invoke(a,clone(COMMANDS.gm_end_initiative.example)).isError);assert.equal(a.game.s.scene.features.length,1);
 const before=a.snapshot(),preview=invoke(a,{op:'gm_preview_scene_close',keep:['hero']});assert(!preview.isError);assert.equal(preview.structuredContent.data.clearTerrain,true);assert.deepEqual(a.snapshot(),before);
 const clock=a.game.s.worldRounds,hp=a.game.find('hero').hp;assert(!invoke(a,clone(COMMANDS.gm_close_scene.example)).isError);assert.equal(a.game.s.scene.features.length,0);assert.equal(a.game.s.worldRounds,clock);assert.equal(a.game.find('hero').hp,hp);
});
test('3.37 and 3.38 sessions load without changing mechanics or losing retry receipts',()=>{
 const a=new AIAdapter({game:fixture()});invoke(a,clone(COMMANDS.gm_roll.example));
 for(const engineVersion of ['3.37.0','3.38.0']){
  const saved={...a.snapshot(),engineVersion},b=new AIAdapter({saved});assert.equal(b.snapshot().engineVersion,ENGINE_VERSION);assert.deepEqual(b.snapshot().game,saved.game);assert.deepEqual(b.snapshot().receipts,saved.receipts);
 }
});
console.log(`${groups} clarity groups passed; ${examples} catalog examples executed`);
