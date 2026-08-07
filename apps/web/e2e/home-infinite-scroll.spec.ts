/**
 * E2E — Home page infinite scroll. Parallel-safe: total counts shift while
 * other specs create/delete properties, so we assert a first page of 20 and
 * that scrolling loads more — never exact totals.
 */
import { goto } from './test-helpers';
import { expect, test } from '@playwright/test';

test.describe('Home page infinite scroll', () => {
  test('loads more properties when scrolling to the bottom', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // 20 is the API's page-size constant; the seed always has ≥20 properties.
    await expect.poll(async () => grid.getByRole('article').count(), { timeout: 15_000 }).toBe(20);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // More must load — the seed has 24 and other specs may add more.
    await expect
      .poll(async () => grid.getByRole('article').count(), { timeout: 15_000 })
      .toBeGreaterThan(20);
  });
});
