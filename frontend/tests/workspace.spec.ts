import { test, expect } from '@playwright/test';

test('collections, search, tasks and persistence', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Ready for your next discovery?' })).toBeVisible();
  await expect(page.locator('.collection-card')).toHaveCount(8);
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  await expect(page.locator('.collection-grid')).toHaveClass(/list-view/);
  await page.getByRole('button', { name: 'Quick search' }).click();
  await page.getByPlaceholder('Find a collection or task…').fill('Syllabus');
  await page.getByRole('dialog').getByRole('button', { name: /Syllabus/ }).click();
  await expect(page.getByRole('link', { name: 'Open in Notion' })).toHaveAttribute('href', 'https://app.notion.com/p/3c49ecdd38af804ebce9e86206305609');
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await page.getByLabel('What would you like to work on?').fill('Practice geography maps');
  await page.getByLabel('Subject', { exact: true }).selectOption('Geography');
  await page.getByRole('button', { name: 'Create task' }).click();
  await page.getByRole('button', { name: /My tasks/ }).click();
  await page.getByRole('checkbox', { name: 'Complete Practice geography maps' }).click();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Complete Practice geography maps' })).toBeChecked();
  await page.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(page.getByText('Practice geography maps', { exact: true })).toBeVisible();
  await expect(page.getByText('Revise fractions & decimals', { exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(page.getByRole('button', { name: 'Mon Sep 21 2026' })).toBeVisible();
  await page.getByRole('button', { name: 'Sat Sep 26 2026' }).click();
  await expect(page.getByText('Room to recharge.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile navigation and layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: '/tmp/shreehan-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Collections', exact: true }).getByRole('button', { name: 'Exam', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Exam', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open in Notion' })).toBeVisible();
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
