/**
 * E2E — Search (T-033, PRD §4.1): typing narrows the result grid and
 * clearing restores it. Seed titles are unique per city (only Riyadh
 * listings contain "Riyadh"), giving a deterministic filter assertion.
 * Filtering and clearing are separate tests.
 */
import { goto } from './test-helpers';
import { expect, test } from '@playwright/test';

const RIYADH_QUERY = 'Riyadh';

test.describe('Search', () => {
  test('typing in the search bar filters the results', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByLabel('Search properties');
    await searchInput.fill(RIYADH_QUERY);

    // Poll until every visible card matches — the seed holds non-Riyadh
    // properties, so narrowing proves the filter without a racy baseline count.
    await expect
      .poll(
        async () => {
          const cards = await grid.getByRole('article').allInnerTexts();
          if (cards.length === 0) return false;
          return cards.every((text) => text.toLowerCase().includes(RIYADH_QUERY.toLowerCase()));
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });

  test('clearing the search restores the full list', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByLabel('Search properties');
    await searchInput.fill(RIYADH_QUERY);

    await expect
      .poll(
        async () => {
          const cards = await grid.getByRole('article').allInnerTexts();
          if (cards.length === 0) return false;
          return cards.every((text) => text.toLowerCase().includes(RIYADH_QUERY.toLowerCase()));
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    const clearButton = page.getByRole('button', { name: 'Clear search' });
    await clearButton.click();

    // Restore asserts against the invariant: 24+ seeded properties exist
    // and are never deleted mid-run (a baseline snapshot would race).
    await expect
      .poll(async () => grid.getByRole('article').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(20);
  });
});
