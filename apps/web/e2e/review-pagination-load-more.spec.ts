import { expect, test } from '@playwright/test';

test.describe('Review pagination load more', () => {
  test('loads more reviews when clicking load more button', async ({ page }) => {
    await page.goto('/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Navigate to riyadh-apartment-1 by finding its card.
    const targetCard = grid.locator('article').filter({ hasText: 'Modern 2BR Apartment in Al Olaya' });
    await targetCard.locator('a').first().click();
    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);

    // Scroll to reviews section.
    const reviewSection = page.getByRole('region', { name: 'Reviews', exact: true });
    await reviewSection.scrollIntoViewIfNeeded();
    await expect(reviewSection).toBeVisible({ timeout: 10_000 });

    // Count review articles on first page (page size is 10, we seeded 15 total).
    const reviewCards = reviewSection.locator('article');
    await expect.poll(async () => reviewCards.count(), { timeout: 10_000 }).toBe(10);

    // Click "Load more" button.
    const loadMoreButton = reviewSection.getByRole('button', { name: /load more/i });
    await expect(loadMoreButton).toBeVisible();
    await loadMoreButton.click();

    // After clicking, all 15 reviews should be visible and button should disappear.
    await expect.poll(async () => reviewCards.count(), { timeout: 10_000 }).toBe(15);
    await expect(loadMoreButton).not.toBeVisible();
  });
});
