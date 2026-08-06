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

/**
 * Shared PG Pool for the test database. Exported so the test-data layer
 * (user/property/review creation) uses the same connection pool as the OTP
 * helper — one pool per Playwright worker, closed in global teardown.
 */
export function getPool(): Pool {
  if (cachedPool === null) {
    cachedPool = new Pool({ connectionString: TEST_DATABASE_URL, max: 4 });
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
 * Dismiss the AI writing-assistant consent dialog if it is open.
 *
 * The create/edit property pages auto-open the dialog on first visit when
 * `localStorage['ai-consent']` is absent. Fresh E2E contexts never have it,
 * so tests that drive the multi-step property form must accept (or decline)
 * consent once per test — localStorage then persists for later navigations.
 */
export async function acceptAiConsent(page: Page): Promise<void> {
  try {
    await page.getByRole('heading', { name: 'AI Writing Assistant' }).waitFor({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Accept' }).click();
  } catch {
    // Dialog not present — proceed.
  }
}

/**
 * Log in as an existing seeded user via the OTP flow.
 * Navigates to /login, submits the phone number, reads the OTP from the DB,
 * types it into the verify-otp page, and waits for redirect to the home page.
 */
export async function loginAsUser(
  page: Page,
  countryCode: string,
  phoneLocal: string,
): Promise<void> {
  const fullPhone = `${countryCode}${phoneLocal}`;

  await page.goto('/login');
  await page.getByLabel('Country code').selectOption(countryCode);
  await page.getByLabel('Phone number').fill(phoneLocal);
  await page.getByRole('button', { name: 'Send code' }).click();

  await expect(page).toHaveURL(/\/verify-otp$/);

  await submitOtpFromDb(page, fullPhone);
  await dismissRecoveryPrompt(page);

  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
}

/**
 * Log in through the email OTP channel (login page email mode).
 */
export async function loginByEmail(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Use email' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();

  await expect(page).toHaveURL(/\/verify-otp$/);

  await submitOtpFromDb(page, email);
  await dismissRecoveryPrompt(page);

  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
}

/**
 * Log in as a user that already exists (e.g. one created by the
 * `browserUser` / `ownerUser` fixtures). Accepts the full E.164 phone and
 * splits it into the country-code + local parts the login form expects.
 * The API rejects logins for unknown identifiers, so callers must create
 * the user first — the fixtures do this automatically.
 */
export async function loginAsTestUser(page: Page, fullPhone: string): Promise<void> {
  const countryCode = fullPhone.slice(0, 4);
  const phoneLocal = fullPhone.slice(4);
  await loginAsUser(page, countryCode, phoneLocal);
}

/**
 * Poll the test database for the latest live OTP for `identifier`, type it
 * into the numbered digit inputs, and wait for verification to land.
 */
export async function submitOtpFromDb(page: Page, identifier: string): Promise<void> {
  let code: string | null = null;
  await expect
    .poll(
      async () => {
        code = await getLatestOtpCode(identifier);
        return code !== null;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  expect(code).toMatch(/^\d{6}$/);

  for (let i = 0; i < code!.length; i += 1) {
    await page.getByLabel(`Digit ${i + 1}`).type(code![i]!);
  }
}

/**
 * Dismiss the recovery-codes prompt that appears on first-time logins, if
 * it shows up at all.
 */
export async function dismissRecoveryPrompt(page: Page): Promise<void> {
  const recoveryButton = page.getByRole('button', { name: "I've saved these codes" });
  try {
    await recoveryButton.waitFor({ timeout: 5_000 });
    await recoveryButton.click();
  } catch {
    // No recovery prompt — proceed.
  }
}

/**
 * Navigate to an app route with resilience to one-shot dev-server navigation
 * races. Under `next dev` compilation/HMR storms the server can abort a
 * `page.goto` (`net::ERR_ABORTED`) before it commits — a transient race that
 * a plain `goto` never survives. Re-issue the navigation when that happens,
 * up to 3 attempts. Any other navigation outcome (timeout, real HTTP error)
 * is thrown to the caller immediately — this only masks the abort race.
 */
export async function goto(page: Page, url: string, options?: { timeout?: number }): Promise<void> {
  const timeout = options?.timeout ?? 30_000;
  for (let attempt = 1; ; attempt += 1) {
    try {
      await page.goto(url, { timeout });
      return;
    } catch (err) {
      const message = String(err);
      if (!message.includes('ERR_ABORTED')) throw err;
      if (attempt >= 3) throw err;
      await page.waitForTimeout(1_000 * attempt);
    }
  }
}
