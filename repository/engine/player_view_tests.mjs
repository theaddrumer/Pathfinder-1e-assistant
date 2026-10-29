import assert from 'node:assert/strict';
import {AIAdapter,ENGINE_VERSION} from './ai_adapter.mjs';
import {Kernel,initialState} from './kernel.mjs';
import {callTool} from './mcp_tools.mjs';
import {playerProjection} from './player_view.mjs';
let groups=0,sequence=0;
const test=(name,fn)=>{fn();groups++;console.log('PASS',name)};
function fixture(){const s=initialState();s.tiles={};s.creatures[1].size=1;s.scene=undefined;delete s.scene;return new AIAdapter({game:new Kernel(s)});}
const gm=(a,command)=>a.execute('gm',{command,expectedRevision:a.revision,requestId:`pv_${++sequence}`,reason:'Player view regression'});
const action=(a,command)=>a.execute('action',{command,expectedRevision:a.revision,requestId:`pa_${++sequence}`});
const view=a=>playerProjection(a.game.s);
const reveal=(a,extra={all:true})=>gm(a,{op:'gm_set_player_view',...extra,revealed:true});
const display=(a,id,layer='map',extra={})=>gm(a,{op:'gm_set_player_display',kind:'creature',ids:[id],display:{layer,...extra}});
const feature=(a,rows,remove=[])=>gm(a,{op:'gm_set_map_features',features:rows,remove});
const snapshotsWithoutPresentation=a=>{const s=structuredClone(a.game.s);delete s.scene.playerView;for(const c of s.creatures)delete c.playerDisplay;for(const f of s.scene.features)delete f.playerDisplay;s.log=[];s.actions.activity=0;return s;};

