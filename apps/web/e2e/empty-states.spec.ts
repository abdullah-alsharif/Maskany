/**
 * E2E — Empty states and 404 (US5 + US7).
 *
 * Validates the no-results empty state, filter-matching-nothing state,
 * and 404 pages for invalid property UUIDs and routes.
 */
import { expect, test } from '@playwright/test';

test.describe('Empty States', () => {
  test('search for nonexistent term shows no-results state', async ({ page }) => {
    await page.goto('/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByLabel('Search properties').first();
    await searchInput.fill('xyznonexistent');

    // Wait for debounced search and empty results.
    await expect.poll(async () => grid.locator('article').count(), { timeout: 15_000 }).toBe(0);

    // NoResults component should appear.
    await expect(page.getByText('No properties found')).toBeVisible({ timeout: 10_000 });
  });

  test('filters matching nothing show empty state', async ({ page }) => {
    await page.goto('/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Set maxPrice to 1 — no property costs 1.
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.locator('#filter-max-price').fill('1');
    await page.getByRole('button', { name: 'Apply Filters' }).click();

    await expect.poll(async () => grid.locator('article').count(), { timeout: 15_000 }).toBe(0);

    await expect(page.getByText('No properties found')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('404 Pages', () => {
  test('nonexistent property UUID shows not-found', async ({ page }) => {
    await page.goto('/properties/00000000-0000-0000-0000-000000000000');

    await expect(page.getByText('Property not found')).toBeVisible({ timeout: 15_000 });
  });

  test('invalid route shows not-found', async ({ page }) => {
    const response = await page.goto('/nonexistent-page-xyz');
    expect(response?.status()).toBe(404);
  });
});
