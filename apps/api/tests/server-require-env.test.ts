/**
 * T-032 — Startup env validation (subprocess).
 *
 * Spawns `src/server.ts` with `JWT_SECRET` stripped from the environment and
 * asserts the process exits non-zero with a clear message. This proves the
 * bootstrap refuses to start when a required secret is missing instead of
 * failing later on the first authenticated request.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SERVER_ENTRY = fileURLToPath(new URL('../src/server.ts', import.meta.url));

describe('server.ts bootstrap — required env validation', () => {
  it('exits non-zero when JWT_SECRET is missing', () => {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) env[key] = value;
    }
    delete env.JWT_SECRET;
    // Bind to an ephemeral port so the test does not collide with any local
    // dev server. If bootstrap validation passes unexpectedly, `app.listen`
    // would still open a socket briefly — this keeps it harmless.
    env.PORT = '0';

    const result = spawnSync('pnpm', ['exec', 'tsx', SERVER_ENTRY], {
      env,
      encoding: 'utf8',
      timeout: 30000,
    });

    expect(result.status).not.toBe(0);
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(output).toMatch(/JWT_SECRET/);
  });
});
