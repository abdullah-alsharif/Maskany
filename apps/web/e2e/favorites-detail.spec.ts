import { expect, test } from '@playwright/test';
import { loginAsUser } from './test-helpers';

const KHALID_COUNTRY = '+966';
const KHALID_PHONE = '501111004';

test.describe.serial('Favorites from detail page', () => {
  test('add favorite from detail page, verify on favorites page, remove from detail page', async ({
    page,
  }) => {
    await loginAsUser(page, KHALID_COUNTRY, KHALID_PHONE);

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const firstCard = grid.locator('article').first();
    const expectedTitle = (await firstCard.locator('h3').innerText()).trim();

    await firstCard.locator('a').first().click();
    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1, name: expectedTitle })).toBeVisible({
      timeout: 15_000,
    });

    const detailFavBtn = page.getByRole('button', { name: 'Add to favorites' });
    await expect(detailFavBtn).toBeVisible();
    await detailFavBtn.click();

    await expect(
      page.getByRole('button', { name: 'Remove from favorites' }),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole('link', { name: 'Favorites' }).click();
    await expect(page).toHaveURL(/\/favorites$/);

    const favoritesGrid = page.getByTestId('favorites-grid');
    await expect(favoritesGrid).toBeVisible({ timeout: 15_000 });
    await expect(favoritesGrid.getByText(expectedTitle, { exact: true })).toBeVisible();

    await page.goto(page.url().replace('/favorites', ''));
    await page.getByRole('link', { name: expectedTitle }).first().click();
    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);

    await page.getByRole('button', { name: 'Remove from favorites' }).click();
    await expect(
      page.getByRole('button', { name: 'Add to favorites' }),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole('link', { name: 'Favorites' }).click();
    await expect(page).toHaveURL(/\/favorites$/);

    await expect(page.getByRole('heading', { name: 'No favorites yet' })).toBeVisible({
      timeout: 10_000,
    });
  });
});
