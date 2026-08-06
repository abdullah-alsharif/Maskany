/**
 * E2E — AI-powered property listing features.
 *
 * Single long test covering the AI consent dialog, field-level enhance
 * buttons, AI review panel, and AI translation generation on the edit
 * property page. Combined into one test to avoid re-authenticating and
 * re-creating expensive AI API calls per feature.
 *
 * AI API calls may fail when no AI provider key is configured — the test
 * verifies UI presence/loading states and accepts either success or
 * graceful error feedback.
 */
import { expect, test } from './test-fixtures';
import { goto, loginAsTestUser } from './test-helpers';

test('AI features on edit property page', async ({ page, ownerWithProperty }) => {
  test.setTimeout(180_000);

  const { owner, property } = ownerWithProperty;

  // ====================================================================
  // Login as property owner and navigate to edit page
  // ====================================================================
  await loginAsTestUser(page, owner.phone);
  await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });

  await goto(page, '/my-properties');
  await expect(page.getByRole('heading', { level: 1, name: 'My properties' })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole('link', { name: `Edit ${property.title}` }).click();
  await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}\/edit$/, { timeout: 30_000 });

  // ====================================================================
  // AI consent dialog appears on first visit
  // ====================================================================
  await expect(page.getByText('AI Writing Assistant')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/use AI to help/i)).toBeVisible();

  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText('AI Writing Assistant')).not.toBeVisible();

  // ====================================================================
  // Step 1: enhance buttons visible on title, summary, description
  // ====================================================================
  const enhanceButtons = page.getByRole('button', { name: /enhance/i });
  await expect(enhanceButtons).toHaveCount(3);
  await expect(enhanceButtons.first()).toBeVisible();

  // ====================================================================
  // Click enhance on title — shows spinner then result or error
  // ====================================================================
  const titleInput = page.getByLabel('Title');
  await expect(titleInput).not.toHaveValue('');

  const titleEnhanceBtn = enhanceButtons.first();
  await titleEnhanceBtn.click();

  // Loading spinner may complete too fast to observe — treat as optional.
  try {
    await titleEnhanceBtn.locator('svg[class*="animate-spin"]').waitFor({ timeout: 3_000 });
  } catch {
    // Spinner not observed — proceed to outcome race.
  }

  const titleOutcome = await Promise.race([
    page
      .getByText('Undo')
      .waitFor({ timeout: 60_000 })
      .then(() => 'undo' as const),
    page
      .getByText('AI generation failed')
      .waitFor({ timeout: 60_000 })
      .then(() => 'error' as const),
    page
      .getByText('AI limit reached for now')
      .waitFor({ timeout: 60_000 })
      .then(() => 'rate_limited' as const),
  ]);
  expect(['undo', 'error', 'rate_limited']).toContain(titleOutcome);

  // ====================================================================
  // Navigate to step 3 — location fields prefilled
  // ====================================================================
  for (let step = 1; step < 3; step++) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText(`Step ${step + 1} of 6`)).toBeVisible({ timeout: 5_000 });
  }

  const areaInput = page.getByLabel('Area / neighborhood');
  await expect(areaInput).toBeVisible();
  await expect(areaInput).not.toHaveValue('');

  // ====================================================================
  // Open translation editor and test generate with AI button
  // ====================================================================
  await page.getByTestId('translation-toggle').click();

  const generateBtn = page.getByRole('button', { name: /generate with ai/i });
  await expect(generateBtn).toBeVisible();

  await generateBtn.click();
  try {
    await generateBtn.locator('[class*="animate-spin"]').waitFor({ timeout: 3_000 });
  } catch {
    // Generation may complete (or fail) too fast for the spinner to be observable.
  }

  // ====================================================================
  // Open AI review panel
  // ====================================================================
  await page.getByRole('button', { name: /start ai review/i }).click();
  await expect(page.getByText('AI Listing Review')).toBeVisible({ timeout: 10_000 });

  const reviewOutcome = await Promise.race([
    page
      .getByText(/\d+\.\d+\/\d+/)
      .waitFor({ timeout: 90_000 })
      .then(() => 'review' as const),
    page
      .getByText('Could not analyze listing')
      .waitFor({ timeout: 90_000 })
      .then(() => 'error' as const),
  ]);
  expect(['review', 'error']).toContain(reviewOutcome);

  await page.getByRole('button', { name: /close/i }).click();
  await expect(page.getByText('AI Listing Review')).not.toBeVisible();
});
