/**
 * E2E — Reviews (PRD §5).
 *
 * Fully isolated: each test creates its own owner, property and browser user,
 * never touching seeded records — safe to run in parallel with anything else.
 */
import { expect, test } from './test-fixtures';
import { goto, loginAsTestUser, appAlert } from './test-helpers';
import { createTestReview } from './test-data';

const REVIEW_COMMENT = 'Great place, highly recommend!';
const UPDATED_COMMENT = 'Even better after staying longer.';

test.describe('Reviews', () => {
  test('[AC-29a] rating distribution bar chart shows the seeded review', async ({
    page,
    ownerWithProperty,
  }) => {
    const { owner, property } = ownerWithProperty;

    // A seeded 5-star review guarantees at least one distribution bar.
    await createTestReview({
      propertyId: property.id,
      userId: owner.id,
      rating: 5,
      comment: 'Hosting a verified guest.',
    });

    await goto(page, `/properties/${property.id}`);
    await expect(page.getByRole('heading', { level: 1, name: property.title })).toBeVisible({
      timeout: 15_000,
    });

    const distribution = page.getByRole('group', { name: /rating distribution/i });
    await expect(distribution).toBeVisible({ timeout: 10_000 });

    // Single seeded 5-star review ⇒ only that bar carries a count; assert
    // via accessible names, not the bars' inline styles.
    await expect(distribution.getByRole('img', { name: '5 stars: 1 review' })).toBeVisible();
    // Zero-count tiers have zero-width bars and are hidden.
    await expect(distribution.getByRole('img', { name: '4 stars: 0 reviews' })).not.toBeVisible();
    await expect(distribution.getByRole('img', { name: '3 stars: 0 reviews' })).not.toBeVisible();

    const summary = page.getByRole('region', { name: /reviews summary/i });
    await expect(summary).toBeVisible({ timeout: 5_000 });
    // Exactly one review exists on this private fixture property.
    await expect(summary.getByText('1 review', { exact: true })).toBeVisible();
  });

  test('[AC-29b] submitting a review stores the comment', async ({
    page,
    ownerWithProperty,
    browserUser,
  }) => {
    const { property } = ownerWithProperty;
    await loginAsTestUser(page, browserUser.phone);

    await goto(page, `/properties/${property.id}`);
    await expect(page.getByRole('heading', { level: 1, name: property.title })).toBeVisible({
      timeout: 15_000,
    });

    const reviewsSection = page.getByRole('region', { name: 'Reviews', exact: true });
    await reviewsSection.scrollIntoViewIfNeeded();
    await expect(reviewsSection).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Rate 5 stars' }).click();
    await page.getByLabel('Comment').fill(REVIEW_COMMENT);
    await page.getByRole('button', { name: 'Submit review' }).click();

    await expect(page.getByText(REVIEW_COMMENT)).toBeVisible({ timeout: 10_000 });
  });

  test('[AC-29c] editing a review replaces the stored comment', async ({
    page,
    ownerWithProperty,
    browserUser,
  }) => {
    const { property } = ownerWithProperty;

    // Seed via factory so the edit path is exercised in isolation.
    await createTestReview({
      propertyId: property.id,
      userId: browserUser.id,
      rating: 5,
      comment: REVIEW_COMMENT,
    });

    await loginAsTestUser(page, browserUser.phone);

    await goto(page, `/properties/${property.id}`);
    await expect(page.getByRole('heading', { level: 1, name: property.title })).toBeVisible({
      timeout: 15_000,
    });

    const editButton = page.getByRole('button', { name: 'Edit' });
    await expect(editButton).toBeVisible({ timeout: 10_000 });
    await editButton.click();

    const commentInput = page.getByLabel('Comment');
    await commentInput.clear();
    await commentInput.fill(UPDATED_COMMENT);

    await page.getByRole('button', { name: 'Update review' }).click();

    await expect(page.getByText(UPDATED_COMMENT)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(REVIEW_COMMENT)).not.toBeVisible();
  });

  test('submitting a review without a rating shows a validation error', async ({
    page,
    ownerWithProperty,
    browserUser,
  }) => {
    const { property } = ownerWithProperty;
    await loginAsTestUser(page, browserUser.phone);

    await goto(page, `/properties/${property.id}`);
    await expect(page.getByRole('heading', { level: 1, name: property.title })).toBeVisible({
      timeout: 15_000,
    });

    const reviewsSection = page.getByRole('region', { name: 'Reviews', exact: true });
    await reviewsSection.scrollIntoViewIfNeeded();

    await page.getByLabel('Comment').fill('No rating selected.');
    await page.getByRole('button', { name: 'Submit review' }).click();

    await expect(appAlert(page)).toBeVisible({ timeout: 5_000 });
    await expect(appAlert(page)).toContainText(/rate|rating/i);

    // Rejected comments must not persist; scope to list items to avoid
    // matching the text still in the composer's textarea.
    await expect(page.getByRole('listitem').filter({ hasText: 'No rating selected.' })).toHaveCount(
      0,
    );
  });

  test('1-star review is accepted and reflected in the summary', async ({
    page,
    ownerWithProperty,
    browserUser,
  }) => {
    const { owner, property } = ownerWithProperty;
    await loginAsTestUser(page, browserUser.phone);

    // A seeded 5-star review from the property owner keeps the average > 1.
    await createTestReview({
      propertyId: property.id,
      userId: owner.id,
      rating: 5,
      comment: 'Hosting a verified guest.',
    });

    await goto(page, `/properties/${property.id}`);
    await expect(page.getByRole('heading', { level: 1, name: property.title })).toBeVisible({
      timeout: 15_000,
    });

    const reviewsSection = page.getByRole('region', { name: 'Reviews', exact: true });
    await reviewsSection.scrollIntoViewIfNeeded();

    await page.getByRole('button', { name: 'Rate 1 star' }).click();
    await page.getByLabel('Comment').fill('One star edge case.');
    await page.getByRole('button', { name: 'Submit review' }).click();

    await expect(page.getByText('One star edge case.')).toBeVisible({ timeout: 10_000 });
    const summary = page.getByRole('region', { name: /reviews summary/i });
    // The fixture property holds the seeded 5-star plus this new 1-star review.
    await expect(summary.getByText('2 reviews', { exact: true })).toBeVisible();
  });
});
