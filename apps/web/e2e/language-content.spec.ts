/**
 * E2E — Language-aware content switching (US12 + US13).
 *
 * Validates that property content (titles, descriptions) switches between
 * English and Arabic when the user toggles the language. The LanguageSwitcher
 * is on the profile page; the globe button is on the home page.
 *
 * The first test uses its own property with a DB-seeded Arabic translation,
 * so it never depends on which card happens to render first in a parallel
 * run. The second test uses the seeded owner's email channel (a unique
 * identifier no other spec touches).
 */
import { expect, test } from './test-fixtures';
import { goto, loginByEmail } from './test-helpers';
import { createTestPropertyArabicTranslation } from './test-data';

test.describe('Language Content Switching', () => {
  test('property detail content switches on language toggle', async ({
    page,
    ownerWithProperty,
  }) => {
    const { property } = ownerWithProperty;
    await createTestPropertyArabicTranslation({
      propertyId: property.id,
      englishTitle: property.title,
    });

    // Navigate to detail page and verify English title.
    await goto(page, `/properties/${property.id}`);
    await expect(page.getByRole('heading', { level: 1, name: property.title })).toBeVisible({
      timeout: 10_000,
    });

    // Switch to Arabic via home page globe button.
    await goto(page, '/');
    await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /التبديل/ }).click();

    // Navigate back to the same property detail.
    await goto(page, `/properties/${property.id}`);

    // Wait for content to update — the h1 should contain Arabic characters.
    await expect
      .poll(
        async () => {
          const h1 = page.getByRole('heading', { level: 1 });
          const text = await h1.innerText();
          return /[\u0600-\u06FF]/.test(text);
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    // Switch back to English via home page globe button.
    await goto(page, '/');
    await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Switch to English' }).click();

    // Navigate back to the property and verify English title is restored.
    await goto(page, `/properties/${property.id}`);
    await expect
      .poll(
        async () => {
          const h1 = page.getByRole('heading', { level: 1 });
          const text = await h1.innerText();
          return text === property.title;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });

  test('my-properties page shows translated titles', async ({ page }) => {
    // The seeded owner's email is unique to this spec — no parallel
    // collisions on the OTP identifier.
    await loginByEmail(page, 'layla@example.com');

    // Navigate to my-properties.
    await goto(page, '/my-properties');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });

    // Record an English title.
    const firstTitle = page.locator('article').first().locator('h3');
    await expect(firstTitle).toBeVisible({ timeout: 10_000 });
    const englishTitle = (await firstTitle.innerText()).trim();

    // Switch to Arabic via home page globe button.
    await goto(page, '/');
    await page.getByRole('button', { name: /التبديل/ }).click();

    // Go back to my-properties.
    await goto(page, '/my-properties');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });

    // Wait for title to change to Arabic.
    await expect
      .poll(
        async () => {
          const text = await firstTitle.innerText();
          return /[\u0600-\u06FF]/.test(text) && text !== englishTitle;
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    // Switch back to English via home page globe button.
    await goto(page, '/');
    await page.getByRole('button', { name: 'Switch to English' }).click();
  });
});
