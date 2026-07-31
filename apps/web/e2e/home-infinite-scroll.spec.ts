import { expect, test } from '@playwright/test';

test.describe('Home page infinite scroll', () => {
  test('loads more properties when scrolling to the bottom', async ({ page }) => {
    await page.goto('/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Wait for the first page of 20 properties to fully render.
    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBe(20);

    // Scroll to the bottom of the page body to trigger infinite scroll.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for new articles to load (seed has 24 total, so 4 more should appear).
    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBe(24);
  });
});
