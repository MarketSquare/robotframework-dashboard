import { test, expect } from '@playwright/test';
import { open_shop, unlucky } from './shop';

test.describe('Cart', () => {
  test('adds a product to the cart', { tag: ['@smoke'] }, async ({ page }) => {
    await test.step('Open shop', async () => {
      await open_shop(page);
    });
    await test.step('Add product', async () => {
      await page.click('#add');
    });
    await test.step('Verify cart count', async () => {
      await expect(page.locator('#cart')).toHaveText('1');
    });
  });

  test('adds several products', async ({ page }) => {
    await test.step('Open shop', async () => {
      await open_shop(page);
    });
    await test.step('Add product', async () => {
      for (let i = 0; i < 3; i++) await page.click('#add');
    });
    await test.step('Verify cart count', async () => {
      await expect(page.locator('#cart')).toHaveText('3');
    });
  });

  // Fails on the first attempt now and then and passes on the retry: a flaky test.
  test('cart survives a slow network', { tag: ['@regression'] }, async ({ page }, testInfo) => {
    await test.step('Open shop', async () => {
      await open_shop(page);
    });
    await test.step('Add product', async () => {
      await page.click('#add');
    });
    await test.step('Verify cart count', async () => {
      const flaky = testInfo.retry === 0 && unlucky(0.5);
      await expect(page.locator('#cart')).toHaveText(flaky ? '2' : '1', { timeout: 500 });
    });
  });
});

test.describe('Checkout', () => {
  test('checkout button is missing', { tag: ['@wip'] }, async ({ page }) => {
    await open_shop(page);
    await expect(page.locator('#checkout')).toBeVisible({ timeout: 500 });
  });
});
