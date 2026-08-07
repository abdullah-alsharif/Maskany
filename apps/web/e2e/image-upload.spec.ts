/**
 * E2E — Image upload during property creation (US1): validates the wizard's
 * image step (skipped in most specs) and that the uploaded image appears on
 * the detail page, with a fresh per-test owner so parallel runs never collide.
 */
import { expect, test } from './test-fixtures';
import path from 'path';
import { fileURLToPath } from 'url';
import { loginAsTestUser } from './test-helpers';
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

  // Publish must complete the media upload round-trip (expectMediaUpload).
  await wizard.uploadImages(path.resolve(__dirname, 'fixtures/test-image.png'));
  await wizard.fillContact(uniqueData.phone);
  await wizard.publish({ expectMediaUpload: true });

  await expect(page.getByRole('heading', { level: 1, name: propertyTitle })).toBeVisible({
    timeout: 10_000,
  });

  // Scoped to <main> so the navbar logo can never satisfy this assertion
  // (alt-text is the property title).
  await expect(
    page
      .getByRole('main')
      .getByRole('img', { name: new RegExp(`^${propertyTitle}`) })
      .first(),
  ).toBeVisible({ timeout: 10_000 });
});
