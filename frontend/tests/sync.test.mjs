import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {acquireLock,processIdentity} from '../../server/sync-lock.mjs';
import {sync,list,atomic,fileIdentity,publicAddress} from '../../server/notion-sync.mjs';
test('pagination retains all results',async()=>{const calls=[];const out=await list(async(p,b)=>{calls.push(b);return b.start_cursor?{results:[2],has_more:false}:{results:[1],has_more:true,next_cursor:'next'}},'search',{});assert.deepEqual(out,[1,2]);assert.equal(calls[1].start_cursor,'next')});
test('signed URL rotation preserves identity; private targets rejected',()=>{assert.equal(fileIdentity('https://example.com/a.pdf?signature=1'),fileIdentity('https://example.com/a.pdf?signature=2'));for(const ip of ['127.0.0.1','10.1.1.1','172.20.0.1','192.168.1.1','169.254.169.254','::1','::ffff:127.0.0.1'])assert.equal(publicAddress(ip),false);assert.equal(publicAddress('8.8.8.8'),true)});
test('add, update, removal and failed sync preserve consistent snapshots',async()=>{const store=await fs.mkdtemp(path.join(os.tmpdir(),'notion-sync-'));await atomic(path.join(store,'library.json'),{documents:[],records:[]});let version=1,archived=false,fail=false,downloads=0;const api=async(endpoint)=>{if(fail)throw Error('unavailable');if(endpoint==='users/me')return {bot:{workspace_name:'Shreehan'}};const page={id:'page',object:'page',url:'https://notion.so/page',last_edited_time:String(version),archived,properties:{Name:{type:'title',title:[{plain_text:'Science'}]},Files:{type:'files',files:[{name:'test.txt',file:{url:'https://example.com/test.txt'}}]}}};if(endpoint==='search')return {results:archived?[]:[page],has_more:false};if(endpoint==='pages/page')return page;if(endpoint.startsWith('blocks/'))return {results:[{type:'paragraph',paragraph:{rich_text:[{plain_text:'Lesson '+version}]}}],has_more:false};throw Error(endpoint)};const opts={store,api,getFile:async()=>{downloads++;return Buffer.from('version '+version)},processFile:async()=>[{number:1,text:'lesson',image:'',method:'Text',confidence:null}]};try{let d=await sync(opts);assert.equal(d.documents.length,1);assert.equal(d.records[0].body,'Lesson 1');const first=d.documents[0].sha256;await sync(opts);assert.equal(downloads,1);version++;d=await sync(opts);assert.notEqual(d.documents[0].sha256,first);const saved=await fs.readFile(path.join(store,'library.json'),'utf8');fail=true;await assert.rejects(sync(opts));assert.equal(await fs.readFile(path.join(store,'library.json'),'utf8'),saved);fail=false;archived=true;d=await sync(opts);assert.equal(d.documents.length,0);assert.equal(d.records.length,0)}finally{await fs.rm(store,{recursive:true,force:true})}});
test('overlapping sync is skipped while a live process holds the lock',async()=>{const store=await fs.mkdtemp(path.join(os.tmpdir(),'notion-lock-'));try{const release=await acquireLock(store);let called=false;await sync({store,api:async()=>{called=true}});assert.equal(called,false);await release()}finally{await fs.rm(store,{recursive:true,force:true})}});
test('failed extraction keeps originals and reports retryable pending work',async()=>{const store=await fs.mkdtemp(path.join(os.tmpdir(),'notion-pending-'));await atomic(path.join(store,'library.json'),{documents:[],records:[]});const page={id:'scan',object:'page',last_edited_time:'1',properties:{Name:{type:'title',title:[{plain_text:'Scan'}]}}};const api=async endpoint=>endpoint==='users/me'?{bot:{workspace_name:'Shreehan'}}:endpoint==='search'?{results:[page]}:{results:[{type:'pdf',pdf:{external:{url:'https://example.com/scan.pdf'}}}]};try{const result=await sync({store,api,getFile:async()=>Buffer.from('%PDF content'),processFile:async()=>{throw Error('missing poppler')}});assert.equal(result.ocrPending,1);assert.equal(result.documents.length,1);assert.equal(JSON.parse(await fs.readFile(path.join(store,'status.json'))).state,'partial');assert.ok(result.documents[0].processingError)}finally{await fs.rm(store,{recursive:true,force:true})}});

