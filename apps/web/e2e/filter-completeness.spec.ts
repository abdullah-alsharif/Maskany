/**
 * E2E — Filter panel completeness (US4).
 *
 * The existing filter test covers only city, minPrice, and sort. This spec
 * validates property type multi-select, maxPrice, rooms, and amenity filters.
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

    // Open filter and select Villa + Apartment.
    await filters.open();
    await filters.selectType('Villa');
    await filters.selectType('Apartment');
    await filters.apply();

    await expect(page).toHaveURL(/type=(VILLA|APARTMENT)/);

    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    // All visible cards should be Villa or Apartment.
    const badges = grid
      .locator('article')
      .locator('span')
      .filter({ hasText: /Villa|Apartment/i });
    const cardCount = await grid.locator('article').count();
    const badgeCount = await badges.count();
    expect(badgeCount).toBe(cardCount);
  });

  test('maxPrice filter narrows results', async ({ page }) => {
    const grid = page.getByTestId('property-grid');
    const initialCount = await grid.locator('article').count();
    const filters = new FilterPanelPage(page);

    await filters.open();
    await filters.fillMaxPrice('3000');
    await filters.apply();

    await expect(page).toHaveURL(/maxPrice=3000/);

    // Non-empty and strictly narrower than the unfiltered grid (the
    // refetch flashes through a skeleton, so "count === 0" alone would
    // pass vacuously).
    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeLessThan(initialCount);
  });

  test('rooms filter narrows results', async ({ page }) => {
    const grid = page.getByTestId('property-grid');
    const initialCount = await grid.locator('article').count();
    const filters = new FilterPanelPage(page);

    await filters.open();
    await filters.selectRooms('3');
    await filters.apply();

    await expect(page).toHaveURL(/rooms=3/);

    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeLessThan(initialCount);
  });

  test('amenity filter narrows results', async ({ page }) => {
    const grid = page.getByTestId('property-grid');
    const initialCount = await grid.locator('article').count();
    const filters = new FilterPanelPage(page);

    await filters.open();
    // Select "Pool" amenity — not all properties have a pool.
    await filters.selectAmenity('Pool');
    await filters.apply();

    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeLessThan(initialCount);
  });

  test('rating filter narrows results', async ({ page }) => {
    const grid = page.getByTestId('property-grid');
    const filters = new FilterPanelPage(page);

    await filters.open();
    // Select minimum 4 stars.
    await filters.selectRating('4 stars');
    await filters.apply();

    // Seeded properties (e.g. the Al Olaya apartment, 4.3) satisfy the
    // filter, so results are non-empty — and every card must show a
    // rating badge of at least 4.0. Poll on the badges themselves: the
    // grid flashes through a skeleton state during the refetch, so a
    // simple "count > 0" poll can pass on stale pre-filter cards.
    await expect
      .poll(
        async () => {
          const ratings = await grid.locator('[data-testid="property-rating"]').allInnerTexts();
          const cardCount = await grid.locator('article').count();
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
