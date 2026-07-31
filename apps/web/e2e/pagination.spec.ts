/**
 * E2E — Pagination (US3).
 *
 * The seed dataset has 24 properties (above the 20/page threshold).
 * This spec verifies the first page fetches the correct page size and
 * the API response structure is well-formed.
 */
import { expect, test } from '@playwright/test';

test.describe('Pagination', () => {
  test('home page shows first page of properties', async ({ page }) => {
    await page.goto('/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Page size is 20 — first page should show 20 properties.
    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBe(20);
  });

  test('pagination API returns correct structure with cursor', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/properties') && res.status() === 200,
    );

    await page.goto('/');
    await page.getByTestId('property-grid').waitFor({ timeout: 15_000 });

    const response = await responsePromise;
    const body = await response.json();

    expect(body).toHaveProperty('properties');
    expect(Array.isArray(body.properties)).toBe(true);
    // First page should have exactly 20 properties.
    expect(body.properties.length).toBe(20);
    // Should have a cursor for infinite scroll.
    expect(body).toHaveProperty('nextCursor');
  });
});
