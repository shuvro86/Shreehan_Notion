import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {noteQuestions} from '../../server/study-notes.mjs';
import {materialGroups,prepareSubject} from '../../server/subject-practice.mjs';

const text = 'Q1. What do plants need?\nAns. Plants need water and sunlight to grow.\nQ2. Name one part of a plant.\nAns. A leaf is a part of a plant.\nWrite True or False:\na) Plants need water. True';
const doc = {id:'note',subject:'Bangladesh Studies',title:'Plants',collection:'Study Note',kind:'PDF',sha256:'one',pages:[{number:1,text,method:'PDF text',confidence:null}]};
const library = {records:[{id:'r',url:'https://notion.test/note',subject:doc.subject,collection:'Study Note'},{id:'m',subject:doc.subject,collection:'Subject Materials'}],documents:[doc,{...doc,id:'material',collection:'Subject Materials'}]};
test('local extraction preserves answers, imperative questions and true/false without misclassifying Bangladesh as Bangla',()=>{
 const items=noteQuestions([{doc,chunk:{page:1,text}}]);
 assert.equal(items.find(q=>q.question==='What do plants need?').answer,'Plants need water and sunlight to grow.');
 assert.equal(items.find(q=>q.question==='Name one part of a plant.').answer,'A leaf is a part of a plant.');
 assert.equal(items.find(q=>q.type==='True / False').answer,'True');
 assert.ok(items.some(q=>q.type==='Fill in the blank'));
 assert.equal(noteQuestions([{doc:{...doc,subject:'Bangla Paper I'},chunk:{page:1,text:'DËi t gnvbwe nRiZ gyn¤§` '.repeat(5)}}]).length,0);
});
test('Study Notes are isolated, generated without provider calls, reused and invalidated on replacement',async()=>{
 const store=await fs.mkdtemp(path.join(os.tmpdir(),'study-notes-'));
 const options={store,collection:'Study Note',apiKey:'must-not-use',generate:()=>{throw Error('external call forbidden')}};
 try{
  assert.deepEqual(materialGroups(library,'Study Note')[0].documents.map(d=>d.id),['note']);
  const first=await prepareSubject(library,doc.subject,options);
  assert.equal(first.state,'ready');
  assert.ok(first.questions.length>=3);
  const second=await prepareSubject(library,doc.subject,options);
  assert.deepEqual(second.questions,first.questions);
  const changed={...library,documents:[{...doc,sha256:'two',pages:[{number:1,text:'Q1. What do roots absorb?\nAns. Roots absorb water from the soil around the plant.',method:'PDF text'}]}]};
  const result=await prepareSubject(changed,doc.subject,options);
  assert.ok(result.questions.every(q=>!first.questions.some(old=>old.id===q.id)));
  const empty=await prepareSubject({...library,documents:[]},doc.subject,options);
  assert.equal(empty.questions.length,0);
  assert.equal(empty.state,'waiting_for_files');
 }finally{await fs.rm(store,{recursive:true,force:true})}
});
