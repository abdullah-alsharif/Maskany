/**
 * E2E — Property detail + WhatsApp (T-033, PRD §3.4).
 *
 * Asserts the PRD-visible blocks: hero image gallery, specs row (bedrooms /
 * bathrooms / area), amenities, and the WhatsApp `wa.me` deep link.
 */
import { goto, openSeedProperty } from './test-helpers';
import { expect, test } from '@playwright/test';
import { SEED_PROPERTY_TITLES } from './test-fixtures';

test.describe('PRD §3.4 — Property Detail View', () => {
  test('[AC-16] displays the required fields: title, gallery, specs, amenities, and WhatsApp FAB', async ({
    page,
  }) => {
    await goto(page, '/');

    // Seeded card — grid card 1 may be a fixture property deleted mid-run.
    const expectedTitle = SEED_PROPERTY_TITLES[0];
    await openSeedProperty(page, expectedTitle);

    await expect(page.getByRole('heading', { level: 1, name: expectedTitle })).toBeVisible({
      timeout: 15_000,
    });

    const galleryImage = page.getByRole('img', { name: new RegExp(`^${expectedTitle}`) }).first();
    await expect(galleryImage).toBeVisible();

    const specs = page.getByLabel('Property specifications');
    await expect(specs).toBeVisible();
    await expect(specs).toContainText(/bedroom/i);
    await expect(specs).toContainText(/bathroom/i);
    await expect(specs).toContainText('m²');

    await expect(page.getByRole('heading', { name: 'Amenities' })).toBeVisible();

    const whatsappFab = page.getByRole('link', {
      name: /contact property owner on whatsapp/i,
    });
    await expect(whatsappFab).toBeVisible();
    await expect(whatsappFab).toHaveAttribute('href', /^https:\/\/wa\.me\/\d{7,15}\?text=/);
  });

  test('[AC-30] WhatsApp FAB opens wa.me deep link with pre-filled message', async ({ page }) => {
    await goto(page, '/');

    const expectedTitle = SEED_PROPERTY_TITLES[0];
    await openSeedProperty(page, expectedTitle);

    const waLink = page.getByRole('link', { name: /contact property owner on whatsapp/i });
    await expect(waLink).toBeVisible({ timeout: 10_000 });

    // 7–15 digits enforce international format (no +, no spaces).
    await expect(waLink).toHaveAttribute('href', /^https:\/\/wa\.me\/\d{7,15}\?text=/);

    const href = (await waLink.getAttribute('href')) ?? '';
    const message = decodeURIComponent(href.split('text=')[1] ?? '');
    expect(message).toContain(expectedTitle);
    expect(message).toMatch(/maskany/i);
  });

  test('[AC-31] WhatsApp number is in international format (no +, no spaces)', async ({ page }) => {
    await goto(page, '/');
    await openSeedProperty(page, SEED_PROPERTY_TITLES[0]);

    const waLink = page.getByRole('link', { name: /contact property owner on whatsapp/i });
    await expect(waLink).toBeVisible({ timeout: 10_000 });

    // The regex requires 7–15 digits right after wa.me/ (no +, no spaces).
    await expect(waLink).toHaveAttribute('href', /^https:\/\/wa\.me\/\d{7,15}\?text=/);
  });

  test('[AC-32] FAB on detail page, icon-only on card', async ({ page }) => {
    await goto(page, '/');
    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Card-level WhatsApp is icon-only — assert no visible text label.
    const card = grid.getByRole('article').filter({ hasText: SEED_PROPERTY_TITLES[0] });
    const cardWa = card.getByRole('link', { name: /contact on whatsapp/i });
    await expect(cardWa).toBeVisible({ timeout: 10_000 });
    const text = await cardWa.innerText();
    expect(text.trim()).toBe('');

    await openSeedProperty(page, SEED_PROPERTY_TITLES[0]);

    // Detail page renders the full WhatsApp FAB.
    const detailWa = page.getByRole('link', { name: /contact property owner on whatsapp/i });
    await expect(detailWa).toBeVisible({ timeout: 10_000 });
  });

  test('[AC-35] image gallery swipe gesture advances to next image', async ({ page }) => {
    await goto(page, '/');

    // Seeded card — has 3 photos and is never deleted mid-run.
    const expectedTitle = SEED_PROPERTY_TITLES[0];
    await openSeedProperty(page, expectedTitle);

    const galleryImage = page.getByRole('img', { name: new RegExp(`^${expectedTitle}`) }).first();
    await expect(galleryImage).toBeVisible({ timeout: 15_000 });

    // Mobile gallery (375px viewport): counter reads "1 / N".
    await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible({ timeout: 10_000 });

    // Swipe left with trusted touch events via CDP.
    const box = await galleryImage.boundingBox();
    expect(box).not.toBeNull();
    const startX = box!.x + box!.width * 0.8;
    const midX = box!.x + box!.width * 0.5;
    const endX = box!.x + box!.width * 0.2;
    const centerY = box!.y + box!.height / 2;

    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: centerY }],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: midX, y: centerY }],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: endX, y: centerY }],
    });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await expect(page.getByText(/^2 \/ \d+$/)).toBeVisible({ timeout: 10_000 });
  });
});
