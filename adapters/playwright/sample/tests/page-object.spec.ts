import { test, expect } from '@playwright/test';
import { ShopPage, unlucky } from './shop';

// No test.step() here: only the dashboard reporter turns these actions into keywords.
test.describe('Page object', () => {
  test('search and add to cart', { tag: ['@smoke'] }, async ({ page }) => {
    const shop = new ShopPage(page);
    await shop.open();
    await shop.search('dash');
    await expect(page.locator('#results li')).toHaveText(['Dashboard']);
    await shop.addToCart(2);
    await expect(page.locator('#cart')).toHaveText('2');
  });

  test('cart keeps count', async ({ page }) => {
    const shop = new ShopPage(page);
    await shop.open();
    await shop.addToCart(unlucky(0.3) ? 1 : 3);
    await expect(page.locator('#cart')).toHaveText('3', { timeout: 500 });
  });
});
