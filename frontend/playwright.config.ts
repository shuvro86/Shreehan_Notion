import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', testMatch: '**/*.spec.ts', use: { baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000', headless: true }, reporter: 'list' });
