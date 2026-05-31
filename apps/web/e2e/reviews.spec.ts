/**
 * E2E — Reviews (PRD §5).
 *
 * Combined into a single test because:
 * 1. Playwright resets the page to about:blank between serial tests
 * 2. The OTP service has a 30-second cooldown — using the same phone
 *    across separate tests would cause 429 errors.
 *
 * Flow: login as a seeded browser user → navigate to a property →
 * verify rating distribution chart → write a review → edit the
 * comment → confirm the update.
 */
import { expect, test } from '@playwright/test';
import { loginAsUser } from './test-helpers';

const BROWSER_COUNTRY = '+966';
const BROWSER_PHONE = '500009001'; // dev-browser
const REVIEW_COMMENT = 'Great place, highly recommend!';
const UPDATED_COMMENT = 'Even better after staying longer.';

test('[AC-29] rating distribution bar chart + full reviews flow', async ({ page }) => {
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
