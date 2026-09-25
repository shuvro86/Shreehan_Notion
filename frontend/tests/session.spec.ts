import { test, expect } from '@playwright/test';

test('sign-out is shared across tabs and private pages stay guarded', async ({ page, context }) => {
  test.skip(!process.env.E2E_USERNAME || !process.env.E2E_PASSWORD, 'Needs temporary test account');
  await page.goto('/login');
  await page.getByPlaceholder('Your favorite name').fill(process.env.E2E_USERNAME!);
  await page.getByPlaceholder('Enter your password').fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Enter my workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Ready for your next discovery?' })).toBeVisible({ timeout: 30_000 });
  const second = await context.newPage();
  await second.goto('/kanban');
  await expect(second.locator('h1')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
  await expect(second).toHaveURL(/\/login$/, { timeout: 30_000 });
  await second.goto('/kanban');
  await expect(second).toHaveURL(/\/login$/);
  expect((await context.request.get('/api/board')).status()).toBe(401);
});

test('API revocation hides private content without a full page navigation', async ({ page, context }) => {
  test.skip(!process.env.E2E_USERNAME || !process.env.E2E_PASSWORD, 'Needs temporary test account');
  await page.goto('/login');
  await page.getByPlaceholder('Your favorite name').fill(process.env.E2E_USERNAME!);
  await page.getByPlaceholder('Enter your password').fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Enter my workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Ready for your next discovery?' })).toBeVisible({ timeout: 30_000 });
  await context.request.post('/api/auth/logout-all');
  await page.evaluate(() => fetch('/api/library'));
  await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Ready for your next discovery?' })).toHaveCount(0);
});
