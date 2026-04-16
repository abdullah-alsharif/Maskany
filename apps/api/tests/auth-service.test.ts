/**
 * Integration tests for the auth service — the pure functions used by the
 * route layer to issue/verify JWTs and manage refresh tokens in PostgreSQL.
 */
import jwt from 'jsonwebtoken';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db, destroy } from '../src/lib/db.js';
import { HttpError } from '../src/lib/http-error.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_MS,
  consumeRefreshToken,
  createRefreshToken,
  deleteRefreshToken,
  issueAccessToken,
  verifyAccessToken,
} from '../src/services/auth-service.js';

async function createUser(phone: string): Promise<{ id: string }> {
  return db
    .insertInto('users')
    .values({ full_name: 'T User', phone, user_type: 'BROWSER' })
    .returning('id')
    .executeTakeFirstOrThrow();
}

describe('auth-service', () => {
  beforeEach(async () => {
    await db.deleteFrom('refresh_tokens').execute();
    await db.deleteFrom('otp_codes').execute();
    await db.deleteFrom('users').execute();
  });

  afterAll(async () => {
    await destroy();
  });

  describe('token TTL constants (PRD §2.3, §2.4)', () => {
    it('access token expires in 15 minutes', () => {
      expect(ACCESS_TOKEN_TTL_SECONDS).toBe(15 * 60);
    });

    it('refresh token expires in 7 days', () => {
      expect(REFRESH_TOKEN_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('issueAccessToken / verifyAccessToken', () => {
    it('issues a JWT signed with JWT_SECRET containing the userId claim', async () => {
      const user = await createUser('+966500000101');
      const token = issueAccessToken(user.id);

      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
        userId: string;
        exp: number;
      };
      expect(decoded.userId).toBe(user.id);
    });

    it('sets exp approximately 15 minutes in the future', async () => {
      const user = await createUser('+966500000102');
      const before = Math.floor(Date.now() / 1000);
      const token = issueAccessToken(user.id);
      const after = Math.floor(Date.now() / 1000);

      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
        exp: number;
      };
      expect(decoded.exp).toBeGreaterThanOrEqual(before + ACCESS_TOKEN_TTL_SECONDS - 2);
      expect(decoded.exp).toBeLessThanOrEqual(after + ACCESS_TOKEN_TTL_SECONDS + 2);
    });

    it('verifyAccessToken returns the userId for a valid token', async () => {
      const user = await createUser('+966500000103');
      const token = issueAccessToken(user.id);

      const result = verifyAccessToken(token);
      expect(result.userId).toBe(user.id);
    });

    it('verifyAccessToken throws UNAUTHORIZED HttpError for a malformed token', () => {
      let caught: unknown;
      try {
        verifyAccessToken('not-a-jwt');
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(HttpError);
      expect((caught as HttpError).status).toBe(401);
      expect((caught as HttpError).code).toBe('UNAUTHORIZED');
    });
  });

  describe('createRefreshToken', () => {
    it('persists a UUID refresh token bound to the user with 7-day expiry', async () => {
      const user = await createUser('+966500000201');
      const before = Date.now();
      const token = await createRefreshToken(user.id);
      const after = Date.now();

      expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

      const row = await db
        .selectFrom('refresh_tokens')
        .where('token', '=', token)
        .select(['user_id', 'expires_at'])
        .executeTakeFirstOrThrow();

      expect(row.user_id).toBe(user.id);
      const exp = new Date(row.expires_at).getTime();
      expect(exp).toBeGreaterThanOrEqual(before + REFRESH_TOKEN_TTL_MS - 2_000);
      expect(exp).toBeLessThanOrEqual(after + REFRESH_TOKEN_TTL_MS + 2_000);
    });

    it('produces a unique token per call', async () => {
      const user = await createUser('+966500000202');
      const a = await createRefreshToken(user.id);
      const b = await createRefreshToken(user.id);
      expect(a).not.toBe(b);
    });
  });

  describe('consumeRefreshToken', () => {
    it('returns the user id for a valid, unexpired refresh token', async () => {
      const user = await createUser('+966500000301');
      const token = await createRefreshToken(user.id);

      const userId = await consumeRefreshToken(token);
      expect(userId).toBe(user.id);
    });

    it('deletes the token row after a successful consumption (single-use)', async () => {
      const user = await createUser('+966500000304');
      const token = await createRefreshToken(user.id);

      await consumeRefreshToken(token);

      const row = await db
        .selectFrom('refresh_tokens')
        .where('token', '=', token)
        .select('id')
        .executeTakeFirst();
      expect(row).toBeUndefined();
    });

    it('throws UNAUTHORIZED when the same token is consumed a second time (rotation)', async () => {
      const user = await createUser('+966500000305');
      const token = await createRefreshToken(user.id);

      await consumeRefreshToken(token);

      await expect(consumeRefreshToken(token)).rejects.toSatisfy(
        (err: unknown) => err instanceof HttpError && err.status === 401,
      );
    });

    it('throws UNAUTHORIZED for an unknown token', async () => {
      await expect(consumeRefreshToken('unknown-token')).rejects.toSatisfy(
        (err: unknown) => err instanceof HttpError && err.status === 401,
      );
    });

    it('throws UNAUTHORIZED for an expired token', async () => {
      const user = await createUser('+966500000302');
      await db
        .insertInto('refresh_tokens')
        .values({
          token: 'expired-token',
          user_id: user.id,
          expires_at: new Date(Date.now() - 60_000),
        })
        .execute();

      await expect(consumeRefreshToken('expired-token')).rejects.toSatisfy(
        (err: unknown) => err instanceof HttpError && err.status === 401,
      );
    });
  });

  describe('deleteRefreshToken', () => {
    it('removes the matching row from refresh_tokens', async () => {
      const user = await createUser('+966500000401');
      const token = await createRefreshToken(user.id);

      await deleteRefreshToken(token);

      const row = await db
        .selectFrom('refresh_tokens')
        .where('token', '=', token)
        .select('id')
        .executeTakeFirst();
      expect(row).toBeUndefined();
    });

    it('is a no-op for an unknown token (idempotent)', async () => {
      await expect(deleteRefreshToken('nope')).resolves.toBeUndefined();
    });
  });
});
