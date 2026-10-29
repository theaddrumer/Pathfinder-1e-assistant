/** One private encounter file and one writer. No campaign archive. */
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export function openSessionStore(filename){
 const file=path.resolve(filename),lock=file+'.lock';fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
 let fd;
 try{fd=fs.openSync(lock,'wx',0o600);}catch(error){
  if(error.code!=='EEXIST')throw error;
  let pid;try{pid=JSON.parse(fs.readFileSync(lock,'utf8')).pid;}catch{throw Error('Unreadable session lock; inspect it before starting another writer');}
  if(!Number.isInteger(pid)||pid<=0)throw Error('Invalid session lock');
  let alive=true;try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')alive=false;else throw e;}
  if(alive)throw Error('This encounter already has a running server; connect to it instead');
  fs.unlinkSync(lock);fd=fs.openSync(lock,'wx',0o600);
 }
 const token=randomUUID();fs.writeFileSync(fd,JSON.stringify({pid:process.pid,token}));fs.closeSync(fd);
 const close=()=>{try{if(JSON.parse(fs.readFileSync(lock,'utf8')).token===token)fs.unlinkSync(lock);}catch(e){if(e.code!=='ENOENT')throw e;}};
 const save=snapshot=>{
  const bytes=JSON.stringify(snapshot);if(Buffer.byteLength(bytes)>384*1024*1024)throw Error('Encounter save exceeds 384 MiB; close/clear old encounter data before continuing');
  const temporary=file+'.'+randomUUID()+'.tmp';let handle;
  try{handle=fs.openSync(temporary,'wx',0o600);fs.writeFileSync(handle,bytes);fs.fsyncSync(handle);fs.closeSync(handle);handle=undefined;fs.renameSync(temporary,file);}
  catch(e){if(handle!==undefined)fs.closeSync(handle);try{fs.unlinkSync(temporary);}catch{}throw e;}
 };
 try{
  let saved=null;if(fs.existsSync(file)){if(fs.statSync(file).size>384*1024*1024)throw Error('Encounter file exceeds size limit');saved=JSON.parse(fs.readFileSync(file,'utf8'));}
  return {file,saved,save,close};
 }catch(e){close();throw e;}
}
