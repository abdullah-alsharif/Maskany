/**
 * E2E — Status toggle (US9).
 *
 * Validates that owners can deactivate and reactivate properties,
 * and that deactivated properties are excluded from the public listing.
 */
import { expect, test } from '@playwright/test';
import { loginAsUser, acceptAiConsent } from './test-helpers';

const OWNER_COUNTRY = '+966';
const OWNER_PHONE = '500009002'; // dev-owner

test('deactivate and reactivate property', async ({ page }) => {
  // Create a property first.
  await loginAsUser(page, OWNER_COUNTRY, OWNER_PHONE);
  await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });

  await page.goto('/my-properties');
  await page.getByRole('link', { name: 'New listing' }).click();
  await acceptAiConsent(page);

  const testTitle = 'E2E Status Toggle Test';

  // Step 1.
  await page.getByLabel('Title').fill(testTitle);
  await page.getByLabel('Description').fill('Status toggle test.');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 2.
  await page.getByLabel('Price').fill('3000');
  await page.getByLabel('Bedrooms').fill('1');
  await page.getByLabel('Bathrooms').fill('1');
  await page.getByLabel('Area (m²)').fill('50');
  await page.getByLabel('Currency').fill('SAR');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 3.
  await page.getByLabel('City').fill('Riyadh');
  await page.getByLabel('Area / neighborhood').fill('Test Area');
  await page.getByLabel('Country').fill('SA');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 4 (skip images).
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 5.
  await page.getByLabel('WhatsApp number').fill('+966500009002');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 6: Publish.
  await page.getByRole('button', { name: 'Publish listing' }).click();
  await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/, { timeout: 15_000 });

  // Go to my-properties and verify Active status.
  await page.goto('/my-properties');
  const testCard = page.locator('article').filter({ hasText: testTitle });
  await expect(testCard.getByText('Active')).toBeVisible({ timeout: 10_000 });

  // Deactivate.
  await page.getByRole('button', { name: `Deactivate ${testTitle}` }).click();

  // Status should change to Inactive.
  await expect(testCard.getByText('Inactive')).toBeVisible({ timeout: 10_000 });

  // Property should NOT appear in public listing.
  await page.goto('/');
  const grid = page.getByTestId('property-grid');
  await expect(grid).toBeVisible({ timeout: 15_000 });
  const allTexts = await grid.locator('article').allInnerTexts();
  const found = allTexts.some((t) => t.includes(testTitle));
  expect(found).toBe(false);

  // Reactivate.
  await page.goto('/my-properties');
  await page.getByRole('button', { name: `Activate ${testTitle}` }).click();

  // Status should change back to Active.
  await expect(testCard.getByText('Active')).toBeVisible({ timeout: 10_000 });

  // Property should reappear in public listing.
  await page.goto('/');
  await expect(grid).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(
      async () => {
        const texts = await grid.locator('article').allInnerTexts();
        return texts.some((t) => t.includes(testTitle));
      },
      { timeout: 15_000 },
    )
    .toBe(true);

  // Clean up.
  await page.goto('/my-properties');
  await page.getByRole('button', { name: `Delete ${testTitle}` }).click();
  await page.getByRole('button', { name: 'Yes, delete listing' }).click();
});
