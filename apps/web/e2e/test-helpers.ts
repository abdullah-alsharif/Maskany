/**
 * Shared helpers for the E2E suite (T-033, PRD §8.3): the OTP lookup reads
 * the test PostgreSQL database via the shared `pg` Pool, so it observes what
 * the API just wrote without stdout scraping.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { Pool } from 'pg';

export const TEST_API_PORT = 3099;
export const TEST_WEB_PORT = 5199;
export const TEST_DATABASE_URL =
  'postgresql://maskany_test:maskany_test_pass@localhost:5433/maskany_test?schema=public';
export const TEST_API_URL = `http://localhost:${TEST_API_PORT}/api`;
export const TEST_WEB_URL = `http://localhost:${TEST_WEB_PORT}`;

let cachedPool: Pool | null = null;

/** Shared PG Pool for the test database — one per worker, closed in teardown. */
export function getPool(): Pool {
  if (cachedPool === null) {
    cachedPool = new Pool({ connectionString: TEST_DATABASE_URL, max: 4 });
  }
  return cachedPool;
}

/**
 * Latest still-live OTP for `identifier`, or null — the caller should fail
 * loudly, since null means the API never wrote one.
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

export async function closeTestHelperPool(): Promise<void> {
  if (cachedPool !== null) {
    await cachedPool.end();
    cachedPool = null;
  }
}

/**
 * The app's error alerts, excluding Next.js's route-announcer element —
 * otherwise `getByRole('alert')` can resolve to two elements.
 */
export function appAlert(page: Page): Locator {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

/** True only for Playwright TimeoutError — real failures still propagate. */
function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.name === 'TimeoutError';
}

/**
 * Open a seeded property's detail page. Seeded cards are never deleted
 * mid-run, unlike the first grid card, which a parallel test may own.
 */
export async function openSeedProperty(page: Page, title: string): Promise<string> {
  const grid = page.getByTestId('property-grid');
  await expect(grid).toBeVisible({ timeout: 15_000 });
  await grid
    .getByRole('article')
    .filter({ hasText: title })
    .getByRole('link', { name: /view details for/i })
    .click();
  await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);
  return page.url();
}

/**
 * Dismiss the AI consent dialog if open — fresh E2E contexts never have
 * localStorage['ai-consent'], so the wizard auto-opens it once per test.
 */
export async function acceptAiConsent(page: Page): Promise<void> {
  try {
    await page.getByRole('heading', { name: 'AI Writing Assistant' }).waitFor({ timeout: 5_000 });
  } catch (err) {
    if (!isTimeoutError(err)) throw err;
    return;
  }
  await page.getByRole('button', { name: 'Accept' }).click();
}

export async function loginAsUser(
  page: Page,
  countryCode: string,
  phoneLocal: string,
): Promise<void> {
  const fullPhone = `${countryCode}${phoneLocal}`;

  await goto(page, '/login');
  await page.getByLabel('Country code').selectOption(countryCode);
  await page.getByLabel('Phone number').fill(phoneLocal);
  await page.getByRole('button', { name: 'Send code' }).click();

  await expect(page).toHaveURL(/\/verify-otp$/);

  await submitOtpFromDb(page, fullPhone);
  await dismissRecoveryPrompt(page);

  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
}

export async function loginByEmail(page: Page, email: string): Promise<void> {
  await goto(page, '/login');
  await page.getByRole('button', { name: 'Use email' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();

  await expect(page).toHaveURL(/\/verify-otp$/);

  await submitOtpFromDb(page, email);
  await dismissRecoveryPrompt(page);

  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
}

/**
 * Log in as an existing user (created by fixtures): splits the full E.164
 * for the form. The API rejects unknown identifiers, so create the user first.
 */
export async function loginAsTestUser(page: Page, fullPhone: string): Promise<void> {
  const countryCode = fullPhone.slice(0, 4);
  const phoneLocal = fullPhone.slice(4);
  await loginAsUser(page, countryCode, phoneLocal);
}

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
    await page.getByLabel(`Digit ${i + 1}`).pressSequentially(code![i]!);
  }
}

export async function dismissRecoveryPrompt(page: Page): Promise<void> {
  const recoveryButton = page.getByRole('button', { name: "I've saved these codes" });
  try {
    await recoveryButton.waitFor({ timeout: 5_000 });
  } catch (err) {
    if (!isTimeoutError(err)) throw err;
    return;
  }
  await recoveryButton.click();
}

/**
 * Navigate, retrying up to 3x on the transient ERR_ABORTED race that next
 * dev compile storms cause; any other failure is rethrown immediately.
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
