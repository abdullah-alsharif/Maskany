/**
 * Runtime environment configuration.
 *
 * Values are read lazily via getters so tests can mutate `process.env` between
 * cases without needing to reset the module cache. Production consumers read
 * each property exactly once at startup (e.g., `server.ts` reads `env.port`).
 */
import path from 'node:path';

const DEFAULT_PORT = 3001;
/**
 * When `CORS_ORIGIN` is unset we assume the operator is running a local Vite
 * dev server on :5173 — the same URL documented in `.env.example`. We
 * deliberately do NOT fall back to `*` because a wildcard origin combined
 * with `credentials: true` is a security anti-pattern (PRD §8.2 / T-029).
 */
const DEFAULT_CORS_ORIGIN = 'http://localhost:5173';
const DEFAULT_UPLOADS_SUBDIR = 'uploads';

export const env = {
  get port(): number {
    const raw = process.env.PORT;
    if (raw === undefined || raw === '') {
      return DEFAULT_PORT;
    }
    return Number(raw);
  },

  get corsOrigin(): string {
    const raw = process.env.CORS_ORIGIN;
    if (raw !== undefined && raw !== '') {
      return raw;
    }
    // Production deployments MUST pin the origin explicitly — silently
    // falling back to the Vite dev URL in prod would almost certainly be a
    // misconfiguration that disables CORS protection.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CORS_ORIGIN must be set explicitly in production — refusing to fall back to a default.',
      );
    }
    return DEFAULT_CORS_ORIGIN;
  },

  get isTest(): boolean {
    return process.env.NODE_ENV === 'test';
  },

  get uploadsDir(): string {
    const raw = process.env.UPLOADS_DIR;
    if (raw && raw.length > 0) {
      return path.resolve(raw);
    }
    return path.resolve(process.cwd(), DEFAULT_UPLOADS_SUBDIR);
  },

  get storageProvider(): 'local' | 's3' {
    return process.env.STORAGE_PROVIDER === 's3' ? 's3' : 'local';
  },

  get s3Bucket(): string {
    return process.env.S3_BUCKET ?? '';
  },

  get s3Region(): string {
    return process.env.S3_REGION ?? 'us-east-1';
  },

  get s3AccessKey(): string {
    return process.env.S3_ACCESS_KEY ?? '';
  },

  get s3SecretKey(): string {
    return process.env.S3_SECRET_KEY ?? '';
  },

  get s3Endpoint(): string | undefined {
    const raw = process.env.S3_ENDPOINT;
    return raw && raw.length > 0 ? raw : undefined;
  },

  get s3CdnUrl(): string | undefined {
    const raw = process.env.S3_CDN_URL;
    return raw && raw.length > 0 ? raw : undefined;
  },

  get fcmServiceAccountJson(): string | undefined {
    const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
    return raw && raw.length > 0 ? raw : undefined;
  },

  get openrouterApiKey(): string | undefined {
    return process.env.OPENROUTER_API_KEY;
  },

  get openrouterPaidApiKey(): string | undefined {
    return process.env.OPENROUTER_PAID_API_KEY;
  },

  get nvidiaApiKey(): string | undefined {
    return process.env.NVIDIA_API_KEY;
  },

  get redisUrl(): string {
    return process.env.REDIS_URL ?? 'redis://localhost:6379';
  },

  get aiCacheEnabled(): boolean {
    return process.env.AI_CACHE_ENABLED !== 'false';
  },

  get aiGlobalCostCapCents(): number {
    return Number(process.env.AI_GLOBAL_COST_CAP_CENTS) || 500;
  },

  get aiUserCostCapCents(): number {
    return Number(process.env.AI_USER_COST_CAP_CENTS) || 100;
  },

  get aiCacheVersion(): string {
    return process.env.AI_CACHE_VERSION ?? 'v1';
  },

  get cbThreshold(): number {
    return Number(process.env.CB_THRESHOLD) || 20;
  },

  get cbResetMs(): number {
    return Number(process.env.CB_RESET_MS) || 120_000;
  },

  get maxEnhanceTokens(): number {
    return Number(process.env.MAX_ENHANCE_TOKENS) || 3500;
  },
};
