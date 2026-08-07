/**
 * E2E — Favorites from the property detail page. Uses a fresh per-test user
 * so the "No favorites yet" end state is guaranteed under parallel runs.
 */
import { expect, test } from './test-fixtures';
import { loginAsTestUser, openSeedProperty } from './test-helpers';
import { createTestFavorite } from './test-data';

test.describe('Favorites from detail page', () => {
  test('adding a favorite from the detail page shows it in Favorites', async ({
    page,
    browserUser,
    seedProperties,
  }) => {
    await loginAsTestUser(page, browserUser.phone);

    const expectedTitle = seedProperties[0].title;

    await openSeedProperty(page, expectedTitle);

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
  });

  test('removing a favorite from the detail page shows the empty state', async ({
    page,
    browserUser,
    seedProperties,
  }) => {
    await createTestFavorite({ userId: browserUser.id, propertyId: seedProperties[0].id });
    await loginAsTestUser(page, browserUser.phone);

    const expectedTitle = seedProperties[0].title;
    await openSeedProperty(page, expectedTitle);

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
