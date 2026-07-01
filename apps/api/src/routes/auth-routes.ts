/**
 * Authentication routes — mounts all OTP-based auth flows under `/api/auth`.
 *
 * Endpoints (PRD §2.1-§2.4):
 *   - POST /register — create user, send SMS OTP
 *   - POST /login    — look up user, send SMS or email OTP (channel chosen
 *                      by the shape of the identifier)
 *   - POST /verify   — verify OTP, issue access + refresh tokens
 *   - POST /refresh  — rotate an access token given a valid refresh token
 *   - POST /logout   — revoke a refresh token
 *   - GET  /me       — return the authenticated user's profile
 *
 * Zod drives input validation; field-level issues surface as
 * `HttpError(400, 'VALIDATION_ERROR')` with a `details` array. All other
 * failure modes reuse the project's standard error envelope.
 */
import { createHash, randomBytes } from 'node:crypto';
import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { db } from '../lib/db.js';
import { ErrorCode, HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';
import { parseOrThrow } from '../lib/validation.js';
import {
  type AuthenticatedRequest,
  requireAuth,
  requireUserId,
} from '../middleware/auth-middleware.js';
import {
  consumeRefreshToken,
  createRefreshToken,
  deleteRefreshToken,
  guardIdentifier,
  issueAccessToken,
  REFRESH_TOKEN_TTL_MS,
} from '../services/auth-service.js';
import { isValidEmail, sendOtpEmail } from '../services/email-service.js';
import { generateOtp, verifyOtp } from '../services/otp-service.js';
import { maskPhone } from '../lib/mask.js';
import { formatOtpMessage, isValidPhoneNumber, sendSms } from '../services/sms-service.js';
import { PHONE_REGEX } from '../validators/property-validators.js';

const registerSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().regex(PHONE_REGEX, 'Phone must be in E.164 format (e.g., +9665xxxxxxxx).'),
  email: z.string().email().optional(),
  userType: z.enum(['BROWSER', 'OWNER']),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1),
});

const verifySchema = z.object({
  identifier: z.string().trim().min(1),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits.'),
});

function classifyIdentifier(identifier: string): 'SMS' | 'EMAIL' {
  return identifier.includes('@') ? 'EMAIL' : 'SMS';
}

function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
  });
}

function extractRefreshToken(req: Request): string | undefined {
  return req.body.refreshToken ?? req.cookies?.refreshToken;
}

interface UserRow {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  user_type: 'BROWSER' | 'OWNER';
  created_at: Date;
}

function toUserDto(row: UserRow): {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  userType: 'BROWSER' | 'OWNER';
  createdAt: string;
} {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    userType: row.user_type,
    createdAt: row.created_at.toISOString(),
  };
}

async function findUserByIdentifier(identifier: string): Promise<UserRow | undefined> {
  const channel = classifyIdentifier(identifier);
  const query = db
    .selectFrom('users')
    .select(['id', 'full_name', 'phone', 'email', 'user_type', 'created_at']);
  return channel === 'EMAIL'
    ? query.where('email', '=', identifier).executeTakeFirst()
    : query.where('phone', '=', identifier).executeTakeFirst();
}

