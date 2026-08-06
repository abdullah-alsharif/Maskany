import { goto } from './test-helpers';
import { test, expect } from '@playwright/test';

test.describe('PWA offline support', () => {
  test('offline banner appears when network is disabled', async ({ page, context }) => {
    await goto(page, '/');
    await expect(page.getByTestId('offline-banner')).not.toBeVisible();

    await context.setOffline(true);
    await page.waitForTimeout(500);

    await expect(page.getByTestId('offline-banner')).toBeVisible();
    await expect(page.getByTestId('offline-banner')).toContainText("You're offline");
  });

  test('offline banner disappears when network is restored', async ({ page, context }) => {
    await goto(page, '/');
    await context.setOffline(true);
    await page.waitForTimeout(500);
    await expect(page.getByTestId('offline-banner')).toBeVisible();

    await context.setOffline(false);
    await page.waitForTimeout(500);
    await expect(page.getByTestId('offline-banner')).not.toBeVisible();
  });

  // Skipped: `@ducanh2912/next-pwa` disables caching in dev mode (`next dev`),
  // so the service worker cannot serve cached HTML after going offline.
  // Tested manually against production builds (`next build && next start`).
  test.skip('app shell loads from cache after going offline', async ({ page, context }) => {
    await goto(page, '/');
    await page.waitForLoadState('networkidle');

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});

    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();
  });
});
