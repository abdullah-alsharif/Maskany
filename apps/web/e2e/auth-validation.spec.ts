/**
 * E2E — Auth validation (PRD §2.1-§2.4).
 *
 * Registration and OTP edge cases plus role guards. Uses a seeded phone only
 * to prove duplicate registration (no OTP is issued); authenticated flows use
 * fresh per-test users so parallel runs never race on OTP codes or rate limits.
 */
import { expect, test } from './test-fixtures';
import { getPool, goto, getLatestOtpCode, loginAsTestUser, appAlert } from './test-helpers';

// Seeded phone, never issued an OTP — safe to share with read-only specs.
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

    await expect(appAlert(page)).toBeVisible({ timeout: 10_000 });
    await expect(appAlert(page)).toContainText(/could not create|already|exists|registered/i);
  });

  test('registering with an empty name shows validation error', async ({ page, uniqueData }) => {
    await goto(page, '/register');

    await page.getByLabel('Country code').selectOption(uniqueData.countryCode);
    await page.getByLabel('Phone number').fill(uniqueData.phoneLocal);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(appAlert(page)).toContainText(/full name/i, {
      timeout: 5_000,
    });
  });

  test('registering with an empty phone shows validation error', async ({ page }) => {
    await goto(page, '/register');

    await page.getByLabel('Full name').fill('No Phone User');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(appAlert(page)).toContainText(/phone/i, { timeout: 5_000 });
  });

  test('registering with an invalid email shows validation error', async ({ page, uniqueData }) => {
    await goto(page, '/register');

    await page.getByLabel('Full name').fill(uniqueData.fullName);
    await page.getByLabel('Country code').selectOption(uniqueData.countryCode);
    await page.getByLabel('Phone number').fill(uniqueData.phoneLocal);
    await page.getByLabel('Email (optional)').fill('not-an-email');
    await page.getByRole('button', { name: 'Create account' }).click();

    // The register form maps the malformed email to a generic account error.
    await expect(appAlert(page)).toHaveText(/could not create your account/i, {
      timeout: 5_000,
    });
  });
});

test.describe('OTP validation', () => {
  test('submitting an invalid OTP code shows an error', async ({
    page,
    // Fixture side-effect: the user must exist for the OTP to be issued.
    browserUser: _browserUser,
    uniqueData,
  }) => {
    await goto(page, '/login');

    await page.getByLabel('Country code').selectOption(uniqueData.countryCode);
    await page.getByLabel('Phone number').fill(uniqueData.phoneLocal);
    await page.getByRole('button', { name: 'Send code' }).click();

    await expect(page).toHaveURL(/\/verify-otp$/);

    for (let i = 0; i < 6; i += 1) {
      await page.getByLabel(`Digit ${i + 1}`).pressSequentially('9');
    }

    await expect(appAlert(page)).toBeVisible({ timeout: 10_000 });
    // The verify page maps failed attempts to "That code didn't match."
    await expect(appAlert(page)).toContainText(/didn'?t match/i);

    // The wrong code must not have verified the pending OTP row.
    const pool = getPool();
    const result = await pool.query<{ verified: boolean }>(
      `SELECT verified
         FROM otp_codes
        WHERE identifier = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [uniqueData.phone],
    );
    expect(result.rows[0]?.verified).toBe(false);
  });

  test('login for an unregistered phone shows an error and issues no OTP', async ({
    page,
    uniqueData,
  }) => {
    await goto(page, '/login');
    await page.getByLabel('Country code').selectOption(uniqueData.countryCode);
    await page.getByLabel('Phone number').fill(uniqueData.phoneLocal);
    await page.getByRole('button', { name: 'Send code' }).click();

    await expect(appAlert(page)).toBeVisible({ timeout: 10_000 });
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

  test('browser-type user visiting /my-properties is redirected to home', async ({
    page,
    browserUser,
  }) => {
    await loginAsTestUser(page, browserUser.phone);

    await goto(page, '/my-properties');
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
  });
});
