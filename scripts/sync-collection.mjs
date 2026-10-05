import {requireDependency} from '../server/dependencies.mjs';
requireDependency('@next/env').loadEnvConfig(process.cwd());
import path from 'node:path';

const {sync, read, atomic, root}=await import('../server/notion-sync.mjs');
const collection=process.argv[2];
const names=new Map([['Study Note','study-note'],['Exam','exam'],['Assignment','assignment']]);
if(!names.has(collection))throw Error('Unsupported collection');
const statusFile=path.join(root,`collection-sync-${names.get(collection)}.json`);
const report=async values=>atomic(statusFile,{...await read(statusFile,{}),...values,updatedAt:new Date().toISOString()});
const items=(library,type)=>new Map((library?.[type]||[]).filter(item=>item.collection===collection).map(item=>[item.id,item]));
const changes=(before,after,fields)=>{
  let added=0,removed=0,changed=0;
  for(const [id,item] of after){
    if(!before.has(id))added++;
    else if(fields.some(field=>JSON.stringify(before.get(id)?.[field])!==JSON.stringify(item[field])))changed++;
  }
  for(const id of before.keys())if(!after.has(id))removed++;
  return {added,removed,changed};
};

try{
  if(!process.env.NOTION_TOKEN)throw Error('Notion sync is not configured on the server.');
  const before=await read(path.join(root,'library.json'),{records:[],documents:[]});
  let result;
  for(let attempt=0;attempt<60&&!result;attempt++){
    result=await sync({collection,onProgress:stage=>report({state:'running',phase:'syncing',message:`${collection}: ${stage}…`})});
    if(!result){
      await report({state:'running',phase:'waiting',message:`Waiting for another Notion sync to finish…`});
      await new Promise(resolve=>setTimeout(resolve,2000));
    }
  }
  if(!result)throw Error('Notion sync remained busy. Try again shortly.');
  if(collection==='Study Note'){
    await report({state:'running',phase:'analysis',message:'Preparing Class 2 Study Notes questions…'});
    const {prepareAllSubjects}=await import('../server/subject-practice.mjs');
    await prepareAllSubjects(result,{collection});
  }
  const records=changes(items(before,'records'),items(result,'records'),['title','body','date','subject','blocks']);
  const documents=changes(items(before,'documents'),items(result,'documents'),['title','sha256','pages','subject']);
  await report({state:'complete',phase:'done',message:`${collection} synced: ${records.added} notes added, ${records.changed} changed, ${records.removed} removed; ${documents.added} files added, ${documents.changed} changed, ${documents.removed} removed.`,records,documents});
}catch(error){
  await report({state:'error',phase:'error',message:error.message==='Notion sync is not configured on the server.'?error.message:`Could not sync ${collection}. Saved content is still available.`});
  process.exitCode=1;
}
