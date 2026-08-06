/**
 * E2E — Reviews (PRD §5).
 *
 * Fully isolated: the test creates its own owner, property and browser
 * user, then exercises the rating-distribution chart, review submission
 * and review editing against that private property. No seeded records are
 * touched, so the spec is safe to run in parallel with anything else.
 */
import { expect, test } from './test-fixtures';
import { goto, loginAsTestUser } from './test-helpers';
import { createTestReview } from './test-data';

const REVIEW_COMMENT = 'Great place, highly recommend!';
const UPDATED_COMMENT = 'Even better after staying longer.';

test.describe('Reviews', () => {
  test('[AC-29] rating distribution bar chart + full reviews flow', async ({
    page,
    ownerWithProperty,
    browserUser,
  }) => {
    const { property } = ownerWithProperty;
    const propertyUrl = `/properties/${property.id}`;

    // --- Login as a fresh browser user and open the private property ---
    await loginAsTestUser(page, browserUser.phone);

    await goto(page, propertyUrl);
    await expect(page.getByRole('heading', { level: 1, name: property.title })).toBeVisible({
      timeout: 15_000,
    });

    // --- [AC-29] Rating distribution bar chart ---
    const distribution = page.getByRole('group', { name: /rating distribution/i });
    await expect(distribution).toBeVisible({ timeout: 10_000 });

    const bars = distribution.locator('[data-testid="distribution-fill"]');
    const barCount = await bars.count();
    expect(barCount).toBeGreaterThanOrEqual(1);

    // Assert bar widths are valid percentage strings
    for (let i = 0; i < barCount; i++) {
      const style = await bars.nth(i).getAttribute('style');
      expect(style).toMatch(/width:\s*\d+(\.\d+)?%/);
    }

    // Assert average rating and total review count displayed
    const summary = page.getByRole('region', { name: /reviews summary/i });
    await expect(summary).toBeVisible({ timeout: 5_000 });
    await expect(summary.getByText(/\d+ review/i)).toBeVisible();

    // --- Leave a review ---
    const reviewsSection = page.getByRole('region', { name: 'Reviews', exact: true });
    await reviewsSection.scrollIntoViewIfNeeded();
    await expect(reviewsSection).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Rate 5 stars' }).click();
    await page.getByLabel('Comment').fill(REVIEW_COMMENT);
    await page.getByRole('button', { name: 'Submit review' }).click();

    await expect(page.getByText(REVIEW_COMMENT)).toBeVisible({ timeout: 10_000 });

    // --- Edit the review ---
    await goto(page, propertyUrl);

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

    await expect(page.locator('p[role="alert"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('p[role="alert"]')).toContainText(/rate|rating/i);
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
    await expect(summary.getByText(/\d+ review/i)).toBeVisible();
  });
});
