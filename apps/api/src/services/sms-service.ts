/**
 * SMS delivery service (PRD §2.2, §2.3).
 *
 * Wraps Twilio's REST API behind a transport-agnostic `sendSms(to, message)`
 * function. Callers compose the message body themselves — `formatOtpMessage`
 * is exported for the OTP-SMS case so the PRD-mandated wording lives in one
 * place.
 *
 * Environment behaviour:
 *   - In production (NODE_ENV === 'production') the Twilio client is
 *     instantiated lazily from TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN /
 *     TWILIO_PHONE_NUMBER and sends a real SMS.
 *   - In any other environment the message is logged to stdout instead.
 *     This keeps developer workflows and the CI test database free of
 *     outbound network calls while still surfacing the OTP code for manual
 *     verification.
 *
 * Phone numbers are validated against an E.164-flavoured regex — a leading
 * `+`, a non-zero country-code digit, and 6-14 further digits. Invalid input
 * raises `HttpError(400, 'INVALID_PHONE')` so the route layer can surface a
 * consistent error envelope to the client.
 */
import twilio from 'twilio';
import { HttpError } from '../lib/http-error.js';

/**
 * E.164-style phone number pattern: `+` followed by a non-zero country code
 * digit, then 6-14 more digits. Total length 8-16 characters including the
 * `+`. Non-digit characters are rejected so callers cannot smuggle spaces,
 * dashes, or parentheses past this check.
 */
const PHONE_NUMBER_PATTERN = /^\+[1-9]\d{6,14}$/;

/**
 * Render the OTP SMS body exactly as required by PRD §2.3.
 *
 * Kept as a separate export so tests, email templates, or future channels can
 * reuse the wording without duplicating the magic string.
 */
export function formatOtpMessage(code: string): string {
  return `Your Maskany verification code is: ${code}. Valid for 5 minutes.`;
}

/**
 * Returns `true` when `phone` looks like a valid international phone number
 * with a country-code prefix. Intentionally strict: rejects spaces, dashes,
 * parentheses, and leading zeros so the value can be passed through to
 * Twilio's API without further normalisation.
 */
export function isValidPhoneNumber(phone: string): boolean {
  return PHONE_NUMBER_PATTERN.test(phone);
}

/**
 * Return a log-safe representation of `phone` that reveals only the first
 * four characters (the `+` plus the leading country-code digits) and the last
 * four digits. All middle digits are replaced with a fixed `***` marker so a
 * leaked log line cannot be used to reconstruct the full number.
 *
 * @example
 *   maskPhoneNumber('+966500001234') → '+966***1234'
 */
export function maskPhoneNumber(phone: string): string {
  const prefixLength = 4;
  const suffixLength = 4;
  if (phone.length <= prefixLength + suffixLength) {
    // Too short to produce a useful mask — redact entirely.
    return '***';
  }
  return `${phone.slice(0, prefixLength)}***${phone.slice(-suffixLength)}`;
}

/**
 * Deliver `message` to `to`. Validates the phone number first in every
 * environment — an invalid number never reaches the transport, logged or
 * otherwise.
 *
 * @throws HttpError(400, 'INVALID_PHONE') when `to` fails validation.
 * @throws Error when TWILIO_* env vars are missing in production.
 */
export async function sendSms(to: string, message: string): Promise<void> {
  if (!isValidPhoneNumber(to)) {
    throw new HttpError(400, 'INVALID_PHONE', 'Invalid phone number format.');
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[SMS] OTP for ${maskPhoneNumber(to)}: ${message}`);
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(
      'Twilio configuration is incomplete: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER must all be set.',
    );
  }

  const client = twilio(accountSid, authToken);
  const send = () => client.messages.create({ body: message, from: fromNumber, to });

  try {
    await send();
  } catch (firstErr) {
    if (isTwilioTransientError(firstErr)) {
      try {
        await send();
      } catch (secondErr) {
        logSmsFailure(to, secondErr);
        throw secondErr;
      }
    } else {
      logSmsFailure(to, firstErr);
      throw firstErr;
    }
  }
}

function isTwilioTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const e = err as { status?: number; code?: string | number };
  if (typeof e.status === 'number' && e.status >= 500) return true;
  if (typeof e.code === 'string' && ['ETIMEDOUT', 'ECONNRESET', 'EPIPE'].includes(e.code))
    return true;
  return false;
}

function logSmsFailure(to: string, err: unknown): void {
  const e = err as { status?: number; code?: string | number } | undefined;
  const errorCode = e?.code ?? e?.status ?? 'UNKNOWN';
  console.error('[SMS] delivery failed', { to: maskPhoneNumber(to), errorCode });
}
