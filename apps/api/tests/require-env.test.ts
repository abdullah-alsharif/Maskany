/**
 * T-032 / T-038 — Startup env validation.
 *
 * `assertRequiredEnv` is invoked from `server.ts` before calling
 * `app.listen`. Missing `JWT_SECRET` or `DATABASE_URL` must raise an error
 * carrying the names of the missing variables so the caller can log and
 * `process.exit(1)` with a clear message.
 *
 * `assertProductionEnv` additionally enforces Twilio and SMTP credentials
 * when `NODE_ENV === 'production'`. This is the testable slice of the
 * production credential validation path — real Twilio/SMTP calls cannot
 * be exercised without live credentials (the project forbids mocking).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assertProductionEnv,
  assertRequiredEnv,
  PRODUCTION_REQUIRED_ENV_VARS,
} from '../src/config/require-env.js';

describe('assertRequiredEnv', () => {
  const original = {
    JWT_SECRET: process.env.JWT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
  };

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.DATABASE_URL = 'postgres://localhost/test';
  });

  afterEach(() => {
    for (const key of ['JWT_SECRET', 'DATABASE_URL'] as const) {
      const value = original[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('returns silently when all required vars are set', () => {
    expect(() => assertRequiredEnv()).not.toThrow();
  });

  it('throws when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    expect(() => assertRequiredEnv()).toThrow(/JWT_SECRET/);
  });

  it('throws when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    expect(() => assertRequiredEnv()).toThrow(/DATABASE_URL/);
  });

  it('throws when JWT_SECRET is empty string', () => {
    process.env.JWT_SECRET = '';
    expect(() => assertRequiredEnv()).toThrow(/JWT_SECRET/);
  });

  it('lists all missing vars in a single error message', () => {
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
    expect(() => assertRequiredEnv()).toThrow(/JWT_SECRET.*DATABASE_URL|DATABASE_URL.*JWT_SECRET/);
  });
});

describe('assertProductionEnv', () => {
  const PROD_VARS = [...PRODUCTION_REQUIRED_ENV_VARS] as string[];
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVars: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const name of PROD_VARS) {
      originalVars[name] = process.env[name];
      process.env[name] = 'set-for-test';
    }
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    for (const name of PROD_VARS) {
      const value = originalVars[name];
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  it('is a no-op when NODE_ENV is not "production"', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.TWILIO_ACCOUNT_SID;
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it('returns silently when all production vars are set', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it('throws a clear error when Twilio credentials are missing in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    expect(() => assertProductionEnv()).toThrow(/TWILIO_ACCOUNT_SID/);
  });

  it('throws a clear error when SMTP credentials are missing in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    expect(() => assertProductionEnv()).toThrow(/SMTP_HOST/);
  });

  it('lists all missing production vars in a single error', () => {
    process.env.NODE_ENV = 'production';
    for (const name of PROD_VARS) {
      delete process.env[name];
    }
    const err = (() => {
      try {
        assertProductionEnv();
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(Error);
    for (const name of PROD_VARS) {
      expect((err as Error).message).toContain(name);
    }
  });

  it('throws when a production var is present but empty', () => {
    process.env.NODE_ENV = 'production';
    process.env.TWILIO_ACCOUNT_SID = '';
    expect(() => assertProductionEnv()).toThrow(/TWILIO_ACCOUNT_SID/);
  });
});
