/**
 * E2E — Home page infinite scroll.
 *
 * Reworked to be parallel-safe: total property count changes while other
 * specs create/delete their own properties, so we assert that a first page
 * of 20 renders and that scrolling loads *more* — never exact totals.
 */
import { goto } from './test-helpers';
import { expect, test } from '@playwright/test';

test.describe('Home page infinite scroll', () => {
  test('loads more properties when scrolling to the bottom', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // The seeded dataset always has ≥ 20 properties, so the first page
    // fills the page size of 20.
    await expect.poll(async () => grid.locator('article').count(), { timeout: 15_000 }).toBe(20);

    // Scroll to the bottom of the page body to trigger infinite scroll.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // More articles must load (seed has 24; other specs may add more).
    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeGreaterThan(20);
  });
});
