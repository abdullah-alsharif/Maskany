/**
 * Integration tests for the OTP service.
 *
 * Runs against the real PostgreSQL test database (see `docker-compose.test.yml`,
 * port 5433). Each test cleans the `otp_codes` table and relies on real
 * `created_at` / `expires_at` timestamps so expiration and rate-limiting
 * behaviour are verified through actual SQL predicates rather than mocks.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db, destroy } from '../src/lib/db.js';
import { HttpError } from '../src/lib/http-error.js';
import {
  OTP_RATE_LIMIT_PER_HOUR,
  OTP_TTL_MS,
  generateOtp,
  verifyOtp,
} from '../src/services/otp-service.js';

const SMS_IDENTIFIER = '+966500000099';
const EMAIL_IDENTIFIER = 'alice@example.com';

describe('otp-service', () => {
  beforeEach(async () => {
    await db.deleteFrom('refresh_tokens').execute();
    await db.deleteFrom('otp_codes').execute();
  });

  afterAll(async () => {
    await destroy();
  });

  describe('generateOtp', () => {
    it('creates a 6-digit numeric code', async () => {
      const result = await generateOtp(SMS_IDENTIFIER, 'SMS');

      expect(result.code).toMatch(/^\d{6}$/);
    });

    it('generates different codes across invocations (cryptographic randomness)', async () => {
      const codes = new Set<string>();
      for (let i = 0; i < 10; i += 1) {
        await db.deleteFrom('otp_codes').execute();
        const { code } = await generateOtp(SMS_IDENTIFIER, 'SMS');
        codes.add(code);
      }

      // 10 draws from a space of 900_000 — collisions are astronomically
      // unlikely. If they happen repeatedly, the RNG is not cryptographic.
      expect(codes.size).toBeGreaterThanOrEqual(9);
    });

    it('persists the OTP with the configured TTL', async () => {
      const before = Date.now();
      const { code } = await generateOtp(SMS_IDENTIFIER, 'SMS');
      const after = Date.now();

      const row = await db
        .selectFrom('otp_codes')
        .where('identifier', '=', SMS_IDENTIFIER)
        .where('otp_type', '=', 'SMS')
        .select(['code', 'otp_type', 'expires_at', 'verified'])
        .executeTakeFirstOrThrow();

      expect(row.code).toBe(code);
      expect(row.otp_type).toBe('SMS');
      expect(row.verified).toBe(false);

      const expiresAt = new Date(row.expires_at).getTime();
      expect(expiresAt).toBeGreaterThanOrEqual(before + OTP_TTL_MS - 1_000);
      expect(expiresAt).toBeLessThanOrEqual(after + OTP_TTL_MS + 1_000);
    });

    it('uses a 5 minute TTL per PRD §2.3', () => {
      expect(OTP_TTL_MS).toBe(5 * 60 * 1000);
    });

    it('enforces a rate limit of 3 requests per hour per identifier', () => {
      expect(OTP_RATE_LIMIT_PER_HOUR).toBe(3);
    });

    it('invalidates previous unused OTPs for the same identifier+type', async () => {
      const first = await generateOtp(SMS_IDENTIFIER, 'SMS');
      const second = await generateOtp(SMS_IDENTIFIER, 'SMS');

      expect(first.code).not.toBe(second.code);

      // Verifying with the old code must fail because it has been invalidated.
      await expect(verifyOtp(SMS_IDENTIFIER, first.code, 'SMS')).rejects.toSatisfy(
        (err) => err instanceof HttpError && err.code === 'OTP_INVALID',
      );

      // Verifying with the new code still succeeds.
      const result = await verifyOtp(SMS_IDENTIFIER, second.code, 'SMS');
      expect(result.verified).toBe(true);
    });

    it('does not invalidate OTPs for a different identifier or type', async () => {
      const sms = await generateOtp(SMS_IDENTIFIER, 'SMS');
      const email = await generateOtp(EMAIL_IDENTIFIER, 'EMAIL');

      // Generating a new SMS for the SMS identifier must not invalidate the
      // EMAIL identifier's OTP.
      await generateOtp(SMS_IDENTIFIER, 'SMS');

      const verified = await verifyOtp(EMAIL_IDENTIFIER, email.code, 'EMAIL');
      expect(verified.verified).toBe(true);

      // The original SMS code is invalidated by the new SMS generation.
      await expect(verifyOtp(SMS_IDENTIFIER, sms.code, 'SMS')).rejects.toSatisfy(
        (err) => err instanceof HttpError && err.code === 'OTP_INVALID',
      );
    });

    it('throws OTP_RATE_LIMIT after 3 requests within one hour', async () => {
      await generateOtp(SMS_IDENTIFIER, 'SMS');
      await generateOtp(SMS_IDENTIFIER, 'SMS');
      await generateOtp(SMS_IDENTIFIER, 'SMS');

      await expect(generateOtp(SMS_IDENTIFIER, 'SMS')).rejects.toSatisfy(
        (err) => err instanceof HttpError && err.status === 429 && err.code === 'OTP_RATE_LIMIT',
      );
    });

    it('does not count requests older than one hour toward the rate limit', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const longAgo = new Date(Date.now() - 30 * 60 * 1000 - 2 * 60 * 60 * 1000);

      await db
        .insertInto('otp_codes')
        .values([
          {
            identifier: SMS_IDENTIFIER,
            code: '111111',
            otp_type: 'SMS',
            expires_at: new Date(twoHoursAgo.getTime() + OTP_TTL_MS),
            created_at: twoHoursAgo,
          },
          {
            identifier: SMS_IDENTIFIER,
            code: '222222',
            otp_type: 'SMS',
            expires_at: new Date(longAgo.getTime() + OTP_TTL_MS),
            created_at: longAgo,
          },
          {
            identifier: SMS_IDENTIFIER,
            code: '333333',
            otp_type: 'SMS',
            expires_at: new Date(longAgo.getTime() + OTP_TTL_MS),
            created_at: longAgo,
          },
        ])
        .execute();

      // Even though the table has 3 prior rows, none are within the last
      // hour, so a new request must succeed.
      const result = await generateOtp(SMS_IDENTIFIER, 'SMS');
      expect(result.code).toMatch(/^\d{6}$/);
    });

    it('counts only the matching identifier+type toward the rate limit', async () => {
      // Fill the SMS rate limit for one identifier.
      await generateOtp(SMS_IDENTIFIER, 'SMS');
      await generateOtp(SMS_IDENTIFIER, 'SMS');
      await generateOtp(SMS_IDENTIFIER, 'SMS');

      // A different identifier / different type must still succeed.
      const other = await generateOtp('+966500000001', 'SMS');
      expect(other.code).toMatch(/^\d{6}$/);

      const emailResult = await generateOtp(SMS_IDENTIFIER, 'EMAIL');
      expect(emailResult.code).toMatch(/^\d{6}$/);
    });
  });

  describe('verifyOtp', () => {
    it('returns verified=true on a correct, unexpired code and marks the row verified', async () => {
      const { code } = await generateOtp(SMS_IDENTIFIER, 'SMS');

      const result = await verifyOtp(SMS_IDENTIFIER, code, 'SMS');
      expect(result.verified).toBe(true);

      const row = await db
        .selectFrom('otp_codes')
        .where('identifier', '=', SMS_IDENTIFIER)
        .where('code', '=', code)
        .where('otp_type', '=', 'SMS')
        .select('verified')
        .executeTakeFirstOrThrow();
      expect(row.verified).toBe(true);
    });

    it('throws OTP_INVALID for a wrong code', async () => {
      await generateOtp(SMS_IDENTIFIER, 'SMS');

      await expect(verifyOtp(SMS_IDENTIFIER, '000000', 'SMS')).rejects.toSatisfy(
        (err) => err instanceof HttpError && err.status === 400 && err.code === 'OTP_INVALID',
      );
    });

    it('throws OTP_INVALID when no OTP exists for the identifier', async () => {
      await expect(verifyOtp(SMS_IDENTIFIER, '123456', 'SMS')).rejects.toSatisfy(
        (err) => err instanceof HttpError && err.code === 'OTP_INVALID',
      );
    });

    it('throws OTP_EXPIRED when the stored OTP has passed its expiration', async () => {
      const pastExpiry = new Date(Date.now() - 60 * 1000);

      await db
        .insertInto('otp_codes')
        .values({
          identifier: SMS_IDENTIFIER,
          code: '654321',
          otp_type: 'SMS',
          expires_at: pastExpiry,
        })
        .execute();

      await expect(verifyOtp(SMS_IDENTIFIER, '654321', 'SMS')).rejects.toSatisfy(
        (err) => err instanceof HttpError && err.status === 400 && err.code === 'OTP_EXPIRED',
      );
    });

    it('throws OTP_INVALID when the OTP has already been verified (no reuse)', async () => {
      const { code } = await generateOtp(SMS_IDENTIFIER, 'SMS');
      await verifyOtp(SMS_IDENTIFIER, code, 'SMS');

      await expect(verifyOtp(SMS_IDENTIFIER, code, 'SMS')).rejects.toSatisfy(
        (err) => err instanceof HttpError && err.code === 'OTP_INVALID',
      );
    });

    it('rejects a code that matches a different identifier', async () => {
      const { code } = await generateOtp(SMS_IDENTIFIER, 'SMS');

      await expect(verifyOtp('+966500000777', code, 'SMS')).rejects.toSatisfy(
        (err) => err instanceof HttpError && err.code === 'OTP_INVALID',
      );
    });

    it('rejects a code verified under a different otp_type', async () => {
      const { code } = await generateOtp(EMAIL_IDENTIFIER, 'EMAIL');

      // Same identifier/code, but requesting SMS verification — must fail.
      await expect(verifyOtp(EMAIL_IDENTIFIER, code, 'SMS')).rejects.toSatisfy(
        (err) => err instanceof HttpError && err.code === 'OTP_INVALID',
      );
    });
  });
});
