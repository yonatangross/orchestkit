import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the OrchestKit docs site.
 *
 * Scope today: landing page (/) only. Add more spec files as needed.
 *
 * The dev server is started automatically. Re-uses an existing server if
 * one is already listening on :3000 (e.g., during local dev). On CI,
 * always starts fresh.
 */
// E2E_PORT lets a seat run its own server on 127.0.0.1 without touching :3000.
const e2ePort = process.env.E2E_PORT;
const baseURL = e2ePort ? `http://127.0.0.1:${e2ePort}` : 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  // Fail builds when test.only is left in source
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['iPhone 14'] },
    },
  ],

  webServer: {
    command: e2ePort ? `npx next dev -H 127.0.0.1 -p ${e2ePort}` : 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
