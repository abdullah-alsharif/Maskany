/**
 * Page Object — Property creation wizard (6 steps: Basics → Details →
 * Location → Images → Contact → Review & publish).
 *
 * Steps are modeled as one method per step so specs can interleave their
 * own assertions (e.g. per-step validation errors) without duplicating the
 * form-driving boilerplate.
 */
import { expect, type Page } from '@playwright/test';
import { acceptAiConsent, goto } from '../test-helpers';

/** Either a path to a fixture file or an in-memory file payload. */
export type UploadPayload = string | { name: string; mimeType: string; buffer: Buffer };

export class PropertyWizardPage {
  constructor(private readonly page: Page) {}

  private get nextButton() {
    return this.page.getByRole('button', { name: 'Next', exact: true });
  }

  /**
   * Navigate to the create wizard: /my-properties → "New listing" →
   * the multi-step form, with the AI consent dialog dismissed.
   */
  async gotoCreate(): Promise<void> {
    await goto(this.page, '/my-properties');
    await expect(this.page.getByRole('heading', { level: 1, name: 'My properties' })).toBeVisible({
      timeout: 10_000,
    });
    await this.page.getByRole('link', { name: 'New listing' }).click();
    await expect(this.page).toHaveURL(/\/properties\/create$/);
    await expect(this.page.getByText('Create listing')).toBeVisible();
    await acceptAiConsent(this.page);
  }

  /** Step 1: Basics. */
  async fillBasics(title: string, description: string): Promise<void> {
    await this.page.getByLabel('Title').fill(title);
    await this.page.getByLabel('Description').fill(description);
    await this.nextButton.click();
  }

  /** Step 2: Details. */
  async fillDetails(details: {
    price: string;
    bedrooms: string;
    bathrooms: string;
    area: string;
    currency?: string;
  }): Promise<void> {
    await this.page.getByLabel('Price').fill(details.price);
    await this.page.getByLabel('Bedrooms').fill(details.bedrooms);
    await this.page.getByLabel('Bathrooms').fill(details.bathrooms);
    await this.page.getByLabel('Area (m²)').fill(details.area);
    await this.page.getByLabel('Currency').fill(details.currency ?? 'SAR');
    await this.nextButton.click();
  }

  /** Step 3: Location. */
  async fillLocation(location: {
    city: string;
    neighborhood: string;
    country?: string;
  }): Promise<void> {
    await this.page.getByLabel('City').fill(location.city);
    await this.page.getByLabel('Area / neighborhood').fill(location.neighborhood);
    await this.page.getByLabel('Country').fill(location.country ?? 'SA');
    await this.nextButton.click();
  }

  /** Step 4: proceed without images. */
  async skipImages(): Promise<void> {
    await this.nextButton.click();
  }

  /**
   * Step 4: upload a file, wait for its local preview to render, then
   * advance to the contact step. Preview renders synchronously from an
   * object URL — no network involved.
   */
  async uploadImages(file: UploadPayload): Promise<void> {
    const fileName = typeof file === 'string' ? file.split(/[\\/]/).pop()! : file.name;
    await this.page.locator('input[type="file"]').first().setInputFiles(file);
    await expect(this.page.locator(`img[alt="${fileName}"]`)).toBeVisible();
    await this.nextButton.click();
  }

  /** Step 5: Contact. */
  async fillContact(whatsapp: string): Promise<void> {
    await this.page.getByLabel('WhatsApp number').fill(whatsapp);
    await this.nextButton.click();
  }

  /**
   * Step 6: publish and land on the detail page.
   * Pass `expectMediaUpload: true` when a valid image was uploaded — the
   * POST /properties/:id/media round-trip must succeed before proceeding.
   */
  async publish(options: { expectMediaUpload?: boolean } = {}): Promise<void> {
    const mediaUpload = options.expectMediaUpload
      ? this.page.waitForResponse(
          (r) => r.url().includes('/media') && r.request().method() === 'POST' && r.ok(),
        )
      : null;
    await this.page.getByRole('button', { name: 'Publish listing' }).click();
    if (mediaUpload) await mediaUpload;
    await expect(this.page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  }
}
