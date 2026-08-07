/**
 * E2E — Filters (PRD §4.3).
 *
 * Opens the filter panel, applies a property-type + city filter, verifies
 * the grid narrows, then clears filters and confirms the full list is
 * restored.
 */
import { goto } from './test-helpers';
import { expect, test } from '@playwright/test';
import { FilterPanelPage } from './pages/filter-panel-page';

test.describe('Filters', () => {
  test('applying filters narrows the grid', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const filters = new FilterPanelPage(page);

    await filters.open();

    await filters.selectCity('Riyadh');

    await filters.fillMinPrice('5000');

    await filters.selectSort('price_desc');

    await filters.apply();

    // Assert the filter contract on content, not a single-shot baseline
    // count (which races parallel creates): every card is Riyadh + >= 5000.
    await expect
      .poll(
        async () => {
          const cards = await grid.getByRole('article').allInnerTexts();
          if (cards.length === 0) return false;
          if (!cards.every((text) => text.toLowerCase().includes('riyadh'))) return false;
          const prices = await grid.getByTestId('property-price').allInnerTexts();
          if (prices.length !== cards.length) return false;
          return prices.every((p) => parseInt(p.replace(/[^0-9]/g, ''), 10) >= 5000);
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });

  test('clearing filters restores the full grid', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const filters = new FilterPanelPage(page);

    // Setup for the restore check — same filters as the narrow test.
    await filters.open();
    await filters.selectCity('Riyadh');
    await filters.fillMinPrice('5000');
    await filters.selectSort('price_desc');
    await filters.apply();

    await expect
      .poll(
        async () => {
          const cards = await grid.getByRole('article').allInnerTexts();
          if (cards.length === 0) return false;
          if (!cards.every((text) => text.toLowerCase().includes('riyadh'))) return false;
          const prices = await grid.getByTestId('property-price').allInnerTexts();
          if (prices.length !== cards.length) return false;
          return prices.every((p) => parseInt(p.replace(/[^0-9]/g, ''), 10) >= 5000);
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    await filters.open();
    await filters.clearAll();

    // Full-page invariant: 24+ seeded properties are never deleted
    // mid-run, so assert the restored count against it, not a baseline.
    await expect
      .poll(async () => grid.getByRole('article').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(20);
  });

  test('[AC-22] filters serialize to URL query params (shareable URLs)', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const filters = new FilterPanelPage(page);

    await filters.open();
    await filters.selectType('Villa');
    await filters.fillMinPrice('1000');
    await filters.apply();

    await expect(page).toHaveURL(/type=VILLA/);
    await expect(page).toHaveURL(/minPrice=1000/);

    await expect
      .poll(async () => grid.getByRole('article').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    await goto(page, '/?type=VILLA&minPrice=1000');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    await filters.open();
    await expect(page.getByRole('button', { name: 'Villa', pressed: true })).toBeVisible();
    await expect(page.getByLabel('Min price')).toHaveValue('1000');

    await expect
      .poll(async () => grid.getByRole('article').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
  });
});
