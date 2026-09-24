import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export async function processIdentity(pid){
 try{process.kill(pid,0)}catch(e){if(e.code==='ESRCH')return null;throw e}
 if(process.platform==='linux'){
  const stat=await fs.readFile(`/proc/${pid}/stat`,'utf8');
  const start=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
  return `${os.hostname()}:${(await fs.readFile('/proc/sys/kernel/random/boot_id','utf8')).trim()}:${start}`;
 }
 const {stdout}=await exec('ps',['-p',String(pid),'-o','lstart=']);
 return `${os.hostname()}:${stdout.trim()}`;
}
export async function acquireLock(store){
 await fs.mkdir(store,{recursive:true});const file=path.join(store,'lock');
 const owner={pid:process.pid,identity:await processIdentity(process.pid),nonce:randomUUID()};
 for(let attempt=0;attempt<3;attempt++){
  try{const handle=await fs.open(file,'wx');await handle.writeFile(JSON.stringify(owner));await handle.close();return async()=>{const current=JSON.parse(await fs.readFile(file,'utf8').catch(()=>'null'));if(current?.nonce===owner.nonce)await fs.unlink(file).catch(()=>{})}}
  catch(error){if(error.code!=='EEXIST')throw error;}
  const raw=await fs.readFile(file,'utf8').catch(()=>'');let prior;try{prior=JSON.parse(raw)}catch{}
  const stat=await fs.stat(file).catch(()=>null);if(!stat)continue;
  if(typeof prior==='object'&&prior?.identity){if(await processIdentity(prior.pid)===prior.identity)return null;}
  else if(typeof prior==='number'){
   // A legacy lock naming this very process can only belong to an earlier container.
   if(prior!==process.pid&&await processIdentity(prior)&&Date.now()-stat.mtimeMs<900000)return null;
  }else if(Date.now()-stat.mtimeMs<30000)return null; // another owner may still be writing
  if(await fs.readFile(file,'utf8').catch(()=>null)===raw)await fs.unlink(file).catch(()=>{});
 }
 return null;
}
