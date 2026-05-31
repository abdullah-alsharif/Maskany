/**
 * Integration tests for the auth HTTP API (POST /api/auth/* and GET /me).
 *
 * Runs against the real Express app and the real test PostgreSQL database.
 * OTP codes are read back from the `otp_codes` table directly so no SMS/email
 * transport calls are necessary — the dev/test implementations only log.
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { db, destroy } from '../src/lib/db.js';

const PHONE = '+966500009001';
const EMAIL = 'route-user@example.com';

async function latestOtp(identifier: string): Promise<string> {
  const row = await db
    .selectFrom('otp_codes')
    .where('identifier', '=', identifier)
    .where('verified', '=', false)
    .orderBy('created_at', 'desc')
    .select('code')
    .executeTakeFirstOrThrow();
  return row.code;
}

function getRefreshToken(res: request.Response): string {
  const cookie = (res.headers['set-cookie'] as unknown as string[] | undefined)?.find((c) =>
    c.startsWith('refreshToken='),
  );
  if (!cookie) throw new Error('No refreshToken cookie in response');
  return cookie.split(';')[0].split('=')[1];
}

describe('auth routes', () => {
  // A fresh app per test keeps the in-memory rate-limiter independent — the
  // auth suite issues many requests and would otherwise hit the 20/15min cap.
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    app = createApp();
    await db.deleteFrom('refresh_tokens').execute();
    await db.deleteFrom('otp_codes').execute();
    await db.deleteFrom('users').execute();
  });

  afterAll(async () => {
    await destroy();
  });

  describe('POST /api/auth/register', () => {
    it('[AC-01] creates a user, queues an SMS OTP, and returns the new userId', async () => {
      const response = await request(app).post('/api/auth/register').send({
        fullName: 'Register User',
        phone: PHONE,
        email: EMAIL,
        userType: 'BROWSER',
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        message: expect.any(String),
        userId: expect.any(String),
      });

      const user = await db
        .selectFrom('users')
        .where('id', '=', response.body.userId)
        .select(['full_name', 'phone', 'email', 'user_type'])
        .executeTakeFirstOrThrow();
      expect(user.full_name).toBe('Register User');
      expect(user.phone).toBe(PHONE);
      expect(user.email).toBe(EMAIL);
      expect(user.user_type).toBe('BROWSER');

      const otp = await db
        .selectFrom('otp_codes')
        .where('identifier', '=', PHONE)
        .where('otp_type', '=', 'SMS')
        .select('code')
        .executeTakeFirstOrThrow();
      expect(otp.code).toMatch(/^\d{6}$/);
    });

    it('accepts registration without an email', async () => {
      const response = await request(app).post('/api/auth/register').send({
        fullName: 'No Email User',
        phone: PHONE,
        userType: 'OWNER',
      });

      expect(response.status).toBe(201);
      const user = await db
        .selectFrom('users')
        .where('id', '=', response.body.userId)
        .select(['email', 'user_type'])
        .executeTakeFirstOrThrow();
      expect(user.email).toBeNull();
      expect(user.user_type).toBe('OWNER');
    });

    it('returns 409 when the phone is already registered', async () => {
      await db
        .insertInto('users')
        .values({ full_name: 'Existing', phone: PHONE, user_type: 'BROWSER' })
        .execute();

      const response = await request(app).post('/api/auth/register').send({
        fullName: 'Duplicate',
        phone: PHONE,
        userType: 'BROWSER',
      });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('PHONE_ALREADY_REGISTERED');
    });

    it('returns 409 when the email is already registered (different phone)', async () => {
      await db
        .insertInto('users')
        .values({
          full_name: 'Existing Email',
          phone: PHONE,
          email: EMAIL,
          user_type: 'BROWSER',
        })
        .execute();

      const response = await request(app).post('/api/auth/register').send({
        fullName: 'Duplicate Email',
        phone: '+966500009002',
        email: EMAIL,
        userType: 'BROWSER',
      });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');

      // No new user should have been created from the duplicate attempt.
      const users = await db.selectFrom('users').where('email', '=', EMAIL).select('id').execute();
      expect(users).toHaveLength(1);
    });

    it('allows two users with different emails (no false positive)', async () => {
      await db
        .insertInto('users')
        .values({
          full_name: 'First Email',
          phone: PHONE,
          email: EMAIL,
          user_type: 'BROWSER',
        })
        .execute();

      const response = await request(app).post('/api/auth/register').send({
        fullName: 'Second Email',
        phone: '+966500009003',
        email: 'other-user@example.com',
        userType: 'BROWSER',
      });

      expect(response.status).toBe(201);
    });

    it('returns 400 with validation errors for missing fields', async () => {
      const response = await request(app).post('/api/auth/register').send({
        phone: PHONE,
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error).toHaveProperty('details');
    });

    it('returns 400 for an invalid phone format', async () => {
      const response = await request(app).post('/api/auth/register').send({
        fullName: 'Bad Phone',
        phone: '123',
        userType: 'BROWSER',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    it('[AC-05] sends an SMS OTP when the identifier is a phone number', async () => {
      await db
        .insertInto('users')
        .values({ full_name: 'Login User', phone: PHONE, user_type: 'BROWSER' })
        .execute();

      const response = await request(app).post('/api/auth/login').send({ identifier: PHONE });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ message: expect.any(String), type: 'sms' });

      const otp = await db
        .selectFrom('otp_codes')
        .where('identifier', '=', PHONE)
        .where('otp_type', '=', 'SMS')
        .select('code')
        .executeTakeFirstOrThrow();
      expect(otp.code).toMatch(/^\d{6}$/);
    });

    it('sends an email OTP when the identifier contains @', async () => {
      await db
        .insertInto('users')
        .values({
          full_name: 'Email User',
          phone: PHONE,
          email: EMAIL,
          user_type: 'BROWSER',
        })
        .execute();

      const response = await request(app).post('/api/auth/login').send({ identifier: EMAIL });

      expect(response.status).toBe(200);
      expect(response.body.type).toBe('email');

      const otp = await db
        .selectFrom('otp_codes')
        .where('identifier', '=', EMAIL)
        .where('otp_type', '=', 'EMAIL')
        .select('code')
        .executeTakeFirstOrThrow();
      expect(otp.code).toMatch(/^\d{6}$/);
    });

    it('returns 404 when no user exists for the identifier', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ identifier: '+966500009999' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('returns 400 when the identifier is missing', async () => {
      const response = await request(app).post('/api/auth/login').send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/verify', () => {
    it('[AC-06] completes the register → verify flow and returns tokens + user', async () => {
      // Register
      const reg = await request(app).post('/api/auth/register').send({
        fullName: 'Flow User',
        phone: PHONE,
        userType: 'BROWSER',
      });
      expect(reg.status).toBe(201);

      const code = await latestOtp(PHONE);

      const verify = await request(app).post('/api/auth/verify').send({
        identifier: PHONE,
        code,
      });

      expect(verify.status).toBe(200);
      expect(verify.body).toMatchObject({
        accessToken: expect.any(String),
        user: {
          id: reg.body.userId,
          fullName: 'Flow User',
          phone: PHONE,
          userType: 'BROWSER',
        },
      });

      // Access token is a valid JWT signed with JWT_SECRET
      const decoded = jwt.verify(verify.body.accessToken, process.env.JWT_SECRET as string) as {
        userId: string;
      };
      expect(decoded.userId).toBe(reg.body.userId);

      // Refresh token persisted
      const rt = getRefreshToken(verify);
      const refreshRow = await db
        .selectFrom('refresh_tokens')
        .where('token', '=', rt)
        .select('user_id')
        .executeTakeFirstOrThrow();
      expect(refreshRow.user_id).toBe(reg.body.userId);
    });

    it('completes the login → verify flow for an email identifier', async () => {
      const { id } = await db
        .insertInto('users')
        .values({
          full_name: 'Email Login',
          phone: PHONE,
          email: EMAIL,
          user_type: 'OWNER',
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      const login = await request(app).post('/api/auth/login').send({ identifier: EMAIL });
      expect(login.status).toBe(200);

      const code = await latestOtp(EMAIL);

      const verify = await request(app).post('/api/auth/verify').send({
        identifier: EMAIL,
        code,
      });

      expect(verify.status).toBe(200);
      expect(verify.body.user).toMatchObject({
        id,
        email: EMAIL,
        userType: 'OWNER',
      });
    });

    it('returns 400 for an invalid OTP code', async () => {
      await db
        .insertInto('users')
        .values({ full_name: 'Bad Code', phone: PHONE, user_type: 'BROWSER' })
        .execute();
      await request(app).post('/api/auth/login').send({ identifier: PHONE });

      const response = await request(app).post('/api/auth/verify').send({
        identifier: PHONE,
        code: '000000',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('OTP_INVALID');
    });

    it('returns 400 when required fields are missing', async () => {
      const response = await request(app).post('/api/auth/verify').send({ identifier: PHONE });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns a new access token AND a rotated refresh token for a valid token', async () => {
      const reg = await request(app).post('/api/auth/register').send({
        fullName: 'Refresh User',
        phone: PHONE,
        userType: 'BROWSER',
      });
      const code = await latestOtp(PHONE);
      const verify = await request(app).post('/api/auth/verify').send({ identifier: PHONE, code });
      const rt1 = getRefreshToken(verify);

      const refresh = await request(app).post('/api/auth/refresh').send({ refreshToken: rt1 });

      expect(refresh.status).toBe(200);
      expect(refresh.body.accessToken).toEqual(expect.any(String));

      const decoded = jwt.verify(refresh.body.accessToken, process.env.JWT_SECRET as string) as {
        userId: string;
      };
      expect(decoded.userId).toBe(reg.body.userId);

      // The newly issued refresh token is persisted and bound to the same user.
      const rt2 = getRefreshToken(refresh);
      expect(rt2).not.toBe(rt1);
      const row = await db
        .selectFrom('refresh_tokens')
        .where('token', '=', rt2)
        .select('user_id')
        .executeTakeFirstOrThrow();
      expect(row.user_id).toBe(reg.body.userId);
    });

    it('invalidates the original refresh token after use (second call returns 401)', async () => {
      await request(app).post('/api/auth/register').send({
        fullName: 'Replay User',
        phone: PHONE,
        userType: 'BROWSER',
      });
      const code = await latestOtp(PHONE);
      const verify = await request(app).post('/api/auth/verify').send({ identifier: PHONE, code });

      const first = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: getRefreshToken(verify) });
      expect(first.status).toBe(200);

      const replay = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: getRefreshToken(verify) });
      expect(replay.status).toBe(401);
      expect(replay.body.error.code).toBe('UNAUTHORIZED');
    });

    it('the newly issued refresh token can itself be used exactly once', async () => {
      await request(app).post('/api/auth/register').send({
        fullName: 'Chain User',
        phone: PHONE,
        userType: 'BROWSER',
      });
      const code = await latestOtp(PHONE);
      const verify = await request(app).post('/api/auth/verify').send({ identifier: PHONE, code });
      const rt1 = getRefreshToken(verify);

      const first = await request(app).post('/api/auth/refresh').send({ refreshToken: rt1 });
      expect(first.status).toBe(200);
      const rt2 = getRefreshToken(first);

      const second = await request(app).post('/api/auth/refresh').send({ refreshToken: rt2 });
      expect(second.status).toBe(200);

      // After rotation the previously issued token is also invalidated.
      const replay = await request(app).post('/api/auth/refresh').send({ refreshToken: rt1 });
      expect(replay.status).toBe(401);
    });

    it('returns 401 for an unknown refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'does-not-exist' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when refreshToken is missing', async () => {
      const response = await request(app).post('/api/auth/refresh').send({});

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('[AC-08] deletes the refresh token and returns a success message', async () => {
      await request(app).post('/api/auth/register').send({
        fullName: 'Logout User',
        phone: PHONE,
        userType: 'BROWSER',
      });
      const code = await latestOtp(PHONE);
      const verify = await request(app).post('/api/auth/verify').send({ identifier: PHONE, code });
      const rt = getRefreshToken(verify);

      const logout = await request(app).post('/api/auth/logout').send({ refreshToken: rt });

      expect(logout.status).toBe(200);
      expect(logout.body).toMatchObject({ message: expect.any(String) });

      // Subsequent refresh with the same token must fail.
      const refreshAfter = await request(app).post('/api/auth/refresh').send({ refreshToken: rt });
      expect(refreshAfter.status).toBe(401);

      const row = await db
        .selectFrom('refresh_tokens')
        .where('token', '=', rt)
        .select('id')
        .executeTakeFirst();
      expect(row).toBeUndefined();
    });

    it('returns 200 (no error) when no refresh token is present', async () => {
      const response = await request(app).post('/api/auth/logout').send({});

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the authenticated user profile for a valid token', async () => {
      const reg = await request(app).post('/api/auth/register').send({
        fullName: 'Me User',
        phone: PHONE,
        email: EMAIL,
        userType: 'OWNER',
      });
      const code = await latestOtp(PHONE);
      const verify = await request(app).post('/api/auth/verify').send({ identifier: PHONE, code });

      const me = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${verify.body.accessToken}`);

      expect(me.status).toBe(200);
      expect(me.body).toMatchObject({
        id: reg.body.userId,
        fullName: 'Me User',
        phone: PHONE,
        email: EMAIL,
        userType: 'OWNER',
      });
    });

    it('[AC-09] returns 401 when the Authorization header is missing', async () => {
      const response = await request(app).get('/api/auth/me');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when the token is invalid or expired', async () => {
      const expired = jwt.sign(
        { userId: '00000000-0000-0000-0000-000000000000' },
        process.env.JWT_SECRET as string,
        { expiresIn: '-1s' },
      );
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expired}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when the token references a user that no longer exists', async () => {
      const secret = process.env.JWT_SECRET as string;
      const token = jwt.sign({ userId: '00000000-0000-0000-0000-000000000000' }, secret, {
        expiresIn: '15m',
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('rate limiting', () => {
    it('[AC-39] blocks the 21st rapid registration request (20/15min window)', async () => {
      for (let i = 0; i < 20; i++) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            fullName: `Rate User ${i}`,
            phone: `+9665000091${i.toString().padStart(2, '0')}`,
            userType: 'BROWSER',
          });
        expect(res.status).toBe(201);
      }

      const blocked = await request(app)
        .post('/api/auth/register')
        .send({ fullName: 'Blocked', phone: '+966500009200', userType: 'BROWSER' });

      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('RATE_LIMITED');
    });

    it('rate limit resets with a fresh app instance', async () => {
      for (let i = 0; i < 20; i++) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            fullName: `Exhaust User ${i}`,
            phone: `+9665000093${i.toString().padStart(2, '0')}`,
            userType: 'BROWSER',
          });
        expect(res.status).toBe(201);
      }

      const blocked = await request(app)
        .post('/api/auth/register')
        .send({ fullName: 'Exhausted', phone: '+966500009400', userType: 'BROWSER' });
      expect(blocked.status).toBe(429);

      const freshApp = createApp();
      const fresh = await request(freshApp)
        .post('/api/auth/register')
        .send({ fullName: 'Fresh Start', phone: '+966500009401', userType: 'BROWSER' });
      expect(fresh.status).toBe(201);
    });

    it('blocks the 21st rapid login request', async () => {
      for (let i = 0; i < 20; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ identifier: `+9665000095${i.toString().padStart(2, '0')}` });
        expect(res.status).toBe(404);
      }

      const blocked = await request(app)
        .post('/api/auth/login')
        .send({ identifier: '+966500009599' });

      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('PRD §2 — acceptance criteria', () => {
    it('[AC-02] verifies OTP is sent via SMS for phone and via email for email', async () => {
      // SMS OTP for phone registration
      const reg = await request(app).post('/api/auth/register').send({
        fullName: 'AC02 User',
        phone: '+966500009901',
        email: 'ac02@example.com',
        userType: 'BROWSER',
      });
      expect(reg.status).toBe(201);

      const smsOtp = await db
        .selectFrom('otp_codes')
        .where('identifier', '=', '+966500009901')
        .where('otp_type', '=', 'SMS')
        .select('code')
        .executeTakeFirstOrThrow();
      expect(smsOtp.code).toMatch(/^\d{6}$/);
      expect(reg.body).toMatchObject({ message: expect.any(String), userId: expect.any(String) });

      // Email OTP for email login
      await db
        .insertInto('users')
        .values({ full_name: 'AC02 Email', phone: '+966500009902', email: 'ac02-login@example.com', user_type: 'BROWSER' })
        .execute();

      const login = await request(app).post('/api/auth/login').send({ identifier: 'ac02-login@example.com' });
      expect(login.status).toBe(200);
      expect(login.body.type).toBe('email');

      const emailOtp = await db
        .selectFrom('otp_codes')
        .where('identifier', '=', 'ac02-login@example.com')
        .where('otp_type', '=', 'EMAIL')
        .select('code')
        .executeTakeFirstOrThrow();
      expect(emailOtp.code).toMatch(/^\d{6}$/);
    });

    it('[AC-03] given an expired OTP when verifying then the API returns 400/OTP_EXPIRED', async () => {
      // Create a user and generate an OTP
      await request(app).post('/api/auth/register').send({
        fullName: 'AC03 User',
        phone: '+966500009903',
        userType: 'BROWSER',
      });

      // Directly insert an already-expired OTP
      const expiredCode = '999999';
      await db
        .insertInto('otp_codes')
        .values({
          identifier: '+966500009903',
          code: expiredCode,
          otp_type: 'SMS',
          expires_at: new Date(Date.now() - 60_000), // 1 minute in the past
          verified: false,
        })
        .execute();

      const response = await request(app).post('/api/auth/verify').send({
        identifier: '+966500009903',
        code: expiredCode,
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('OTP_EXPIRED');
    });

    it('[AC-07] full refresh token rotation: use token → get new → use old → 401', async () => {
      await request(app).post('/api/auth/register').send({
        fullName: 'AC07 User',
        phone: '+966500009904',
        userType: 'BROWSER',
      });
      const code = await latestOtp('+966500009904');
      const verify = await request(app).post('/api/auth/verify').send({ identifier: '+966500009904', code });
      const rt1 = getRefreshToken(verify);

      // Use refresh token → get new pair
      const first = await request(app).post('/api/auth/refresh').send({ refreshToken: rt1 });
      expect(first.status).toBe(200);
      expect(first.body.accessToken).toEqual(expect.any(String));

      // Old refresh token is now invalidated → 401
      const replay = await request(app).post('/api/auth/refresh').send({ refreshToken: rt1 });
      expect(replay.status).toBe(401);
      expect(replay.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('edge cases', () => {
    it('returns 404 when logging in with email for a phone-only user', async () => {
      await db
        .insertInto('users')
        .values({ full_name: 'Phone Only', phone: PHONE, user_type: 'BROWSER' })
        .execute();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier: EMAIL });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('returns 400 when OTP type mismatches identifier (SMS code with email)', async () => {
      await request(app).post('/api/auth/register').send({
        fullName: 'Mismatch User',
        phone: PHONE,
        email: EMAIL,
        userType: 'BROWSER',
      });

      const smsCode = await latestOtp(PHONE);

      const res = await request(app).post('/api/auth/verify').send({
        identifier: EMAIL,
        code: smsCode,
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('OTP_INVALID');
    });

    it('returns 400 for fullName exceeding 120 characters', async () => {
      const res = await request(app).post('/api/auth/register').send({
        fullName: 'A'.repeat(121),
        phone: PHONE,
        userType: 'BROWSER',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 when replaying a rotated refresh token', async () => {
      await request(app).post('/api/auth/register').send({
        fullName: 'Rotate Guard',
        phone: PHONE,
        userType: 'BROWSER',
      });
      const code = await latestOtp(PHONE);
      const verify = await request(app).post('/api/auth/verify').send({ identifier: PHONE, code });
      const rt1 = getRefreshToken(verify);

      const first = await request(app).post('/api/auth/refresh').send({ refreshToken: rt1 });
      expect(first.status).toBe(200);

      const replay = await request(app).post('/api/auth/refresh').send({ refreshToken: rt1 });
      expect(replay.status).toBe(401);
      expect(replay.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('full auth lifecycle', () => {
    it('completes register→login→verify→me→refresh→logout in a single flow', async () => {
      const userPhone = '+966500009900';
      const userEmail = 'lifecycle@example.com';

      // 1. Register
      const reg = await request(app).post('/api/auth/register').send({
        fullName: 'Lifecycle User',
        phone: userPhone,
        email: userEmail,
        userType: 'BROWSER',
      });
      expect(reg.status).toBe(201);
      const userId = reg.body.userId;

      // 2. Login via email (independent OTP type, no cooldown conflict with SMS)
      const login = await request(app).post('/api/auth/login').send({ identifier: userEmail });
      expect(login.status).toBe(200);
      expect(login.body.type).toBe('email');

      const emailOtp = await latestOtp(userEmail);

      // 3. Verify with wrong code
      const wrong = await request(app).post('/api/auth/verify').send({
        identifier: userEmail,
        code: '000000',
      });
      expect(wrong.status).toBe(400);
      expect(wrong.body.error.code).toBe('OTP_INVALID');

      // 4. Verify with correct code
      const verify = await request(app).post('/api/auth/verify').send({
        identifier: userEmail,
        code: emailOtp,
      });
      expect(verify.status).toBe(200);
      expect(verify.body.accessToken).toEqual(expect.any(String));
      expect(verify.body.user).toMatchObject({ id: userId, fullName: 'Lifecycle User' });
      const accessToken1 = verify.body.accessToken;
      const rt1 = getRefreshToken(verify);

      // 5. GET /me with the original JWT
      const me1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken1}`);
      expect(me1.status).toBe(200);
      expect(me1.body.id).toBe(userId);

      // 6. Refresh — rotates token pair
      const refresh1 = await request(app).post('/api/auth/refresh').send({ refreshToken: rt1 });
      expect(refresh1.status).toBe(200);
      expect(refresh1.body.accessToken).toEqual(expect.any(String));
      const accessToken2 = refresh1.body.accessToken;
      const rt2 = getRefreshToken(refresh1);
      expect(rt2).not.toBe(rt1);

      // 7. GET /me with the new JWT
      const me2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken2}`);
      expect(me2.status).toBe(200);
      expect(me2.body.id).toBe(userId);

      // 8. The old JWT is stateless and remains valid until expiry.
      const me3 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken1}`);
      expect(me3.status).toBe(200);

      // 9. The old refresh token was consumed in step 6
      const replay = await request(app).post('/api/auth/refresh').send({ refreshToken: rt1 });
      expect(replay.status).toBe(401);
      expect(replay.body.error.code).toBe('UNAUTHORIZED');

      // 10. Logout — revokes active refresh token
      const logout = await request(app).post('/api/auth/logout').send({ refreshToken: rt2 });
      expect(logout.status).toBe(200);

      // 11. Revoked token cannot be used after logout
      const afterLogout = await request(app).post('/api/auth/refresh').send({ refreshToken: rt2 });
      expect(afterLogout.status).toBe(401);
      expect(afterLogout.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
