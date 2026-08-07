/**
 * E2E — Favorites (T-033, PRD §7.1, 027-US1, 027-US2, 027-US4).
 *
 * Guest favorites live in localStorage; authenticated ones are server-
 * persisted; guest favorites merge on login (POST /api/favorites/merge).
 * Fresh per-test users keep parallel runs from sharing favorite state.
 */
import { expect, test } from './test-fixtures';
import { goto, loginAsTestUser } from './test-helpers';
import { createTestFavorite } from './test-data';

test.describe('Favorites — guest flow', () => {
  test('toggling the heart stores the favorite in localStorage and Favorites', async ({
    page,
    seedProperties,
  }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Seeded property — grid card 1 may be a fixture deleted mid-run.
    const expectedTitle = seedProperties[0].title;
    const firstCard = grid.getByRole('article').filter({ hasText: expectedTitle });

    const addButton = firstCard.getByRole('button', { name: 'Add to favorites' });
    await expect(addButton).toBeVisible();
    await addButton.click();

    await expect(firstCard.getByRole('button', { name: 'Remove from favorites' })).toBeVisible();

    const stored = await page.evaluate(() => window.localStorage.getItem('maskany_favorites'));
    expect(typeof stored).toBe('string');
    const parsed = JSON.parse(stored as string) as unknown;
    expect(Array.isArray(parsed)).toBe(true);
    expect((parsed as string[]).length).toBe(1);

    await page.getByRole('link', { name: 'Favorites' }).click();
    await expect(page).toHaveURL(/\/favorites$/);

    const favoritesGrid = page.getByTestId('favorites-grid');
    await expect(favoritesGrid).toBeVisible({ timeout: 15_000 });
    await expect(favoritesGrid.getByText(expectedTitle, { exact: true })).toBeVisible();
  });

  test('removing a guest favorite empties the favorites list', async ({ page, seedProperties }) => {
    await goto(page, '/');
    await page.evaluate(
      (value) => window.localStorage.setItem('maskany_favorites', value),
      JSON.stringify([seedProperties[0].id]),
    );
    await page.reload();

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    await page.getByRole('link', { name: 'Favorites' }).click();
    await expect(page).toHaveURL(/\/favorites$/);

    const favoritesGrid = page.getByTestId('favorites-grid');
    await expect(favoritesGrid).toBeVisible({ timeout: 15_000 });
    await expect(favoritesGrid.getByText(seedProperties[0].title, { exact: true })).toBeVisible();

    await favoritesGrid
      .getByRole('article')
      .filter({ hasText: seedProperties[0].title })
      .getByRole('button', { name: 'Remove from favorites' })
      .click();

    await expect(page.getByRole('heading', { name: 'No favorites yet' })).toBeVisible({
      timeout: 10_000,
    });

    const storedAfter = await page.evaluate(() => window.localStorage.getItem('maskany_favorites'));
    expect(JSON.parse(storedAfter ?? '[]')).toEqual([]);
  });
});

test.describe('Favorites — authenticated flow', () => {
  test('adding a favorite persists server-side across refresh', async ({
    page,
    browserUser,
    seedProperties,
  }) => {
    await goto(page, '/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
    await loginAsTestUser(page, browserUser.phone);

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const expectedTitle = seedProperties[0].title;
    const firstCard = grid.getByRole('article').filter({ hasText: expectedTitle });

    await firstCard.getByRole('button', { name: 'Add to favorites' }).click();
    await expect(firstCard.getByRole('button', { name: 'Remove from favorites' })).toBeVisible();

    await page.getByRole('link', { name: 'Favorites' }).click();
    await expect(page).toHaveURL(/\/favorites$/);

    const favoritesGrid = page.getByTestId('favorites-grid');
    await expect(favoritesGrid).toBeVisible({ timeout: 15_000 });
    await expect(favoritesGrid.getByText(expectedTitle, { exact: true })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/favorites$/);
    const gridAfterRefresh = page.getByTestId('favorites-grid');
    await expect(gridAfterRefresh).toBeVisible({ timeout: 15_000 });
    await expect(gridAfterRefresh.getByText(expectedTitle, { exact: true })).toBeVisible();
  });

  test('removing a favorite persists server-side across refresh', async ({
    page,
    browserUser,
    seedProperties,
  }) => {
    await goto(page, '/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
    await createTestFavorite({ userId: browserUser.id, propertyId: seedProperties[0].id });

    await loginAsTestUser(page, browserUser.phone);

    await page.getByRole('link', { name: 'Favorites' }).click();
    await expect(page).toHaveURL(/\/favorites$/);

    const favoritesGrid = page.getByTestId('favorites-grid');
    await expect(favoritesGrid).toBeVisible({ timeout: 15_000 });
    await expect(favoritesGrid.getByText(seedProperties[0].title, { exact: true })).toBeVisible();

    await favoritesGrid
      .getByRole('article')
      .filter({ hasText: seedProperties[0].title })
      .getByRole('button', { name: 'Remove from favorites' })
      .click();

    await page.reload();
    await expect(page).toHaveURL(/\/favorites$/);
    await expect(page.getByRole('heading', { name: 'No favorites yet' })).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe('Favorites — guest-to-auth merge', () => {
  test('guest favorites survive login and appear in the authenticated favorites list', async ({
    page,
    browserUser,
    seedProperties,
  }) => {
    await goto(page, '/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
    await page.reload();

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const titles = seedProperties.map((p) => p.title);
    expect(titles.length).toBeGreaterThanOrEqual(2);
    for (const title of titles) {
      const card = grid.getByRole('article').filter({ hasText: title });
      await card.getByRole('button', { name: 'Add to favorites' }).click();
      await expect(card.getByRole('button', { name: 'Remove from favorites' })).toBeVisible();
    }

    const stored = await page.evaluate(() => window.localStorage.getItem('maskany_favorites'));
    expect(JSON.parse(stored ?? '[]')).toHaveLength(2);

    // Log in — merge fires automatically via auth-context (async, best-effort)
    await loginAsTestUser(page, browserUser.phone);
    // The merge is fire-and-forget; wait for it to clear localStorage
    await expect
      .poll(async () => page.evaluate(() => window.localStorage.getItem('maskany_favorites')), {
        timeout: 5_000,
      })
      .toBeNull();
    // Reload so useFavorites re-fetches from server after the merge completed
    await page.reload();

    await page.getByRole('link', { name: 'Favorites' }).click();
    await expect(page).toHaveURL(/\/favorites$/);

    const favoritesGrid = page.getByTestId('favorites-grid');
    await expect(favoritesGrid).toBeVisible({ timeout: 15_000 });

    for (const title of titles) {
      await expect(favoritesGrid.getByText(title, { exact: true })).toBeVisible();
    }

    const storedAfter = await page.evaluate(() => window.localStorage.getItem('maskany_favorites'));
    expect(storedAfter).toBeNull();
  });
});
