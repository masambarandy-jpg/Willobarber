import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:8090',
    headless: true,
    screenshot: 'on',
    video: 'retain-on-failure',
    viewport: { width: 390, height: 844 }, // iPhone 14
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  reporter: [['html', { outputFolder: 'tests/playwright-report' }]],
});
