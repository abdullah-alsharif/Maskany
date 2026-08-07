import { goto } from './test-helpers';
import { expect, test } from '@playwright/test';

test.describe('Language persistence', () => {
  test('switching to Arabic survives a full page reload', async ({ page }) => {
    await goto(page, '/');

    await page.getByRole('button', { name: 'التبديل إلى العربية' }).click();
    await expect(page.getByRole('button', { name: 'Switch to English' })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/$/);

    await expect(page.getByRole('button', { name: 'Switch to English' })).toBeVisible();
  });

  test('switching to English after Arabic survives reload', async ({ page }) => {
    await goto(page, '/');

    await page.getByRole('button', { name: 'التبديل إلى العربية' }).click();
    await expect(page.getByRole('button', { name: 'Switch to English' })).toBeVisible();

    await page.getByRole('button', { name: 'Switch to English' }).click();
    await expect(page.getByRole('button', { name: 'التبديل إلى العربية' })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'التبديل إلى العربية' })).toBeVisible();
  });

  test('Arabic mode applies RTL direction to the document', async ({ page }) => {
    await goto(page, '/');

    await page.getByRole('button', { name: 'التبديل إلى العربية' }).click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('dir')))
      .toBe('rtl');

    await page.getByRole('button', { name: 'Switch to English' }).click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('dir')))
      .toBe('ltr');
  });
});
