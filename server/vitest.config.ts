import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 15000,
    // refuses to run unless DATABASE_URL points at a *_test database
    setupFiles: ['./test/setup.ts'],
    // all test files share one database that is truncated before each test
    fileParallelism: false,
    // app.ts loads server/.env too; blank these so tests never send real emails
    env: {
      RESEND_API_KEY: '',
      EMAIL_FROM: '',
    },
  },
});
