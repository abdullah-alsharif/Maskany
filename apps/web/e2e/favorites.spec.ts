/**
 * E2E — Favorites (T-033, PRD §7.1, 027-US1, 027-US2, 027-US4).
 *
 * Guest flow:   heart toggle → localStorage → favorites tab → remove → empty state
 * Auth flow:    login → heart toggle → server-persisted → survives refresh
 * Merge flow:   guest favorites survive login (POST /api/favorites/merge)
 *
 * Every authenticated scenario uses a fresh per-test user, so parallel runs
 * never share server-side favorite state. (The owner-dashboard scenario is
 * covered by insights-dashboard.spec.ts with the seeded owner.)
 */
import { expect, test } from './test-fixtures';
import { goto, loginAsTestUser } from './test-helpers';

test.describe('Favorites — guest flow', () => {
  test('toggling the heart adds to the favorites tab and toggling again removes it', async ({
    page,
    seedProperties,
  }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Use a seeded property — the first grid card can be a fixture property
    // owned by a parallel test and deleted mid-run.
    const expectedTitle = seedProperties[0].title;
    const firstCard = grid.locator('article').filter({ hasText: expectedTitle });

    const addButton = firstCard.getByRole('button', { name: 'Add to favorites' });
    await expect(addButton).toBeVisible();
    await addButton.click();

    await expect(firstCard.getByRole('button', { name: 'Remove from favorites' })).toBeVisible();

    const stored = await page.evaluate(() => window.localStorage.getItem('maskany_favorites'));
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!) as unknown;
    expect(Array.isArray(parsed)).toBe(true);
    expect((parsed as string[]).length).toBe(1);

    await page.getByRole('link', { name: 'Favorites' }).click();
    await expect(page).toHaveURL(/\/favorites$/);

    const favoritesGrid = page.getByTestId('favorites-grid');
    await expect(favoritesGrid).toBeVisible({ timeout: 15_000 });
    await expect(favoritesGrid.getByText(expectedTitle, { exact: true })).toBeVisible();

    await favoritesGrid.getByRole('button', { name: 'Remove from favorites' }).first().click();

    await expect(page.getByRole('heading', { name: 'No favorites yet' })).toBeVisible({
      timeout: 10_000,
    });

    const storedAfter = await page.evaluate(() => window.localStorage.getItem('maskany_favorites'));
    expect(JSON.parse(storedAfter ?? '[]')).toEqual([]);
  });
});

test.describe('Favorites — authenticated flow', () => {
  test('login, add favorite, verify it persists server-side across refresh', async ({
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
    const firstCard = grid.locator('article').filter({ hasText: expectedTitle });

    await firstCard.getByRole('button', { name: 'Add to favorites' }).click();
    await expect(firstCard.getByRole('button', { name: 'Remove from favorites' })).toBeVisible();

    await page.getByRole('link', { name: 'Favorites' }).click();
    await expect(page).toHaveURL(/\/favorites$/);

    const favoritesGrid = page.getByTestId('favorites-grid');
    await expect(favoritesGrid).toBeVisible({ timeout: 15_000 });
    await expect(favoritesGrid.getByText(expectedTitle, { exact: true })).toBeVisible();

    // Refresh — favorite must persist on the server
    await page.reload();
    await expect(page).toHaveURL(/\/favorites$/);
    const gridAfterRefresh = page.getByTestId('favorites-grid');
    await expect(gridAfterRefresh).toBeVisible({ timeout: 15_000 });
    await expect(gridAfterRefresh.getByText(expectedTitle, { exact: true })).toBeVisible();

    // Remove — reload to confirm the deletion persisted and we see empty state
    await gridAfterRefresh.getByRole('button', { name: 'Remove from favorites' }).first().click();
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
      const card = grid.locator('article').filter({ hasText: title });
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
