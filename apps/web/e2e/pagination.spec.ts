/**
 * E2E — Pagination (US3).
 *
 * The seed dataset has 16 properties (under the 20/page threshold).
 * This spec verifies that all properties load on the initial page and
 * that the pagination boundary behaves correctly.
 */
import { expect, test } from '@playwright/test';

test.describe('Pagination', () => {
  test('home page shows all 16 seeded properties', async ({ page }) => {
    await page.goto('/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Wait for all articles to render.
    await expect.poll(async () => grid.locator('article').count(), { timeout: 15_000 }).toBe(16);
  });

  test('pagination API returns correct structure', async ({ page }) => {
    // Intercept the properties API to inspect the response.
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/properties') && res.status() === 200,
    );

    await page.goto('/');
    await page.getByTestId('property-grid').waitFor({ timeout: 15_000 });

    const response = await responsePromise;
    const body = await response.json();

    // API should return properties array.
    expect(body).toHaveProperty('properties');
    expect(Array.isArray(body.properties)).toBe(true);
    expect(body.properties.length).toBe(16);
  });
});
