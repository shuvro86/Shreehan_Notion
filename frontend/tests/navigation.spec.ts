import { test, expect } from '@playwright/test';

test('all primary pages open through navigation', async ({ page }) => {
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;
  if (!username || !password) test.skip(true, 'Set E2E_USERNAME and E2E_PASSWORD.');
  const failures: string[] = [];
  let trackResponses = false;
  page.on('pageerror', error => failures.push(`page error: ${error.message}`));
  page.on('response', response => { if (trackResponses && response.status() >= 400 && new URL(response.url()).origin === new URL(process.env.E2E_BASE_URL || 'http://localhost:3000').origin) failures.push(`${response.status()} ${response.url()}`); });
  await page.goto('/login');
  await page.getByPlaceholder('Your favorite name').fill(username!);
  await page.getByPlaceholder('Enter your password').fill(password!);
  await page.getByRole('button', { name: 'Enter my workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Ready for your next discovery?' })).toBeVisible();
  trackResponses = true;
  await page.getByRole('button', { name: /My tasks/ }).first().click();
  await expect(page.getByRole('heading', { name: 'One small win at a time.' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Collections' }).getByRole('button', { name: 'Routine' }).click();
  await expect(page.getByRole('heading', { name: 'Routine', exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Browse library/ }).click();
  await expect(page).toHaveURL(/\/library\?collection=Routine$/);
  await expect(page.getByRole('heading', { name: 'Your learning. All here.' })).toBeVisible();
  for (const [label, pathname, back] of [
    ['Document library', '/library', 'Back to overview'],
    ['Shreehan Digital Twin', '/assistant', 'Back to learning hub'],
    ['Class 2 practice', '/practice', 'Back to overview'],
    ['Project board', '/kanban', 'Learning hub'],
  ]) {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Ready for your next discovery?' })).toBeVisible();
    await page.getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${pathname}$`));
    await expect(page.locator('h1').first()).toBeVisible();
    console.log(`${label}: ${page.url()} — ${await page.locator('h1').first().innerText()}`);
    await page.getByRole('link', { name: back }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Ready for your next discovery?' })).toBeVisible();
  }
  await page.goto('/library');
  await page.getByRole('button', { name: 'Start practicing' }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.getByRole('heading', { name: 'A little practice. A lot of possibility.' })).toBeVisible();
  await page.getByRole('button', { name: 'Browse documents' }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole('heading', { name: 'Your learning. All here.' })).toBeVisible();
  expect(failures).toEqual([]);
});
