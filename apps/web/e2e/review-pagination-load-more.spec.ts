/**
 * E2E — Review pagination (US10) on a property owned by the test.
 *
 * Instead of relying on seeded review counts (which other parallel specs may
 * shift), the test seeds its own property with exactly 15 reviews via the
 * test-data layer, then verifies the load-more behavior on it. Everything is
 * cascade-deleted with the owner user.
 */
import { goto } from './test-helpers';
import { expect, test } from './test-fixtures';
import { createTestProperty, createTestReviewBatch } from './test-data';

test.describe('Review pagination load more', () => {
  test('loads more reviews when clicking load more button', async ({ page, ownerUser }) => {
    const property = await createTestProperty({
      ownerId: ownerUser.id,
      title: `E2E Review Pagination ${ownerUser.phone}`,
    });
    await createTestReviewBatch({
      propertyId: property.id,
      count: 15,
      basePhone: `+96659${ownerUser.phone.slice(-6)}`,
      baseName: `E2E Reviewer ${ownerUser.phone.slice(-4)}`,
    });

    await goto(page, `/properties/${property.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });

    // Scroll to reviews section.
    const reviewSection = page.getByRole('region', { name: 'Reviews', exact: true });
    await reviewSection.scrollIntoViewIfNeeded();
    await expect(reviewSection).toBeVisible({ timeout: 10_000 });

    // Page size is 10, we seeded 15 total.
    const reviewCards = reviewSection.locator('article');
    await expect.poll(async () => reviewCards.count(), { timeout: 10_000 }).toBe(10);

    // Click "Load more" button.
    const loadMoreButton = reviewSection.getByRole('button', { name: /load more/i });
    await expect(loadMoreButton).toBeVisible();
    await loadMoreButton.click();

    // After clicking, all 15 reviews are visible and the button disappears.
    await expect.poll(async () => reviewCards.count(), { timeout: 10_000 }).toBe(15);
    await expect(loadMoreButton).not.toBeVisible();
  });
});
