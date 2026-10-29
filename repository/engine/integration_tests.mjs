import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AIAdapter,bounded} from './ai_adapter.mjs';
import {callTool,REFERENCES,reference,TOOLS} from './mcp_tools.mjs';
import {COMMANDS} from './integration_catalog.mjs';
import {openSessionStore} from './session_store.mjs';
import {Kernel,initialState} from './kernel.mjs';
import {clone} from './core.mjs';
import {isReadOnlyCommand} from './lifecycle.mjs';
let number=0,count=0;
const test=(name,fn)=>{fn();count++;console.log('PASS',name);};
const send=(a,command,channel='gm',extra={})=>a.execute(channel,{command,requestId:'test_'+ ++number,expectedRevision:a.revision,...(channel==='gm'?{reason:'Integration test declaration'}:{}),...extra});
const make=()=>{const s=initialState();s.tiles={};Object.assign(s.creatures[0],{x:1,y:3,hp:200,maxHp:200});Object.assign(s.creatures[1],{x:7,y:3,size:1,hp:200,maxHp:200});return new AIAdapter({game:new Kernel(s)});};
test('fresh empty encounter and pure status/query/catalog',()=>{
 const a=new AIAdapter(),before=a.snapshot();assert.equal(a.status().active,null);assert.equal(a.status().creatures.length,0);
 assert(a.catalog({channel:'action'}).commands.some(c=>c.op==='attack'));assert(a.query({command:{op:'gm_get_map'}}).data.width===10);
 assert.deepEqual(a.snapshot(),before);assert.throws(()=>a.query({command:{op:'gm_roll',kind:'plain'}}),/read-only/);
});
test('tool-only setup, initiative and action expenditure do not need direct state writes',()=>{
 const a=new AIAdapter();let rev=callTool(a,'kernel_status').structuredContent.revision;
 function tool(name,command){const r=callTool(a,name,{command,expectedRevision:rev,requestId:'flow_'+ ++number,...(name==='kernel_gm'?{reason:'Build fictional test encounter'}:{})});assert(!r.isError,JSON.stringify(r));rev=r.structuredContent.revision;return r.structuredContent;}
 const definition=a.catalog({op:'register_creature'}).example.definition;tool('kernel_gm',{op:'register_creature',definition});
 tool('kernel_gm',{op:'spawn_creature',definition:definition.id,id:'one',x:1,y:1,team:'party'});tool('kernel_gm',{op:'spawn_creature',definition:definition.id,id:'two',x:2,y:1,team:'enemy'});
 tool('kernel_gm',{op:'gm_begin_initiative',scores:{one:20,two:10}});const r=tool('kernel_action',{op:'attack',actor:'one',target:'two'});assert.equal(r.state.actions.resources.standard,0);
 const before=a.snapshot();assert(callTool(a,'kernel_action',{command:{op:'attack',actor:'one',target:'two'},expectedRevision:rev,requestId:'overspend'}).isError);assert.deepEqual(a.snapshot(),before);
 tool('kernel_action',{op:'end_turn'});assert.equal(a.status().active,'two');
});
test('ordinary tool cannot invoke GM overrides or smuggle role metadata',()=>{
 const a=make(),before=a.snapshot();assert.throws(()=>send(a,{op:'admin_attack',actor:'hero',target:'warden'},'action'),/kernel_gm/);
 assert(callTool(a,'kernel_action',{command:{op:'end_turn'},expectedRevision:a.revision,requestId:'role',role:'gm'}).isError);
 assert(callTool(a,'kernel_gm',{command:{op:'end_turn'},expectedRevision:a.revision,requestId:'missing_reason'}).isError);
 assert.deepEqual(a.snapshot(),before);
});
test('retry executes once, changed request IDs conflict, stale intentions reject',()=>{
 const a=make();a.game.s.testRolls=[4];const args={command:{op:'gm_roll',kind:'damage',target:'hero',count:1,sides:6,cause:'environment',damageType:'bludgeoning'},expectedRevision:a.revision,requestId:'once',reason:'Environmental injury'};
 const r=a.execute('gm',args);assert.equal(a.game.find('hero').hp,196);const after=a.snapshot();assert(a.execute('gm',args).replayed);assert.deepEqual(a.snapshot(),after);
 assert.throws(()=>a.execute('gm',{...args,command:{...args.command,count:2}}),/different arguments/);
 assert.throws(()=>a.execute('gm',{...args,requestId:'stale'}),/State changed/);assert.deepEqual(a.snapshot(),after);
 assert.equal(a.result({requestId:'once',path:'/rolls'}).data[0],4);assert.equal(r.revision,a.revision);
});
test('native validation failure restores RNG, engine state, checkpoints and adapter revision',()=>{
 const a=make();a.game.s.testRolls=[20];const before=a.snapshot();assert.throws(()=>send(a,{op:'move',actor:'hero',path:[{x:9,y:7}]},'action'));assert.deepEqual(a.snapshot(),before);
 assert.throws(()=>send(a,{op:'gm_resolve_fall',target:'hero',fall:{distanceFeet:-1}}));assert.deepEqual(a.snapshot(),before);
});
test('persistence failure does not acknowledge or commit a command',()=>{
 const a=make();a.persist=()=>{throw Error('Simulated storage failure');};const before=a.snapshot();assert.throws(()=>send(a,{op:'gm_resolve_damage',target:'hero',amount:5,damageType:'force'}),/storage failure/);assert.deepEqual(a.snapshot(),before);
});
test('saved restart preserves retries and native undo checkpoints',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kernel-integration-')),file=path.join(dir,'encounter.json');let store;
 try{
  store=openSessionStore(file);assert.throws(()=>openSessionStore(file),/running server/);const a=make();a.persist=store.save;a.game.turnStart=clone(a.game.s);
  const args={command:{op:'gm_resolve_damage',target:'hero',amount:7,damageType:'force'},expectedRevision:a.revision,requestId:'restart',reason:'Test injury'};a.execute('gm',args);store.close();store=openSessionStore(file);
  const b=new AIAdapter({saved:store.saved,persist:store.save});assert.equal(b.game.find('hero').hp,193);assert(b.execute('gm',args).replayed);send(b,{op:'undo_turn'});assert.equal(b.game.find('hero').hp,200);assert.notEqual(b.revision,args.expectedRevision);
 }finally{store?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('movement AoO continuation resumes the original paid path',()=>{
 const a=make();Object.assign(a.game.find('warden'),{x:3,y:3,reach:1});
 const r=send(a,{op:'move',actor:'hero',path:[{x:2,y:3},{x:2,y:4}]},'action');assert(a.game.s.interrupt);const choice=r.state.continuations.find(c=>c.kind==='interrupt').choices.find(c=>!c.take);
 send(a,choice,'action');assert.equal(a.game.find('hero').y,4);assert.equal(a.status().actions.resources.move,0);assert.equal(a.status().unresolved.actions.length,0);
});
test('casting pauses expose native AoO decisions and one safe resume',()=>{
 const a=make();Object.assign(a.game.find('warden'),{x:2,y:3,reach:1});
 send(a,{op:'cast_spell',actor:'hero',spell:{name:'Test spell',level:1,casterLevel:3,targets:['warden'],components:[{amount:3,damageType:'force'}]}},'action');
 const c=a.status().continuations.find(c=>c.kind==='casting_aoo');assert(c);send(a,c.choices.find(x=>!x.take));const next=a.status().continuations.find(c=>c.kind==='casting_resume');assert(next);send(a,next.choices[0]);
 assert.equal(a.game.find('warden').hp,197);assert.equal(a.status().actions.resources.standard,0);assert(!a.game.s.pendingSpellCast);
});
test('full attack continuation exposes next strike and finish rather than restart',()=>{
 const a=make();a.game.find('hero').bab=11;a.game.find('warden').x=2;a.game.s.testRolls=[1];const r=send(a,{op:'full_attack',actor:'hero',target:'warden'},'action');const c=r.state.continuations.find(x=>x.kind==='full_attack');assert(c);assert(c.choices.some(x=>x.op==='full_attack_next'));send(a,c.choices.find(x=>x.op==='finish_full_attack'),'action');assert(!a.game.s.pendingFullAttack);
});
test('time checkpoint choices acknowledge the proper owner without advancing again',()=>{
 const a=make();send(a,{op:'gm_schedule_time_event',id:'bell',label:'Bell',after:{count:2,unit:'round'}});send(a,{op:'gm_advance_time',count:5,unit:'round'});
 const c=a.status().continuations.find(x=>x.kind==='time_event');assert(c);assert.equal(a.game.s.worldRounds,2);send(a,{...c.choices[0],reason:'GM resolves bell'});assert.equal(a.game.s.worldRounds,2);send(a,{op:'gm_advance_time',count:3,unit:'round'});assert.equal(a.game.s.worldRounds,5);
});
test('scene closure discards enemies without a new campaign archive',()=>{
 const a=make();send(a,{op:'gm_close_scene',keep:['hero'],placements:[{id:'hero',x:1,y:1}]});assert.deepEqual(a.status().creatures.map(x=>x.id),['hero']);assert.equal(a.game.find('hero').hp,200);
});
test('bounded query pages and full result details never rerun mechanics',()=>{
 assert.deepEqual(bounded([1,2,3,4],{offset:2,limit:2}).data,[3,4]);assert.equal(bounded({x:[1,2,3]},{limit:1}).truncated,true);
 const a=make();a.game.s.testRolls=[1,2,3];send(a,{op:'gm_roll',kind:'plain',count:3,sides:6});const id=a.lastResult.requestId,before=a.snapshot();assert.deepEqual(a.result({requestId:id,path:'/rolls',offset:1,limit:1}).data,[2]);assert.deepEqual(a.snapshot(),before);
 assert.throws(()=>a.query({command:{op:'inspect'},path:'/not_real'}),/Unknown result path/);
});
test('JSON input guards and MCP tool failures are structured',()=>{
 const a=make(),before=a.snapshot();for(const args of [{command:{op:'end_turn'},requestId:'x',expectedRevision:a.revision,unexpected:true},JSON.parse('{"__proto__":{"polluted":true}}')])assert(callTool(a,'kernel_action',args).isError);
 assert(callTool(a,'kernel_catalog',{op:'constructor'}).isError);assert(callTool(a,'kernel_catalog',{op:'__proto__'}).isError);
 assert.equal({}.polluted,undefined);assert.deepEqual(a.snapshot(),before);assert(callTool(a,'no_such_tool',{}).structuredContent.error);
});
test('catalog agrees with native read-only classification and every reference exists',()=>{
 for(const op of Object.keys(COMMANDS))assert.equal(COMMANDS[op].channel==='query',isReadOnlyCommand(op));
 for(const topic of Object.keys(REFERENCES))assert(reference({topic,limit:1}).text.length>0,topic);
 assert.equal(TOOLS.filter(x=>!x.annotations.readOnlyHint).length,2);assert.equal(TOOLS.length,7);
});
console.log(`${count} integration groups passed`);
