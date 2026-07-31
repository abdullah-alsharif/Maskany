/**
 * E2E — Image upload during property creation (US1).
 *
 * The image upload step (Step 4) is skipped in all existing E2E tests.
 * This spec validates that uploading images during creation works and
 * that images appear on the detail page.
 */
import { expect, test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { loginAsUser, acceptAiConsent } from './test-helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OWNER_COUNTRY = '+966';
const OWNER_PHONE = '500009002'; // dev-owner
const PROPERTY_TITLE = 'E2E Upload Test';

test('uploading images during creation shows them on detail page', async ({ page }) => {
  await loginAsUser(page, OWNER_COUNTRY, OWNER_PHONE);
  await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });

  // Navigate to create form.
  await page.goto('/my-properties');
  await page.getByRole('link', { name: 'New listing' }).click();
  await expect(page).toHaveURL(/\/properties\/create$/);
  await acceptAiConsent(page);

  // Step 1: Basics.
  await page.getByLabel('Title').fill(PROPERTY_TITLE);
  await page.getByLabel('Description').fill('A test property with uploaded images.');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 2: Details.
  await page.getByLabel('Price').fill('5000');
  await page.getByLabel('Bedrooms').fill('2');
  await page.getByLabel('Bathrooms').fill('1');
  await page.getByLabel('Area (m²)').fill('80');
  await page.getByLabel('Currency').fill('SAR');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 3: Location.
  await page.getByLabel('City').fill('Riyadh');
  await page.getByLabel('Area / neighborhood').fill('Al Olaya');
  await page.getByLabel('Country').fill('SA');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 4: Images — upload a test file.
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(path.resolve(__dirname, 'fixtures/test-image.png'));

  // Wait for upload to process (thumbnail should appear).
  await page.waitForTimeout(2000);

  // Click Next to proceed.
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 5: Contact.
  await page.getByLabel('WhatsApp number').fill('+966500009002');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 6: Review & publish.
  await page.getByRole('button', { name: 'Publish listing' }).click();

  // Should land on detail page.
  await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1, name: PROPERTY_TITLE })).toBeVisible({
    timeout: 10_000,
  });

  // Gallery should show at least one image.
  const images = page.locator('img');
  await expect(images.first()).toBeVisible({ timeout: 10_000 });

  // Clean up: delete the test property.
  await page.goto('/my-properties');
  await page.getByRole('button', { name: `Delete ${PROPERTY_TITLE}` }).click();
  await page.getByRole('button', { name: 'Yes, delete listing' }).click();
  await expect(page.getByRole('heading', { name: PROPERTY_TITLE })).not.toBeVisible({
    timeout: 10_000,
  });
});
