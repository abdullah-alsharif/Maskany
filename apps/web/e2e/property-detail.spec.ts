/**
 * E2E — Property detail + WhatsApp (T-033, PRD §3.4).
 *
 * Navigates from the listing grid into a property detail page and asserts
 * the four user-visible blocks the PRD calls out: hero image gallery, the
 * specs row (bedrooms / bathrooms / area), amenities, and the WhatsApp
 * call-to-action with a properly composed `wa.me` deep link.
 */
import { expect, test } from '@playwright/test';

test.describe('Property detail', () => {
  test('renders gallery, specs, amenities, and a WhatsApp link with a wa.me href', async ({
    page,
  }) => {
    await page.goto('/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const firstCard = grid.locator('article').first();
    const expectedTitle = (await firstCard.locator('h3').innerText()).trim();
    await firstCard.locator('a').first().click();

    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);

    // Title heading proves the detail page rendered with seeded data.
    await expect(page.getByRole('heading', { level: 1, name: expectedTitle })).toBeVisible({
      timeout: 15_000,
    });

    // Gallery — the hero image carries the property title in its alt text.
    const galleryImage = page.locator(`img[alt^="${expectedTitle}"]`).first();
    await expect(galleryImage).toBeVisible();

    // Specs row — exposes bedrooms, bathrooms, and area.
    const specs = page.getByLabel('Property specifications');
    await expect(specs).toBeVisible();
    await expect(specs).toContainText(/bedroom/i);
    await expect(specs).toContainText(/bathroom/i);
    await expect(specs).toContainText('m²');

    // Amenities heading is present (every seed property has at least one).
    await expect(page.getByRole('heading', { name: 'Amenities' })).toBeVisible();

    // WhatsApp FAB — has the correct deep-link target.
    const whatsappLink = page.getByRole('link', {
      name: /contact property owner on whatsapp/i,
    });
    await expect(whatsappLink).toBeVisible();
    const href = await whatsappLink.getAttribute('href');
    expect(href).not.toBeNull();
    expect(href).toMatch(/^https:\/\/wa\.me\/\d{7,15}\?text=/);
  });
});
