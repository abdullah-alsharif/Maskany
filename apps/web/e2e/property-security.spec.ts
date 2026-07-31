import { expect, test } from '@playwright/test';
import { loginAsUser, acceptAiConsent } from './test-helpers';

const OWNER_COUNTRY = '+966';
const OWNER_PHONE = '501111001';
const OWNER_PROPERTY_TITLE = 'Modern 2BR Apartment in Al Olaya';

test.describe('Self-review block', () => {
  test('owner visiting their own property sees they cannot review it', async ({ page }) => {
    await loginAsUser(page, OWNER_COUNTRY, OWNER_PHONE);
    await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });

    await page.goto('/');
    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const ownerPropertyLink = grid.locator('article').filter({ hasText: OWNER_PROPERTY_TITLE }).locator('a').first();
    await ownerPropertyLink.click();
    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1, name: OWNER_PROPERTY_TITLE })).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByText(/owners cannot review their own property/i)).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.getByRole('button', { name: /submit review/i })).not.toBeVisible();
  });
});

test.describe('Property creation validation', () => {
  test('submitting step 1 with empty title shows validation error', async ({ page }) => {
    await loginAsUser(page, OWNER_COUNTRY, OWNER_PHONE);
    await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });

    await page.goto('/properties/create');
    await expect(page).toHaveURL(/\/properties\/create$/);
    await acceptAiConsent(page);

    await page.getByLabel('Description').fill('Test description without title.');
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    await expect(page.getByText(/title is required|required/i)).toBeVisible({ timeout: 5_000 });
  });
});

test.describe.serial('Browser user restrictions', () => {
  test('browser-type user cannot access create-property page', async ({ page }) => {
    await loginAsUser(page, '+966', '501111004');

    await page.goto('/properties/create');
    await expect(page).not.toHaveURL(/\/properties\/create$/);
  });
});
