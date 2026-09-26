import { test, expect } from '@playwright/test';
import { open_shop, unlucky } from './shop';

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await open_shop(page);
  });

  test('finds a product by name', { tag: ['@smoke'] }, async ({ page }) => {
    await test.step('Type search query', async () => {
      await page.fill('#search', 'robot');
    });
    await test.step('Verify results', async () => {
      await expect(page.locator('#results li')).toHaveText(['Robot']);
    });
  });

  test('search is case insensitive', async ({ page }) => {
    await test.step('Type search query', async () => {
      await page.fill('#search', 'PLAY');
    });
    await test.step('Verify results', async () => {
      await expect(page.locator('#results li')).toHaveText(['Playwright']);
    });
  });

  test('matches multiple products', { tag: ['@regression'] }, async ({ page }) => {
    await test.step('Type search query', async () => {
      await page.fill('#search', 'o');
    });
    await test.step('Verify results', async () => {
      const expected = unlucky(0.4) ? ['Robot', 'Keyboard'] : ['Robot', 'Dashboard', 'Keyboard'];
      await expect(page.locator('#results li')).toHaveText(expected, { timeout: 1000 });
    });
  });

  test('shows suggestions while typing', {
    tag: ['@regression'],
    annotation: { type: 'issue', description: 'https://example.com/issues/42' },
  }, async () => {
    test.skip(true, 'Suggestions are not implemented yet');
  });
});
