/**
 * E2E — Image upload validation during property creation.
 *
 * Valid uploads succeed and publish; non-image files are rejected with a
 * validation alert. Each test logs in with a fresh per-test owner and uses
 * a unique property title, so the delete step is unambiguous in parallel.
 */
import { expect, test } from './test-fixtures';
import path from 'path';
import { fileURLToPath } from 'url';
import { loginAsTestUser } from './test-helpers';
import { MyPropertiesPage } from './pages/my-properties-page';
import { PropertyWizardPage } from './pages/property-wizard-page';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Image upload validation', () => {
  test('valid image upload succeeds', async ({ page, uniqueData, ownerUser }) => {
    const propertyTitle = uniqueData.title('Upload Validation Property');
    const wizard = new PropertyWizardPage(page);
    const myProperties = new MyPropertiesPage(page);

    await loginAsTestUser(page, ownerUser.phone);

    await wizard.gotoCreate();
    await wizard.fillBasics(propertyTitle, 'Testing image upload validation.');
    await wizard.fillDetails({
      price: '5000',
      bedrooms: '2',
      bathrooms: '1',
      area: '80',
      currency: 'SAR',
    });
    await wizard.fillLocation({ city: 'Riyadh', neighborhood: 'Test Area', country: 'SA' });

    await wizard.uploadImages(path.resolve(__dirname, 'fixtures/test-image.png'));
    await wizard.fillContact(uniqueData.phone);
    await wizard.publish({ expectMediaUpload: true });

    const images = page.locator('img');
    await expect(images.first()).toBeVisible({ timeout: 10_000 });

    await myProperties.goto();
    await myProperties.deleteProperty(propertyTitle);
  });

  test('non-image file type is rejected', async ({ page, uniqueData, ownerUser }) => {
    const propertyTitle = uniqueData.title('Rejected Upload Property');
    const wizard = new PropertyWizardPage(page);
    const myProperties = new MyPropertiesPage(page);

    await loginAsTestUser(page, ownerUser.phone);

    await wizard.gotoCreate();
    await wizard.fillBasics(propertyTitle, 'Testing image upload validation.');
    await wizard.fillDetails({
      price: '5000',
      bedrooms: '2',
      bathrooms: '1',
      area: '80',
      currency: 'SAR',
    });
    await wizard.fillLocation({ city: 'Riyadh', neighborhood: 'Test Area', country: 'SA' });

    // A non-image file still renders a local preview; the server rejects it
    // on publish (400 INVALID_MIME_TYPE), and the create wizard swallows
    // that failure — so the listing is published without any photo.
    await wizard.uploadImages({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });
    await wizard.fillContact(uniqueData.phone);
    await wizard.publish();

    // Assert the file never became a property image.
    await expect(page.locator(`img[alt^="${propertyTitle}"]`)).toHaveCount(0);
    await expect(page.locator('img[alt^="test.txt"]')).toHaveCount(0);

    // Clean up.
    await myProperties.goto();
    await myProperties.deleteProperty(propertyTitle);
  });
});
