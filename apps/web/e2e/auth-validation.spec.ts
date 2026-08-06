/**
 * E2E — Auth validation (PRD §2.1-§2.4).
 *
 * Registration and OTP edge cases: duplicate identifiers, empty required
 * fields, invalid OTP codes, and role/authentication guards on protected
 * routes. Tests that need an existing identifier use a seeded phone purely
 * for the duplicate-registration case (no OTP is issued), while every
 * authenticated flow uses a fresh per-test user so parallel runs never
 * race on OTP codes or rate limits.
 */
import { expect, test } from './test-fixtures';
import { goto, getLatestOtpCode, loginAsTestUser } from './test-helpers';

// Seeded owner phone — used only to prove duplicate registration fails.
// No OTP is issued for it, so sharing it with read-only specs is safe.
const EXISTING_PHONE_COUNTRY = '+966';
const EXISTING_PHONE_LOCAL = '501111001';

test.describe('Registration validation', () => {
  test('registering with an existing phone number shows an error', async ({ page }) => {
    await goto(page, '/register');
    await expect(page.getByRole('heading', { level: 1, name: 'Create account' })).toBeVisible();

    await page.getByLabel('Full name').fill('Duplicate User');
    await page.getByLabel('Country code').selectOption(EXISTING_PHONE_COUNTRY);
    await page.getByLabel('Phone number').fill(EXISTING_PHONE_LOCAL);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.locator('p[role="alert"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('p[role="alert"]')).toContainText(
      /could not create|already|exists|registered/i,
    );
  });

  test('registering with an empty name shows validation error', async ({ page, uniqueData }) => {
    await goto(page, '/register');

    await page.getByLabel('Country code').selectOption(uniqueData.countryCode);
    await page.getByLabel('Phone number').fill(uniqueData.phoneLocal);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.locator('p[role="alert"]')).toContainText(/full name/i, {
      timeout: 5_000,
    });
  });

  test('registering with an empty phone shows validation error', async ({ page }) => {
    await goto(page, '/register');

    await page.getByLabel('Full name').fill('No Phone User');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.locator('p[role="alert"]')).toContainText(/phone/i, { timeout: 5_000 });
  });

  test('registering with an invalid email shows validation error', async ({ page, uniqueData }) => {
    await goto(page, '/register');

    await page.getByLabel('Full name').fill(uniqueData.fullName);
    await page.getByLabel('Country code').selectOption(uniqueData.countryCode);
    await page.getByLabel('Phone number').fill(uniqueData.phoneLocal);
    await page.getByLabel('Email (optional)').fill('not-an-email');
    await page.getByRole('button', { name: 'Create account' }).click();

    // The API rejects the malformed email; the register form surfaces a
    // generic error alert.
    await expect(page.locator('p[role="alert"]')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('OTP validation', () => {
  test('submitting an invalid OTP code shows an error', async ({
    page,
    // The user must exist (fixture side-effect) for the OTP request to
    // succeed; the binding itself is unused.
    browserUser: _browserUser,
    uniqueData,
  }) => {
    await goto(page, '/login');

    await page.getByLabel('Country code').selectOption(uniqueData.countryCode);
    await page.getByLabel('Phone number').fill(uniqueData.phoneLocal);
    await page.getByRole('button', { name: 'Send code' }).click();

    await expect(page).toHaveURL(/\/verify-otp$/);

    for (let i = 0; i < 6; i += 1) {
      await page.getByLabel(`Digit ${i + 1}`).type('9');
    }

    await expect(page.locator('p[role="alert"]')).toBeVisible({ timeout: 10_000 });
  });

  test('login for an unregistered phone shows an error and issues no OTP', async ({
    page,
    uniqueData,
  }) => {
    await goto(page, '/login');
    await page.getByLabel('Country code').selectOption(uniqueData.countryCode);
    await page.getByLabel('Phone number').fill(uniqueData.phoneLocal);
    await page.getByRole('button', { name: 'Send code' }).click();

    await expect(page.locator('p[role="alert"]')).toBeVisible({ timeout: 10_000 });
    // The API must not have written an OTP for an unknown identifier.
    const code = await getLatestOtpCode(uniqueData.phone);
    expect(code).toBeNull();
  });
});

test.describe('Unauthorized access', () => {
  test('guest visiting /my-properties is redirected to login', async ({ page }) => {
    await goto(page, '/my-properties');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('guest visiting /properties/create is redirected to login', async ({ page }) => {
    await goto(page, '/properties/create');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('guest visiting /insights is redirected to login', async ({ page }) => {
    await goto(page, '/insights');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('guest visiting a property edit page is redirected to login', async ({ page }) => {
    await goto(page, '/properties/00000000-0000-0000-0000-000000000000/edit');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('browser-type user visiting /my-properties is redirected', async ({ page, browserUser }) => {
    await loginAsTestUser(page, browserUser.phone);

    await goto(page, '/my-properties');
    await expect(page).not.toHaveURL(/\/my-properties$/);
  });
});
