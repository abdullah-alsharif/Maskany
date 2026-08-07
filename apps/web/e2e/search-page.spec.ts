/**
 * E2E — Dedicated /search page (US6): typing a query into the search
 * input on the dedicated route filters the results grid.
 */
import { goto } from './test-helpers';
import { expect, test } from '@playwright/test';

const RIYADH_QUERY = 'Riyadh';
const DUBAI_QUERY = 'Dubai';

test.describe('/search Page', () => {
  test('typing a query on /search filters the results', async ({ page }) => {
    await goto(page, '/search');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByLabel('Search properties');
    await searchInput.fill(RIYADH_QUERY);

    // Debounced query lands server-side; poll one consistent snapshot so
    // a single count read cannot observe a stale grid mid-refetch.
    await expect
      .poll(
        async () => {
          const texts = await grid.getByRole('article').allInnerTexts();
          if (texts.length === 0) return false;
          return texts.every((text) => text.toLowerCase().includes(RIYADH_QUERY.toLowerCase()));
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });

  test('changing query on /search updates results', async ({ page }) => {
    // Phase 1 (fill Riyadh) is pure setup so the grid settles; the
    // phase-2 poll then only observes the Dubai change (no stale reads).
    await goto(page, '/search');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByLabel('Search properties');

    await searchInput.fill(RIYADH_QUERY);
    await expect
      .poll(
        async () => {
          const texts = await grid.getByRole('article').allInnerTexts();
          if (texts.length === 0) return false;
          return texts.every((text) => text.toLowerCase().includes(RIYADH_QUERY.toLowerCase()));
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    await searchInput.fill(DUBAI_QUERY);
    await expect
      .poll(
        async () => {
          const texts = await grid.getByRole('article').allInnerTexts();
          if (texts.length === 0) return false;
          return texts.every((text) => text.toLowerCase().includes(DUBAI_QUERY.toLowerCase()));
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });
});
