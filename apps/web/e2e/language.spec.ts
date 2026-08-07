/**
 * E2E — Language toggle (PRD §7.1): the globe button toggles English and
 * Arabic. EN→AR and AR→EN are separate tests so each direction fails on
 * its own.
 */
import { goto } from './test-helpers';
import { expect, test } from '@playwright/test';

test.describe('Language toggle', () => {
  test('globe button switches the UI to Arabic', async ({ page }) => {
    await goto(page, '/');

    // Default English state: the globe's aria-label is the Arabic string.
    const globeButton = page.getByRole('button', { name: 'التبديل إلى العربية' });
    await expect(globeButton).toBeVisible();

    await globeButton.click();

    await expect(page.getByRole('button', { name: 'Switch to English' })).toBeVisible();
  });

  test('globe button switches the UI back to English', async ({ page }) => {
    await goto(page, '/');

    // Switch to Arabic first — the return flip needs the Arabic locale.
    await page.getByRole('button', { name: 'التبديل إلى العربية' }).click();
    await expect(page.getByRole('button', { name: 'Switch to English' })).toBeVisible();

    await page.getByRole('button', { name: 'Switch to English' }).click();
    await expect(page.getByRole('button', { name: 'التبديل إلى العربية' })).toBeVisible();
  });
});
