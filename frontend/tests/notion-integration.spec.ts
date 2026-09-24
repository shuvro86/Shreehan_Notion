import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import seed from '../../data/library.json';
type Doc=typeof seed.documents[number];

test.beforeEach(async({page})=>{
 const username=process.env.E2E_USERNAME,password=process.env.E2E_PASSWORD;
 test.skip(!username||!password,'Authenticated live app credentials required');
 const login=await page.request.post('/api/auth/login',{data:{username,password}});
 expect(login.status()).toBe(200);
});

test('new half-yearly syllabus is in the actual API, reader and download',async({page})=>{
 const response=await page.request.get('/api/library');expect(response.headers()['cache-control']).toBe('no-store');
 const {library,sync}=await response.json();
 expect(sync.worker.state).toMatch(/running|waiting/);
 expect(Date.now()-Date.parse(sync.worker.updatedAt)).toBeLessThan(45000);
 const syllabus:Doc=library.documents.find((d:Doc)=>d.filename==='syllabus_c22_s16_20260924_46e533.pdf');
 expect(syllabus).toBeTruthy();expect(syllabus.collection).toBe('Syllabus');expect(syllabus.pages.length).toBeGreaterThan(0);
 const original=await page.request.get(syllabus.url);expect(original.status()).toBe(200);
 expect(createHash('sha256').update(await original.body()).digest('hex')).toBe(syllabus.sha256);
 await page.goto('/library?collection=Syllabus');
 await expect(page.getByRole('heading',{name:'HALF YEARLY',exact:true})).toBeVisible();
 await page.getByRole('heading',{name:'HALF YEARLY',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('link',{name:'Download',exact:true})).toHaveAttribute('href',syllabus.url);
 await page.getByRole('button',{name:'Extracted text',exact:true}).click();
 await expect(page.locator('.extracted-text pre')).not.toHaveText('');
});

test('polling refreshes new documents, edits and deletions without reloading',async({page})=>{
 const data=await (await page.request.get('/api/library')).json();
 await page.route('**/api/library',r=>r.fulfill({json:data}));
 await page.clock.install();await page.goto('/library');
 await expect(page.locator('.document-card')).toHaveCount(data.library.documents.length);
 const added={...data.library.documents[0],id:'sync-regression-only',title:'New sync regression syllabus'};
 data.library.documents.push(added);await page.clock.fastForward(15000);
 await expect(page.getByRole('heading',{name:added.title,exact:true})).toBeVisible();
 added.title='Edited sync regression syllabus';await page.clock.fastForward(15000);
 await expect(page.getByRole('heading',{name:added.title,exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'New sync regression syllabus',exact:true})).toHaveCount(0);
 await page.getByRole('heading',{name:added.title,exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 data.library.documents=data.library.documents.filter((d:Doc)=>d.id!==added.id);await page.clock.fastForward(15000);
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('heading',{name:added.title,exact:true})).toHaveCount(0);
 data.sync={state:'stale',lastSuccess:'2026-09-23T15:19:49Z'};await page.clock.fastForward(15000);
 await expect(page.locator('.import-status')).toContainText('Notion updates delayed');
});

test('does not render an obsolete bundled library while live data loads',async({page})=>{
 const data=await (await page.request.get('/api/library')).json();
 let release!:()=>void;
 const pending=new Promise<void>(resolve=>{release=resolve});
 await page.route('**/api/library',async route=>{await pending;await route.fulfill({json:data})});
 await page.goto('/library');await expect(page.locator('.document-card')).toHaveCount(0);
 release();await expect(page.locator('.document-card')).toHaveCount(data.library.documents.length);
});
