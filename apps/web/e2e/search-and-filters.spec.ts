import { goto } from './test-helpers';
import { expect, test } from '@playwright/test';
import { FilterPanelPage } from './pages/filter-panel-page';

test.describe('Search + Filters combined', () => {
  test('search query and property type filter work together', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    await page.getByLabel('Search properties').first().fill('Riyadh');

    await expect
      .poll(
        async () => {
          const cards = await grid.locator('article').allInnerTexts();
          if (cards.length === 0) return false;
          return cards.every((text) => text.toLowerCase().includes('riyadh'));
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    const riyadhCount = await grid.locator('article').count();

    const filters = new FilterPanelPage(page);
    await filters.open();
    await filters.selectType('Villa');
    await filters.apply();

    await expect(page).toHaveURL(/q=Riyadh/);
    await expect(page).toHaveURL(/type=VILLA/);

    await expect
      .poll(
        async () => {
          const count = await grid.locator('article').count();
          return count;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    const filteredCount = await grid.locator('article').count();
    expect(filteredCount).toBeLessThanOrEqual(riyadhCount);

    const badges = grid
      .locator('article')
      .locator('span')
      .filter({ hasText: /^Villa$/ });
    expect(await badges.count()).toBe(filteredCount);
  });

  test('clearing search preserves active filters', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    await page.getByLabel('Search properties').first().fill('Riyadh');
    await expect(page).toHaveURL(/q=Riyadh/);

    const filters = new FilterPanelPage(page);
    await filters.open();
    await filters.fillMinPrice('1000');
    await filters.apply();

    await expect(page).toHaveURL(/q=Riyadh/);
    await expect(page).toHaveURL(/minPrice=1000/);

    await page.getByRole('button', { name: 'Clear search' }).click();

    await expect(page).not.toHaveURL(/q=/);
    await expect(page).toHaveURL(/minPrice=1000/);

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

    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeGreaterThan(1);

    const prices = await grid
      .locator('article')
      .locator('[data-testid="property-price"]')
      .allInnerTexts();
    const numericPrices = prices.map((p) => parseInt(p.replace(/[^0-9]/g, ''), 10));
    for (let i = 1; i < numericPrices.length; i++) {
      expect(numericPrices[i]!).toBeGreaterThanOrEqual(numericPrices[i - 1]!);
    }
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

    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeGreaterThan(1);

    const prices = await grid
      .locator('article')
      .locator('[data-testid="property-price"]')
      .allInnerTexts();
    const numericPrices = prices.map((p) => parseInt(p.replace(/[^0-9]/g, ''), 10));
    for (let i = 1; i < numericPrices.length; i++) {
      expect(numericPrices[i]!).toBeLessThanOrEqual(numericPrices[i - 1]!);
    }
  });
});
