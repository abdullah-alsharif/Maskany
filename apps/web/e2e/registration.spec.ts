/**
 * E2E — User registration (PRD §2.1): registers a fresh browser-type user via
 * the UI (phone derived from the test id so parallel runs never collide),
 * enters the DB-issued OTP, and deletes the account afterwards to keep the
 * database baseline clean.
 */
import { expect, test } from './test-fixtures';
import { goto, submitOtpFromDb } from './test-helpers';
import { deleteTestUserByPhone } from './test-data';

test.describe('Registration', () => {
  test('register a new browser user via the create-account flow', async ({ page, uniqueData }) => {
    const fullName = `${uniqueData.fullName} Registered`;
    const fullPhone = uniqueData.phone;

    try {
      await goto(page, '/profile');

      await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible();
      const signInLink = page.getByRole('link', { name: 'Sign in' });
      await expect(signInLink).toBeVisible();
      await signInLink.click();
      await expect(page).toHaveURL(/\/login$/);

      const createAccountLink = page.getByRole('link', { name: 'Create account' });
      await expect(createAccountLink).toBeVisible();
      await createAccountLink.click();
      await expect(page).toHaveURL(/\/register$/);

      await expect(page.getByRole('heading', { level: 1, name: 'Create account' })).toBeVisible();
      await page.getByLabel('Full name').fill(fullName);
      await page.getByLabel('Country code').selectOption(uniqueData.countryCode);
      await page.getByLabel('Phone number').fill(uniqueData.phoneLocal);
      await page.getByLabel('Email (optional)').fill(uniqueData.email);

      // BROWSER is the form's default user type — nothing to select.
      await page.getByRole('button', { name: 'Create account' }).click();

      await expect(page).toHaveURL(/\/verify-otp$/);

      await submitOtpFromDb(page, fullPhone);

      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

      await goto(page, '/profile');
      await expect(page.getByText(fullName)).toBeVisible({ timeout: 10_000 });
    } finally {
      // Clean up so the next run starts from the baseline seed, even on failure.
      await deleteTestUserByPhone(fullPhone);
    }
  });
});
