import { goto } from './test-helpers';
import { test, expect } from '@playwright/test';

test.describe('PWA offline support', () => {
  test('offline banner appears when network is disabled', async ({ page, context }) => {
    await goto(page, '/');
    await expect(page.getByTestId('offline-banner')).not.toBeVisible();

    await context.setOffline(true);

    await expect(page.getByTestId('offline-banner')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('offline-banner')).toContainText("You're offline");
  });

  test('offline banner disappears when network is restored', async ({ page, context }) => {
    await goto(page, '/');
    await context.setOffline(true);
    await expect(page.getByTestId('offline-banner')).toBeVisible({ timeout: 5_000 });

    await context.setOffline(false);
    await expect(page.getByTestId('offline-banner')).not.toBeVisible({ timeout: 5_000 });
  });
});
