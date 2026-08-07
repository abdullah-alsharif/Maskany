/**
 * E2E — Language-aware content switching (US12 + US13).
 *
 * Property titles/descriptions switch locale via the profile
 * LanguageSwitcher or home globe button. Tests rely on a DB-seeded
 * Arabic translation on the fixture's property and on seeded owner
 * layla@example.com's listings.
 */
import { expect, test } from './test-fixtures';
import { goto, loginByEmail } from './test-helpers';
import { createTestPropertyArabicTranslation } from './test-data';

test.describe('Language Content Switching', () => {
  test('property detail content switches to Arabic when the language is toggled', async ({
    page,
    ownerWithProperty,
  }) => {
    const { property } = ownerWithProperty;
    await createTestPropertyArabicTranslation({
      propertyId: property.id,
      englishTitle: property.title,
    });

    await goto(page, `/properties/${property.id}`);
    await expect(page.getByRole('heading', { level: 1, name: property.title })).toBeVisible({
      timeout: 10_000,
    });

    await goto(page, '/');
    await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /التبديل/ }).click();

    await goto(page, `/properties/${property.id}`);

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
  });

  test('toggling back to English restores the English title', async ({
    page,
    ownerWithProperty,
  }) => {
    const { property } = ownerWithProperty;
    await createTestPropertyArabicTranslation({
      propertyId: property.id,
      englishTitle: property.title,
    });

    // The return flip needs the Arabic locale active first.
    await goto(page, '/');
    await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /التبديل/ }).click();
    await expect(page.getByRole('button', { name: 'Switch to English' })).toBeVisible();

    await goto(page, `/properties/${property.id}`);
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

    await goto(page, '/');
    await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Switch to English' }).click();

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
    // layla@example.com (seeded owner, seed.ts) is the only fixture whose
    // listings carry Arabic translations; her email is unique to this spec.
    await loginByEmail(page, 'layla@example.com');

    await goto(page, '/my-properties');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });

    const firstTitle = page.getByRole('article').first().getByRole('heading', { level: 3 });
    await expect(firstTitle).toBeVisible({ timeout: 10_000 });
    const englishTitle = (await firstTitle.innerText()).trim();

    await goto(page, '/');
    await page.getByRole('button', { name: /التبديل/ }).click();

    await goto(page, '/my-properties');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });

    await expect
      .poll(
        async () => {
          const text = await firstTitle.innerText();
          return /[\u0600-\u06FF]/.test(text) && text !== englishTitle;
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    await goto(page, '/');
    await page.getByRole('button', { name: 'Switch to English' }).click();
  });
});
