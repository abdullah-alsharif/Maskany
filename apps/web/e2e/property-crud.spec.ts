/**
 * E2E — Property CRUD (PRD §3.2).
 *
 * Combined into a single test because Playwright resets the page to
 * about:blank between serial tests, which destroys the origin-specific
 * localStorage and breaks subsequent page.goto navigations that depend
 * on auth state surviving a full reload.
 *
 * Flow: login as seeded owner → create property via multi-step form →
 * confirm on detail page → return to My Properties → delete it.
 */
import { expect, test } from '@playwright/test';
import { loginAsUser, acceptAiConsent } from './test-helpers';

const OWNER_COUNTRY = '+966';
const OWNER_PHONE = '500009002'; // dev-owner

const PROPERTY_TITLE = 'E2E Test Property';

test('full property CRUD flow', async ({ page }) => {
  // --- Login ---
  await loginAsUser(page, OWNER_COUNTRY, OWNER_PHONE);
  await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });

  // --- Create listing ---
  // Use client-side navigation (click a link) so auth state is preserved.
  await page.goto('/my-properties');
  await expect(page.getByRole('heading', { level: 1, name: 'My properties' })).toBeVisible({
    timeout: 10_000,
  });

  // Click the "New listing" link.
  await page.getByRole('link', { name: 'New listing' }).click();
  await expect(page).toHaveURL(/\/properties\/create$/);
  await expect(page.getByText('Create listing')).toBeVisible();
  await acceptAiConsent(page);

  // --- Step 1: Basics ---
  await page.getByLabel('Title').fill(PROPERTY_TITLE);
  await page.getByLabel('Description').fill('A test property created during E2E.');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // --- Step 2: Details ---
  await page.getByLabel('Price').fill('5000');
  await page.getByLabel('Bedrooms').fill('2');
  await page.getByLabel('Bathrooms').fill('1');
  await page.getByLabel('Area (m²)').fill('80');
  await page.getByLabel('Currency').fill('SAR');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // --- Step 3: Location ---
  await page.getByLabel('City').fill('Riyadh');
  await page.getByLabel('Area / neighborhood').fill('Al Olaya');
  await page.getByLabel('Country').fill('SA');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // --- Step 4: Images (skip) ---
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // --- Step 5: Contact ---
  await page.getByLabel('WhatsApp number').fill('+966500009002');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // --- Step 6: Review & publish ---
  await page.getByRole('button', { name: 'Publish listing' }).click();

  // After successful creation we should land on the property detail page.
  await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1, name: PROPERTY_TITLE })).toBeVisible({
    timeout: 10_000,
  });

  // --- Delete the listing ---
  await page.goto('/my-properties');
  await expect(page.getByRole('heading', { level: 1, name: 'My properties' })).toBeVisible({
    timeout: 10_000,
  });

  const deleteButton = page.getByRole('button', { name: `Delete ${PROPERTY_TITLE}`, exact: true });
  await expect(deleteButton).toBeVisible();
  await deleteButton.click();

  // Confirm the delete dialog.
  await page.getByRole('button', { name: 'Yes, delete listing' }).click();

  // Hard-delete removes the property from the list entirely.
  await expect(page.getByRole('heading', { name: PROPERTY_TITLE, exact: true })).not.toBeVisible({
    timeout: 10_000,
  });
});
