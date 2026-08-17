import { defineConfig } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 5,
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
  // Every tenant/env combo we want to test is a Playwright project. Running
  // `npx playwright test` runs them all in one shot with a combined report;
  // `--project=cca-local` narrows to one.
  projects: [
    {
      name: 'cca-local',
      testDir: './specs',
      testMatch: ['vitality/native/**/*.spec.ts', 'vitality/default/**/*.spec.ts'],
      metadata: { tenant: 'cca', env: 'local' },
    },
    {
      name: 'cca-staging',
      testDir: './specs',
      testMatch: ['vitality/native/**/*.spec.ts', 'vitality/default/**/*.spec.ts'],
      metadata: { tenant: 'cca', env: 'staging' },
    },
    {
      name: 'theagenda-local',
      testDir: './specs',
      testMatch: ['vitality/native/**/*.spec.ts', 'vitality/capetown/**/*.spec.ts'],
      metadata: { tenant: 'theagenda', env: 'local' },
    },
    {
      name: 'theagenda-staging',
      testDir: './specs',
      testMatch: ['vitality/native/**/*.spec.ts', 'vitality/capetown/**/*.spec.ts'],
      metadata: { tenant: 'theagenda', env: 'staging' },
    },
  ],
});
