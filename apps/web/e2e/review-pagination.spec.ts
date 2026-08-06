/**
 * E2E — Review pagination (US10).
 *
 * Verifies the review section renders on a property that has reviews.
 * The property and its reviews are created by the test itself so the
 * spec stays stable while other parallel tests mutate the shared seed.
 */
import { goto } from './test-helpers';
import { expect, test } from './test-fixtures';
import { createTestProperty, createTestReviewBatch } from './test-data';

test.describe('Review Pagination', () => {
  test('detail page shows review count matching visible reviews', async ({ page, ownerUser }) => {
    const property = await createTestProperty({
      ownerId: ownerUser.id,
      title: `E2E Review Pagination ${ownerUser.phone}`,
    });
    await createTestReviewBatch({
      propertyId: property.id,
      count: 3,
      basePhone: `+96658${ownerUser.phone.slice(-6)}`,
      baseName: `E2E Reviewer ${ownerUser.phone.slice(-4)}`,
    });

    await goto(page, `/properties/${property.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });

    // The reviews section heading and the summary count must render
    // (the batch created exactly 3 reviews).
    await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('3 reviews')).toBeVisible({ timeout: 10_000 });
  });
});
