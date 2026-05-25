/**
 * OTP generation and verification service.
 *
 * Business rules (PRD §2.3):
 *   - Codes are 6 digits, cryptographically random.
 *   - Each code is valid for 5 minutes.
 *   - At least 30 seconds must elapse between OTP generations for the same
 *     identifier+type.
 *   - Generating a new OTP for an identifier+type invalidates any still-live
 *     unused OTP for that same identifier+type so only the latest code is
 *     accepted.
 *   - Verification requires the code to exist, not be expired, and not have
 *     been verified already. Successful verification marks the row as
 *     `verified = true` — codes are single-use.
 *
 * This module is delivery-agnostic: SMS and email transports consume the
 * returned `code` separately. It raises `HttpError` for the three defined
 * failure modes so callers can map them to HTTP responses uniformly.
 */
import { randomInt } from 'node:crypto';
import { db } from '../lib/db.js';
import { ErrorCode, HttpError } from '../lib/http-error.js';

/** OTP time-to-live in milliseconds (PRD §2.3: 5 minutes). */
export const OTP_TTL_MS = 5 * 60 * 1000;

/** Minimum interval in ms between OTP generations for the same identifier+type. */
const OTP_COOLDOWN_MS = 30_000;

export type OtpType = 'SMS' | 'EMAIL';

export interface GenerateOtpResult {
  code: string;
  expiresAt: Date;
}

export interface VerifyOtpResult {
  verified: true;
}

/**
 * Generate and persist a new 6-digit OTP for the given identifier/type.
 *
 * Enforces a 30-second cooldown between OTP generations and invalidates any
 * prior live unused OTP for the same (identifier, type) pair so that only
 * the most recent code is accepted by `verifyOtp`.
 *
 * @throws HttpError(429, 'OTP_RATE_LIMIT') — less than 30 seconds since the
 *   last OTP for the same identifier+type.
 */
export async function generateOtp(identifier: string, type: OtpType): Promise<GenerateOtpResult> {
  await enforceCooldown(identifier, type);
  await invalidatePreviousOtps(identifier, type);

  const code = randomSixDigitCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db
    .insertInto('otp_codes')
    .values({
      identifier,
      code,
      otp_type: type,
      expires_at: expiresAt,
    })
    .execute();

  return { code, expiresAt };
}

/**
 * Verify that `code` is the live, unused OTP issued to `identifier` under
 * `type`. On success marks the row as verified so it cannot be reused.
 *
 * @throws HttpError(400, 'OTP_EXPIRED') — the matching OTP exists but has
 *   passed its `expires_at`.
 * @throws HttpError(400, 'OTP_INVALID') — no matching live OTP exists, or it
 *   has already been consumed.
 */
export async function verifyOtp(
  identifier: string,
  code: string,
  type: OtpType,
): Promise<VerifyOtpResult> {
  const updated = await db
    .updateTable('otp_codes')
    .set({ verified: true })
    .where('identifier', '=', identifier)
    .where('code', '=', code)
    .where('otp_type', '=', type)
    .where('verified', '=', false)
    .where('expires_at', '>', new Date())
    .returning(['id'])
    .executeTakeFirst();

  if (!updated) {
    const existing = await db
      .selectFrom('otp_codes')
      .where('identifier', '=', identifier)
      .where('code', '=', code)
      .where('otp_type', '=', type)
      .select(['expires_at', 'verified'])
      .executeTakeFirst();

    if (!existing) {
      throw new HttpError(400, ErrorCode.OTP_INVALID, 'Invalid OTP code.');
    }
    if (existing.verified) {
      throw new HttpError(400, ErrorCode.OTP_INVALID, 'Invalid OTP code.');
    }
    throw new HttpError(400, ErrorCode.OTP_EXPIRED, 'OTP has expired.');
  }

  return { verified: true };
}

async function enforceCooldown(identifier: string, type: OtpType): Promise<void> {
  const lastOtp = await db
    .selectFrom('otp_codes')
    .where('identifier', '=', identifier)
    .where('otp_type', '=', type)
    .orderBy('created_at', 'desc')
    .select(['created_at'])
    .executeTakeFirst();

  if (lastOtp) {
    const elapsedMs = Date.now() - new Date(lastOtp.created_at).getTime();
    if (elapsedMs < OTP_COOLDOWN_MS) {
      throw new HttpError(
        429,
        ErrorCode.OTP_RATE_LIMIT,
        'Please wait before requesting another code.',
      );
    }
  }
}

async function invalidatePreviousOtps(identifier: string, type: OtpType): Promise<void> {
  // Mark any still-live prior OTPs as `verified = true`. The column name is
  // slightly overloaded: here it means "row is no longer available for use"
  // (either because a user verified it, or because it was superseded by a
  // new generation). Filtering on `verified = false` in `verifyOtp` then
  // excludes these rows, so old codes surface as `OTP_INVALID` rather than
  // `OTP_EXPIRED` — matching the semantics of a superseded code. Rows are
  // preserved so the hourly rate-limit count remains accurate.
  await db
    .updateTable('otp_codes')
    .set({ verified: true })
    .where('identifier', '=', identifier)
    .where('otp_type', '=', type)
    .where('verified', '=', false)
    .execute();
}

function randomSixDigitCode(): string {
  // randomInt is inclusive-exclusive: [100000, 1000000) → 6 digits always.
  return randomInt(100_000, 1_000_000).toString();
}
