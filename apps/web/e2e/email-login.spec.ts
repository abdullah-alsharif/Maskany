/**
 * E2E — Email-based login (US2).
 *
 * The login form supports both phone and email OTP flows. This spec
 * validates the email path with a fresh per-test user so parallel runs
 * never collide on the seeded email accounts.
 */
import { expect, test } from './test-fixtures';
import { goto, loginByEmail } from './test-helpers';

test.describe('Email Login', () => {
  test('email-based OTP login authenticates the user', async ({ page, browserUser }) => {
    await loginByEmail(page, browserUser.email!);

    // Verify authenticated state.
    await page
      .getByRole('link', { name: /profile|account/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByRole('heading', { name: browserUser.fullName })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('invalid email shows error', async ({ page }) => {
    await goto(page, '/login');

    await page.getByRole('button', { name: 'Use email' }).click();
    await page.getByLabel('Email address').fill('nonexistent@example.com');
    await page.getByRole('button', { name: 'Send code' }).click();

    // Should show error or stay on login page.
    await expect(page.locator('p[role="alert"]')).toBeVisible({ timeout: 10_000 });
  });
});
