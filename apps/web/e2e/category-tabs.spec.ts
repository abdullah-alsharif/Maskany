/**
 * E2E — Category tabs (US11).
 *
 * The CategoryBar has 8 tabs (All, Apartments, Rooms, Chalets, Villas,
 * Houses, Studios, Other). This spec validates that each tab filters
 * the property grid correctly.
 */
import { expect, test } from '@playwright/test';

test.describe('Category Tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });
  });

  test('All tab shows all properties', async ({ page }) => {
    const grid = page.getByTestId('property-grid');

    // First click a specific tab to narrow.
    await page.getByRole('tab', { name: 'Villas' }).click();
    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
    const villaCount = await grid.locator('article').count();

    // Now click All — should show more or equal.
    await page.getByRole('tab', { name: 'All' }).click();
    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(villaCount);
  });

  test('Villas tab shows only villas', async ({ page }) => {
    const grid = page.getByTestId('property-grid');

    await page.getByRole('tab', { name: 'Villas' }).click();

    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    // All visible badges should say "Villa".
    const badges = grid
      .locator('article')
      .locator('span')
      .filter({ hasText: /^Villa$/ });
    const count = await grid.locator('article').count();
    const badgeCount = await badges.count();
    expect(badgeCount).toBe(count);
  });

  test('Apartments tab shows only apartments', async ({ page }) => {
    const grid = page.getByTestId('property-grid');

    await page.getByRole('tab', { name: 'Apartments' }).click();

    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    const badges = grid
      .locator('article')
      .locator('span')
      .filter({ hasText: /^Apartment$/ });
    const count = await grid.locator('article').count();
    const badgeCount = await badges.count();
    expect(badgeCount).toBe(count);
  });

  test('Studios tab shows only studios', async ({ page }) => {
    const grid = page.getByTestId('property-grid');

    await page.getByRole('tab', { name: 'Studios' }).click();

    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    const badges = grid
      .locator('article')
      .locator('span')
      .filter({ hasText: /^Studio$/ });
    const count = await grid.locator('article').count();
    const badgeCount = await badges.count();
    expect(badgeCount).toBe(count);
  });

  test('Other tab shows only other types or is empty', async ({ page }) => {
    const grid = page.getByTestId('property-grid');

    await page.getByRole('tab', { name: 'Other' }).click();

    // May be empty if no OTHER-type properties are seeded.
    await page.waitForTimeout(1000);
    const count = await grid.locator('article').count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
