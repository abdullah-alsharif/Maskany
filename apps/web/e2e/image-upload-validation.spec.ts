import { expect, test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { loginAsUser, acceptAiConsent } from './test-helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OWNER_COUNTRY = '+966';
const OWNER_PHONE = '500009002';
const PROPERTY_TITLE = 'E2E Upload Validation Test';

test.describe('Image upload validation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, OWNER_COUNTRY, OWNER_PHONE);
    await page.goto('/my-properties');
    await page.getByRole('link', { name: 'New listing' }).click();
    await expect(page).toHaveURL(/\/properties\/create$/);
    await acceptAiConsent(page);

    await page.getByLabel('Title').fill(PROPERTY_TITLE);
    await page.getByLabel('Description').fill('Testing image upload validation.');
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    await page.getByLabel('Price').fill('5000');
    await page.getByLabel('Bedrooms').fill('2');
    await page.getByLabel('Bathrooms').fill('1');
    await page.getByLabel('Area (m²)').fill('80');
    await page.getByLabel('Currency').fill('SAR');
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    await page.getByLabel('City').fill('Riyadh');
    await page.getByLabel('Area / neighborhood').fill('Test Area');
    await page.getByLabel('Country').fill('SA');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  });

  test('valid image upload succeeds', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(path.resolve(__dirname, 'fixtures/test-image.png'));
    await page.waitForTimeout(2000);

    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByLabel('WhatsApp number').fill('+966500009002');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Publish listing' }).click();
    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    const images = page.locator('img');
    await expect(images.first()).toBeVisible({ timeout: 10_000 });

    await page.goto('/my-properties');
    await page.getByRole('button', { name: `Delete ${PROPERTY_TITLE}` }).click();
    await page.getByRole('button', { name: 'Yes, delete listing' }).click();
  });

  test('non-image file type is rejected', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });

    await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 5_000 });
  });
});
