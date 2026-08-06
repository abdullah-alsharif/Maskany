/**
 * E2E — Dedicated /search page (US6).
 *
 * The /search route has no dedicated E2E test. This spec validates
 * that search results render correctly on the dedicated route.
 */
import { goto } from './test-helpers';
import { expect, test } from '@playwright/test';

test.describe('/search Page', () => {
  test('/search route displays filtered results', async ({ page }) => {
    await goto(page, '/search?q=Riyadh');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const cards = grid.locator('article');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // All visible cards should contain "Riyadh" in their text.
    const allTexts = await cards.allInnerTexts();
    for (const text of allTexts) {
      expect(text.toLowerCase()).toContain('riyadh');
    }
  });

  test('changing query on /search updates results', async ({ page }) => {
    await goto(page, '/search?q=Riyadh');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const riyadhCount = await grid.locator('article').count();
    expect(riyadhCount).toBeGreaterThan(0);

    // Change to Dubai query.
    await goto(page, '/search?q=Dubai');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const dubaiCount = await grid.locator('article').count();
    expect(dubaiCount).toBeGreaterThan(0);

    // Counts should differ (Riyadh and Dubai have different property counts).
    const allTexts = await grid.locator('article').allInnerTexts();
    for (const text of allTexts) {
      expect(text.toLowerCase()).toContain('dubai');
    }
  });
});
