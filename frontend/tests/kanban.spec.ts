import { test, expect } from '@playwright/test';

test('one seeded board supports fixed columns, rename, add, delete, and browser persistence', async ({ page }) => {
  await page.goto('/kanban');

  const columns = page.locator('.kanban-column');
  await expect(columns).toHaveCount(5);
  await expect(page.getByRole('heading', { name: 'My project board' })).toBeVisible();
  await expect(columns.nth(0).getByRole('button', { name: 'Ideas', exact: true })).toBeVisible();
  await expect(columns.nth(4).getByRole('button', { name: 'Done', exact: true })).toBeVisible();

  await columns.nth(0).getByRole('button', { name: 'Rename Ideas' }).click();
  const rename = columns.nth(0).getByRole('textbox', { name: 'Column name' });
  await rename.fill('Backlog');
  await rename.press('Enter');
  await expect(columns.nth(0).getByRole('button', { name: 'Backlog', exact: true })).toBeVisible();

  await columns.nth(0).getByRole('button', { name: 'Add a card', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Sketch a reading corner');
  await page.locator('#card-details').fill('Choose a quiet place and add a soft cushion.');
  await page.getByRole('button', { name: 'Add card', exact: true }).click();
  const addedCard = columns.nth(0).locator('.kanban-card').filter({ hasText: 'Sketch a reading corner' });
  await expect(addedCard).toContainText('Choose a quiet place and add a soft cushion.');

  await page.reload();
  const savedColumn = page.locator('.kanban-column').nth(0);
  await expect(savedColumn.getByRole('button', { name: 'Backlog', exact: true })).toBeVisible();
  const savedCard = savedColumn.locator('.kanban-card').filter({ hasText: 'Sketch a reading corner' });
  await expect(savedCard).toBeVisible();
  await savedCard.getByRole('button', { name: 'Delete Sketch a reading corner' }).click();
  await expect(savedCard).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.kanban-column').nth(0).getByText('Sketch a reading corner', { exact: true })).toHaveCount(0);
});

test('dragging a card moves it between the fixed columns', async ({ page }) => {
  await page.goto('/kanban');
  const boardColumns = page.locator('.kanban-column');
  const card = boardColumns.nth(0).locator('.kanban-card').filter({ hasText: 'Build a better morning routine' });
  await card.dragTo(boardColumns.nth(1));
  await expect(boardColumns.nth(1).getByRole('heading', { name: 'Build a better morning routine' })).toBeVisible();
  await expect(boardColumns.nth(0).getByRole('heading', { name: 'Build a better morning routine' })).toHaveCount(0);
});
