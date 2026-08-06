/**
 * E2E — Browse listings (T-033, PRD §3.5, §4.1).
 *
 * The home page must load with at least one property card visible, and
 * tapping a card must take the user to that property's detail page where
 * its title is rendered as the primary heading.
 */
import { goto } from './test-helpers';
import { expect, test } from '@playwright/test';
import { SEED_PROPERTY_TITLES } from './test-fixtures';

test.describe('PRD §3.5 — Browse Listings', () => {
  test('home page loads with property cards and a card click navigates to detail', async ({
    page,
  }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Click a seeded card — the first grid card can be a fixture property
    // owned by a parallel test and deleted mid-run.
    const expectedTitle = SEED_PROPERTY_TITLES[0];
    const firstCard = grid.locator('article').filter({ hasText: expectedTitle });
    await expect(firstCard).toBeVisible();

    await firstCard.locator('a').first().click();

    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);

    const detailHeading = page.getByRole('heading', { level: 1, name: expectedTitle });
    await expect(detailHeading).toBeVisible({ timeout: 15_000 });
  });

  test('[AC-34] pull-to-refresh on home page triggers data reload', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });
    await expect(grid.locator('article').first()).toBeVisible({ timeout: 15_000 });

    // Pull-to-refresh listens to real touch events (usePullToRefresh in
    // home-page.tsx) — a mouse drag does nothing. Dispatch trusted touch
    // events via CDP, swiping down past PULL_TO_REFRESH_THRESHOLD (80px).
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    const startY = 60;
    const endY = viewport!.height * 0.6;
    expect(endY - startY).toBeGreaterThanOrEqual(80);
    const centerX = viewport!.width / 2;

    // A successful pull must refetch the property list.
    const refetch = page.waitForResponse(
      (r) => r.url().includes('/api/properties') && r.request().method() === 'GET',
    );

    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: centerX, y: startY }],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: centerX, y: startY + 40 }],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: centerX, y: endY }],
    });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    // The gesture must trigger a data reload.
    await refetch;

    // Grid should still be visible after pull-to-refresh
    await expect(grid).toBeVisible({ timeout: 15_000 });
    await expect(grid.locator('article').first()).toBeVisible({ timeout: 15_000 });
  });
});
