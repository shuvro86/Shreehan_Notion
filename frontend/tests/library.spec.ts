import { test, expect } from '@playwright/test';
import library from '../../data/library.json';
import practice from '../../data/practice.json';
import { createHash } from 'node:crypto';
test.beforeEach(async({page})=>{await page.route('**/api/library',route=>route.fulfill({json:{library,sync:{state:'ok',lastSuccess:'2026-09-18T12:00:00Z'}}}));});

test('every original and preview is served, with matching file checksums', async ({ request }) => {
  test.setTimeout(120000);
  expect(library.documents).toHaveLength(30);
  expect(library.missing).toEqual([]);
  expect(library.documents.reduce((n,d)=>n+d.pages.length,0)).toBe(83);
  for (const doc of library.documents) {
    const file=await request.get(doc.url);
    expect(file.status(),doc.filename).toBe(200);
    expect(createHash('sha256').update(await file.body()).digest('hex')).toBe(doc.sha256);
    for (const page of doc.pages) {
      const preview=await request.get(page.image);
      expect(preview.status(),page.image).toBe(200);
      expect(preview.headers()['content-type']).toContain('image/');
    }
  }
  for(const q of practice.questions)for(const s of q.sources){
    const doc=library.documents.find(d=>d.id===s.documentId);
    expect(doc, q.id).toBeDefined();
    expect(doc!.pages[s.page-1], q.id).toBeDefined();
  }
});

test('library search, reader, page controls, and downloads', async ({ page }) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/library');
  await expect(page.locator('.document-card')).toHaveCount(30);
  await page.getByRole('combobox',{name:'Filter by collection'}).selectOption('Study Note');
  await expect(page.locator('.document-card')).toHaveCount(15);
  await page.getByRole('textbox',{name:'Search documents'}).fill('cereals');
  await expect(page.locator('.document-card')).toHaveCount(1);
  await page.locator('.document-card').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Next document page'}).click();
  await page.getByRole('button',{name:'Extracted text',exact:true}).click();
  await expect(page.locator('.extracted-text')).toContainText('What are cereals?');
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('link',{name:'Download',exact:true}).click();
  expect((await downloadPromise).suggestedFilename()).toBe('Science.pdf');
  await page.getByRole('button',{name:'Close reader'}).click();
  await page.getByRole('button',{name:'View report',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('30 / 30');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('Class 2 answers, source links and progress', async ({page})=>{
  await page.goto('/practice');
  await page.getByRole('textbox',{name:'Search questions and answers'}).fill('What is wind?');
  await expect(page.locator('.question-card')).toHaveCount(1);
  await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
  await expect(page.locator('.model-answer')).toContainText('Moving air is called wind.');
  await page.locator('.model-answer').getByRole('button').click();
  await expect(page.getByRole('dialog')).toContainText('Air Around Us — page 95');
  await page.getByRole('button',{name:'Close reader'}).click();
  await page.getByRole('button',{name:'Mark practiced',exact:true}).click();
  await page.reload();
  await page.getByRole('textbox',{name:'Search questions and answers'}).fill('What is wind?');
  await expect(page.getByRole('button',{name:'Practiced',exact:true})).toBeVisible();
  await page.getByRole('textbox',{name:'Search questions and answers'}).fill('unmatchedtopicxyz');
  await expect(page.getByText('No prepared answer matches those words.')).toBeVisible();
});

test('mobile document and practice layouts',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/library');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:'/tmp/shreehan-library-mobile.png',fullPage:false});
  await page.locator('.document-card').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.getByRole('button',{name:'Close reader'}).click();
  await page.getByRole('button',{name:'Start practicing',exact:true}).click();
  await page.getByRole('textbox',{name:'Search questions and answers'}).fill('পাখা');
  await expect(page.locator('.question-card').first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
