import { test, expect } from '@playwright/test';

test.describe('PWA offline support', () => {
  test('offline banner appears when network is disabled', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByTestId('offline-banner')).not.toBeVisible();

    await context.setOffline(true);
    await page.waitForTimeout(500);

    await expect(page.getByTestId('offline-banner')).toBeVisible();
    await expect(page.getByTestId('offline-banner')).toContainText("You're offline");
  });

  test('offline banner disappears when network is restored', async ({ page, context }) => {
    await page.goto('/');
    await context.setOffline(true);
    await page.waitForTimeout(500);
    await expect(page.getByTestId('offline-banner')).toBeVisible();

    await context.setOffline(false);
    await page.waitForTimeout(500);
    await expect(page.getByTestId('offline-banner')).not.toBeVisible();
  });

  test('app shell loads from cache after going offline', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});

    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();
  });
});
