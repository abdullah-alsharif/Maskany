/**
 * Shared helpers for the Playwright E2E suite (T-033, PRD §8.3).
 *
 * Intentionally lean: the helpers expose only the functions individual specs
 * need (latest-OTP lookup, login helper) so each spec stays focused on the
 * user journey rather than test plumbing.
 *
 * The OTP lookup talks to the test PostgreSQL database directly via the
 * shared `pg` Pool so it observes whatever the API just wrote — without
 * relying on stdout scraping. This keeps the auth flow spec deterministic
 * even when SMS log lines change format.
 */
import { expect, type Page } from '@playwright/test';
import { Pool } from 'pg';

export const TEST_API_PORT = 3099;
export const TEST_WEB_PORT = 5199;
export const TEST_DATABASE_URL =
  'postgresql://maskany_test:maskany_test_pass@localhost:5433/maskany_test?schema=public';
export const TEST_API_URL = `http://localhost:${TEST_API_PORT}/api`;
export const TEST_WEB_URL = `http://localhost:${TEST_WEB_PORT}`;

let cachedPool: Pool | null = null;

function getPool(): Pool {
  if (cachedPool === null) {
    cachedPool = new Pool({ connectionString: TEST_DATABASE_URL, max: 2 });
  }
  return cachedPool;
}

/**
 * Fetch the most recently issued, still-live OTP for `identifier`. Returns
 * `null` when no matching row exists (the caller should fail the test loudly
 * in that case — it indicates the API never wrote one).
 */
export async function getLatestOtpCode(identifier: string): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query<{ code: string }>(
    `SELECT code
       FROM otp_codes
      WHERE identifier = $1
        AND verified = false
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1`,
    [identifier],
  );
  if (result.rows.length === 0) return null;
  return result.rows[0]!.code;
}

/**
 * Close the cached Pool so the test process exits cleanly. Called from the
 * global teardown.
 */
export async function closeTestHelperPool(): Promise<void> {
  if (cachedPool !== null) {
    await cachedPool.end();
    cachedPool = null;
  }
}

/**
 * Log in as an existing seeded user via the OTP flow.
 * Navigates to /login, submits the phone number, reads the OTP from the DB,
 * types it into the verify-otp page, and waits for redirect to the home page.
 */
export async function loginAsUser(page: Page, countryCode: string, phoneLocal: string): Promise<void> {
  const fullPhone = `${countryCode}${phoneLocal}`;

  await page.goto('/login');
  await page.getByLabel('Country code').selectOption(countryCode);
  await page.getByLabel('Phone number').fill(phoneLocal);
  await page.getByRole('button', { name: 'Send code' }).click();

  await expect(page).toHaveURL(/\/verify-otp$/);

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

  // After OTP verification the API may prompt the user to save recovery
  // codes for first-time login. Dismiss it if present.
  const recoveryButton = page.getByRole('button', { name: "I've saved these codes" });
  try {
    await recoveryButton.waitFor({ timeout: 5_000 });
    await recoveryButton.click();
  } catch {
    // No recovery prompt — proceed.
  }

  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
}
