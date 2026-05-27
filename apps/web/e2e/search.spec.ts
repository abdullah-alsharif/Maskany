/**
 * E2E — Search (T-033, PRD §4.1).
 *
 * Typing into the search bar narrows the result grid; clearing the query
 * restores the full list. The seed dataset uses unique titles per city
 * (e.g. only Riyadh listings contain "Riyadh"), giving us a deterministic
 * way to assert filtering.
 */
import { expect, test } from '@playwright/test';

const RIYADH_QUERY = 'Riyadh';

test.describe('Search', () => {
  test('typing in the search bar filters results and clearing restores them', async ({ page }) => {
    await page.goto('/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const initialCount = await grid.locator('article').count();
    expect(initialCount).toBeGreaterThan(1);

    const searchInput = page.getByLabel('Search properties').first();
    await searchInput.fill(RIYADH_QUERY);

    // Wait for the debounced query to land and the grid to refresh.
    await expect
      .poll(
        async () => {
          const cards = await grid.locator('article').allInnerTexts();
          if (cards.length === 0) return false;
          return cards.every((text) => text.toLowerCase().includes(RIYADH_QUERY.toLowerCase()));
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    const filteredCount = await grid.locator('article').count();
    expect(filteredCount).toBeLessThan(initialCount);
    expect(filteredCount).toBeGreaterThan(0);

    const clearButton = page.getByRole('button', { name: 'Clear search' });
    await clearButton.click();

    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBe(initialCount);
  });
});
