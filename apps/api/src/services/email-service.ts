/**
 * Email delivery service (PRD §2.2, §2.3).
 *
 * Wraps Nodemailer's SMTP transport behind a transport-agnostic
 * `sendEmail(to, subject, html)` function. `sendOtpEmail(to, code)` composes
 * the PRD-mandated subject + HTML body and delegates to `sendEmail` so the
 * OTP wording lives in one place.
 *
 * Environment behaviour:
 *   - In production (NODE_ENV === 'production') the Nodemailer transporter is
 *     instantiated lazily from SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS /
 *     SMTP_FROM and sends a real email.
 *   - In any other environment the message is logged to stdout instead. This
 *     keeps developer workflows and the CI test database free of outbound
 *     network calls while still surfacing the OTP code for manual verification.
 *
 * Email addresses are validated against a pragmatic regex that enforces an
 * `@` separator, a domain with a TLD, no whitespace, no control characters
 * (defends against header-injection), and the RFC-5321 254-char total limit.
 * Invalid input raises `HttpError(400, 'INVALID_EMAIL')` so the route layer
 * can surface a consistent error envelope to the client.
 */
import nodemailer from 'nodemailer';
import { HttpError } from '../lib/http-error.js';

/**
 * RFC-5321 practical upper bound on the full email address length.
 */
const MAX_EMAIL_LENGTH = 254;

/**
 * Pragmatic email-address pattern:
 *   - One or more non-space / non-control local characters
 *   - `@` separator
 *   - Domain label(s) followed by a `.` and a ≥2-char TLD
 *
 * The regex intentionally rejects whitespace and CR/LF so values passed
 * through to SMTP cannot smuggle additional headers (`Bcc: evil@x.com`).
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;

/**
 * Subject line for the OTP verification email (PRD §2.3 / task hint).
 */
const OTP_EMAIL_SUBJECT = 'Your Maskany Verification Code';

/**
 * PRD-mandated subject for OTP verification emails. Exposed as a function so
 * future localisation can vary the value without callers depending on a
 * constant export.
 */
export function formatOtpEmailSubject(): string {
  return OTP_EMAIL_SUBJECT;
}

/**
 * Returns `true` when `email` looks like a valid address usable by the SMTP
 * transport. Intentionally strict: rejects whitespace, control characters,
 * empty local/domain parts, TLD-less domains, and anything longer than 254
 * characters.
 */
export function isValidEmail(email: string): boolean {
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) {
    return false;
  }
  return EMAIL_PATTERN.test(email);
}

/**
 * Return a log-safe representation of `email` that reveals only the first
 * character of the local part and the full domain. The rest of the local part
 * is replaced with a fixed `***` marker so a leaked log line cannot be used
 * to recover the full address.
 *
 * @example
 *   maskEmail('alice@example.com') → 'a***@example.com'
 */
export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) {
    // No local part, or unable to parse — redact entirely.
    return '***';
  }
  const firstLocalChar = email.charAt(0);
  const domain = email.slice(atIndex);
  return `${firstLocalChar}***${domain}`;
}

/**
 * Render the OTP verification email body as a mobile-friendly HTML document.
 *
 * The template carries the four pieces of content required by the PRD:
 *   - A branded app-name header (logo placeholder — swap with an <img> once a
 *     hosted asset exists).
 *   - The 6-digit OTP code, rendered large and centered so users can read it
 *     at a glance on a phone preview.
 *   - A 5-minute expiration notice.
 *   - A "don't share" warning aligned with the SMS copy.
 */
export function formatOtpEmailHtml(code: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${OTP_EMAIL_SUBJECT}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#fdfcfa;font-family:'Outfit',Arial,sans-serif;color:#1c1917;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fdfcfa;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px;">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <!-- App logo placeholder: replace src once a hosted asset exists -->
                <div role="img" aria-label="Maskany logo" style="font-family:'DM Serif Display',Georgia,serif;font-size:28px;color:#e2683d;letter-spacing:0.02em;">
                  Maskany
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:16px;font-size:18px;line-height:1.4;color:#1c1917;">
                Your verification code
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 0;">
                <div style="font-family:'DM Serif Display',Georgia,serif;font-size:40px;letter-spacing:0.3em;color:#1c1917;font-weight:600;">
                  ${code}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:12px;font-size:14px;line-height:1.5;color:#57534e;">
                This code will expire in 5 minutes.
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;line-height:1.5;color:#57534e;">
                For your security, don't share this code with anyone. Maskany staff will never ask you for it.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Deliver an HTML email. Validates the recipient address first in every
 * environment — an invalid address never reaches the transport, logged or
 * otherwise.
 *
 * @throws HttpError(400, 'INVALID_EMAIL') when `to` fails validation.
 * @throws Error when SMTP_* env vars are missing in production.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!isValidEmail(to)) {
    throw new HttpError(400, 'INVALID_EMAIL', 'Invalid email address format.');
  }

  if (process.env.NODE_ENV !== 'production') {
    // Intentional developer-facing output. We deliberately log ONLY the
    // masked recipient — never the subject, HTML body, or OTP code — so that
    // captured stdout (e.g., CI logs, `docker logs`) cannot be replayed to
    // compromise an account. PRD §8.2 / T-029.
    console.log(`[EMAIL] OTP sent to: ${maskEmail(to)}`);
    return;
  }

  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !portRaw || !user || !pass || !from) {
    throw new Error(
      'SMTP configuration is incomplete: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM must all be set.',
    );
  }

  const port = Number(portRaw);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const send = () => transporter.sendMail({ from, to, subject, html });

  try {
    await send();
  } catch (firstErr) {
    if (isSmtpTransientError(firstErr)) {
      try {
        await send();
      } catch (secondErr) {
        logEmailFailure(to, secondErr);
        throw secondErr;
      }
    } else {
      logEmailFailure(to, firstErr);
      throw firstErr;
    }
  }
}

function isSmtpTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: string }).code;
  return (
    typeof code === 'string' && ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EPIPE'].includes(code)
  );
}

function logEmailFailure(to: string, err: unknown): void {
  const code =
    (err as { code?: string; responseCode?: number } | undefined)?.code ??
    (err as { responseCode?: number } | undefined)?.responseCode ??
    'UNKNOWN';
  console.error('[EMAIL] delivery failed', { to: maskEmail(to), errorCode: code });
}

/**
 * Send the OTP verification email to `to` using the PRD-mandated subject and
 * HTML template. Thin wrapper around `sendEmail` so route layers can invoke
 * a single function after generating an OTP code.
 */
export async function sendOtpEmail(to: string, code: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[EMAIL] OTP for ${maskEmail(to)}: ${code}`);
  }
  await sendEmail(to, formatOtpEmailSubject(), formatOtpEmailHtml(code));
}
