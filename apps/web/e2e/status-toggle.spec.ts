/**
 * E2E — Status toggle (US9).
 *
 * Validates that owners can deactivate and reactivate properties,
 * and that deactivated properties are excluded from the public listing.
 * Runs with a fresh per-test owner and a unique property title so the
 * public-listing assertions never observe another test's data.
 */
import { expect, test } from './test-fixtures';
import { goto, loginAsTestUser } from './test-helpers';
import { MyPropertiesPage } from './pages/my-properties-page';
import { PropertyWizardPage } from './pages/property-wizard-page';

test.describe('Status toggle', () => {
  test('deactivate and reactivate property', async ({ page, ownerUser, uniqueData }) => {
    const testTitle = uniqueData.title('Status Toggle Property');
    const wizard = new PropertyWizardPage(page);
    const myProperties = new MyPropertiesPage(page);

    // Create a property first.
    await loginAsTestUser(page, ownerUser.phone);
    await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });

    await wizard.gotoCreate();
    await wizard.fillBasics(testTitle, 'Status toggle test.');
    await wizard.fillDetails({
      price: '3000',
      bedrooms: '1',
      bathrooms: '1',
      area: '50',
      currency: 'SAR',
    });
    await wizard.fillLocation({ city: 'Riyadh', neighborhood: 'Test Area', country: 'SA' });
    await wizard.skipImages();
    await wizard.fillContact(uniqueData.phone);
    await wizard.publish();

    // Go to my-properties and verify Active status.
    await myProperties.goto();
    const testCard = myProperties.card(testTitle);
    await expect(testCard.getByText('Active')).toBeVisible({ timeout: 10_000 });

    // Deactivate.
    await myProperties.toggleStatus(testTitle, 'Inactive');

    // Property should NOT appear in public listing.
    await goto(page, '/');
    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });
    const allTexts = await grid.locator('article').allInnerTexts();
    const found = allTexts.some((t) => t.includes(testTitle));
    expect(found).toBe(false);

    // Reactivate.
    await myProperties.goto();
    await myProperties.toggleStatus(testTitle, 'Active');

    // Property should reappear in public listing.
    await goto(page, '/');
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
    await myProperties.goto();
    await myProperties.deleteProperty(testTitle);
  });
});
