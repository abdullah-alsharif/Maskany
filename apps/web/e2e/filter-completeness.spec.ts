/**
 * E2E — Filter panel completeness (US4).
 *
 * Complements the existing filter test (city/minPrice/sort) by validating
 * property type multi-select, maxPrice, rooms, and amenity filters.
 */
import { goto } from './test-helpers';
import { expect, test } from '@playwright/test';
import { FilterPanelPage } from './pages/filter-panel-page';

test.describe('Filter Completeness', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/');
    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });
  });

  test('property type multi-select filters correctly', async ({ page }) => {
    const grid = page.getByTestId('property-grid');
    const filters = new FilterPanelPage(page);

    await filters.open();
    await filters.selectType('Villa');
    await filters.selectType('Apartment');
    await filters.apply();

    await expect(page).toHaveURL(/type=(VILLA|APARTMENT)/);

    // Grid flashes through a skeleton during the refetch, so a bare count
    // poll can pass on stale pre-filter cards; badges settling ends it.
    await expect
      .poll(
        async () => {
          const cardCount = await grid.getByRole('article').count();
          if (cardCount === 0) return false;
          const badgeCount = await grid
            .getByRole('article')
            .getByText(/^(Villa|Apartment)$/i)
            .count();
          return badgeCount === cardCount;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });

  test('maxPrice filter narrows results', async ({ page }) => {
    const grid = page.getByTestId('property-grid');
    const filters = new FilterPanelPage(page);

    await filters.open();
    await filters.fillMaxPrice('3000');
    await filters.apply();

    await expect(page).toHaveURL(/maxPrice=3000/);

    // Assert on price testids, not a baseline count that races parallel
    // fixture creates — fixture apartments (price 5,000) are excluded.
    await expect
      .poll(
        async () => {
          const prices = await grid.getByTestId('property-price').allInnerTexts();
          if (prices.length === 0) return false;
          return prices.every((p) => parseInt(p.replace(/[^0-9]/g, ''), 10) <= 3000);
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });

  test('rooms filter narrows results', async ({ page }) => {
    const grid = page.getByTestId('property-grid');
    const filters = new FilterPanelPage(page);

    await filters.open();
    await filters.selectRooms('3');
    await filters.apply();

    await expect(page).toHaveURL(/rooms=3/);

    // API treats rooms as a minimum (`rooms >= N`); cards render "N beds",
    // and 2BR fixture apartments are excluded — a deterministic subset.
    await expect
      .poll(
        async () => {
          const cards = await grid.getByRole('article').allInnerTexts();
          if (cards.length === 0) return false;
          return cards.every((text) => {
            const match = text.match(/(\d+) beds/);
            return match !== null && parseInt(match[1]!, 10) >= 3;
          });
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });

  test('amenity filter narrows results', async ({ page }) => {
    const grid = page.getByTestId('property-grid');
    const filters = new FilterPanelPage(page);

    await filters.open();
    // Select "Pool" amenity — not all properties have a pool.
    await filters.selectAmenity('Pool');
    await filters.apply();

    // Cards don't render amenities, so count is the observable: only seeded
    // pool properties match, below the 20-card page size — no racy baseline.
    await expect
      .poll(
        async () => {
          const count = await grid.getByRole('article').count();
          return count > 0 && count < 20;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });

  test('rating filter narrows results', async ({ page }) => {
    const grid = page.getByTestId('property-grid');
    const filters = new FilterPanelPage(page);

    await filters.open();
    await filters.selectRating('4 stars');
    await filters.apply();

    // Seeded properties (e.g. Al Olaya, 4.3) satisfy the filter so results
    // stay non-empty; poll badges themselves since a bare count poll passes
    // on stale pre-refetch skeleton cards.
    await expect
      .poll(
        async () => {
          const ratings = await grid.getByTestId('property-rating').allInnerTexts();
          const cardCount = await grid.getByRole('article').count();
          return (
            ratings.length > 0 &&
            ratings.length === cardCount &&
            ratings.every((rating) => parseFloat(rating) >= 4)
          );
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });
});
