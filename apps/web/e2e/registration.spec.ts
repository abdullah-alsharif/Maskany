/**
 * E2E — User registration (PRD §2.1).
 *
 * Registers a fresh browser-type user with a unique phone number, enters
 * the OTP from the database, and confirms the profile page shows the
 * newly-created account details.
 */
import { expect, test } from '@playwright/test';
import { getLatestOtpCode } from './test-helpers';

const FULL_NAME = 'Test Register User';
const COUNTRY_CODE = '+966';
const PHONE_LOCAL = '502000001';
const FULL_PHONE = `${COUNTRY_CODE}${PHONE_LOCAL}`;
const EMAIL = 'testregister@example.com';

test.describe.serial('Registration', () => {
  test('register a new browser user via the create-account flow', async ({ page }) => {
    await page.goto('/profile');

    // Unauthenticated profile shows a "Sign in" link → navigate to /login.
    await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible();
    const signInLink = page.getByRole('link', { name: 'Sign in' });
    await expect(signInLink).toBeVisible();
    await signInLink.click();
    await expect(page).toHaveURL(/\/login$/);

    // The login page has a "Create account" link.
    const createAccountLink = page.getByRole('link', { name: 'Create account' });
    await expect(createAccountLink).toBeVisible();
    await createAccountLink.click();
    await expect(page).toHaveURL(/\/register$/);

    // Fill the registration form.
    await expect(page.getByRole('heading', { level: 1, name: 'Create account' })).toBeVisible();
    await page.getByLabel('Full name').fill(FULL_NAME);
    await page.getByLabel('Country code').selectOption(COUNTRY_CODE);
    await page.getByLabel('Phone number').fill(PHONE_LOCAL);
    await page.getByLabel('Email (optional)').fill(EMAIL);

    // Default user type is BROWSER — keep it selected.
    await page.getByRole('button', { name: 'Create account' }).click();

    // Should reach the OTP verification page.
    await expect(page).toHaveURL(/\/verify-otp$/);

    // Pull the OTP from the database.
    let code: string | null = null;
    await expect
      .poll(
        async () => {
          code = await getLatestOtpCode(FULL_PHONE);
          return code !== null;
        },
        { timeout: 10_000 },
      )
      .toBe(true);
    expect(code).toMatch(/^\d{6}$/);

    for (let i = 0; i < code!.length; i += 1) {
      await page.getByLabel(`Digit ${i + 1}`).type(code![i]!);
    }

    // Dismiss the recovery-codes prompt if the API shows one.
    const recoveryButton = page.getByRole('button', { name: "I've saved these codes" });
    try {
      await recoveryButton.waitFor({ timeout: 5_000 });
      await recoveryButton.click();
    } catch {
      // No recovery prompt — proceed.
    }

    // After verification we land on the home page.
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

    // Visit profile and confirm the registered user's name is shown.
    await page.goto('/profile');
    await expect(page.getByText(FULL_NAME)).toBeVisible({ timeout: 10_000 });
  });
});
