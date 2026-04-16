import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Load root .env first for all shared vars, then .env.test to override
// test-specific settings (primarily DATABASE_URL → test database).
loadEnv({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
loadEnv({ path: fileURLToPath(new URL('./.env.test', import.meta.url)), override: true });

export default defineConfig({
  test: {
    name: '@maskany/api',
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    // Integration tests share a single PostgreSQL test database, so running
    // multiple test files in parallel would cause truncate/insert races.
    // A single fork keeps files sequential while still isolating the suite
    // from the host process.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        functions: 80,
        lines: 80,
        branches: 75,
      },
    },
  },
});
