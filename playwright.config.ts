import { defineConfig, devices } from '@playwright/test';

const E2E_PORT = 3099;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || `http://localhost:${E2E_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next dev --turbopack -p ${E2E_PORT}`,
        url: `http://localhost:${E2E_PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
