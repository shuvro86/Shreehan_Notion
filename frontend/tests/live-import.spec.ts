import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
test('live synchronized library serves every original and new preview',async({request,page})=>{
 test.setTimeout(120000);
 const response=await request.get('/api/library');expect(response.ok()).toBeTruthy();
 const {library}=await response.json();expect(library.syncedAt).toBeTruthy();expect(library.documents.length).toBe(library.expectedAttachments);
 for(const doc of library.documents){const file=await request.get(doc.url);expect(file.status(),doc.filename).toBe(200);expect(createHash('sha256').update(await file.body()).digest('hex'),doc.filename).toBe(doc.sha256);for(const p of doc.pages){if(p.image.startsWith('/api/documents/'))expect((await request.get(p.image)).status()).toBe(200)}}
 await page.goto('/library');await expect(page.locator('.document-card')).toHaveCount(library.documents.length);
 const geometry=library.documents.find((d:{filename:string})=>d.filename==='Geometry.pdf');expect(geometry).toBeTruthy();
 await page.goto('/library?doc='+geometry.id);await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('link',{name:'Download',exact:true})).toHaveAttribute('href',geometry.url);
});
