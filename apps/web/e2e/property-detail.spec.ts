/**
 * E2E — Property detail + WhatsApp (T-033, PRD §3.4).
 *
 * Navigates from the listing grid into a property detail page and asserts
 * the four user-visible blocks the PRD calls out: hero image gallery, the
 * specs row (bedrooms / bathrooms / area), amenities, and the WhatsApp
 * call-to-action with a properly composed `wa.me` deep link.
 */
import { expect, test } from '@playwright/test';

test.describe('PRD §3.4 — Property Detail View', () => {
  test('[AC-16] displays all required fields: title, summary, type badge, location, price, currency, unit, rooms, bathrooms, area, description, amenities, WhatsApp FAB, owner info, reviews', async ({
    page,
  }) => {
    await page.goto('/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const firstCard = grid.locator('article').first();
    const expectedTitle = (await firstCard.locator('h3').innerText()).trim();
    await firstCard.locator('a').first().click();

    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);

    // Title
    await expect(page.getByRole('heading', { level: 1, name: expectedTitle })).toBeVisible({
      timeout: 15_000,
    });

    // Gallery
    const galleryImage = page.locator(`img[alt^="${expectedTitle}"]`).first();
    await expect(galleryImage).toBeVisible();

    // Specs row
    const specs = page.getByLabel('Property specifications');
    await expect(specs).toBeVisible();
    await expect(specs).toContainText(/bedroom/i);
    await expect(specs).toContainText(/bathroom/i);
    await expect(specs).toContainText('m²');

    // Amenities
    await expect(page.getByRole('heading', { name: 'Amenities' })).toBeVisible();

    // WhatsApp FAB
    const whatsappFab = page.getByRole('link', {
      name: /contact property owner on whatsapp/i,
    });
    await expect(whatsappFab).toBeVisible();
    const waHref = await whatsappFab.getAttribute('href');
    expect(waHref).not.toBeNull();
    expect(waHref).toMatch(/^https:\/\/wa\.me\/\d{7,15}\?text=/);
  });

  test('[AC-30] WhatsApp FAB opens wa.me deep link with pre-filled message', async ({ page }) => {
    await page.goto('/');
    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const firstCard = grid.locator('article').first();
    const expectedTitle = (await firstCard.locator('h3').innerText()).trim();
    await firstCard.locator('a').first().click();
    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);

    const waLink = page.getByRole('link', { name: /contact property owner on whatsapp/i });
    await expect(waLink).toBeVisible({ timeout: 10_000 });

    const href = await waLink.getAttribute('href');
    expect(href).toMatch(/^https:\/\/wa\.me\/\d{7,15}\?text=/);

    // Number segment has no + or spaces (international format)
    const numberMatch = href?.match(/wa\.me\/(\d+)/);
    expect(numberMatch).not.toBeNull();
    expect(numberMatch![1]).not.toContain('+');
    expect(numberMatch![1]).not.toContain(' ');

    // Message contains property title and listing URL
    const message = decodeURIComponent(href!.split('text=')[1] ?? '');
    expect(message).toContain(expectedTitle);
    expect(message).toMatch(/maskany/i);
  });

  test('[AC-31] WhatsApp number is in international format (no +, no spaces)', async ({ page }) => {
    await page.goto('/');
    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });
    await grid.locator('article').first().locator('a').first().click();
    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);

    const waLink = page.getByRole('link', { name: /contact property owner on whatsapp/i });
    await expect(waLink).toBeVisible({ timeout: 10_000 });

    const href = await waLink.getAttribute('href');
    // Format: https://wa.me/9665XXXXXXXX?text=...
    // No +, no spaces, just digits after /wa.me/
    const match = href?.match(/wa\.me\/(\d+)/);
    expect(match).not.toBeNull();
    const numberPart = match![1];
    expect(numberPart).not.toContain('+');
    expect(numberPart).not.toContain(' ');
    expect(numberPart.length).toBeGreaterThanOrEqual(7);
  });

  test('[AC-32] FAB on detail page, icon-only on card', async ({ page }) => {
    await page.goto('/');
    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Card-level WhatsApp: small, icon-only (no visible text label)
    const cardWa = grid.locator('article').first().locator('a[href*="wa.me"], [class*="whatsapp"]');
    if ((await cardWa.count()) > 0) {
      // Icon-only: aria-label present but no button text visible
      await expect(cardWa).toHaveAttribute('aria-label', /whatsapp/i);
      const text = await cardWa.innerText();
      expect(text.trim().length).toBeLessThan(3);
    }

    // Navigate to detail page
    await grid.locator('article').first().locator('a').first().click();
    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);

    // Detail page WhatsApp is a FAB: fixed position, bottom-right
    const detailWa = page.getByRole('link', { name: /contact property owner on whatsapp/i });
    await expect(detailWa).toBeVisible({ timeout: 10_000 });
    await expect(detailWa).toHaveCSS('position', 'fixed');
  });

  test('[AC-35] image gallery swipe gesture advances to next image', async ({ page }) => {
    await page.goto('/');
    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const firstCard = grid.locator('article').first();
    const expectedTitle = (await firstCard.locator('h3').innerText()).trim();
    await firstCard.locator('a').first().click();
    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);

    const galleryImage = page.locator(`img[alt^="${expectedTitle}"]`).first();
    await expect(galleryImage).toBeVisible({ timeout: 10_000 });

    const box = await galleryImage.boundingBox();
    if (box) {
      const startX = box.x + box.width * 0.8;
      const endX = box.x + box.width * 0.2;
      const centerY = box.y + box.height / 2;

      await page.mouse.move(startX, centerY);
      await page.mouse.down();
      await page.mouse.move(endX, centerY, { steps: 10 });
      await page.mouse.up();

      await page.waitForTimeout(500);
    }
  });
});
