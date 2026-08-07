/**
 * Playwright config (T-033, PRD §8.3): webServer spawns the Express API on
 * :3099 (test DB :5433, NODE_ENV=test — SMS/email log instead of calling
 * Twilio, OTP cooldown off) and the Next dev server on :5199 pointed at the
 * test API. globalSetup re-seeds and pre-compiles routes; 375x812 viewport.
 */
import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_API_PORT, TEST_DATABASE_URL, TEST_WEB_PORT } from './e2e/test-helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '../..');
const API_PACKAGE_DIR = path.resolve(REPO_ROOT, 'apps/api');
const API_SERVER_ENTRY = path.resolve(API_PACKAGE_DIR, 'dist/src/server.js');

// Slow machines can raise these via env (E2E_*_TIMEOUT, E2E_SKIP_BUILD).
const expectTimeout = Number(process.env.E2E_EXPECT_TIMEOUT) || 15_000;
const actionTimeout = Number(process.env.E2E_ACTION_TIMEOUT) || 30_000;
const webServerTimeout = Number(process.env.E2E_WEBSERVER_TIMEOUT) || 120_000;
const skipApiBuild = process.env.E2E_SKIP_BUILD === 'true';
// The webServer command owns the API build so the suite runs from a clean checkout.
const apiServerCommand = skipApiBuild
  ? `node ${API_SERVER_ENTRY}`
  : `pnpm exec tsc -p tsconfig.build.json && node ${API_SERVER_ENTRY}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts$/,
  // Fixtures give every spec unique data, so the suite runs fully parallel;
  // E2E_SERIAL=1 forces one worker to debug order-dependent failures.
  fullyParallel: true,
  workers: process.env.E2E_SERIAL === '1' ? 1 : '50%',
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'on-failure' }]],
  timeout: 60_000,
  expect: {
    // Generous default — dev-server route compilation under parallel workers.
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
