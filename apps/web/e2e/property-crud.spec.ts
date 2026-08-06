/**
 * E2E — Property CRUD (PRD §3.2).
 *
 * Full create → verify → delete cycle as a fresh per-test owner, with a
 * unique title so parallel runs can never produce duplicate "Delete"
 * buttons for the same listing.
 */
import { expect, test } from './test-fixtures';
import { loginAsTestUser } from './test-helpers';
import { MyPropertiesPage } from './pages/my-properties-page';
import { PropertyWizardPage } from './pages/property-wizard-page';

test.describe('Property CRUD', () => {
  test('full property CRUD flow', async ({ page, ownerUser, uniqueData }) => {
    const propertyTitle = uniqueData.title('CRUD Property');
    const wizard = new PropertyWizardPage(page);
    const myProperties = new MyPropertiesPage(page);

    // --- Login ---
    await loginAsTestUser(page, ownerUser.phone);
    await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });

    // --- Create listing ---
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

    // After successful creation we should land on the property detail page.
    await expect(page.getByRole('heading', { level: 1, name: propertyTitle })).toBeVisible({
      timeout: 10_000,
    });

    // --- Delete the listing ---
    await myProperties.goto();
    await myProperties.deleteProperty(propertyTitle);
  });
});