test('reused container PID never strands the lock',async()=>{
 const store=await fs.mkdtemp(path.join(os.tmpdir(),'notion-restart-'));
 try{
  // Legacy PID lock left by an earlier container with the same PID.
  await fs.writeFile(path.join(store,'lock'),String(process.pid));
  let release=await acquireLock(store);assert.equal(typeof release,'function');await release();
  await fs.writeFile(path.join(store,'lock'),JSON.stringify({pid:process.pid,identity:'previous-container:old-start',nonce:'old'}));
  release=await acquireLock(store);assert.equal(typeof release,'function');
  assert.equal(JSON.parse(await fs.readFile(path.join(store,'lock'))).identity,await processIdentity(process.pid));await release();
 }finally{await fs.rm(store,{recursive:true,force:true})}
});
test('renames, attachment removal, page text edits and permanent deletion reconcile',async()=>{
 const store=await fs.mkdtemp(path.join(os.tmpdir(),'notion-edits-'));
 await atomic(path.join(store,'library.json'),{documents:[],records:[]});
 let name='Syllabus',files=true,deleted=false;
 const api=async endpoint=>{
  if(endpoint==='users/me')return {bot:{workspace_name:'Shreehan'}};
  if(endpoint==='search')return {results:deleted?[]:[{id:'syllabus',object:'page',last_edited_time:name,properties:{Name:{type:'title',title:[{plain_text:name}]},Files:{type:'files',files:files?[{name:'new.txt',file:{url:'https://example.com/new.txt'}}]:[]}}}]};
  if(endpoint.startsWith('pages/')){const e=Error('Not found');e.status=404;throw e}
  return {results:[{type:'paragraph',paragraph:{rich_text:[{plain_text:name+' content'}]}}]};
 };
 const opts={store,api,getFile:async()=>Buffer.from('syllabus'),processFile:async()=>[{number:1,text:'syllabus',image:'',method:'Text',confidence:null}]};
 try{
  let d=await sync(opts);assert.equal(d.documents.length,1);
  name='Second term syllabus';d=await sync(opts);assert.equal(d.documents[0].title,name);assert.equal(d.records[0].body,name+' content');
  files=false;d=await sync(opts);assert.equal(d.documents.length,0);assert.equal(d.records.length,1);
  deleted=true;d=await sync(opts);assert.equal(d.records.length,0);
 }finally{await fs.rm(store,{recursive:true,force:true})}
});

test('Homework blocks preserve identity, completion, nesting and removal',async()=>{
 const {HOMEWORK_PAGE_ID}=await import('../../server/homework.mjs');
 const store=await fs.mkdtemp(path.join(os.tmpdir(),'notion-homework-'));
 await atomic(path.join(store,'library.json'),{documents:[],records:[]});
 let checked=false,text='Read the next chapter',removed=false;
 const api=async endpoint=>{
  if(endpoint==='users/me')return {bot:{workspace_name:'Shreehan'}};
  if(endpoint==='search')return {results:[{id:HOMEWORK_PAGE_ID,object:'page',url:'https://notion.so/homework',properties:{title:{type:'title',title:[{plain_text:'Homework'}]}}}]};
  return {results:removed?[]:[{id:'instruction',type:'to_do',to_do:{rich_text:[{plain_text:text}],checked}}]};
 };
 try{
  let result=await sync({store,api});assert.equal(result.homework.items.length,1);assert.equal(result.records[0].collection,'Homework');assert.equal(result.homework.items[0].checked,false);
  checked=true;text='Revised homework';result=await sync({store,api});assert.equal(result.homework.items[0].id,'instruction');assert.equal(result.homework.items[0].title,text);assert.equal(result.homework.items[0].checked,true);
  removed=true;result=await sync({store,api});assert.deepEqual(result.homework.items,[]);assert.equal(result.homework.sources.length,1);
 }finally{await fs.rm(store,{recursive:true,force:true})}
});
