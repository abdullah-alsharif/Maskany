/**
 * E2E — Auth flow (T-033, PRD §2.2, §2.3).
 *
 * An unauthenticated visit to /profile shows the sign-in CTA. From there
 * the user can navigate to /login, submit a phone number for a fresh
 * per-test user, and land on the OTP verification page. We then read the
 * issued OTP straight from the test database (since the SMS service only
 * logs in non-production), submit it, and assert we end up on the home
 * page authenticated. Finally we navigate to /profile and confirm the
 * user's name is now visible.
 *
 * Each test owns a fresh user via the `browserUser` fixture, so this spec
 * is safe to run in parallel with any other spec.
 */
import { expect, test } from './test-fixtures';
import { goto, getLatestOtpCode } from './test-helpers';

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

  test('submitting a phone number reaches the OTP page and verification authenticates', async ({
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

    let code: string | null = null;
    await expect
      .poll(
        async () => {
          code = await getLatestOtpCode(browserUser.phone);
          return code !== null;
        },
        { timeout: 10_000 },
      )
      .toBe(true);
    expect(code).toMatch(/^\d{6}$/);

    for (let i = 0; i < code!.length; i += 1) {
      await page.getByLabel(`Digit ${i + 1}`).type(code![i]!);
    }

    // After verification the app navigates to "/" — confirm we're signed in
    // by visiting the profile page and finding the fresh user's name.
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

    await goto(page, '/profile');
    await expect(page.getByText(browserUser.fullName)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(browserUser.phone)).toBeVisible();
  });
});
