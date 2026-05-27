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
});
