/**
 * E2E — Favorites from the property detail page.
 *
 * Uses a fresh per-test user so the "No favorites yet" end state is
 * guaranteed regardless of what other specs do in parallel.
 */
import { expect, test } from './test-fixtures';
import { goto, loginAsTestUser } from './test-helpers';

test.describe('Favorites from detail page', () => {
  test('add favorite from detail page, verify on favorites page, remove from detail page', async ({
    page,
    browserUser,
    seedProperties,
  }) => {
    await loginAsTestUser(page, browserUser.phone);

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const expectedTitle = seedProperties[0].title;
    const firstCard = grid.locator('article').filter({ hasText: expectedTitle });

    await firstCard.locator('a').first().click();
    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1, name: expectedTitle })).toBeVisible({
      timeout: 15_000,
    });

    const detailFavBtn = page.getByRole('button', { name: 'Add to favorites' });
    await expect(detailFavBtn).toBeVisible();
    await detailFavBtn.click();

    await expect(page.getByRole('button', { name: 'Remove from favorites' })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('link', { name: 'Favorites' }).click();
    await expect(page).toHaveURL(/\/favorites$/);

    const favoritesGrid = page.getByTestId('favorites-grid');
    await expect(favoritesGrid).toBeVisible({ timeout: 15_000 });
    await expect(favoritesGrid.getByText(expectedTitle, { exact: true })).toBeVisible();

    await goto(page, page.url().replace('/favorites', ''));
    await page.getByRole('link', { name: expectedTitle }).first().click();
    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);

    await page.getByRole('button', { name: 'Remove from favorites' }).click();
    await expect(page.getByRole('button', { name: 'Add to favorites' })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('link', { name: 'Favorites' }).click();
    await expect(page).toHaveURL(/\/favorites$/);

    await expect(page.getByRole('heading', { name: 'No favorites yet' })).toBeVisible({
      timeout: 10_000,
    });
  });
});
