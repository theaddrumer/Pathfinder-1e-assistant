#!/usr/bin/env node
/** Produce host-specific connection files without modifying the engine. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),[mode,url]=process.argv.slice(2);
if(mode==='--local'){
 const config={mcpServers:{'tabletop-kernel':{command:process.execPath,args:[path.join(root,'mcp_server.mjs')]}}};
 fs.writeFileSync(path.join(root,'mcp.local.json'),JSON.stringify(config,null,2)+'\n');console.log('Created mcp.local.json with absolute paths for a local MCP client.');
}else if(mode==='--http'){
 const endpoint=new URL(url);if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw Error('Supply a credential-free HTTPS MCP endpoint URL');
 const dir=path.join(root,'http-plugin');fs.mkdirSync(dir,{recursive:true});
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'plugin.json'),'utf8'));delete manifest.extensions;
 fs.writeFileSync(path.join(dir,'plugin.json'),JSON.stringify(manifest,null,2)+'\n');
 fs.writeFileSync(path.join(dir,'mcp.json'),JSON.stringify({$schema:'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',mcpServers:{'tabletop-kernel':{type:'streamable-http',url:endpoint.href,extensions:{'com.openai':{auth:{type:'api_key',headerScheme:'bearer'}}}}}},null,2)+'\n');
 console.log('Created http-plugin connection manifest. Credentials are supplied separately during connection setup.');
}else{console.log('Usage: node configure_plugin.mjs --local\n       node configure_plugin.mjs --http https://your-host/mcp');process.exitCode=2;}
