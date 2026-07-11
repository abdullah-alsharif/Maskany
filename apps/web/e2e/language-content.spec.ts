/**
 * E2E — Language-aware content switching (US12 + US13).
 *
 * Validates that property content (titles, descriptions) switches between
 * English and Arabic when the user toggles the language. The LanguageSwitcher
 * is on the profile page; the globe button is on the home page.
 */
import { expect, test } from '@playwright/test';
import { getLatestOtpCode } from './test-helpers';

test.describe('Language Content Switching', () => {
  test('property detail content switches on language toggle', async ({ page }) => {
    // Go to home and note the first property's English title.
    await page.goto('/');
    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const firstCard = grid.locator('article').first();
    const englishTitle = (await firstCard.locator('h3').innerText()).trim();
    const detailHref = await firstCard.locator('a').first().getAttribute('href');
    expect(detailHref).toBeTruthy();

    // Navigate to detail page and verify English title.
    await firstCard.locator('a').first().click();
    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1, name: englishTitle })).toBeVisible({
      timeout: 10_000,
    });

    // Switch to Arabic via home page globe button.
    await page.goto('/');
    await expect(grid).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /التبديل/ }).click();

    // Navigate back to the same property detail.
    await page.goto(detailHref!);

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
    await page.goto('/');
    await expect(grid).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Switch to English/ }).click();

    // Navigate back to the property and verify English title is restored.
    await page.goto(detailHref!);
    await expect
      .poll(
        async () => {
          const h1 = page.getByRole('heading', { level: 1 });
          const text = await h1.innerText();
          return text === englishTitle;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });

  test('my-properties page shows translated titles', async ({ page }) => {
    // Use email login to avoid shared phone-based rate limiter.
    await page.goto('/login');
    await page.getByRole('button', { name: 'Use email' }).click();
    await page.getByLabel('Email address').fill('layla@example.com');
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page).toHaveURL(/\/verify-otp$/);

    let code: string | null = null;
    await expect
      .poll(
        async () => {
          code = await getLatestOtpCode('layla@example.com');
          return code !== null;
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    for (let i = 0; i < code!.length; i += 1) {
      await page.getByLabel(`Digit ${i + 1}`).type(code![i]!);
    }

    const recoveryButton = page.getByRole('button', { name: "I've saved these codes" });
    try {
      await recoveryButton.waitFor({ timeout: 5_000 });
      await recoveryButton.click();
    } catch {
      // No recovery prompt.
    }

    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

    // Navigate to my-properties.
    await page.goto('/my-properties');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });

    // Record an English title.
    const firstTitle = page.locator('article').first().locator('h3');
    await expect(firstTitle).toBeVisible({ timeout: 10_000 });
    const englishTitle = (await firstTitle.innerText()).trim();

    // Switch to Arabic via home page globe button.
    await page.goto('/');
    await page.getByRole('button', { name: /التبديل/ }).click();

    // Go back to my-properties.
    await page.goto('/my-properties');
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
    await page.goto('/');
    await page.getByRole('button', { name: /Switch to English/ }).click();
  });
});
