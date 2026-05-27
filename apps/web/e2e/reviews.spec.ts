/**
 * E2E — Reviews (PRD §5).
 *
 * Combined into a single test because Playwright resets the page to
 * about:blank between serial tests, which destroys the origin-specific
 * localStorage needed for auth state to survive a full reload.
 *
 * Flow: login as a seeded browser user → navigate to a property →
 * write a review → edit the comment → confirm the update.
 */
import { expect, test } from '@playwright/test';
import { loginAsUser } from './test-helpers';

const BROWSER_COUNTRY = '+966';
const BROWSER_PHONE = '500009001'; // dev-browser (no existing reviews)
const REVIEW_COMMENT = 'Great place, highly recommend!';
const UPDATED_COMMENT = 'Even better after staying longer.';

test('full reviews flow', async ({ page }) => {
  // --- Login and navigate to a property ---
  await loginAsUser(page, BROWSER_COUNTRY, BROWSER_PHONE);

  const grid = page.getByTestId('property-grid');
  await expect(grid).toBeVisible({ timeout: 15_000 });

  const firstCard = grid.locator('article').first();
  const link = firstCard.locator('a').first();
  const href = await link.getAttribute('href');
  const propertyUrl = href ?? '/properties/seed';

  await link.click();
  await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);

  // --- Leave a review ---
  const reviewsSection = page.getByRole('region', { name: 'Reviews', exact: true });
  await reviewsSection.scrollIntoViewIfNeeded();
  await expect(reviewsSection).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Rate 5 stars' }).click();
  await page.getByLabel('Comment').fill(REVIEW_COMMENT);
  await page.getByRole('button', { name: 'Submit review' }).click();

  await expect(page.getByText(REVIEW_COMMENT)).toBeVisible({ timeout: 10_000 });

  // --- Edit the review ---
  await page.goto(propertyUrl);

  const editButton = page.getByRole('button', { name: 'Edit' });
  await expect(editButton).toBeVisible({ timeout: 10_000 });
  await editButton.click();

  const commentInput = page.getByLabel('Comment');
  await commentInput.clear();
  await commentInput.fill(UPDATED_COMMENT);

  await page.getByRole('button', { name: 'Update review' }).click();

  await expect(page.getByText(UPDATED_COMMENT)).toBeVisible({ timeout: 10_000 });
});
