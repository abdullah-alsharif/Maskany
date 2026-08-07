/**
 * E2E — Email-based login (US2): validates the email OTP path with a fresh
 * per-test user so parallel runs never collide on seeded email accounts.
 */
import { expect, test } from './test-fixtures';
import { goto, loginByEmail, appAlert } from './test-helpers';

test.describe('Email Login', () => {
  test('email-based OTP login authenticates the user', async ({ page, browserUser }) => {
    await loginByEmail(page, browserUser.email!);

    await page.getByRole('link', { name: 'Profile' }).click();
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByRole('heading', { name: browserUser.fullName })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('invalid email shows error', async ({ page }) => {
    await goto(page, '/login');

    await page.getByRole('button', { name: 'Use email' }).click();
    // Fixed literal by design: uniqueData would create an account, breaking
    // the premise that this address has none.
    await page.getByLabel('Email address').fill('nonexistent@example.com');
    await page.getByRole('button', { name: 'Send code' }).click();

    // The API's USER_NOT_FOUND maps to a generic "could not send a code"
    // alert — the underlying message is not surfaced verbatim.
    await expect(appAlert(page)).toHaveText(/could not send a code/i, { timeout: 10_000 });
  });
});
