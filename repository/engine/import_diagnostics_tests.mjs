import assert from 'node:assert/strict';
import {AIAdapter,ENGINE_VERSION} from './ai_adapter.mjs';
import {callTool,REFERENCES} from './mcp_tools.mjs';
import {COMMANDS} from './integration_catalog.mjs';

let groups=0,sequence=0;
const test=(name,fn)=>{fn();groups++;console.log('PASS',name)};
const fixture=()=>structuredClone(COMMANDS.register_creature.example.definition);
const send=(a,command)=>callTool(a,'kernel_gm',{command,expectedRevision:a.revision,requestId:`import_${++sequence}`,reason:'Import regression fixture'});
const register=(a,d)=>send(a,{op:'register_creature',definition:d});
function rejected(d,pattern){
 const a=new AIAdapter(),before=a.snapshot(),r=register(a,d);
 assert(r.isError,JSON.stringify(r));assert.match(r.structuredContent.error.message,pattern);
 assert.deepEqual(r.structuredContent.help.reference,{topic:'registry'});
 assert.deepEqual(a.snapshot(),before,'Rejected import changed encounter, checkpoints or receipts');
 return r.structuredContent.error.message;
}
function attackFixture(){const d=fixture();d.stats.attacks=[{label:'First',damageDie:6},{label:'Second',damageDie:4}];return d;}
function ammoFixture(){const d=attackFixture();d.stats.attacks[1].ammoId='shots';d.stats.attacks[1].attackMode='ranged';d.stats.attacks[1].rangeIncrementFeet=30;d.stats.ammunition={shots:{type:'loaded',reserve:5,loaded:1,capacity:1}};return d;}

