/**
 * E2E — Favorites (T-033, PRD §7.1, 027-US1, 027-US2, 027-US4).
 *
 * Guest flow:   heart toggle → localStorage → favorites tab → remove → empty state
 * Auth flow:    login → heart toggle → server-persisted → survives refresh
 * Merge flow:   guest favorites survive login (POST /api/favorites/merge)
 * Owner flow:   owner dashboard (/insights) loads with property data
 */
import { expect, test } from '@playwright/test';
import { loginAsUser } from './test-helpers';

/* ---------- helpers ---------- */

const KHALID_COUNTRY = '+966';
const KHALID_PHONE = '501111004';

const LAYLA_COUNTRY = '+966';
const LAYLA_PHONE = '501111001';

const FATIMA_COUNTRY = '+966';
const FATIMA_PHONE = '501111002';

test.describe('Favorites — guest flow', () => {
  test('toggling the heart adds to the favorites tab and toggling again removes it', async ({
    page,
  }) => {
    await page.goto('/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const firstCard = grid.locator('article').first();
    const expectedTitle = (await firstCard.locator('h3').innerText()).trim();

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

test.describe.serial('Favorites — authenticated flow', () => {
  test('login, add favorite, verify it persists server-side across refresh', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
    await loginAsUser(page, KHALID_COUNTRY, KHALID_PHONE);

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const firstCard = grid.locator('article').first();
    const expectedTitle = (await firstCard.locator('h3').innerText()).trim();

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

test.describe.serial('Favorites — guest-to-auth merge', () => {
  test('guest favorites survive login and appear in the authenticated favorites list', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.context().clearCookies();
    await page.reload();

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const cards = grid.locator('article');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(2);

    const titles: string[] = [];
    for (let i = 0; i < 2; i++) {
      const card = cards.nth(i);
      titles.push((await card.locator('h3').innerText()).trim());
      await card.getByRole('button', { name: 'Add to favorites' }).click();
      await expect(card.getByRole('button', { name: 'Remove from favorites' })).toBeVisible();
    }

    const stored = await page.evaluate(() => window.localStorage.getItem('maskany_favorites'));
    expect(JSON.parse(stored ?? '[]')).toHaveLength(2);

    // Log in — merge fires automatically via auth-context (async, best-effort)
    await loginAsUser(page, FATIMA_COUNTRY, FATIMA_PHONE);
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

test.describe.serial('Favorites — owner dashboard', () => {
  test('owner insights page loads with metric cards and top properties', async ({ page }) => {
    await loginAsUser(page, LAYLA_COUNTRY, LAYLA_PHONE);

    await page.goto('/insights');
    await expect(page).toHaveURL(/\/insights$/);

    await expect(page.getByText('Total listings')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Active')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Top Properties')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Best performing listings')).toBeVisible({ timeout: 5_000 });
  });
});
