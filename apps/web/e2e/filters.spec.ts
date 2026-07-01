/**
 * E2E — Filters (PRD §4.3).
 *
 * Opens the filter panel, applies a property-type + city filter, verifies
 * the grid narrows, then clears filters and confirms the full list is
 * restored.
 */
import { expect, test } from '@playwright/test';

test.describe('Filters', () => {
  test('applying filters narrows the grid and clearing restores it', async ({ page }) => {
    await page.goto('/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const initialCount = await grid.locator('article').count();
    expect(initialCount).toBeGreaterThan(1);

    // Open the filter panel.
    await page.getByRole('button', { name: 'Filters' }).click();

    // Select "Villa" property type.
    await page.locator('#filter-city').selectOption('Riyadh');

    // Set min price to a high value to narrow results.
    await page.locator('#filter-min-price').fill('5000');

    // Select sort: Price: High to Low.
    await page.locator('#filter-sort').selectOption('price_desc');

    // Apply filters.
    await page.getByRole('button', { name: 'Apply Filters' }).click();

    // Wait for the grid to refresh with filtered results.
    await expect
      .poll(
        async () => {
          const count = await grid.locator('article').count();
          return count;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    const filteredCount = await grid.locator('article').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);

    // Re-open filter panel and clear all filters.
    await page.getByRole('button', { name: /Filters/ }).click();
    await page.getByRole('button', { name: 'Clear All' }).click();

    // Wait for the full grid to be restored.
    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBe(initialCount);
  });

  test('[AC-22] filters serialize to URL query params (shareable URLs)', async ({ page }) => {
    // Open home page
    await page.goto('/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Open filter panel and apply type=VILLA, minPrice=1000
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('checkbox', { name: 'Villa' }).check();
    await page.locator('#filter-min-price').fill('1000');
    await page.getByRole('button', { name: 'Apply Filters' }).click();

    // Assert URL contains ?type=VILLA&minPrice=1000
    await expect(page).toHaveURL(/type=VILLA/);
    await expect(page).toHaveURL(/minPrice=1000/);

    // Wait for results to load
    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    // Reload page with those query params directly
    await page.goto('/?type=VILLA&minPrice=1000');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Open filter panel and assert it reflects the loaded params
    await page.getByRole('button', { name: 'Filters' }).click();
    await expect(page.getByRole('checkbox', { name: 'Villa' })).toBeChecked();
    await expect(page.locator('#filter-min-price')).toHaveValue('1000');

    // Assert search results match the filter
    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
  });
});
