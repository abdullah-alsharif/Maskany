/**
 * E2E — AI-powered property listing features: consent + field-level enhance,
 * and translation generation + review panel. The AI provider needs a key to
 * produce output, so the spec SKIPS when no key is configured and FAILS on
 * any API error — error/limit feedback is never accepted as a pass.
 */
import { expect, test } from './test-fixtures';
import { goto, loginAsTestUser } from './test-helpers';
import type { Page } from '@playwright/test';

const aiKeyConfigured = Boolean(
  process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_PAID_API_KEY,
);

/** Log in as the owner, open the edit wizard, and accept the AI consent dialog. */
async function openEditPage(
  page: Page,
  owner: { phone: string },
  property: { title: string },
): Promise<void> {
  await loginAsTestUser(page, owner.phone);
  await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });

  await goto(page, '/my-properties');
  await expect(page.getByRole('heading', { level: 1, name: 'My properties' })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole('link', { name: `Edit ${property.title}` }).click();
  await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}\/edit$/, { timeout: 30_000 });

  await expect(page.getByText('AI Writing Assistant')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/use AI to help/i)).toBeVisible();
  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText('AI Writing Assistant')).not.toBeVisible();
}

test('AI consent dialog and field-level enhancement on the edit page', async ({
  page,
  ownerWithProperty,
}) => {
  test.skip(!aiKeyConfigured, 'AI provider key not configured — cannot verify AI success');
  test.setTimeout(180_000);

  const { owner, property } = ownerWithProperty;
  await openEditPage(page, owner, property);

  const enhanceButtons = page.getByRole('button', { name: /enhance/i });
  await expect(enhanceButtons).toHaveCount(3);
  await expect(enhanceButtons.first()).toBeVisible();

  const titleInput = page.getByLabel('Title');
  await expect(titleInput).not.toHaveValue('');

  await enhanceButtons.first().click();

  // "Undo" only appears after a real enhancement — API errors are not
  // an accepted outcome (see header comment).
  await expect(page.getByText('Undo')).toBeVisible({ timeout: 60_000 });
});

test('AI translation generation and review panel on the edit page', async ({
  page,
  ownerWithProperty,
}) => {
  test.skip(!aiKeyConfigured, 'AI provider key not configured — cannot verify AI success');
  test.setTimeout(180_000);

  const { owner, property } = ownerWithProperty;
  await openEditPage(page, owner, property);

  for (let step = 1; step < 3; step++) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText(`Step ${step + 1} of 6`)).toBeVisible({ timeout: 5_000 });
  }

  const areaInput = page.getByLabel('Area / neighborhood');
  await expect(areaInput).toBeVisible();
  await expect(areaInput).not.toHaveValue('');

  await page.getByRole('button', { name: /add translation|hide/i }).click();

  const generateBtn = page.getByRole('button', { name: /generate with ai/i });
  await expect(generateBtn).toBeVisible();

  await generateBtn.click();
  // Generation must populate the Arabic title — a failed call leaving it
  // empty is not an accepted outcome.
  await expect(page.getByLabel('العنوان')).not.toHaveValue('', { timeout: 60_000 });

  await page.getByRole('button', { name: /start ai review/i }).click();
  await expect(page.getByText('AI Listing Review')).toBeVisible({ timeout: 10_000 });

  // A real score is required — an analysis error is not accepted (see header).
  await expect(page.getByText(/\d+\.\d+\/\d+/)).toBeVisible({ timeout: 90_000 });

  await page.getByRole('button', { name: /close/i }).click();
  await expect(page.getByText('AI Listing Review')).not.toBeVisible();
});
