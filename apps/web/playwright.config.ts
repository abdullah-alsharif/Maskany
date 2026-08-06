/**
 * Playwright configuration for the Maskany web app E2E suite (T-033, PRD §8.3).
 *
 * The PRD requires real-browser, real-API, real-database tests. Playwright's
 * `webServer` option spawns both processes for us:
 *
 *   1. The Express API on :3099 wired to the test database (port 5433) with
 *      `NODE_ENV=test` so SMS/email transports log instead of calling Twilio
 *      and the OTP cooldown is disabled (`OTP_COOLDOWN_MS: '0'`).
 *   2. The Next.js dev server on :5199 with `API_BASE_URL` pointing at the
 *      test API so every fetch from the browser hits :3099.
 *
 * `globalSetup` re-seeds the test database and pre-compiles every route
 * (warm-up) before the run starts.
 *
 * Mobile-first: 375x812 (iPhone 13) viewport mirrors the development target.
 */
import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_API_PORT = 3099;
const TEST_WEB_PORT = 5199;
const TEST_DATABASE_URL =
  'postgresql://maskany_test:maskany_test_pass@localhost:5433/maskany_test?schema=public';
const REPO_ROOT = path.resolve(__dirname, '../..');
const API_PACKAGE_DIR = path.resolve(REPO_ROOT, 'apps/api');
const API_SERVER_ENTRY = path.resolve(API_PACKAGE_DIR, 'dist/src/server.js');

// Configurable timeouts — slow machines can raise them via env:
// E2E_EXPECT_TIMEOUT E2E_ACTION_TIMEOUT E2E_WEBSERVER_TIMEOUT E2E_SKIP_BUILD
const expectTimeout = Number(process.env.E2E_EXPECT_TIMEOUT) || 15_000;
const actionTimeout = Number(process.env.E2E_ACTION_TIMEOUT) || 30_000;
const webServerTimeout = Number(process.env.E2E_WEBSERVER_TIMEOUT) || 120_000;
const skipApiBuild = process.env.E2E_SKIP_BUILD === 'true';
// The webServer command owns the (fast) API TypeScript build so
// `playwright test` works from a clean checkout without extra steps.
const apiServerCommand = skipApiBuild
  ? `node ${API_SERVER_ENTRY}`
  : `pnpm exec tsc -p tsconfig.build.json && node ${API_SERVER_ENTRY}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts$/,
  // Every spec owns its data through the fixtures layer (unique phone/email/
  // titles per test), so the whole suite runs in parallel. E2E_SERIAL=1
  // forces a single worker for debugging order-dependent failures.
  fullyParallel: true,
  workers: process.env.E2E_SERIAL === '1' ? 1 : '50%',
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'on-failure' }]],
  timeout: 60_000,
  expect: {
    // Generous default: the webpack dev server compiles routes lazily, and
    // under 50% worker parallelism cold compiles can take a few seconds.
    timeout: expectTimeout,
  },
  use: {
    baseURL: `http://localhost:${TEST_WEB_PORT}`,
    viewport: { width: 375, height: 812 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout,
  },
  globalSetup: path.resolve(__dirname, 'e2e/global-setup.ts'),
  globalTeardown: path.resolve(__dirname, 'e2e/global-teardown.ts'),
  webServer: [
    {
      command: apiServerCommand,
      cwd: API_PACKAGE_DIR,
      reuseExistingServer: !process.env.CI,
      timeout: webServerTimeout,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(TEST_API_PORT),
        DATABASE_URL: TEST_DATABASE_URL,
        JWT_SECRET: 'maskany-e2e-jwt-secret',
        JWT_ACCESS_EXPIRY: '15m',
        JWT_REFRESH_EXPIRY: '7d',
        CORS_ORIGIN: `http://localhost:${TEST_WEB_PORT}`,
        TWILIO_ACCOUNT_SID: 'test_sid',
        TWILIO_AUTH_TOKEN: 'test_token',
        TWILIO_PHONE_NUMBER: '+1000000000',
        SMTP_HOST: 'localhost',
        SMTP_PORT: '1025',
        SMTP_USER: 'test',
        SMTP_PASS: 'test',
        SMTP_FROM: 'test@maskany.com',
        AUTH_RATE_LIMIT: '200',
        FAVORITES_RATE_LIMIT: '300',
        OTP_COOLDOWN_MS: '0',
      },
    },
    {
      command: `pnpm exec next dev --webpack -p ${TEST_WEB_PORT}`,
      cwd: __dirname,
      url: `http://localhost:${TEST_WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: webServerTimeout,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        API_BASE_URL: `http://localhost:${TEST_API_PORT}`,
      },
    },
  ],
});
