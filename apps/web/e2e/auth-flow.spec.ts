/**
 * E2E — Auth flow (T-033, PRD §2.2, §2.3).
 *
 * Sign-in CTA → /login → OTP page; the issued OTP is read from the test
 * DB (SMS only logs in non-production). Each test owns a fresh user via
 * the `browserUser` fixture, so parallel runs are safe.
 */
import { expect, test } from './test-fixtures';
import { goto, submitOtpFromDb } from './test-helpers';

test.describe('Auth flow', () => {
  test('unauthenticated profile surfaces a sign-in CTA that opens the login page', async ({
    page,
  }) => {
    await goto(page, '/profile');

    await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible();
    const signInLink = page.getByRole('link', { name: 'Sign in' });
    await expect(signInLink).toBeVisible();

    await signInLink.click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  });

  test('submitting a phone number reaches the OTP page', async ({
    page,
    browserUser,
    uniqueData,
  }) => {
    await goto(page, '/login');

    await page.getByLabel('Country code').selectOption(uniqueData.countryCode);
    await page.getByLabel('Phone number').fill(uniqueData.phoneLocal);
    await page.getByRole('button', { name: 'Send code' }).click();

    await expect(page).toHaveURL(/\/verify-otp$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Enter the code' })).toBeVisible();
    await expect(page.getByText(browserUser.phone)).toBeVisible();
  });

  test('entering the issued OTP authenticates the user', async ({
    page,
    browserUser,
    uniqueData,
  }) => {
    await goto(page, '/login');

    await page.getByLabel('Country code').selectOption(uniqueData.countryCode);
    await page.getByLabel('Phone number').fill(uniqueData.phoneLocal);
    await page.getByRole('button', { name: 'Send code' }).click();

    await expect(page).toHaveURL(/\/verify-otp$/);

    await submitOtpFromDb(page, browserUser.phone);

    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

    await goto(page, '/profile');
    await expect(page.getByText(browserUser.fullName)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(browserUser.phone)).toBeVisible();
  });
});
