/**
 * E2E — Image upload during property creation (US1).
 *
 * The image upload step (Step 4) is skipped in most E2E tests.
 * This spec validates that uploading images during creation works and
 * that images appear on the detail page. Runs with a fresh per-test owner
 * and a unique property title so parallel runs never collide.
 */
import { expect, test } from './test-fixtures';
import path from 'path';
import { fileURLToPath } from 'url';
import { loginAsTestUser } from './test-helpers';
import { MyPropertiesPage } from './pages/my-properties-page';
import { PropertyWizardPage } from './pages/property-wizard-page';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('uploading images during creation shows them on detail page', async ({
  page,
  uniqueData,
  ownerUser,
}) => {
  const propertyTitle = uniqueData.title('Upload Property');
  const wizard = new PropertyWizardPage(page);
  const myProperties = new MyPropertiesPage(page);

  await loginAsTestUser(page, ownerUser.phone);
  await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });

  await wizard.gotoCreate();
  await wizard.fillBasics(propertyTitle, 'A test property with uploaded images.');
  await wizard.fillDetails({
    price: '5000',
    bedrooms: '2',
    bathrooms: '1',
    area: '80',
    currency: 'SAR',
  });
  await wizard.fillLocation({ city: 'Riyadh', neighborhood: 'Al Olaya', country: 'SA' });

  // Step 4: Images — upload a test file; the local preview renders
  // synchronously, and publish must complete the media upload round-trip.
  await wizard.uploadImages(path.resolve(__dirname, 'fixtures/test-image.png'));
  await wizard.fillContact(uniqueData.phone);
  await wizard.publish({ expectMediaUpload: true });

  // Should land on detail page.
  await expect(page.getByRole('heading', { level: 1, name: propertyTitle })).toBeVisible({
    timeout: 10_000,
  });

  // Gallery should show at least one image.
  const images = page.locator('img');
  await expect(images.first()).toBeVisible({ timeout: 10_000 });

  // Clean up: delete the test property.
  await myProperties.goto();
  await myProperties.deleteProperty(propertyTitle);
});
