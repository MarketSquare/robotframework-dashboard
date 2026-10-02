import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  retries: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'results/report.json' }],
    // every action, expect, hook and fixture, grouped per helper function / page object method
    ['../dashboard-reporter.js', { outputFile: 'results/dashboard-report.json', groupByFunction: true }],
  ],
  metadata: { Environment: process.env.SAMPLE_ENV ?? 'local' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
});
