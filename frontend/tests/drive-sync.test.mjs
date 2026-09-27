import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {syncDrive, studyMetadata, driveClient} from '../../server/drive-sync.mjs';

test('Drive study metadata keeps textbook page and subject', () => {
  assert.deepEqual(studyMetadata({name:'59.png'}, ['Materials','Science']), {collection:'Half Yearly',subject:'Science',title:'Food for Health · textbook page 59',sourcePage:59});
  assert.equal(studyMetadata({name:'Geography.pdf'}, ['Materials','Geograpgy']).subject, 'Geography');
  assert.equal(studyMetadata({name:'syllabus.pdf'}, ['Syllabus']).collection, 'Syllabus');
});

test('Drive listing follows every provider page', async () => {
  const calls = [];
  const client = driveClient('token', async (url) => {
    calls.push(new URL(url));
    return {ok:true,json:async()=>calls.length===1?{files:[{id:'a'}],nextPageToken:'next'}:{files:[{id:'b'}]}};
  });
  assert.deepEqual((await client.children('root')).map(f=>f.id), ['a','b']);
  assert.equal(calls[1].searchParams.get('pageToken'), 'next');
});

test('Drive sync reconciles updates, removals, and failures without publishing partial snapshots', async () => {
  const store = await fs.mkdtemp(path.join(os.tmpdir(), 'drive-sync-'));
  let version = 1, removed = false, fail = false, downloads = 0, extractions = 0;
  const client = {
    file: async () => ({name:'Half Yearly',mimeType:'application/vnd.google-apps.folder'}),
    children: async id => {
      if (fail) throw Error('listing failed');
      if (id==='root') return [{id:'science',name:'Science',mimeType:'application/vnd.google-apps.folder'}];
      return removed ? [] : [{id:'page59',name:'59.png',mimeType:'image/png',modifiedTime:String(version),md5Checksum:String(version)}];
    },
    download: async () => { downloads++; return Buffer.from(`image ${version}`); },
  };
  const processFile = async (_local,_dir,url) => {extractions++; return [{number:1,image:`${url}/original.png`,text:'Rice and wheat are energy-giving foods.',method:'OCR',confidence:90}];};
  const options = {client,processFile,store,folderId:'root'};
  try {
    let library = await syncDrive(options);
    assert.equal(library.sourceType, 'google_drive');
    assert.equal(library.documents.length, 1);
    assert.equal(library.documents[0].sourceType, 'google_drive');
    assert.equal(library.documents[0].sourcePage, 59);
    await syncDrive(options);
    assert.equal(downloads, 1);
    assert.equal(extractions, 1);
    version++;
    library = await syncDrive(options);
    assert.equal(downloads, 2);
    assert.equal(extractions, 2);
    const saved = await fs.readFile(path.join(store,'library.json'),'utf8');
    fail = true;
    await assert.rejects(syncDrive(options), /listing failed/);
    assert.equal(await fs.readFile(path.join(store,'library.json'),'utf8'), saved);
    fail = false;
    removed = true;
    library = await syncDrive(options);
    assert.deepEqual(library.documents, []);
  } finally { await fs.rm(store,{recursive:true,force:true}); }
});
