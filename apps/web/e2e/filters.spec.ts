/**
 * E2E — Filters (PRD §4.3).
 *
 * Opens the filter panel, applies a property-type + city filter, verifies
 * the grid narrows, then clears filters and confirms the full list is
 * restored.
 */
import { goto } from './test-helpers';
import { expect, test } from '@playwright/test';
import { FilterPanelPage } from './pages/filter-panel-page';

test.describe('Filters', () => {
  test('applying filters narrows the grid and clearing restores it', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const initialCount = await grid.locator('article').count();
    expect(initialCount).toBeGreaterThan(1);

    const filters = new FilterPanelPage(page);

    // Open the filter panel.
    await filters.open();

    // Select "Riyadh" city.
    await filters.selectCity('Riyadh');

    // Set min price to a high value to narrow results.
    await filters.fillMinPrice('5000');

    // Select sort: Price: High to Low.
    await filters.selectSort('price_desc');

    // Apply filters.
    await filters.apply();

    // Wait for the grid to refresh with filtered results — non-empty and
    // strictly narrower than the initial grid.
    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeLessThan(initialCount);

    // Re-open filter panel and clear all filters.
    await filters.open();
    await filters.clearAll();

    // Wait for the full grid to be restored.
    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(initialCount);
  });

  test('[AC-22] filters serialize to URL query params (shareable URLs)', async ({ page }) => {
    // Open home page
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const filters = new FilterPanelPage(page);

    // Open filter panel and apply type=VILLA, minPrice=1000
    await filters.open();
    await filters.selectType('Villa');
    await filters.fillMinPrice('1000');
    await filters.apply();

    // Assert URL contains ?type=VILLA&minPrice=1000
    await expect(page).toHaveURL(/type=VILLA/);
    await expect(page).toHaveURL(/minPrice=1000/);

    // Wait for results to load
    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    // Reload page with those query params directly
    await goto(page, '/?type=VILLA&minPrice=1000');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Open filter panel and assert it reflects the loaded params
    await filters.open();
    await expect(page.getByRole('button', { name: 'Villa', pressed: true })).toBeVisible();
    await expect(page.locator('#filter-min-price')).toHaveValue('1000');

    // Assert search results match the filter
    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
  });
});