export function createAuthRouter(): Router {
  const router = Router();

  router.post(
    '/register',
    asyncHandler(async (req, res) => {
      const body = parseOrThrow(registerSchema, req.body);

      await guardIdentifier(body.phone, 'phone');
      if (body.email) {
        await guardIdentifier(body.email, 'email');
      }

      const inserted = await db
        .insertInto('users')
        .values({
          full_name: body.fullName,
          phone: body.phone,
          email: body.email ?? null,
          user_type: body.userType,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      const { code } = await generateOtp(body.phone, 'SMS');
      try {
        await sendSms(body.phone, formatOtpMessage(code));
      } catch (smsErr) {
        if (body.email) {
          logger.warn('[SMS] delivery failed, falling back to email', {
            phone: maskPhone(body.phone),
            error: smsErr instanceof Error ? smsErr.message : 'Unknown',
          });
          await sendOtpEmail(body.email, code);
        } else {
          throw smsErr;
        }
      }

      res.status(201).json({
        message: 'Registration started. Enter the code we sent to verify your account.',
        userId: inserted.id,
      });
    }),
  );

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const body = parseOrThrow(loginSchema, req.body);
      const channel = classifyIdentifier(body.identifier);

      if (channel === 'SMS' && !isValidPhoneNumber(body.identifier)) {
        throw new HttpError(400, ErrorCode.VALIDATION_ERROR, 'Invalid phone number format.');
      }
      if (channel === 'EMAIL' && !isValidEmail(body.identifier)) {
        throw new HttpError(400, ErrorCode.VALIDATION_ERROR, 'Invalid email address format.');
      }

      const user = await findUserByIdentifier(body.identifier);
      if (!user) {
        throw new HttpError(404, ErrorCode.USER_NOT_FOUND, 'No account matches that identifier.');
      }

      const { code } = await generateOtp(body.identifier, channel);
      if (channel === 'SMS') {
        try {
          await sendSms(body.identifier, formatOtpMessage(code));
        } catch (smsErr) {
          if (user.email) {
            logger.warn('[SMS] delivery failed, falling back to email', {
              phone: maskPhone(body.identifier),
              error: smsErr instanceof Error ? smsErr.message : 'Unknown',
            });
            await sendOtpEmail(user.email, code);
          } else {
            throw smsErr;
          }
        }
      } else {
        await sendOtpEmail(body.identifier, code);
      }

      res.status(200).json({
        message: 'OTP sent. Enter the code to finish signing in.',
        type: channel === 'SMS' ? 'sms' : 'email',
      });
    }),
  );

  router.post(
    '/verify',
    asyncHandler(async (req, res) => {
      const body = parseOrThrow(verifySchema, req.body);
      const channel = classifyIdentifier(body.identifier);

      await verifyOtp(body.identifier, body.code, channel);

      const user = await findUserByIdentifier(body.identifier);
      if (!user) {
        throw new HttpError(401, ErrorCode.UNAUTHORIZED, 'User no longer exists.');
      }

      // Generate recovery codes on first OTP verification
      const existing = await db
        .selectFrom('recovery_codes')
        .where('user_id', '=', user.id)
        .select('id')
        .executeTakeFirst();

      let recoveryCodes: string[] | undefined;
      if (!existing) {
        recoveryCodes = await createRecoveryCodes(user.id);
      }

      const accessToken = issueAccessToken(user.id);
      const refreshToken = await createRefreshToken(user.id);
      setRefreshTokenCookie(res, refreshToken);

      res.status(200).json({
        accessToken,
        user: toUserDto(user),
        ...(recoveryCodes ? { recoveryCodes } : {}),
      });
    }),
  );

  router.post(
    '/refresh',
    asyncHandler(async (req, res) => {
      const refreshToken = extractRefreshToken(req);
      if (!refreshToken) {
        throw new HttpError(401, ErrorCode.UNAUTHORIZED, 'Missing refresh token.');
      }
      // `consumeRefreshToken` deletes the presented token atomically, so the
      // caller gets exactly one use. We immediately issue a fresh pair —
      // rotate-on-use — to keep the session alive without leaving a long-
      // lived refresh token outstanding. PRD §8.2 / T-029.
      const userId = await consumeRefreshToken(refreshToken);
      const accessToken = issueAccessToken(userId);
      const newRefreshToken = await createRefreshToken(userId);
      setRefreshTokenCookie(res, newRefreshToken);

      res.status(200).json({ accessToken });
    }),
  );

  router.post(
    '/logout',
    asyncHandler(async (req, res) => {
      const refreshToken = extractRefreshToken(req);
      if (refreshToken) {
        await deleteRefreshToken(refreshToken);
      }
      clearRefreshTokenCookie(res);
      res.status(200).json({ message: 'Logged out.' });
    }),
  );

  async function createRecoveryCodes(userId: string): Promise<string[]> {
    const codes: { plaintext: string; code_hash: string }[] = [];
    for (let i = 0; i < 8; i++) {
      const plaintext = randomBytes(5).toString('hex');
      const code_hash = createHash('sha256').update(plaintext).digest('hex');
      codes.push({ plaintext, code_hash });
    }

    await db
      .insertInto('recovery_codes')
      .values(codes.map((c) => ({ user_id: userId, code_hash: c.code_hash, used_at: null })))
      .execute();

    return codes.map((c) => c.plaintext);
  }

  const recoverSchema = z.object({
    identifier: z.string().trim().min(1),
    code: z.string().regex(/^[0-9a-f]{10}$/, 'Recovery code must be 10 characters.'),
  });

  router.post(
    '/recover',
    asyncHandler(async (req, res) => {
      const body = parseOrThrow(recoverSchema, req.body);

      const user = await findUserByIdentifier(body.identifier);
      if (!user) {
        throw new HttpError(404, ErrorCode.USER_NOT_FOUND, 'No account matches that identifier.');
      }

      const codeHash = createHash('sha256').update(body.code).digest('hex');

      const consumed = await db
        .updateTable('recovery_codes')
        .set({ used_at: new Date() })
        .where('user_id', '=', user.id)
        .where('code_hash', '=', codeHash)
        .where('used_at', 'is', null)
        .returning('id')
        .executeTakeFirst();

      if (!consumed) {
        throw new HttpError(401, ErrorCode.UNAUTHORIZED, 'Invalid or already used recovery code.');
      }

      const accessToken = issueAccessToken(user.id);
      const refreshToken = await createRefreshToken(user.id);
      setRefreshTokenCookie(res, refreshToken);

      res.status(200).json({
        accessToken,
        user: toUserDto(user),
      });
    }),
  );

  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req);

      const user = await db
        .selectFrom('users')
        .where('id', '=', userId)
        .select(['id', 'full_name', 'phone', 'email', 'user_type', 'created_at'])
        .executeTakeFirst();

      if (!user) {
        throw new HttpError(401, ErrorCode.UNAUTHORIZED, 'User no longer exists.');
      }

      res.status(200).json(toUserDto(user));
    }),
  );

  return router;
}
