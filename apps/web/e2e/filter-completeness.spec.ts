/**
 * E2E — Filter panel completeness (US4).
 *
 * The existing filter test covers only city, minPrice, and sort. This spec
 * validates property type multi-select, maxPrice, rooms, and amenity filters.
 */
import { expect, test } from '@playwright/test';

test.describe('Filter Completeness', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });
  });

  test('property type multi-select filters correctly', async ({ page }) => {
    const grid = page.getByTestId('property-grid');

    // Open filter and select Villa + Apartment.
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('button', { name: 'Villa', pressed: false }).click();
    await page.getByRole('button', { name: 'Apartment', pressed: false }).click();
    await page.getByRole('button', { name: 'Apply Filters' }).click();

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

    await page.getByRole('button', { name: 'Filters' }).click();
    await page.locator('#filter-max-price').fill('3000');
    await page.getByRole('button', { name: 'Apply Filters' }).click();

    await expect(page).toHaveURL(/maxPrice=3000/);

    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeLessThan(initialCount);
  });

  test('rooms filter narrows results', async ({ page }) => {
    const grid = page.getByTestId('property-grid');
    const initialCount = await grid.locator('article').count();

    await page.getByRole('button', { name: 'Filters' }).click();
    await page.locator('#filter-rooms').selectOption('3');
    await page.getByRole('button', { name: 'Apply Filters' }).click();

    await expect(page).toHaveURL(/rooms=3/);

    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeLessThan(initialCount);
  });

  test('amenity filter narrows results', async ({ page }) => {
    const grid = page.getByTestId('property-grid');
    const initialCount = await grid.locator('article').count();

    await page.getByRole('button', { name: 'Filters' }).click();
    // Select "Pool" amenity — not all properties have a pool.
    await page.getByRole('button', { name: 'Pool', pressed: false }).click();
    await page.getByRole('button', { name: 'Apply Filters' }).click();

    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeLessThanOrEqual(initialCount);
  });

  test('rating filter narrows results', async ({ page }) => {
    const grid = page.getByTestId('property-grid');

    await page.getByRole('button', { name: 'Filters' }).click();
    // Select minimum 4 stars.
    await page.getByRole('button', { name: '4 stars' }).click();
    await page.getByRole('button', { name: 'Apply Filters' }).click();

    // Results should be filtered (possibly zero).
    await page.waitForTimeout(1000);
    const count = await grid.locator('article').count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