test('unknown fields identify the actual attack index and reject atomically',()=>{
 const d=attackFixture();d.stats.attacks[1].inventedAttackBonus=5;
 rejected(d,/Unknown attack field: definition\.stats\.attacks\[1\]\.inventedAttackBonus/);
 delete d.stats.attacks[1].inventedAttackBonus;d.stats.attacks[1].damageDie='1d6';
 rejected(d,/definition\.stats\.attacks\[1\]\.damageDie.*integer/);
});
test('misplaced stats and capitalization give actionable size diagnostics',()=>{
 const d=fixture();d.sizeCategory='small';rejected(d,/definition\.sizeCategory.*definition\.stats\.sizeCategory/);
 delete d.sizeCategory;d.stats.sizeCategory='Small';rejected(d,/definition\.stats\.sizeCategory.*Small.*lowercase.*small/);
});
test('missing ammunition store and missing ranged mode are distinct',()=>{
 const d=ammoFixture();d.stats.attacks[1].ammoId='absent';
 rejected(d,/attacks\[1\]\.ammoId.*missing store "absent".*available IDs: shots/);
 d.stats.attacks[1].ammoId='shots';delete d.stats.attacks[1].attackMode;
 rejected(d,/attacks\[1\]\.attackMode.*ranged.*store exists/);
 d.stats.attacks[1].attackMode='melee';rejected(d,/attacks\[1\]\.attackMode/);
 d.stats.attacks[1].attackMode='ranged';assert(!register(new AIAdapter(),d).isError);
});
test('ammunition errors name store and quantity or unsupported key',()=>{
 const d=ammoFixture();d.stats.ammunition.shots.loaded=2;
 rejected(d,/definition\.stats\.ammunition\["shots"\]\.loaded.*capacity \(1\)/);
 d.stats.ammunition.shots.loaded=1;d.stats.ammunition.shots.count=5;
 rejected(d,/ammunition\["shots"\].*unsupported.*\["count"\]/);
 delete d.stats.ammunition.shots.count;d.stats.ammunition.shots.ready=1;
 rejected(d,/ammunition\["shots"\]\.ready.*reserve/);
 d.stats.ammunition.shots={type:'reserve',reserve:5,capacity:1};
 rejected(d,/ammunition\["shots"\]\.capacity.*loaded/);
});
test('printed totals and auxiliary fields identify invalid locations',()=>{
 const cases=[
  [d=>{delete d.stats.statTotals.touchAc},/definition\.stats\.statTotals\.touchAc/],
  [d=>{d.stats.statTotals.attack='5'},/definition\.stats\.statTotals\.attack.*integer/],
  [d=>{d.stats.statTotals.AC=16},/definition\.stats\.statTotals\.AC/],
  [d=>{d.stats.initiative=2},/definition\.stats\.initiative.*statTotals\.initiative/],
  [d=>{d.stats.flags={preciseShot:1}},/definition\.stats\.flags\.preciseShot.*boolean/],
  [d=>{d.stats.vision={darkvision:'60'}},/definition\.stats\.vision\.darkvision.*integer/],
  [d=>{d.stats.skills.Perception='3'},/definition\.stats\.skills\.Perception/],
  [d=>{d.stats.abilityLinks.attack=['strength']},/definition\.stats\.abilityLinks\.attack/]
 ];
 for(const [change,pattern] of cases){const d=fixture();change(d);rejected(d,pattern)}
});
test('malformed envelopes and attack lists reject before extension inspection',()=>{
 for(const d of [null,[],42,'bad'])rejected(d,/definition must be/);
 for(const stats of [null,[],42,'bad']){const d=fixture();d.stats=stats;rejected(d,/definition\.stats must be/)}
 for(const attacks of [{},'bad',[],[null],[5]]){const d=fixture();d.stats.attacks=attacks;rejected(d,/definition\.stats\.attacks/)}
});
test('specialized attack and combat metadata errors retain containing paths',()=>{
 const d=attackFixture();d.stats.attacks[1].attackKind='invented';rejected(d,/definition\.stats\.attacks\[1\].*Invalid attack kind/);
 delete d.stats.attacks[1].attackKind;d.stats.attacks[1].weaponHands=3;rejected(d,/definition\.stats\.attacks\[1\]\.weaponHands/);
 delete d.stats.attacks[1].weaponHands;d.stats.attacks[1].lightWeapon='true';rejected(d,/definition\.stats\.attacks\[1\]\.lightWeapon/);
 delete d.stats.attacks[1].lightWeapon;d.stats.attackPlan={mainIndex:7};rejected(d,/definition\.stats\.attackPlan.*index/);
});
test('current help is reachable and corrected imports preserve printed totals on spawn',()=>{
 const a=new AIAdapter(),d=fixture();d.sizeCategory='small';const failure=register(a,d);assert(failure.isError);
 const guide=callTool(a,'kernel_reference',failure.structuredContent.help.reference);
 assert(!guide.isError);assert.equal(guide.structuredContent.file,'CREATURE_IMPORT_V3_42.md');
 assert(guide.structuredContent.text.includes('current V3.42 contract'));
 assert.equal(REFERENCES.registry,'CREATURE_IMPORT_V3_42.md');
 delete d.sizeCategory;d.stats.sizeCategory='small';assert(!register(a,d).isError);
 assert(!send(a,{op:'spawn_creature',definition:d.id,id:'imported',x:1,y:1,team:'enemy'}).isError);
 for(const [stat,value] of Object.entries(d.stats.statTotals))assert.equal(a.game.stat('imported',stat),value);
 assert.deepEqual(a.game.find('imported').skills,d.stats.skills);
 assert(!register(new AIAdapter(),fixture()).isError,'Catalog example must remain executable');
});
test('V3.41 saved checkpoints and receipts survive the version upgrade',()=>{
 const a=new AIAdapter();assert(!register(a,fixture()).isError);const old=a.snapshot();old.engineVersion='3.41.0';
 const b=new AIAdapter({saved:old}),current=b.snapshot();assert.equal(current.engineVersion,ENGINE_VERSION);
 assert.deepEqual(current.game,old.game);assert.deepEqual(current.receipts,old.receipts);assert.equal(b.revision,a.revision);
});
console.log(`${groups} import diagnostics groups passed`);
