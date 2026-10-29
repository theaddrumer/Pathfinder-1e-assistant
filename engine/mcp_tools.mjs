import {ARTWORK_REQUEST_BYTES} from './map_artwork.mjs';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {COMMANDS} from './integration_catalog.mjs';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {ListToolsRequestSchema,CallToolRequestSchema,ListResourcesRequestSchema,ReadResourceRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {ADAPTER_INSTRUCTIONS,ENGINE_VERSION,assertJson} from './ai_adapter.mjs';
const obj=(properties={},required=[])=>({type:'object',properties,required,additionalProperties:false});
const str={type:'string'},integer={type:'integer',minimum:0};
const page={offset:integer,limit:{type:'integer',minimum:1,maximum:100}};
const command={type:'object',properties:{op:str},required:['op'],additionalProperties:true};
const mutation={command,expectedRevision:{type:'string',description:'Exact revision returned by kernel_status or the last accepted mutation.'},requestId:{type:'string',description:'Unique 1–80 character ID for this intent. Reuse the SAME ID and arguments only when retrying an uncertain response.'}};
export const TOOLS=[
 {name:'kernel_status',description:'Read the authoritative encounter, current revision, action budget, paged creatures and pending continuation choices. Start here. Target one creature for derived combat stats and configured base speed. Use view=continuations to page all choices. No dice or state changes.',inputSchema:obj({...page,target:str,view:{type:'string',enum:['encounter','continuations']}})},
 {name:'kernel_catalog',description:'Discover supported commands by family/channel, or describe one op including use, costs/changes, limitations, input hints, examples where available and referenceTopic. null required means incomplete guidance; read the guide. Gameplay uses action; setup/adjudication uses gm; read-only operations use query. Native validators own detailed payloads.',inputSchema:obj({op:str,family:{type:'string',enum:['map','magic','time','setup','effects','combat']},channel:{type:'string',enum:['query','action','gm']},offset:integer,limit:{type:'integer',minimum:1,maximum:50}})},
 {name:'kernel_query',description:'Run a catalogued read-only engine command. Use path (JSON pointer), offset and limit for large results. Useful for vocabulary, spells/resources, map geometry, previews, clocks, conditions and events. No state changes.',inputSchema:obj({command,path:str,...page},['command'])},
 {name:'kernel_action',description:'Perform ONE ordinary gameplay action or offered continuation through the engine actor role. Enforces action costs, resources, movement and targeting. Paused is success: inspect continuations instead of repeating. Requires current revision and retry ID.',inputSchema:obj(mutation,['command','expectedRevision','requestId'])},
 {name:'kernel_gm',description:'Explicit GM setup or adjudication, with a recorded reason. Import/spawn creatures, configure maps/resources, resolve GM decisions/events, roll standalone dice (gm_roll kind:plain), apply declared damage/healing, or undo. Do not use this to evade a rejected ordinary action. It may change or clear encounter data.',inputSchema:obj({...mutation,reason:{type:'string',minLength:1,maxLength:500}},['command','expectedRevision','requestId','reason'])},
 {name:'kernel_result',description:'Read full details of the latest accepted mutation in bounded pages. Use requestId and a JSON pointer path from omittedPaths; this never reruns the action or rolls again.',inputSchema:obj({requestId:str,path:str,...page},['requestId'])},
 {name:'kernel_reference',description:'Read bundled integration and mechanics documentation in line pages. Start with topic=start for operation or workflows for tested patterns. Omit topic to list available documents. Guides contain validated payload examples and scope limits, not a complete PF1e spell database.',inputSchema:obj({topic:str,offset:integer,limit:{type:'integer',minimum:1,maximum:120}})}
].map(t=>({...t,annotations:{readOnlyHint:!['kernel_action','kernel_gm'].includes(t.name),destructiveHint:['kernel_action','kernel_gm'].includes(t.name),idempotentHint:!['kernel_action','kernel_gm'].includes(t.name),openWorldHint:false}}));
export const REFERENCES={collectives:'COLLECTIVES_V3_50.md',setup:'SETUP.md',launcher:'UBUNTU_LAUNCHER_V3_48.md',readme:'README.md',coordinates:'MAP_COORDINATES_V3_48.md',artwork:'MAP_ARTWORK_V3_47.md',map_library:'MAP_LIBRARY_V3_46.md',player_view:'PLAYER_VIEW_V3_43.md',subtypes:'SUBTYPES_V3_41.md',combat:'COMBAT_MECHANICS_V3_40.md',start:'AI_START_HERE.md',workflows:'AI_WORKFLOWS.md',prone_dice:'PRONE_AND_DICE_V3_38.md',registry:'CREATURE_IMPORT_V3_42.md',ailments:'docs/history/CONDITIONS_AND_AILMENTS_V3_6.md',traits:'docs/history/FOUNDATIONS_V3_7.md',attacks:'docs/history/ATTACK_ROUTINES_AND_AMMUNITION_V3_19.md',maneuvers:'docs/history/COMBAT_MANEUVERS_AND_OVERRIDES_V3_11.md',riders:'docs/history/ATTACK_RIDERS_V3_12.md',defenses:'docs/history/DEFENSIVE_EQUIPMENT_VISIBILITY_V3_16.md',events:'docs/history/PENDING_EVENTS_AND_READY_V3_21.md',initiative:'docs/history/INITIATIVE_AND_COMBAT_TIMING_V3_20.md',integration:'INTEGRATION_V3_37.md',commands:'COMMAND_REFERENCE.md',handoff:'AI_GM_HANDOFF.md',architecture:'ARCHITECTURE.md',map:'MAP_FEATURES_V3_35.md',elevation:'MAP_AND_ELEVATION_V3_34.md',falling:'FALLING_V3_36.md',health:'ENCOUNTER_BASICS_V3_31.md',areas:'PERSISTENT_AREAS_V3_30.md',conditions:'SPELL_CONDITIONS_V3_32.md',concentration:'CONCENTRATION_V3_33.md',casting:'docs/history/CASTING_TIMES_AND_INTERRUPTION_V3_24.md',delivery:'docs/history/TOUCH_AND_RAY_DELIVERY_V3_25.md',counterspells:'docs/history/COUNTERSPELL_AND_DISPEL_V3_26.md',resources:'docs/history/SPELL_RESOURCES_V3_27.md',summons:'docs/history/SUMMONS_V3_28.md'};
function readGuide(topic){if(!Object.hasOwn(REFERENCES,topic))throw Error('Unknown reference topic');return fs.readFileSync(fileURLToPath(new URL(REFERENCES[topic],import.meta.url)),'utf8');}
export function reference({topic,offset=0,limit=80}={}){
 if(topic===undefined)return {topics:REFERENCES};
 if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>120)throw Error('Reference page needs offset >= 0 and limit 1–120');
 const lines=readGuide(topic).split('\n');return {topic,file:REFERENCES[topic],offset,total:lines.length,nextOffset:offset+limit<lines.length?offset+limit:null,text:lines.slice(offset,offset+limit).join('\n')};
}
function validate(schema,value,path='arguments'){
 if(schema.type==='object'){
  if(value===null||typeof value!=='object'||Array.isArray(value))throw Error(`${path} must be an object`);
  for(const key of schema.required||[])if(!Object.hasOwn(value,key))throw Error(`${path}.${key} is required`);
  for(const [key,v] of Object.entries(value)){if(schema.properties?.[key])validate(schema.properties[key],v,path+'.'+key);else if(schema.additionalProperties===false)throw Error(`Unknown ${path}.${key}`);}
 }else if(schema.type==='integer'){if(!Number.isInteger(value)||value<(schema.minimum??-Infinity)||value>(schema.maximum??Infinity))throw Error(`Invalid ${path}`);}
 else if(schema.type==='string'){if(typeof value!=='string'||value.length<(schema.minLength??0)||value.length>(schema.maxLength??Infinity)||schema.enum&&!schema.enum.includes(value))throw Error(`Invalid ${path}`);}
}
export function callTool(adapter,name,args={}){
 try{
  const tool=TOOLS.find(t=>t.name===name);if(!tool)throw Error('Unknown tool');assertJson(args);const artwork=name==='kernel_gm'&&args?.command?.op==='gm_set_map_artwork';if(Buffer.byteLength(JSON.stringify(args))>(artwork?ARTWORK_REQUEST_BYTES:2*1024*1024))throw Error(artwork?'Artwork arguments exceed 23 MiB':'Tool arguments exceed 2 MiB');validate(tool.inputSchema,args);
  const result=name==='kernel_status'?adapter.status(args):name==='kernel_catalog'?adapter.catalog(args):name==='kernel_query'?adapter.query(args):name==='kernel_result'?adapter.result(args):name==='kernel_reference'?reference(args):adapter.execute(name==='kernel_action'?'action':'gm',args);
  return {content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result};
 }catch(error){const op=args?.command?.op,entry=typeof op==='string'&&Object.hasOwn(COMMANDS,op)?COMMANDS[op]:null;const result={ok:false,...(entry?{help:{catalog:{op},reference:{topic:entry.referenceTopic}}}:{}),error:{code:error.code||'REJECTED',message:error.message},revision:adapter.revision,recovery:'Inspect kernel_status/catalog/reference. Rejected operations do not spend actions or dice. Retry uncertain accepted requests with the identical requestId and arguments.'};return {isError:true,content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result};}
}
export function createMcpServer(adapter){
 const server=new Server({name:'tabletop-kernel',version:ENGINE_VERSION},{capabilities:{tools:{},resources:{}},instructions:ADAPTER_INSTRUCTIONS});
 server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:TOOLS}));
 server.setRequestHandler(CallToolRequestSchema,async request=>callTool(adapter,request.params.name,request.params.arguments||{}));
 server.setRequestHandler(ListResourcesRequestSchema,async()=>({resources:Object.keys(REFERENCES).map(topic=>({uri:'tabletop://reference/'+topic,name:topic,mimeType:'text/markdown'}))}));
 server.setRequestHandler(ReadResourceRequestSchema,async request=>{const topic=request.params.uri.replace(/^tabletop:\/\/reference\//,'');if(request.params.uri!=='tabletop://reference/'+topic)throw Error('Unknown resource');return {contents:[{uri:request.params.uri,mimeType:'text/markdown',text:readGuide(topic)}]};});
 return server;
}
