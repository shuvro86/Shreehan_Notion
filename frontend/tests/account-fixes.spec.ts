import { test, expect } from '@playwright/test';

test('history and change-password form work after login', async ({ page }) => {
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;
  if (!username || !password) test.skip(true, 'Set E2E_USERNAME and E2E_PASSWORD.');
  await page.goto('/login');
  await page.getByPlaceholder('Your favorite name').fill(username!);
  await page.getByPlaceholder('Enter your password').fill(password!);
  await page.getByRole('button', { name: 'Enter my workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Ready for your next discovery?' })).toBeVisible();
  await expect(page.locator('.hero-history')).not.toContainText('Loading today’s history…');
  await page.locator('.hero-history').click();
  const history = page.getByRole('dialog', { name: /On this day/ });
  await expect(history).toBeVisible();
  await expect(history.getByRole('region', { name: 'World history' }).locator('.history-event')).not.toHaveCount(0);
  await history.getByRole('button', { name: 'Close dialog' }).click();

  await page.getByRole('button', { name: 'Change password' }).click();
  const form = page.getByRole('dialog', { name: 'Change password' });
  await expect(form.getByLabel('Current password')).toHaveCount(0);
  await expect(form.getByLabel('New password', { exact: true })).toHaveAttribute('minlength', '6');
  await expect(form.getByLabel('Confirm new password')).toHaveAttribute('minlength', '6');
  await form.getByLabel('New password', { exact: true }).fill('another-password-123');
  await form.getByLabel('Confirm new password').fill('different-password-123');
  await form.getByRole('button', { name: 'Save new password' }).click();
  await expect(form.getByRole('alert')).toHaveText('New passwords do not match.');
});

test('signup accurately explains local OTP delivery', async ({ page }) => {
  await page.route('**/api/auth/signup', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ delivery: 'development_log' }) }));
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByPlaceholder('Your favorite name').fill('new_learner');
  await page.getByPlaceholder('you@example.com').fill('new@example.test');
  await page.getByRole('button', { name: 'Send my code' }).click();
  await expect(page.getByRole('status')).toContainText('Email is not configured');
});
