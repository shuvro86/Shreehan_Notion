import {test,expect} from '@playwright/test';
import seed from '../../data/library.json';
test('an open library refreshes additions and removals without reload',async({page})=>{
 let library=structuredClone(seed);
 await page.route('**/api/library',r=>r.fulfill({json:{library,sync:{state:'ok',lastSuccess:new Date().toISOString()}}}));
 await page.goto('/library');await expect(page.locator('.document-card')).toHaveCount(30);
 library.documents.push({...library.documents[0],id:'new-test-document',title:'New automatically synced lesson'});
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.locator('.document-card')).toHaveCount(31);
 await page.getByRole('textbox',{name:'Search documents'}).fill('automatically synced');
 await expect(page.locator('.document-card')).toHaveCount(1);
 await page.locator('.document-card').click();await expect(page.getByRole('dialog')).toBeVisible();
 library.documents=library.documents.filter(d=>d.id!=='new-test-document');
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.document-card')).toHaveCount(0);
});
test('changed source files invalidate prepared answers',async({page})=>{
 const library=structuredClone(seed);library.documents=library.documents.map(d=>({...d,sha256:'changed'}));
 await page.route('**/api/library',r=>r.fulfill({json:{library,sync:{state:'ok'}}}));
 await page.goto('/practice');await expect(page.locator('.question-card')).toHaveCount(0);await expect(page.getByText('No prepared answer matches those words.')).toBeVisible();
});
