import {requireDependency} from '../server/dependencies.mjs';
const nextEnv=requireDependency('@next/env');

import {prepareUnseen} from '../server/unseen-practice.mjs';
nextEnv.loadEnvConfig(process.cwd());
const {sync,atomic,root}=await import('../server/notion-sync.mjs');
if(!process.env.NOTION_TOKEN){await atomic(root+'/status.json',{state:'unconfigured',message:'Set NOTION_TOKEN on the server to enable automatic sync.'});process.exit(1)}
if(process.env.VERCEL){console.error('Automatic sync requires a persistent Node server and disk.');process.exit(1)}
const interval=Math.max(30,Number(process.env.NOTION_SYNC_INTERVAL_SECONDS)||60)*1000;
do{
 try{
  const result=await sync();
  if(result){
   console.log(`Notion sync: ${result.documents.length} files, ${result.records.length} records, ${result.ocrPending} pending extraction.`);
   try {
    const practice=process.argv.includes('--sync-only')?null:await prepareUnseen(result);
    if(practice)console.log(`Unseen Paper: ${practice.questions.length} questions available; ${practice.jobs.filter(j=>j.state!=='ready').length} files pending.`);
   } catch { console.error('Unseen Paper preparation failed; it will retry after the next sync.'); }
  }
 }catch(error){console.error('Notion sync failed:',String(error.message).replaceAll(process.env.NOTION_TOKEN,'[redacted]').replace(/https?:\/\/\S+/g,'[URL]')); if(process.argv.includes('--once'))process.exitCode=1}
 if(process.argv.includes('--once'))break;
 await new Promise(r=>setTimeout(r,interval));
}while(true);
