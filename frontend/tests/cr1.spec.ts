import { test, expect } from '@playwright/test';

test('account login and board changes persist through reload', async ({ page }) => {
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;
  if (!username || !password) test.skip(true, 'Set E2E_USERNAME and E2E_PASSWORD for the local test account.');
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('.auth-wrap')).toHaveCSS('display', 'grid');
  await page.screenshot({ path: 'tmp/cr1-login.png', fullPage: true });
  await page.getByPlaceholder('Your favorite name').fill(username!);
  await page.getByPlaceholder('Enter your password').fill(password!);
  await page.getByRole('button', { name: 'Enter my workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Ready for your next discovery?' })).toBeVisible();
  await page.getByRole('link', { name: 'Project board' }).click();
  await expect(page.getByRole('heading', { name: 'My project board' })).toBeVisible();
  await expect(page.locator('.kanban-column')).toHaveCount(5);
  if (await page.getByRole('button', { name: 'Rename Ideas for later' }).count()) {
    await page.getByRole('button', { name: 'Rename Ideas for later' }).click();
    await page.getByRole('textbox', { name: 'Column name' }).fill('Ideas');
    await page.getByRole('textbox', { name: 'Column name' }).press('Enter');
    await expect(page.getByRole('button', { name: 'Ideas', exact: true })).toBeVisible();
  }
  if (await page.getByRole('button', { name: 'Delete Browser persistence check' }).count()) {
    await page.getByRole('button', { name: 'Delete Browser persistence check' }).click();
    await expect(page.getByText('Browser persistence check')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Add a card' }).first().click();
  await page.getByLabel('Title').fill('Browser persistence check');
  await page.getByLabel('Details').fill('Stored in SQLite');
  await page.getByRole('button', { name: 'Add card', exact: true }).click();
  await expect(page.getByText('Browser persistence check')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Browser persistence check')).toBeVisible();
  await page.getByRole('button', { name: 'Rename Ideas' }).click();
  await page.getByRole('textbox', { name: 'Column name' }).fill('Ideas for later');
  await page.getByRole('textbox', { name: 'Column name' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Ideas for later', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ideas for later', exact: true })).toBeVisible();
  await page.locator('.kanban-card', { hasText: 'Browser persistence check' }).dragTo(page.locator('.kanban-column').nth(1));
  await expect(page.locator('.kanban-column').nth(1).getByText('Browser persistence check')).toBeVisible();
  await page.reload();
  await expect(page.locator('.kanban-column').nth(1).getByText('Browser persistence check')).toBeVisible();
  await page.getByRole('button', { name: 'Delete Browser persistence check' }).click();
  await expect(page.getByText('Browser persistence check')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Browser persistence check')).toHaveCount(0);
  await page.getByRole('button', { name: 'Rename Ideas for later' }).click();
  await page.getByRole('textbox', { name: 'Column name' }).fill('Ideas');
  await page.getByRole('textbox', { name: 'Column name' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Ideas', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Learning hub' }).click();
  await expect(page.getByRole('heading', { name: 'Ready for your next discovery?' })).toBeVisible();
  if (!(await page.getByText('Account task persistence check').count())) {
    await page.getByRole('button', { name: 'New task' }).click();
    await page.getByPlaceholder('e.g. Review the science chapter').fill('Account task persistence check');
    await page.getByRole('button', { name: 'Create task' }).click();
    await expect(page.getByText('Account task persistence check')).toBeVisible();
  }
  await page.reload();
  await expect(page.getByText('Account task persistence check')).toBeVisible();
  await page.goto('/practice');
  await expect(page.getByRole('heading', { name: 'A little practice. A lot of possibility.' })).toBeVisible();
  const marker = page.getByRole('button', { name: 'Mark practiced' }).first();
  if (await marker.count()) await marker.click();
  await expect(page.getByRole('button', { name: 'Practiced' }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Practiced' }).first()).toBeVisible();
});
