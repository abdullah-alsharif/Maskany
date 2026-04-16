/**
 * Startup validation for required environment variables (T-032, T-038, PRD §8.2).
 *
 * Previously `JWT_SECRET` and `DATABASE_URL` were only validated on-demand —
 * the first request that needed either would fail with a 500 at runtime.
 * The server now fails fast at boot if a required var is missing or empty
 * so misconfiguration surfaces immediately in logs rather than during the
 * first user-facing request.
 *
 * Production additionally requires Twilio and SMTP credentials. These are
 * only enforced when `NODE_ENV === 'production'` so dev and test environments
 * remain free of outbound-credential requirements.
 */

/** Environment variables that the API refuses to start without in any environment. */
export const REQUIRED_ENV_VARS = ['JWT_SECRET', 'DATABASE_URL'] as const;

/**
 * Environment variables required only when running in production.
 * Missing any of these in production means SMS/email delivery is broken,
 * so the server refuses to start rather than silently dropping messages.
 */
export const PRODUCTION_REQUIRED_ENV_VARS = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
] as const;

/**
 * Throw when any required env var is undefined or the empty string.
 *
 * The thrown `Error` names every missing variable so the caller can log a
 * single, actionable message before calling `process.exit(1)`.
 */
export function assertRequiredEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((name) => {
    const value = process.env[name];
    return value === undefined || value === '';
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Set them in the process environment before starting the API.',
    );
  }
}

/**
 * Throw when any production-only env var is missing and `NODE_ENV === 'production'`.
 * No-ops in development and test so local workflows remain credential-free.
 */
export function assertProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const missing = PRODUCTION_REQUIRED_ENV_VARS.filter((name) => {
    const value = process.env[name];
    return value === undefined || value === '';
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variable(s): ${missing.join(', ')}. ` +
        'Set them before starting the API in production mode.',
    );
  }
}
