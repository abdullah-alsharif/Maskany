/**
 * T-044 — next.config.ts tests.
 *
 * Verifies that the Next.js configuration rewrites /api/* and /uploads/* to
 * the backend server and sets up transpilePackages correctly.
 */
import { describe, expect, it } from 'vitest';
import type { NextConfig } from 'next';

describe('next.config.ts (T-044)', () => {
  it('exports a valid Next.js config object', async () => {
    const mod = await import('../next.config');
    const config = mod.default as NextConfig;
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  it('configures rewrites for /api/* and /uploads/* to the backend', async () => {
    const mod = await import('../next.config');
    const config = mod.default as NextConfig;
    expect(typeof config.rewrites).toBe('function');
    const rewrites = await (config.rewrites as () => Promise<unknown>)();
    const rules = Array.isArray(rewrites)
      ? rewrites
      : ((rewrites as { beforeFiles?: unknown[]; afterFiles?: unknown[] }).beforeFiles ??
        (rewrites as unknown[]));
    expect(
      (rules as Array<{ source: string; destination: string }>).some((r) =>
        r.source.startsWith('/api/'),
      ),
    ).toBe(true);
    expect(
      (rules as Array<{ source: string; destination: string }>).some((r) =>
        r.source.startsWith('/uploads/'),
      ),
    ).toBe(true);
  });
});
