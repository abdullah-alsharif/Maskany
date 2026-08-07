/**
 * E2E — Browse listings (T-033, PRD §3.5, §4.1).
 *
 * The home page must load with at least one property card visible, and
 * tapping a card must take the user to that property's detail page where
 * its title is rendered as the primary heading.
 */
import { goto, openSeedProperty } from './test-helpers';
import { expect, test } from '@playwright/test';
import { SEED_PROPERTY_TITLES } from './test-fixtures';

test.describe('PRD §3.5 — Browse Listings', () => {
  test('home page loads with property cards', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // The first grid card may be a parallel test's fixture property,
    // deleted mid-run — a seeded card is stable for the whole run.
    const expectedTitle = SEED_PROPERTY_TITLES[0];
    const firstCard = grid.getByRole('article').filter({ hasText: expectedTitle });
    await expect(firstCard).toBeVisible();
  });

  test('clicking a card navigates to its detail page', async ({ page }) => {
    await goto(page, '/');

    const expectedTitle = SEED_PROPERTY_TITLES[0];

    await openSeedProperty(page, expectedTitle);

    const detailHeading = page.getByRole('heading', { level: 1, name: expectedTitle });
    await expect(detailHeading).toBeVisible({ timeout: 15_000 });
  });

  test('[AC-34] pull-to-refresh on home page triggers data reload', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });
    await expect(grid.getByRole('article').first()).toBeVisible({ timeout: 15_000 });

    // Pull-to-refresh listens to trusted touch events (usePullToRefresh in
    // home-page.tsx) — dispatch via CDP, past the 80px threshold.
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    const startY = 60;
    const endY = viewport!.height * 0.6;
    expect(endY - startY).toBeGreaterThanOrEqual(80);
    const centerX = viewport!.width / 2;

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

    await refetch;

    await expect(grid).toBeVisible({ timeout: 15_000 });
    await expect(grid.getByRole('article').first()).toBeVisible({ timeout: 15_000 });
  });
});
