import {requireDependency} from '../server/dependencies.mjs';
requireDependency('@next/env').loadEnvConfig(process.cwd());
import path from 'node:path';
const {sync,atomic,root,read}=await import('../server/notion-sync.mjs');
const {materialGroups,prepareSubject}=await import('../server/subject-practice.mjs');
const statusFile=path.join(root,'subject-materials-sync.json');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function update(fields){await atomic(statusFile,{...await read(statusFile,{}),...fields,updatedAt:new Date().toISOString()})}

try{
 if(!process.env.NOTION_TOKEN)throw Error('Notion sync is not configured on this server.');
 await update({state:'running',phase:'sync',percent:2,message:'Connecting to Notion…',subject:null});
 let library=null;
 for(let attempt=0;attempt<300&&!library;attempt++){
  library=await sync({onProgress:async stage=>{
   const current=await read(statusFile,{});
   await update({state:'running',phase:'sync',percent:Math.min(68,Math.max(5,(current.percent||5)+1)),message:stage,subject:null});
  }});
  if(!library){await update({state:'running',phase:'sync',message:'Waiting for the scheduled source sync to finish…'});await pause(2000)}
 }
 if(!library)throw Error('A sync is already running. Try again shortly.');
 const groups=materialGroups(library);
 let completed=0,partial=Boolean(library.drivePending);
 await update({state:'running',phase:'analysis',percent:70,message:'Notion records synced. Reading subject material…',subject:null,subjectsTotal:groups.length,subjectsCompleted:0});
 for(let index=0;index<groups.length;index++){
  const group=groups[index];
  let result;
  for(let attempt=0;attempt<600&&!result;attempt++){
   try{
    result=await prepareSubject(library,group.subject,{maxCalls:30,onProgress:async item=>{
     const ratio=item.target?Math.min(1,item.questions/item.target):0;
     await update({state:'running',phase:'analysis',percent:Math.min(96,70+Math.floor((index+ratio)/Math.max(groups.length,1)*26)),message:item.message,subject:group.subject,questionsReady:item.questions,questionsTarget:item.target,subjectsTotal:groups.length,subjectsCompleted:completed});
    }});
   }catch(error){if(error.message!=='busy')throw error;await update({state:'running',phase:'analysis',message:`Waiting for the background question worker to finish ${group.subject}…`,subject:group.subject,subjectsTotal:groups.length,subjectsCompleted:completed});await pause(2000)}
  }
  if(!result)throw Error(`Question preparation for ${group.subject} is busy. Try again shortly.`);
  completed++;
  if(result.state!=='ready')partial=true;
  await update({state:'running',phase:'analysis',percent:Math.min(96,70+Math.floor(completed/Math.max(groups.length,1)*26)),message:`${group.subject}: ${result.questions.length} of ${result.target} questions ready.`,subject:group.subject,questionsReady:result.questions.length,questionsTarget:result.target,subjectsTotal:groups.length,subjectsCompleted:completed});
 }
 const state=partial?'partial':'complete';
 const message=library.drivePending?'Known public files were synced. New Drive folder files need a server-side Drive credential.':partial?'Sync finished; some material needs attention.':'Notion subject materials synced and analyzed.';
 await update({state,phase:'done',percent:100,message,subject:null,subjectsTotal:groups.length,subjectsCompleted:completed,records:library.records.length,documents:library.documents.length});
}catch(error){await update({state:'error',phase:'error',message:error.message||'Sync failed. The previous library is still available.',subject:null});process.exitCode=1}
