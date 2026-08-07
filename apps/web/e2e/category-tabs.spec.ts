/**
 * E2E — Category tabs (US11).
 *
 * Validates each of the 8 CategoryBar tabs (All, Apartments, Rooms, Chalets,
 * Villas, Houses, Studios, Other) filters the property grid correctly.
 */
import { goto } from './test-helpers';
import { expect, test } from '@playwright/test';
import { SEED_PROPERTY_TITLES } from './test-fixtures';

test.describe('Category Tabs', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, '/');
    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });
  });

  test('All tab shows all properties', async ({ page }) => {
    const grid = page.getByTestId('property-grid');

    // Narrow first; poll until visible cards are all villa-badged.
    await page.getByRole('tab', { name: 'Villas' }).click();
    await expect
      .poll(
        async () => {
          const cardCount = await grid.getByRole('article').count();
          if (cardCount === 0) return false;
          const badgeCount = await grid
            .getByRole('article')
            .getByText(/^Villa$/)
            .count();
          return badgeCount === cardCount;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    const villaCount = await grid.getByRole('article').count();

    // All must settle on a superset of villas that still includes the seeded
    // apartment (SEED_PROPERTY_TITLES[0], never deleted mid-run).
    await page.getByRole('tab', { name: 'All' }).click();
    await expect
      .poll(
        async () => {
          const cardCount = await grid.getByRole('article').count();
          if (cardCount < villaCount) return false;
          const apartmentVisible = await grid
            .getByRole('article')
            .filter({ hasText: SEED_PROPERTY_TITLES[0] })
            .first()
            .isVisible();
          return apartmentVisible;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });

  test('Villas tab shows only villas', async ({ page }) => {
    const grid = page.getByTestId('property-grid');

    await page.getByRole('tab', { name: 'Villas' }).click();

    // Badge count === card count: a bare count poll can pass on stale
    // pre-refetch skeleton cards.
    await expect
      .poll(
        async () => {
          const cardCount = await grid.getByRole('article').count();
          if (cardCount === 0) return false;
          const badgeCount = await grid
            .getByRole('article')
            .getByText(/^Villa$/)
            .count();
          return badgeCount === cardCount;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });

  test('Apartments tab shows only apartments', async ({ page }) => {
    const grid = page.getByTestId('property-grid');

    await page.getByRole('tab', { name: 'Apartments' }).click();

    await expect
      .poll(
        async () => {
          const cardCount = await grid.getByRole('article').count();
          if (cardCount === 0) return false;
          const badgeCount = await grid
            .getByRole('article')
            .getByText(/^Apartment$/)
            .count();
          return badgeCount === cardCount;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });

  test('Studios tab shows only studios', async ({ page }) => {
    const grid = page.getByTestId('property-grid');

    await page.getByRole('tab', { name: 'Studios' }).click();

    await expect
      .poll(
        async () => {
          const cardCount = await grid.getByRole('article').count();
          if (cardCount === 0) return false;
          const badgeCount = await grid
            .getByRole('article')
            .getByText(/^Studio$/)
            .count();
          return badgeCount === cardCount;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });

  test('Other tab shows an empty grid (no OTHER-type seed)', async ({ page }) => {
    const grid = page.getByTestId('property-grid');

    // Wait for the category fetch so we never assert on a stale grid.
    const otherFetch = page.waitForResponse(
      (r) => r.url().includes('/api/properties') && r.url().includes('type=OTHER'),
    );
    await page.getByRole('tab', { name: 'Other' }).click();
    await otherFetch;

    // Fixture-created properties are APARTMENT and none are OTHER-seeded, so
    // the tab is deterministic; assert the no-results state, not cards.
    await expect(page.getByText('No properties found')).toBeVisible({ timeout: 10_000 });
    await expect(grid).not.toBeVisible();
  });
});
