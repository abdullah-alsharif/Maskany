import { goto } from './test-helpers';
import { expect, test } from '@playwright/test';

test.describe('Language on form pages', () => {
  test('login form labels switch to Arabic', async ({ page }) => {
    await goto(page, '/');
    await page.getByRole('button', { name: 'التبديل إلى العربية' }).click();
    await expect(page.getByRole('button', { name: 'Switch to English' })).toBeVisible();

    await goto(page, '/login');
    await expect(page.getByText(/تسجيل الدخول/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/رقم الهاتف|رقم الجوال/i)).toBeVisible();
  });

  test('register form labels switch to Arabic', async ({ page }) => {
    await goto(page, '/');
    await page.getByRole('button', { name: 'التبديل إلى العربية' }).click();
    await expect(page.getByRole('button', { name: 'Switch to English' })).toBeVisible();

    await goto(page, '/register');
    await expect(page.getByRole('heading', { name: 'إنشاء حساب' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/الاسم الكامل/i)).toBeVisible();
  });

  test('verify-otp page labels switch to Arabic', async ({ page }) => {
    await goto(page, '/');
    await page.getByRole('button', { name: 'التبديل إلى العربية' }).click();
    await expect(page.getByRole('button', { name: 'Switch to English' })).toBeVisible();

    await goto(page, '/login');
    await page.getByLabel(/رمز الدولة|Country code/).selectOption('+966');
    await page.getByLabel(/رقم الهاتف|Phone number/).fill('501111001');
    await page.getByRole('button', { name: 'إرسال الرمز' }).click();
    await expect(page).toHaveURL(/\/verify-otp$/);

    await expect(page.getByText(/أدخل الرمز/i)).toBeVisible({ timeout: 10_000 });
  });
});
