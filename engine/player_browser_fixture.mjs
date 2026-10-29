/** Local browser regression fixture; mutation control is stdin, never an HTTP route. */
import readline from 'node:readline';
import {AIAdapter} from './ai_adapter.mjs';
import {startPlayerHttp} from './player_server.mjs';
const a=new AIAdapter({demo:true});let seq=0;
const run=(command,channel='gm')=>a.execute(channel,{command,expectedRevision:a.revision,requestId:'browser_'+ ++seq,...(channel==='gm'?{reason:'Synthetic player viewer fixture'}:{})});
a.game.s.tiles={};a.game.find('warden').x=6;a.game.find('warden').y=3;a.game.find('warden').name='PRIVATE_ENEMY_SENTINEL';
run({op:'gm_configure_map',width:18,height:12,name:'PRIVATE_MAP_SENTINEL'});
run({op:'gm_set_player_view',title:'The old storehouse',rect:{x:1,y:1,width:10,height:9},revealed:true});
run({op:'gm_set_player_display',kind:'creature',ids:['hero'],display:{layer:'map',label:'Explorer',color:'#75c6bf'}});
run({op:'gm_set_map_features',features:[
 {id:'north',preset:'wall',points:[{x:1,y:1},{x:14,y:1}],playerDisplay:{layer:'map',style:'wall',color:'#a9b8c4'}},
 {id:'west',preset:'wall',points:[{x:1,y:1},{x:1,y:10}],playerDisplay:{layer:'map',style:'wall',color:'#a9b8c4'}},
 {id:'south',preset:'wall',points:[{x:1,y:10},{x:11,y:10}],playerDisplay:{layer:'map',style:'wall',color:'#a9b8c4'}},
 {id:'pool',preset:'open',cells:[{x:7,y:6},{x:8,y:6},{x:9,y:6},{x:7,y:7},{x:8,y:7},{x:9,y:7}],playerDisplay:{layer:'map',style:'water',label:'Shallow water',color:'#448fa4'}},
 {id:'crates',preset:'wall',cells:[{x:3,y:2},{x:4,y:2},{x:3,y:3}],playerDisplay:{layer:'map',style:'terrain',label:'Crates',color:'#b79764'}},
 {id:'trap',preset:'open',cells:[{x:5,y:7}],name:'PRIVATE_TRAP_SENTINEL',note:'PRIVATE_DC_SENTINEL'}
]});
const server=await startPlayerHttp(a,{port:0});console.log(JSON.stringify({url:`http://127.0.0.1:${server.address().port}/player`}));
const input=readline.createInterface({input:process.stdin});input.on('line',line=>{try{const {command,channel}=JSON.parse(line);const result=run(command,channel);console.log(JSON.stringify({ok:true,revision:result.revision}));}catch(e){console.log(JSON.stringify({ok:false,error:e.message}));}});
input.on('close',()=>server.close());
