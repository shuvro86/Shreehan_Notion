import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prepareUnseen, mergedPractice, sourceChunks, validateQuestions } from '../../server/unseen-practice.mjs';

const text = 'A triangle has three sides. A square has four sides. Shapes can be seen all around us.';
const doc = { id: 'new-math', title: 'Shapes', subject: 'Math', collection: 'Unseen Paper', kind: 'Image', sha256: 'abc', pages: [{ number: 1, text, method: 'OCR', confidence: 90 }] };
const curated = { sources: [], questions: [] };
const payload = page => ({ topic: 'Shapes', items: [{ question: `How many sides does the triangle on page ${page} have?`, answer: 'Three sides.', type: 'Short answer', options: [], page, evidence: 'A triangle has three sides.' }] });

test('new subject is generated, persisted, reused, replaced and removed', async () => {
 const store = await fs.mkdtemp(path.join(os.tmpdir(), 'unseen-'));
 let calls = 0;
 const options = { store, curated, apiKey: 'test', generate: async ({ chunk }) => { calls++; return payload(chunk.page); } };
 try {
  let result = await prepareUnseen({ documents: [doc] }, options);
  assert.equal(result.questions[0].subject, 'Math');
  assert.equal(result.jobs[0].state, 'ready');
  const firstId = result.questions[0].id;
  await prepareUnseen({ documents: [doc] }, options);
  assert.equal(calls, 1);
  const changed = { ...doc, sha256: 'replacement' };
  const saved = JSON.parse(await fs.readFile(path.join(store, 'unseen-practice.json')));
  assert.equal(mergedPractice({ documents: [changed] }, curated, saved).questions.length, 0);
  result = await prepareUnseen({ documents: [changed] }, options);
  assert.notEqual(result.questions[0].id, firstId);
  assert.equal(calls, 2);
  result = await prepareUnseen({ documents: [] }, options);
  assert.equal(result.questions.length, 0);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(store, 'unseen-practice.json'))).documents, {});
 } finally { await fs.rm(store, { recursive: true, force: true }); }
});

test('multi-page PDF checkpoints resume without regenerating completed pages', async () => {
 const store = await fs.mkdtemp(path.join(os.tmpdir(), 'unseen-pages-'));
 const pdf = { ...doc, kind: 'PDF', pages: [1, 2, 3].map(number => ({ number, text, method: 'PDF text' })) };
 const pages = [];
 const options = { store, curated, apiKey: 'test', maxBatches: 1, generate: async ({ chunk }) => { pages.push(chunk.page); return payload(chunk.page); } };
 try {
  let result = await prepareUnseen({ documents: [pdf] }, options);
  assert.equal(result.jobs[0].state, 'queued');
  assert.equal(result.questions.length, 0);
  await prepareUnseen({ documents: [pdf] }, options);
  result = await prepareUnseen({ documents: [pdf] }, options);
  assert.deepEqual(pages, [1, 2, 3]);
  assert.equal(result.questions.length, 3);
  assert.deepEqual(result.questions.map(q => q.sources[0].page), [1, 2, 3]);
 } finally { await fs.rm(store, { recursive: true, force: true }); }
});

test('provider failure retries after backoff, without exposing unsupported answers', async () => {
 const store = await fs.mkdtemp(path.join(os.tmpdir(), 'unseen-retry-'));
 let calls = 0;
 const options = { store, curated, apiKey: 'test', now: 1000, generate: async () => { calls++; throw Error('provider'); } };
 try {
  let result = await prepareUnseen({ documents: [doc] }, options);
  assert.equal(result.jobs[0].state, 'retrying');
  assert.equal(result.questions.length, 0);
  await prepareUnseen({ documents: [doc] }, { ...options, now: 2000 });
  assert.equal(calls, 1);
  result = await prepareUnseen({ documents: [doc] }, { ...options, now: 122000, generate: async () => payload(1) });
  assert.equal(result.jobs[0].state, 'ready');
 } finally { await fs.rm(store, { recursive: true, force: true }); }
});

test('unclear scans, invented evidence, duplicates and invalid answer options are rejected', () => {
 assert.throws(() => sourceChunks({ ...doc, pages: [{ ...doc.pages[0], confidence: 20 }] }), /unreadable/);
 assert.throws(() => sourceChunks({ ...doc, processingError: 'pending' }), /extraction/);
 const chunk = sourceChunks(doc)[0];
 assert.throws(() => validateQuestions({ items: [{ ...payload(1).items[0], evidence: 'A triangle has seven sides.' }] }, chunk, doc, 0), /evidence/);
 assert.throws(() => validateQuestions({ items: [...payload(1).items, ...payload(1).items] }, chunk, doc, 0), /duplicate/);
 assert.throws(() => validateQuestions({ items: [{ ...payload(1).items[0], type: 'Multiple choice', options: ['One', 'Two', 'Four'] }] }, chunk, doc, 0), /invalid/);
 const long = { ...doc, pages: [{ number: 1, text: 'a'.repeat(25000) }] };
 assert.equal(sourceChunks(long).map(c => c.text).join('').length, 25000);
});

test('curated matching sources are preserved without an AI call or API key', async () => {
 const store = await fs.mkdtemp(path.join(os.tmpdir(), 'unseen-curated-'));
 try {
  const result = await prepareUnseen({ documents: [doc] }, { store, apiKey: '', curated: { sources: [{ documentId: doc.id, subject: doc.subject, sha256: doc.sha256 }], questions: [] }, generate: async () => { throw Error('should not run'); } });
  assert.equal(result.sources.length, 1);
  assert.deepEqual(result.jobs, []);
 } finally { await fs.rm(store, { recursive: true, force: true }); }
});
