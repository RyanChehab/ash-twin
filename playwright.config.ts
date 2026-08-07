import { defineConfig } from '@playwright/test';
import 'dotenv/config';

const tenant = process.env.TENANT ?? 'cca';
const env    = process.env.ENV    ?? 'local';

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 8,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ...(process.env.CI ? [['junit', { outputFile: 'test-results/junit.xml' }] as const] : []),
  ],
  use: {
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: `${tenant}-${env}` },
  ],
});
