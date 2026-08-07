/**
 * E2E — Review pagination (US10) on a test-owned property: seeds 15 reviews
 * via the test-data layer instead of relying on counts that parallel specs
 * may shift; everything cascades away with the owner user.
 */
import { goto } from './test-helpers';
import { expect, test } from './test-fixtures';
import { createTestProperty, createTestReviewBatch, deleteTestUser } from './test-data';

test.describe('Review pagination load more', () => {
  test('loads more reviews when clicking load more button', async ({ page, ownerUser }) => {
    const property = await createTestProperty({
      ownerId: ownerUser.id,
      title: `E2E Review Pagination ${ownerUser.phone}`,
    });
    const { users } = await createTestReviewBatch({
      propertyId: property.id,
      count: 15,
      basePhone: `+96659${ownerUser.phone.slice(-6)}`,
      baseName: `E2E Reviewer ${ownerUser.phone.slice(-4)}`,
    });

    try {
      await goto(page, `/properties/${property.id}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });

      const reviewSection = page.getByRole('region', { name: 'Reviews', exact: true });
      await reviewSection.scrollIntoViewIfNeeded();
      await expect(reviewSection).toBeVisible({ timeout: 10_000 });

      // API default page size is 10; we seeded 15.
      const reviewCards = reviewSection.getByRole('article');
      await expect.poll(async () => reviewCards.count(), { timeout: 10_000 }).toBe(10);

      const loadMoreButton = reviewSection.getByRole('button', { name: /load more/i });
      await expect(loadMoreButton).toBeVisible();
      await loadMoreButton.click();

      await expect.poll(async () => reviewCards.count(), { timeout: 10_000 }).toBe(15);
      await expect(loadMoreButton).not.toBeVisible();
    } finally {
      await Promise.all(users.map((user) => deleteTestUser(user.id)));
    }
  });
});
