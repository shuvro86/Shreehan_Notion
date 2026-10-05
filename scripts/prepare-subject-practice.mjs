import {requireDependency} from '../server/dependencies.mjs';
requireDependency('@next/env').loadEnvConfig(process.cwd());
const {read,root}=await import('../server/notion-sync.mjs');
const {prepareAllSubjects,prepareSubject}=await import('../server/subject-practice.mjs');

const mode=process.argv.includes('--more')?'more':process.argv.includes('--refresh')?'refresh':null;
const subject=mode?process.argv.at(-1):null;
const library=await read(root+'/library.json',null);
if(!library)process.exit(0);
try{
 if(subject){
  const result=await prepareSubject(library,subject,{more:mode==='more',refresh:mode==='refresh',maxCalls:30});
  console.log(JSON.stringify({subject,target:result.target,questions:result.questions.length,state:result.state}));
 }else{
  const results=await prepareAllSubjects(library,process.argv.includes('--study-notes')?{collection:'Study Note'}:{});
  console.log(JSON.stringify(results.map(item=>({subject:item.subject,target:item.result.target,questions:item.result.questions.length,state:item.result.state}))));
 }
}catch(error){
 console.error(`Subject practice: ${error.message}`);
 process.exitCode=error.message==='busy'?2:error.message==='initial_not_ready'?3:1;
}
