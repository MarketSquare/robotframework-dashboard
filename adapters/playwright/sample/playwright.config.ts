import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  retries: 1,
  reporter: [['list'], ['json', { outputFile: 'results/report.json' }]],
  metadata: { Environment: process.env.SAMPLE_ENV ?? 'local' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
});
