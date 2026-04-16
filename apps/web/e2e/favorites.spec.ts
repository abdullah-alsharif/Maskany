/**
 * E2E — Favorites (T-033, PRD §7.1).
 *
 * Tapping the heart on a property card persists the listing under the
 * `maskany_favorites` localStorage key, the bottom-nav badge increments,
 * and navigating to the Favorites tab shows the saved property. Tapping
 * the heart again removes the listing and the empty-state copy returns.
 */
import { expect, test } from '@playwright/test';

test.describe('Favorites', () => {
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

    // Card heart should flip to "Remove from favorites" state.
    await expect(firstCard.getByRole('button', { name: 'Remove from favorites' })).toBeVisible();

    // localStorage now contains exactly one favorited id.
    const stored = await page.evaluate(() => window.localStorage.getItem('maskany_favorites'));
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!) as unknown;
    expect(Array.isArray(parsed)).toBe(true);
    expect((parsed as string[]).length).toBe(1);

    // Navigate to the favorites tab via the bottom nav.
    await page.getByRole('link', { name: 'Favorites' }).click();
    await expect(page).toHaveURL(/\/favorites$/);

    const favoritesGrid = page.getByTestId('favorites-grid');
    await expect(favoritesGrid).toBeVisible({ timeout: 15_000 });
    await expect(favoritesGrid.getByText(expectedTitle, { exact: true })).toBeVisible();

    // Untoggle from the favorites grid — empty state should reappear.
    await favoritesGrid.getByRole('button', { name: 'Remove from favorites' }).first().click();

    await expect(page.getByRole('heading', { name: 'No favorites yet' })).toBeVisible({
      timeout: 5_000,
    });

    const storedAfter = await page.evaluate(() => window.localStorage.getItem('maskany_favorites'));
    expect(JSON.parse(storedAfter ?? '[]')).toEqual([]);
  });
});
