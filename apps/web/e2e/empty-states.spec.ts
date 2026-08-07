/**
 * E2E — Empty states and 404 (US5 + US7).
 *
 * No-results and filter-matching-nothing states assert the "No properties
 * found" terminal text; 404s cover invalid property UUIDs and routes.
 */
import { goto } from './test-helpers';
import { expect, test } from '@playwright/test';
import { FilterPanelPage } from './pages/filter-panel-page';

test.describe('Empty States', () => {
  test('search for nonexistent term shows no-results state', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByLabel('Search properties');
    await searchInput.fill('xyznonexistent');

    // Poll for the NoResults text: a count-0 poll can pass transiently
    // while the grid unmounts (skeleton or empty branch), the text cannot.
    await expect
      .poll(async () => page.getByText('No properties found').count(), { timeout: 15_000 })
      .toBe(1);
  });

  test('filters matching nothing show empty state', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Set maxPrice to 1 — no property costs 1.
    const filters = new FilterPanelPage(page);
    await filters.open();
    await filters.fillMaxPrice('1');
    await filters.apply();

    // See search test: poll for NoResults text — the article-count poll
    // can catch the skeleton window where the grid is unmounted.
    await expect
      .poll(async () => page.getByText('No properties found').count(), { timeout: 15_000 })
      .toBe(1);
  });
});

test.describe('404 Pages', () => {
  test('nonexistent property UUID shows not-found', async ({ page }) => {
    await goto(page, '/properties/00000000-0000-0000-0000-000000000000');

    await expect(page.getByText('Property not found')).toBeVisible({ timeout: 15_000 });
  });

  test('invalid route shows not-found', async ({ page }) => {
    const response = await page.goto('/nonexistent-page-xyz');
    expect(response?.status()).toBe(404);
  });
});
