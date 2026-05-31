import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_API_PORT = 3099;
const TEST_WEB_PORT = 3000;
const TEST_DATABASE_URL =
  'postgresql://maskany_test:maskany_test_pass@localhost:5433/maskany_test?schema=public';
const REPO_ROOT = path.resolve(__dirname, '../../..');
const API_PACKAGE_DIR = path.resolve(REPO_ROOT, 'apps/api');
const API_SERVER_ENTRY = path.resolve(API_PACKAGE_DIR, 'dist/src/server.js');

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: `http://localhost:${TEST_WEB_PORT}`,
    viewport: { width: 375, height: 812 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `node ${API_SERVER_ENTRY}`,
      cwd: API_PACKAGE_DIR,
      url: `http://localhost:${TEST_API_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(TEST_API_PORT),
        DATABASE_URL: TEST_DATABASE_URL,
        JWT_SECRET: 'maskany-e2e-jwt-secret',
        CORS_ORIGIN: `http://localhost:${TEST_WEB_PORT}`,
        TWILIO_ACCOUNT_SID: 'test_sid',
        TWILIO_AUTH_TOKEN: 'test_token',
        TWILIO_PHONE_NUMBER: '+1000000000',
        SMTP_HOST: 'localhost',
        SMTP_PORT: '1025',
        SMTP_USER: 'test',
        SMTP_PASS: 'test',
        SMTP_FROM: 'test@maskany.com',
      },
    },
    {
      command: `pnpm exec next start -p ${TEST_WEB_PORT}`,
      cwd: path.resolve(__dirname, '..'),
      url: `http://localhost:${TEST_WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        API_BASE_URL: `http://localhost:${TEST_API_PORT}`,
      },
    },
  ],
});
