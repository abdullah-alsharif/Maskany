/**
 * E2E — Image upload validation: the server rejects non-image uploads
 * (400 INVALID_MIME_TYPE), but the create wizard swallows that failure — the
 * listing still publishes, just without a photo. This spec pins that the
 * rejected file never becomes a property image; the success path lives in
 * image-upload.spec.ts.
 */
import { expect, test } from './test-fixtures';
import { loginAsTestUser } from './test-helpers';
import { PropertyWizardPage } from './pages/property-wizard-page';

test.describe('Image upload validation', () => {
  test('non-image file type is rejected', async ({ page, uniqueData, ownerUser }) => {
    const propertyTitle = uniqueData.title('Rejected Upload Property');
    const wizard = new PropertyWizardPage(page);

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

    // The server rejects the file on publish (400 INVALID_MIME_TYPE), but the
    // wizard swallows that failure — the listing publishes without a photo.
    await wizard.uploadImages({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });
    await wizard.fillContact(uniqueData.phone);
    await wizard.publish();

    await expect(page.getByRole('img', { name: new RegExp(`^${propertyTitle}`) })).toHaveCount(0);
    await expect(page.getByRole('img', { name: /test\.txt/i })).toHaveCount(0);
  });
});
