import { test, expect } from '@playwright/test';
import seed from '../../data/library.json';
import bank from '../../data/unseen-practice.json';

const documents = bank.sources.map(source => ({
 ...seed.documents[0],
 id: source.documentId,
 subject: source.subject,
 collection: 'Unseen Paper',
 sha256: source.sha256,
 title: `${source.subject} source page ${source.printedPage}`,
}));

test('reviewed bank covers every source with varied, unique questions', () => {
 expect(bank.sources).toHaveLength(18);
 expect(new Set(bank.questions.map(q => q.id)).size).toBe(70);
 expect(new Set(bank.questions.map(q => q.question)).size).toBe(70);
 expect(new Set(bank.questions.flatMap(q => q.sources.map(s => s.documentId)))).toEqual(new Set(bank.sources.map(s => s.documentId)));
 for (const subject of ['Science', 'History']) {
  const questions = bank.questions.filter(q => q.subject === subject);
  expect(questions).toHaveLength(35);
  expect(new Set(questions.map(q => q.type)).size).toBeGreaterThanOrEqual(5);
  for (const q of questions) {
   expect(q.answer.trim()).not.toBe('');
   if (q.options.length) expect(q.options).toContain(q.answer);
   for (const source of q.sources) expect(bank.sources.find(s => s.documentId === source.documentId)?.subject).toBe(subject);
  }
 }
});

test('subject questions reveal answers, preserve work, and add unique batches', async ({ page }) => {
 await page.route('**/api/library', route => route.fulfill({ json: { library: { ...seed, documents }, sync: { state: 'ok' } } }));
 await page.goto('/');
 await page.getByRole('navigation', { name: 'Collections', exact: true }).getByRole('button', { name: 'Unseen Paper', exact: true }).click();
 const module = page.getByRole('region', { name: 'Unseen Paper practice' });
 await expect(module.getByText('8 of 8 synced files have questions', { exact: false })).toBeVisible();
 const cards = module.locator('.unseen-question-card');
 await expect(cards).toHaveCount(20);
 await expect(module.locator('.unseen-model-answer:visible')).toHaveCount(0);
 await cards.first().getByRole('textbox').fill('wind');
 await cards.first().getByRole('button', { name: 'Show answer' }).click();
 await expect(cards.first().locator('.unseen-model-answer')).toHaveText('MODEL ANSWER · CLASS 2wind');
 await expect(cards.first().getByRole('link')).toHaveAttribute('href', /\/library\?doc=fe8ef472.*&page=1/);
 await module.getByRole('button', { name: 'Show 5 more different questions' }).click();
 await expect(cards).toHaveCount(25);
 await module.getByRole('button', { name: 'History 35 questions' }).click();
 await expect(cards).toHaveCount(20);
 await expect(module.locator('.unseen-model-answer:visible')).toHaveCount(0);
 await expect(module.getByText('10 of 10 synced files have questions', { exact: false })).toBeVisible();
 await cards.first().getByRole('button', { name: 'Show answer' }).click();
 await expect(cards.first().locator('.unseen-model-answer')).toContainText('Emperor Ashoka');
 for (let i = 0; i < 3; i++) await module.getByRole('button', { name: 'Show 5 more different questions' }).click();
 await expect(cards).toHaveCount(35);
 expect(new Set(await cards.evaluateAll(nodes => nodes.map(n => n.getAttribute('data-question-id')))).size).toBe(35);
 await expect(module.getByText('All 35 History questions are now shown.', { exact: false })).toBeVisible();
 await module.getByRole('button', { name: 'Science 35 questions' }).click();
 await expect(cards).toHaveCount(25);
 await expect(cards.first().getByRole('textbox')).toHaveValue('wind');
 await cards.first().getByRole('button', { name: 'Hide answer' }).click();
 await expect(cards.first().locator('.unseen-model-answer')).toBeHidden();
 await page.setViewportSize({ width: 390, height: 844 });
 await expect(page.locator('.sidebar')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -242, 0)');
 await module.scrollIntoViewIfNeeded();
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
 await page.screenshot({ path: '/tmp/shreehan-unseen-mobile.png' });
});

test('document reader recognizes the reviewed History questions', async ({ page }) => {
 await page.route('**/api/library', route => route.fulfill({ json: { library: { ...seed, documents }, sync: { state: 'ok' } } }));
 const source = bank.sources.find(s => s.subject === 'History' && s.printedPage === 34)!;
 await page.goto(`/library?doc=${source.documentId}&page=1`);
 const reader = page.getByRole('dialog');
 await expect(reader).toContainText('1 prepared questions reference this document.');
 await reader.getByRole('button', { name: 'Practice this subject' }).click();
 await expect(page.locator('.question-card')).toHaveCount(35);
});

test('changed or removed Notion sources cannot show stale answers', async ({ page }) => {
 const changedId = bank.sources.find(s => s.subject === 'Science')!.documentId;
 const removedId = bank.sources.find(s => s.subject === 'History')!.documentId;
 const updated = documents.filter(d => d.id !== removedId).map(d => d.id === changedId ? { ...d, sha256: 'changed' } : d);
 await page.route('**/api/library', route => route.fulfill({ json: { library: { ...seed, documents: updated }, sync: { state: 'ok' } } }));
 await page.goto('/');
 await page.getByRole('navigation', { name: 'Collections', exact: true }).getByRole('button', { name: 'Unseen Paper', exact: true }).click();
 await expect(page.getByRole('status').filter({ hasText: '1 new or changed file is awaiting automatic questions.' })).toBeVisible();
 await expect(page.locator(`.unseen-sources a[href*="${changedId}"]`)).toHaveCount(0);
 await page.getByRole('button', { name: /History \d+ questions/ }).click();
 await expect(page.locator(`.unseen-sources a[href*="${removedId}"]`)).toHaveCount(0);
 await expect(page.locator('[data-question-id="unseen-history-001"]')).toHaveCount(0);
});
