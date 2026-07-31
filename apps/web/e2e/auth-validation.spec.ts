import { expect, test } from '@playwright/test';
import { getLatestOtpCode } from './test-helpers';

const EXISTING_PHONE_COUNTRY = '+966';
const EXISTING_PHONE_LOCAL = '501111001';

const FRESH_COUNTRY = '+966';
const FRESH_PHONE = '504000001';

test.describe('Registration validation', () => {
  test('registering with an existing phone number shows an error', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { level: 1, name: 'Create account' })).toBeVisible();

    await page.getByLabel('Full name').fill('Duplicate User');
    await page.getByLabel('Country code').selectOption(EXISTING_PHONE_COUNTRY);
    await page.getByLabel('Phone number').fill(EXISTING_PHONE_LOCAL);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.locator('p[role="alert"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('p[role="alert"]')).toContainText(/could not create|already|exists|registered/i);
  });

  test('registering with an empty name shows validation error', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel('Country code').selectOption(FRESH_COUNTRY);
    await page.getByLabel('Phone number').fill(FRESH_PHONE);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.locator('p[role="alert"]')).toContainText(/full name/i, {
      timeout: 5_000,
    });
  });

  test('registering with an empty phone shows validation error', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel('Full name').fill('No Phone User');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.locator('p[role="alert"]')).toContainText(/phone/i, { timeout: 5_000 });
  });
});

test.describe('OTP validation', () => {
  test('submitting an invalid OTP code shows an error', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Country code').selectOption(EXISTING_PHONE_COUNTRY);
    await page.getByLabel('Phone number').fill(EXISTING_PHONE_LOCAL);
    await page.getByRole('button', { name: 'Send code' }).click();

    await expect(page).toHaveURL(/\/verify-otp$/);

    for (let i = 0; i < 6; i += 1) {
      await page.getByLabel(`Digit ${i + 1}`).type('9');
    }

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Unauthorized access', () => {
  test('guest visiting /my-properties is redirected to login', async ({ page }) => {
    await page.goto('/my-properties');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('guest visiting /properties/create is redirected to login', async ({ page }) => {
    await page.goto('/properties/create');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('guest visiting /insights is redirected to login', async ({ page }) => {
    await page.goto('/insights');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('browser-type user visiting /my-properties is redirected', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Country code').selectOption('+966');
    await page.getByLabel('Phone number').fill('501111004');
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page).toHaveURL(/\/verify-otp$/);

    let code: string | null = null;
    await expect
      .poll(
        async () => {
          code = await getLatestOtpCode('+966501111004');
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

    await page.goto('/my-properties');
    await expect(page).not.toHaveURL(/\/my-properties$/);
  });
});
