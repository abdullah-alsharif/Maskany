/**
 * E2E — Email-based login (US2).
 *
 * The login form supports both phone and email OTP flows. This spec
 * validates the email path which was previously untested.
 */
import { expect, test } from '@playwright/test';
import { getLatestOtpCode } from './test-helpers';

const OWNER_EMAIL = 'layla@example.com';

test.describe('Email Login', () => {
  test('email-based OTP login authenticates the user', async ({ page }) => {
    await page.goto('/login');

    // Switch to email mode.
    await page.getByRole('button', { name: 'Use email' }).click();
    await expect(page.getByRole('button', { name: 'Use email' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Fill email and submit.
    await page.getByLabel('Email address').fill(OWNER_EMAIL);
    await page.getByRole('button', { name: 'Send code' }).click();

    await expect(page).toHaveURL(/\/verify-otp$/);

    // Read OTP from DB.
    let code: string | null = null;
    await expect
      .poll(
        async () => {
          code = await getLatestOtpCode(OWNER_EMAIL);
          return code !== null;
        },
        { timeout: 10_000 },
      )
      .toBe(true);
    expect(code).toMatch(/^\d{6}$/);

    // Enter OTP.
    for (let i = 0; i < code!.length; i += 1) {
      await page.getByLabel(`Digit ${i + 1}`).type(code![i]!);
    }

    // Dismiss recovery prompt if present.
    const recoveryButton = page.getByRole('button', { name: "I've saved these codes" });
    try {
      await recoveryButton.waitFor({ timeout: 5_000 });
      await recoveryButton.click();
    } catch {
      // No recovery prompt.
    }

    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

    // Verify authenticated state.
    await page
      .getByRole('link', { name: /profile|account/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByRole('heading', { name: 'Layla Al-Mansouri' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('invalid email shows error', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: 'Use email' }).click();
    await page.getByLabel('Email address').fill('nonexistent@example.com');
    await page.getByRole('button', { name: 'Send code' }).click();

    // Should show error or stay on login page.
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
  });
});