test('old and fresh state defaults private; read-only projection does not mutate',()=>{
 const a=fixture();a.game.find('warden').name='SECRET_MONSTER';a.game.s.scene.name='SECRET_ROOM';a.game.s.log.push('SECRET_HISTORY');const before=a.snapshot();
 assert.deepEqual(view(a),{schema:1,map:{width:10,height:8,squareFeet:5,title:'Encounter map'},cells:[],features:[],tokens:[]});
 assert.deepEqual(a.snapshot(),before);
 const r=callTool(a,'kernel_query',{command:{op:'gm_preview_player_view'}});assert(!r.isError);assert.deepEqual(a.snapshot(),before);
});
test('revealing terrain and changing layers are independent of mechanics and conditions',()=>{
 const a=fixture();const before=snapshotsWithoutPresentation(a);
 display(a,'hero','map',{label:'Explorer'});assert.equal(view(a).tokens.length,0);
 reveal(a);assert.deepEqual(view(a).tokens.map(t=>t.label),['Explorer']);assert.equal(a.game.find('warden').hp,65);
 display(a,'hero','gm');assert.equal(view(a).tokens.length,0);
 assert.deepEqual(snapshotsWithoutPresentation(a),before);assert(!a.game.hasCondition('hero','invisible'));
 assert.equal(a.game.s.actions.activity,1,'Presentation edit should select current turn for undo');
});
test('hidden mechanical participants still threaten and interrupt normal movement',()=>{
 const a=fixture();Object.assign(a.game.find('warden'),{x:2,y:4,reach:1});reveal(a);display(a,'hero');
 const r=action(a,{op:'move',actor:'hero',path:[{x:1,y:3}]});assert.equal(r.result.data.status,'interrupt');assert(a.game.s.interrupt);
 const pending=structuredClone(a.game.s.interrupt),actions=structuredClone(a.game.s.actions),rng=a.game.s.seed;
 display(a,'warden','map',{label:'An attacker'});assert.deepEqual(a.game.s.interrupt,pending);assert.deepEqual(a.game.s.actions,actions);assert.equal(a.game.s.seed,rng);
 assert.equal(view(a).tokens.length,2);display(a,'warden','gm');assert.equal(view(a).tokens.length,1);
});
test('public allowlist excludes internal identity, hidden traps, hazards and distant geometry',()=>{
 const a=fixture();a.game.find('hero').name='SECRET_NAME';a.game.s.scene.name='SECRET_TITLE';a.game.s.tiles['1,1']='hazard';
 feature(a,[{id:'secret_trap',name:'SECRET_TRAP',preset:'open',cells:[{x:1,y:1}],note:'SECRET_DC'},
 {id:'boundary',name:'SECRET_WALL',preset:'wall',points:[{x:0,y:2},{x:10,y:2}],note:'SECRET_NOTE',playerDisplay:{layer:'map',label:'Stone',style:'wall'}},
 {id:'diagonal',preset:'open',points:[{x:0,y:0},{x:8,y:8}],playerDisplay:{layer:'map',label:'Edge'}}]);
 reveal(a,{rect:{x:1,y:1,width:2,height:2}});display(a,'hero');
 const p=view(a),raw=JSON.stringify(p);assert(!raw.includes('SECRET'));assert(!raw.includes('secret_trap'));assert(!raw.includes('hero'));assert(!raw.includes('boundary'));
 assert.equal(p.cells.find(c=>c.x===1&&c.y===1).terrain,'floor');assert.equal(p.features.length,2);assert.equal(p.tokens.length,0);
 for(const f of p.features)for(const [u,v] of f.segments){for(const q of [u,v]){assert(q.x>=1&&q.x<=3);assert(q.y>=1&&q.y<=3)}}
 assert.equal(p.features[0].segments.length,2);
});
test('large tokens require fully revealed footprints; cell features clip without metadata',()=>{
 const a=fixture();a.game.find('warden').size=2;display(a,'warden','map',{label:'Large creature'});
 feature(a,[{id:'region',preset:'open',cells:[{x:5,y:3},{x:6,y:3}],playerDisplay:{layer:'map',label:'Water',style:'water'}}]);
 reveal(a,{cells:[{x:5,y:3}]});assert.equal(view(a).tokens.length,0);assert.deepEqual(view(a).features[0].cells,[{x:5,y:3}]);
 reveal(a,{rect:{x:5,y:3,width:2,height:2}});assert.equal(view(a).tokens.length,1);assert.equal(view(a).tokens[0].size,2);
 gm(a,{op:'gm_set_player_view',cells:[{x:6,y:4}],revealed:false});assert.equal(view(a).tokens.length,0);
});
test('feature updates preserve display, removal/recreation does not; door state stays visual',()=>{
 const a=fixture();reveal(a);
 const f={id:'door',preset:'door',points:[{x:8,y:1},{x:8,y:2}],playerDisplay:{layer:'map',label:'Door',style:'door'}};
 feature(a,[f]);assert.equal(view(a).features[0].open,false);
 gm(a,{op:'gm_set_door',id:'door',state:'open'});assert.equal(view(a).features[0].open,true);
 const update={...f,doorState:'open'};delete update.playerDisplay;feature(a,[update]);assert.equal(view(a).features[0].label,'Door');
 feature(a,[],['door']);feature(a,[update]);assert.equal(view(a).features.length,0);
});
test('invalid display/reveal batches reject atomically; actor cannot publish and no HTML is executed',()=>{
 const a=fixture();const cases=[
 {op:'gm_set_player_display',kind:'creature',ids:['hero','absent'],display:{layer:'map'}},
 {op:'gm_set_player_display',kind:'creature',ids:['hero'],display:{layer:'map',color:'url(secret)'}},
 {op:'gm_set_player_display',kind:'creature',ids:['hero'],display:{layer:'map',hidden:false}},
 {op:'gm_set_player_view',cells:[{x:1,y:1},{x:100,y:1}],revealed:true},
 {op:'gm_set_player_view',all:true,rect:{x:0,y:0,width:1,height:1},revealed:true},
 {op:'gm_set_player_view',all:true},
 {op:'gm_set_player_view',title:'ok',revealed:true}
 ];for(const cmd of cases){const before=a.snapshot();assert.throws(()=>gm(a,cmd));assert.deepEqual(a.snapshot(),before)}
 assert.throws(()=>a.game.dispatch({op:'gm_set_player_view',all:true,revealed:true,reason:'No'},'actor'),/GM-only/);
 assert.throws(()=>action(a,{op:'gm_set_player_display',kind:'creature',ids:['hero'],display:{layer:'map'}}),/kernel_gm/);
 gm(a,{op:'gm_set_player_view',title:'<img src=x onerror=alert(1)>'});assert.equal(view(a).map.title,'<img src=x onerror=alert(1)>');
});
test('presentation survives saves, retries and undo without a second state owner',()=>{
 const a=fixture();a.game.s.previousSentinel='kept';a.game.turnStart=structuredClone(a.game.s);
 reveal(a);display(a,'hero','map',{label:'Explorer'});const saved=a.snapshot(),b=new AIAdapter({saved});assert.deepEqual(view(b),view(a));
 gm(a,{op:'undo_turn'});assert.equal(view(a).cells.length,0);assert.equal(view(a).tokens.length,0);assert.equal(a.game.s.previousSentinel,'kept');
 const old=b.snapshot();old.engineVersion='3.42.0';const c=new AIAdapter({saved:old});assert.equal(c.snapshot().engineVersion,ENGINE_VERSION);assert.deepEqual(c.snapshot().game,old.game);
 const args={command:{op:'gm_set_player_view',title:'Once'},expectedRevision:b.revision,requestId:'repeat_public',reason:'Retry test'};b.execute('gm',args);const once=b.snapshot();assert(b.execute('gm',args).replayed);assert.deepEqual(b.snapshot(),once);
});
test('resize prunes masks, expansion stays hidden, closure resets survivor display',()=>{
 const a=fixture();reveal(a);display(a,'hero');gm(a,{op:'gm_configure_map',width:9,height:7});assert.equal(view(a).cells.length,63);
 gm(a,{op:'gm_configure_map',width:10,height:8});assert.equal(view(a).cells.length,63);
 gm(a,{op:'gm_close_scene',keep:['hero'],placements:[{id:'hero',x:1,y:1}]});assert.equal(view(a).cells.length,0);assert.equal(a.game.find('hero').playerDisplay,undefined);assert.equal(view(a).map.title,'Encounter map');
 reveal(a);assert.equal(view(a).tokens.length,0);
});
test('spawn accepts public metadata atomically without installing it on the definition',()=>{
 const a=fixture();gm(a,{op:'register_creature',definition:{id:'test',name:'SECRET_TEMPLATE',stats:{maxHp:10}}});reveal(a);
 gm(a,{op:'spawn_creature',definition:'test',id:'extra',x:8,y:6,playerDisplay:{layer:'map',label:'Visitor'}});
 assert.equal(view(a).tokens[0].label,'Visitor');assert.equal(a.game.s.creatureCatalog.test.playerDisplay,undefined);
});
test('vitals opt-in publishes only native health and condition names, follows edits and saves',()=>{
 const a=fixture();reveal(a);display(a,'hero');display(a,'warden');
 assert(view(a).tokens.every(t=>!('vitals' in t)));
 display(a,'hero','map',{showVitals:true,label:'Explorer'});
 gm(a,{op:'apply_condition',target:'hero',condition:'shaken',rounds:2});
 a.game.s.conditionInstances.find(e=>e.target==='hero').note='PRIVATE_CONDITION_NOTE';
 a.game.s.energyTempHp.hero=[{amount:4,expiresAt:100,source:'PRIVATE_HP_SOURCE'}];
 a.game.s.nonlethalDamage.hero=2;
 let v=view(a).tokens.find(t=>t.label==='Explorer').vitals;
 assert.deepEqual(v,{hp:a.game.find('hero').hp,maxHp:a.game.find('hero').maxHp,temporaryHp:4,nonlethal:2,conditions:['shaken']});
 const hp=v.hp;gm(a,{op:'gm_resolve_damage',target:'hero',amount:7,damageType:'force'});
 v=view(a).tokens.find(t=>t.vitals).vitals;assert.equal(v.hp,hp-3);assert.equal(v.temporaryHp,0);
 gm(a,{op:'gm_heal_hp',target:'hero',amount:1});assert.equal(view(a).tokens.find(t=>t.vitals).vitals.hp,hp-2);
 gm(a,{op:'remove_condition',target:'hero',condition:'shaken'});assert.deepEqual(view(a).tokens.find(t=>t.vitals).vitals.conditions,[]);
 assert(!JSON.stringify(view(a)).includes('PRIVATE_'));
 assert.deepEqual(view(new AIAdapter({saved:a.snapshot()})),view(a));
 a.game.find('hero').hp=-3;assert.equal(view(a).tokens.find(t=>t.vitals).vitals.hp,-3);
 display(a,'hero','map',{showVitals:false});assert(view(a).tokens.every(t=>!('vitals' in t)));
});
test('vitals never bypass fog/layers, do not grant team-based access, and reject invalid flags atomically',()=>{
 const a=fixture();reveal(a);display(a,'hero','map',{showVitals:true});
 const c=a.game.find('hero');c.size=2;
 gm(a,{op:'gm_set_player_view',cells:[{x:c.x+1,y:c.y+1}],revealed:false});assert.equal(view(a).tokens.length,0);
 reveal(a);assert.equal(view(a).tokens.length,1);display(a,'hero','gm');assert.equal(view(a).tokens.length,0);
 display(a,'warden','map');a.game.find('warden').team=c.team;assert(!('vitals' in view(a).tokens[0]));
 const before=a.snapshot();assert.throws(()=>display(a,'warden','map',{showVitals:'yes'}),/showVitals/);assert.deepEqual(a.snapshot(),before);
});
console.log(`${groups} player view groups passed`);
