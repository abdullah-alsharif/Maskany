/**
 * E2E — Auth flow (T-033, PRD §2.2, §2.3).
 *
 * An unauthenticated visit to /profile shows the sign-in CTA. From there
 * the user can navigate to /login, submit a phone number for one of the
 * seeded users (browser-khalid, +966501111004), and land on the OTP
 * verification page. We then read the issued OTP straight from the test
 * database (since the SMS service only logs in non-production), submit it,
 * and assert we end up on the home page authenticated. Finally we navigate
 * to /profile and confirm the seeded user's name is now visible.
 */
import { expect, test } from '@playwright/test';
import { getLatestOtpCode } from './test-helpers';

const SEED_USER_FULL_NAME = 'Khalid Rahman';
const SEED_USER_COUNTRY_CODE = '+966';
const SEED_USER_PHONE_LOCAL = '501111004';
const SEED_USER_FULL_PHONE = `${SEED_USER_COUNTRY_CODE}${SEED_USER_PHONE_LOCAL}`;

test.describe.serial('Auth flow', () => {
  test('unauthenticated profile surfaces a sign-in CTA that opens the login page', async ({
    page,
  }) => {
    await page.goto('/profile');

    await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible();
    const signInLink = page.getByRole('link', { name: 'Sign in' });
    await expect(signInLink).toBeVisible();

    await signInLink.click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  });

  test('submitting a seeded phone number reaches the OTP page and verification authenticates', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Country code').selectOption(SEED_USER_COUNTRY_CODE);
    await page.getByLabel('Phone number').fill(SEED_USER_PHONE_LOCAL);
    await page.getByRole('button', { name: 'Send code' }).click();

    await expect(page).toHaveURL(/\/verify-otp$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Enter the code' })).toBeVisible();
    await expect(page.getByText(SEED_USER_FULL_PHONE)).toBeVisible();

    // Pull the issued OTP straight from the test database — sendSms only
    // logs (masked) in non-production, so the DB is the only place the
    // plaintext code lives during a test run.
    let code: string | null = null;
    await expect
      .poll(
        async () => {
          code = await getLatestOtpCode(SEED_USER_FULL_PHONE);
          return code !== null;
        },
        { timeout: 10_000 },
      )
      .toBe(true);
    expect(code).toMatch(/^\d{6}$/);

    // Type each digit into the corresponding numbered input.
    for (let i = 0; i < code!.length; i += 1) {
      await page.getByLabel(`Digit ${i + 1}`).type(code![i]!);
    }

    // After verification the app navigates to "/" — confirm we're signed in
    // by visiting the profile page and finding the seeded user's name.
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

    await page.goto('/profile');
    await expect(page.getByText(SEED_USER_FULL_NAME)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(SEED_USER_FULL_PHONE)).toBeVisible();
  });
});
