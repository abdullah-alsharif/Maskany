/**
 * E2E — User registration (PRD §2.1).
 *
 * Registers a fresh browser-type user with a unique phone number, enters
 * the OTP from the database, and confirms the profile page shows the
 * newly-created account details. The phone number is derived from the
 * test id so parallel runs (and reruns) never collide, and the created
 * account is deleted afterwards to keep the database baseline clean.
 */
import { expect, test } from './test-fixtures';
import { goto, getLatestOtpCode } from './test-helpers';
import { deleteTestUserByPhone } from './test-data';

test.describe('Registration', () => {
  test('register a new browser user via the create-account flow', async ({ page, uniqueData }) => {
    const fullName = `${uniqueData.fullName} Registered`;
    const fullPhone = uniqueData.phone;

    await goto(page, '/profile');

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
    await page.getByLabel('Full name').fill(fullName);
    await page.getByLabel('Country code').selectOption(uniqueData.countryCode);
    await page.getByLabel('Phone number').fill(uniqueData.phoneLocal);
    await page.getByLabel('Email (optional)').fill(uniqueData.email);

    // Default user type is BROWSER — keep it selected.
    await page.getByRole('button', { name: 'Create account' }).click();

    // Should reach the OTP verification page.
    await expect(page).toHaveURL(/\/verify-otp$/);

    // Pull the OTP from the database.
    let code: string | null = null;
    await expect
      .poll(
        async () => {
          code = await getLatestOtpCode(fullPhone);
          return code !== null;
        },
        { timeout: 10_000 },
      )
      .toBe(true);
    expect(code).toMatch(/^\d{6}$/);

    for (let i = 0; i < code!.length; i += 1) {
      await page.getByLabel(`Digit ${i + 1}`).type(code![i]!);
    }

    // After verification we land on the home page.
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

    // Visit profile and confirm the registered user's name is shown.
    await goto(page, '/profile');
    await expect(page.getByText(fullName)).toBeVisible({ timeout: 10_000 });

    // Clean up the account so the next run starts from the baseline seed.
    await deleteTestUserByPhone(fullPhone);
  });
});
