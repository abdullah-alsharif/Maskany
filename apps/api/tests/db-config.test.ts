/**
 * Structural tests for `apps/api/src/lib/db.ts` — pool sizing, DATABASE_URL
 * consumption, and graceful shutdown semantics. No I/O against the database
 * itself; see `db.test.ts` for integration coverage.
 */
import { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPool, destroy } from '../src/lib/db.js';

describe('db module configuration', () => {
  const originalEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  };

  beforeEach(() => {
    process.env.DATABASE_URL =
      'postgresql://maskany_test:maskany_test_pass@localhost:5433/maskany_test';
  });

  afterEach(() => {
    for (const key of ['DATABASE_URL', 'NODE_ENV'] as const) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('exports a destroy function for graceful shutdown', () => {
    expect(typeof destroy).toBe('function');
  });

  it('creates a pool with max 3 connections in the test environment', async () => {
    process.env.NODE_ENV = 'test';

    const pool = createPool();
    try {
      expect(pool).toBeInstanceOf(Pool);
      expect(pool.options.max).toBe(3);
    } finally {
      await pool.end();
    }
  });

  it('creates a pool with max 10 connections outside of tests', async () => {
    process.env.NODE_ENV = 'development';

    const pool = createPool();
    try {
      expect(pool.options.max).toBe(10);
    } finally {
      await pool.end();
    }
  });

  it('reads the connection string from DATABASE_URL', async () => {
    const url = 'postgresql://user:pass@example.com:5432/mydb';
    process.env.DATABASE_URL = url;

    const pool = createPool();
    try {
      expect(pool.options.connectionString).toBe(url);
    } finally {
      await pool.end();
    }
  });

  it('throws a descriptive error when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    expect(() => createPool()).toThrow(/DATABASE_URL/);
  });
});
