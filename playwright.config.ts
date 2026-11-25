import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

import { API_PORT, API_URL, APP_URL, WEB_PORT } from './e2e/support/env';

// Locally from server/.env.e2e; in CI from the job env, which wins because loadEnvFile never overrides.
if (existsSync('server/.env.e2e')) process.loadEnvFile('server/.env.e2e');

// The API server loads server/.env as a fallback, so without this guard a missing DATABASE_URL
// would point the e2e run at the dev database.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. E2E tests need their own database: locally via server/.env.e2e, in CI via the job env.');
}
const database = new URL(databaseUrl).pathname.slice(1);
if (!database.endsWith('_test')) {
  throw new Error(`Refusing to run e2e tests against "${database}": the database name must end in "_test".`);
}

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: APP_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: [
    {
      name: 'api',
      // migrations are idempotent, so a fresh database works without a separate step.
      // Binaries are called directly: `pnpm exec` starts them in their own process group, which
      // Playwright's shutdown does not reach, so the servers outlive the run and it never ends.
      command: './node_modules/.bin/drizzle-kit migrate && ./node_modules/.bin/tsx src/index.ts',
      cwd: 'server',
      url: `${API_URL}/health`,
      // never attach to a server that is already running: it could be using another database
      reuseExistingServer: false,
      env: {
        DATABASE_URL: databaseUrl,
        PORT: String(API_PORT),
        APP_URL,
        BETTER_AUTH_URL: API_URL,
        // sessions only need to outlive one run
        BETTER_AUTH_SECRET: randomBytes(32).toString('base64'),
        // invitation links are logged instead of emailed
        RESEND_API_KEY: '',
        EMAIL_FROM: '',
      },
    },
    {
      name: 'web',
      command: `./node_modules/.bin/vite --port ${WEB_PORT} --strictPort`,
      url: APP_URL,
      reuseExistingServer: false,
      env: { VITE_API_URL: API_URL },
    },
  ],
});
