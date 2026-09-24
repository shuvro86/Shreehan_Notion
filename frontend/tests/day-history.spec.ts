import { test, expect } from '@playwright/test';
import { dhakaDate, selectHistory } from '../app/lib/day-history';

test('Bangladesh events are found before truncation, including historical place names', () => {
 const world = Array.from({ length: 12 }, (_, i) => ({ year: 2000 + i, text: `World event ${i}` }));
 const events = selectHistory('09-21', [...world, { year: 1971, text: 'A memorable day in East Pakistan.' }, { text: 'A local achievement.', pages: [{ titles: { normalized: 'Bangladesh' } }] }]);
 expect(events.slice(0, 2).map(e => e.region)).toEqual(['Bangladesh', 'Bangladesh']);
 expect(events).toHaveLength(10);
 expect(selectHistory('09-21', [null, {}, { text: 123 }])).toEqual([]);
});

test('national commemorations match dates and follow Dhaka midnight', () => {
 expect(dhakaDate(new Date('2026-03-25T18:00:00Z'))).toBe('03-26');
 expect(dhakaDate(new Date('2026-03-25T17:59:59Z'))).toBe('03-25');
 for (const date of ['02-21', '03-26', '12-16']) expect(selectHistory(date, [])[0].region).toBe('Bangladesh');
 expect(selectHistory('09-21', undefined)).toEqual([]);
});

test('history highlights Bangladesh and groups world events afterwards', async ({ page }) => {
 await page.route('**/api/day-context', route => route.fulfill({ json: {
  dateLabel: 'March 26', location: 'Dhaka', weather: { temperature: null, code: null },
  events: selectHistory('03-26', [{ year: 2000, text: 'A world discovery.' }]),
 } }));
 await page.goto('/');
 await expect(page.locator('.hero-history')).toContainText('BANGLADESH');
 await expect(page.locator('.hero-history')).toContainText('Bangladesh declared independence');
 await page.locator('.hero-history').click();
 const modal = page.getByRole('dialog');
 await expect(modal).toContainText('March 26');
 await expect(modal.locator('.history-group-heading')).toHaveText(['Bangladesh', 'Around the world']);
 await expect(modal.getByRole('region', { name: 'World history' })).toContainText('A world discovery.');
});
