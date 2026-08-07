/**
 * E2E — Property CRUD (PRD §3.2).
 *
 * Create, edit, and delete are separate tests, each as a fresh per-test
 * owner with a unique title so parallel runs never collide on "Delete"
 * buttons; fixture teardown cascades created rows away.
 */
import { expect, test } from './test-fixtures';
import { loginAsTestUser, acceptAiConsent } from './test-helpers';
import { MyPropertiesPage } from './pages/my-properties-page';
import { PropertyWizardPage } from './pages/property-wizard-page';
import { createTestProperty } from './test-data';

test.describe('Property CRUD', () => {
  test('owner creates a listing and lands on its detail page', async ({
    page,
    ownerUser,
    uniqueData,
  }) => {
    const propertyTitle = uniqueData.title('CRUD Property');
    const wizard = new PropertyWizardPage(page);

    await loginAsTestUser(page, ownerUser.phone);
    await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });

    await wizard.gotoCreate();
    await wizard.fillBasics(propertyTitle, 'A test property created during E2E.');
    await wizard.fillDetails({
      price: '5000',
      bedrooms: '2',
      bathrooms: '1',
      area: '80',
      currency: 'SAR',
    });
    await wizard.fillLocation({ city: 'Riyadh', neighborhood: 'Al Olaya', country: 'SA' });
    await wizard.skipImages();
    await wizard.fillContact(uniqueData.phone);
    await wizard.publish();

    await expect(page.getByRole('heading', { level: 1, name: propertyTitle })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('owner deletes a listing from My Properties', async ({ page, ownerWithProperty }) => {
    const { owner, property } = ownerWithProperty;

    await loginAsTestUser(page, owner.phone);
    await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });

    const myProperties = new MyPropertiesPage(page);
    await myProperties.goto();
    await myProperties.deleteProperty(property.title);
  });

  test('owner edits a listing title → change persists on the detail page', async ({
    page,
    ownerUser,
    uniqueData,
  }) => {
    const property = await createTestProperty({
      ownerId: ownerUser.id,
      title: uniqueData.title('Update Property'),
    });
    const editedTitle = uniqueData.title('Updated Property');
    const myProperties = new MyPropertiesPage(page);

    await loginAsTestUser(page, ownerUser.phone);
    await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });

    await myProperties.goto();
    await myProperties
      .card(property.title)
      .getByRole('link', { name: `Edit ${property.title}` })
      .click();
    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}\/edit$/);

    // The wizard mounts fresh with the AI consent dialog — dismiss it
    // or it intercepts every pointer event on the form.
    await acceptAiConsent(page);

    await page.getByLabel('Title').clear();
    await page.getByLabel('Title').fill(editedTitle);

    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Step 2 of 6')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Step 3 of 6')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Step 4 of 6')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Step 5 of 6')).toBeVisible({ timeout: 5_000 });
    await page.getByLabel('WhatsApp number').clear();
    await page.getByLabel('WhatsApp number').fill(uniqueData.phone);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Step 6 of 6')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Publish changes' }).click();

    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 1, name: editedTitle })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('heading', { level: 1, name: property.title })).not.toBeVisible();
  });
});
