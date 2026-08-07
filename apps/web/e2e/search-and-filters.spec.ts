import { goto } from './test-helpers';
import { expect, test } from '@playwright/test';
import { FilterPanelPage } from './pages/filter-panel-page';

test.describe('Search + Filters combined', () => {
  test('search query and property type filter work together', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    await page.getByLabel('Search properties').fill('Riyadh');

    await expect
      .poll(
        async () => {
          const cards = await grid.getByRole('article').allInnerTexts();
          if (cards.length === 0) return false;
          return cards.every((text) => text.toLowerCase().includes('riyadh'));
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    const filters = new FilterPanelPage(page);
    await filters.open();
    await filters.selectType('Villa');
    await filters.apply();

    await expect(page).toHaveURL(/q=Riyadh/);
    await expect(page).toHaveURL(/type=VILLA/);

    // Badge count must equal card count in one poll snapshot — a size
    // comparison against the search-only grid would race parallel creates.
    await expect
      .poll(
        async () => {
          const count = await grid.getByRole('article').count();
          if (count === 0) return false;
          const badges = await grid
            .getByRole('article')
            .getByText(/^Villa$/)
            .count();
          return badges === count;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });

  test('clearing search preserves active filters', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    await page.getByLabel('Search properties').fill('Riyadh');
    await expect(page).toHaveURL(/q=Riyadh/);

    const filters = new FilterPanelPage(page);
    await filters.open();
    await filters.fillMinPrice('1000');
    await filters.apply();

    await expect(page).toHaveURL(/q=Riyadh/);
    await expect(page).toHaveURL(/minPrice=1000/);

    await page.getByRole('button', { name: 'Clear search' }).click();

    // Anchors to exactly "/?minPrice=1000" — query drops, filter stays.
    await expect(page).toHaveURL(/\/\?minPrice=1000$/, { timeout: 10_000 });

    await expect(grid).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Sort order', () => {
  test('Price: Low to High sorts ascending', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const filters = new FilterPanelPage(page);
    await filters.open();
    await filters.selectSort('price_asc');
    await filters.apply();

    await expect(page).toHaveURL(/sort=price_asc/);

    // Poll the settled sorted grid — refetch flashes a skeleton — with one
    // price per card so the snapshot is never a half-updated DOM.
    await expect
      .poll(
        async () => {
          const cardCount = await grid.getByRole('article').count();
          const prices = await grid.getByTestId('property-price').allInnerTexts();
          if (cardCount < 2 || prices.length !== cardCount) return false;
          const numeric = prices.map((p) => parseInt(p.replace(/[^0-9]/g, ''), 10));
          return numeric.every((v, i) => i === 0 || v >= numeric[i - 1]!);
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });

  test('Price: High to Low sorts descending', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const filters = new FilterPanelPage(page);
    await filters.open();
    await filters.selectSort('price_desc');
    await filters.apply();

    await expect(page).toHaveURL(/sort=price_desc/);

    // Poll the ordering derived from the DOM (see ascending test above).
    await expect
      .poll(
        async () => {
          const cardCount = await grid.getByRole('article').count();
          const prices = await grid.getByTestId('property-price').allInnerTexts();
          if (cardCount < 2 || prices.length !== cardCount) return false;
          const numeric = prices.map((p) => parseInt(p.replace(/[^0-9]/g, ''), 10));
          return numeric.every((v, i) => i === 0 || v <= numeric[i - 1]!);
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });
});
