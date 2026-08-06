/**
 * E2E — Language toggle (PRD §7.1).
 *
 * The home page has a globe button that toggles between English and Arabic.
 * Clicking it switches the UI language and the button's aria-label updates
 * to reflect the opposite direction.
 */
import { goto } from './test-helpers';
import { expect, test } from '@playwright/test';

test.describe('Language toggle', () => {
  test('toggling the language switcher flips between English and Arabic', async ({ page }) => {
    await goto(page, '/');

    // In the default English state the globe button's aria-label says
    // "التبديل إلى العربية" (Switch to Arabic).
    const globeButton = page.getByRole('button', { name: 'التبديل إلى العربية' });
    await expect(globeButton).toBeVisible();

    // Click to switch to Arabic.
    await globeButton.click();

    // After switching, the button's label changes to "Switch to English".
    await expect(page.getByRole('button', { name: 'Switch to English' })).toBeVisible();

    // Click to switch back to English.
    await page.getByRole('button', { name: 'Switch to English' }).click();
    await expect(page.getByRole('button', { name: 'التبديل إلى العربية' })).toBeVisible();
  });
});
