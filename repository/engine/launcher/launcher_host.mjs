// Dedicated desktop-launcher entry point. The engine and HTTP routes stay unchanged.
// Parent stdin is a private lifecycle pipe, never a network control endpoint.
import readline from 'node:readline';
import {main} from '../mcp_server.mjs';

let stopping=false;
function stop(){
 if(stopping)return;stopping=true;
 // Windows does not deliver POSIX signals from Process.Kill. Invoke the engine's
 // own shutdown handler in-process so both listeners and the session lock close.
 process.emit('SIGTERM');
 const deadline=setTimeout(()=>process.exit(1),8000);deadline.unref();
}
try{
 await main(['--http']);
 const input=readline.createInterface({input:process.stdin,terminal:false});
 input.on('line',line=>{if(line==='shutdown')stop();});
 input.once('close',stop);
 process.stdout.write('TABLETOP_LAUNCHER_READY\n');
}catch(error){console.error(error.message);process.exitCode=1;}
