import { expect, test } from './test-fixtures';
import { goto, loginAsTestUser, acceptAiConsent } from './test-helpers';

test.describe('Property form step validation', () => {
  test.beforeEach(async ({ page, ownerUser }) => {
    await loginAsTestUser(page, ownerUser.phone);
    await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });
    await goto(page, '/properties/create');
    await expect(page).toHaveURL(/\/properties\/create$/);
    await acceptAiConsent(page);
  });

  test('step 1: empty title shows validation error', async ({ page }) => {
    await page.getByLabel('Description').fill('Some description.');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Title is required.')).toBeVisible({ timeout: 5_000 });

    // The wizard must not advance past the broken step.
    await expect(page).toHaveURL(/\/properties\/create$/);
  });

  test('step 2: empty price shows validation error', async ({ page, uniqueData }) => {
    await page.getByLabel('Title').fill(uniqueData.title('Validation'));
    await page.getByLabel('Description').fill('Test description.');
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Price must be a positive number.')).toBeVisible({
      timeout: 5_000,
    });

    // The wizard must not advance past the broken step.
    await expect(page).toHaveURL(/\/properties\/create$/);
  });

  test('step 2: negative bedrooms shows validation error', async ({ page, uniqueData }) => {
    await page.getByLabel('Title').fill(uniqueData.title('Validation'));
    await page.getByLabel('Description').fill('Test description.');
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    await page.getByLabel('Price').fill(`9${uniqueData.suffix}`);
    // '-1' is an intentional boundary literal; only title/price need isolation.
    await page.getByLabel('Bedrooms').fill('-1');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Bedrooms cannot be negative.')).toBeVisible({
      timeout: 5_000,
    });

    // The wizard must not advance past the broken step.
    await expect(page).toHaveURL(/\/properties\/create$/);
  });

  test('step 3: empty city shows validation error', async ({ page, uniqueData }) => {
    await page.getByLabel('Title').fill(uniqueData.title('Validation'));
    await page.getByLabel('Description').fill('Test description.');
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    await page.getByLabel('Price').fill(`9${uniqueData.suffix}`);
    await page.getByLabel('Bedrooms').fill('2');
    await page.getByLabel('Bathrooms').fill('1');
    await page.getByLabel('Area (m²)').fill('80');
    await page.getByLabel('Currency').fill('SAR');
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('City is required.')).toBeVisible({ timeout: 5_000 });

    // The wizard must not advance past the broken step.
    await expect(page).toHaveURL(/\/properties\/create$/);
  });

  test('step 5: invalid whatsapp format shows validation error', async ({ page, uniqueData }) => {
    await page.getByLabel('Title').fill(uniqueData.title('Validation'));
    await page.getByLabel('Description').fill('Test description.');
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    await page.getByLabel('Price').fill(`9${uniqueData.suffix}`);
    await page.getByLabel('Bedrooms').fill('2');
    await page.getByLabel('Bathrooms').fill('1');
    await page.getByLabel('Area (m²)').fill('80');
    await page.getByLabel('Currency').fill('SAR');
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    await page.getByLabel('City').fill('Riyadh');
    await page.getByLabel('Area / neighborhood').fill('Al Olaya');
    await page.getByLabel('Country').fill('SA');
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    await page.getByRole('button', { name: 'Next', exact: true }).click();

    await page.getByLabel('WhatsApp number').fill('invalid');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('WhatsApp number must be in E.164 format')).toBeVisible({
      timeout: 5_000,
    });

    // The wizard must not advance past the broken step.
    await expect(page).toHaveURL(/\/properties\/create$/);
  });
});
