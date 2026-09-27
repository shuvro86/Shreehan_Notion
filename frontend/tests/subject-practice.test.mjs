import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {prepareSubject, readableChunks} from '../../server/subject-practice.mjs';

test('low confidence OCR is excluded from subject questions', () => {
 const doc = {id:'scan',kind:'PDF',pages:[{number:1,text:'A damaged scan can change the meaning of a sentence.',method:'OCR',confidence:45},{number:2,text:'Clear readable source text can support a practice question.',method:'OCR',confidence:75}]};
 assert.deepEqual(readableChunks({documents:[doc]}).map(item => item.chunk.page),[2]);
});

test('Subject Materials get 15 questions, then five new questions per request, and reset after source change', async () => {
 const store = await fs.mkdtemp(path.join(os.tmpdir(), 'shreehan-subject-'));
 try {
  const text = 'The river flows from the mountain to the sea. A river carries water through valleys.';
  const doc = {id:'river-page',sha256:'v1',subject:'Geography',title:'River',kind:'PDF',collection:'Subject Materials',notionUrl:'https://notion.test/river',pages:[{number:1,text,method:'Text',confidence:null}]};
  const library = {records:[{id:'river',collection:'Subject Materials',subject:'Geography',url:'https://notion.test/river'}],documents:[doc]};
  const generate = async ({chunk,count,existing}) => ({topic:'Rivers',items:Array.from({length:count},(_,index)=>({type:'Short answer',question:`River question ${existing.length+index+1}?`,answer:'The river flows to the sea.',options:[],page:chunk.page,evidence:'The river flows from the mountain to the sea.'}))});
  const initial = await prepareSubject(library,'Geography',{store,generate,apiKey:'test',maxCalls:15});
  assert.equal(initial.questions.length,15);
  assert.equal(initial.target,15);
  assert.equal(initial.state,'ready');
  const next = await prepareSubject(library,'Geography',{store,generate,apiKey:'test',more:true,maxCalls:10});
  assert.equal(next.questions.length,20);
  assert.equal(next.target,20);
  assert.equal(new Set(next.questions.map(question => question.id)).size,20);
  assert.equal(next.state,'ready');
  doc.pages[0].text += ' A lake is a body of water.';
  const changed = await prepareSubject(library,'Geography',{store,generate,apiKey:'test',maxCalls:15});
  assert.equal(changed.target,15);
  assert.equal(changed.questions.length,15);
  assert.notEqual(changed.version,initial.version);
 } finally { await fs.rm(store,{recursive:true,force:true}); }
});
