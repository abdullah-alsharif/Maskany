/**
 * Push notification service (T-040, PRD §7.2).
 *
 * Sends push notifications via Firebase Cloud Messaging (FCM).
 * Initialised lazily from `FCM_SERVICE_ACCOUNT_JSON` env var (JSON string).
 * When the env var is absent (local dev / CI) all sends are silently skipped.
 *
 * The service never throws — notification failure must not fail the request
 * that triggered it (e.g., a new review).
 */
import * as admin from 'firebase-admin';
import { env } from '../config/env.js';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

let _initialised = false;
let _enabled = false;

function ensureInit(): boolean {
  if (_initialised) {
    return _enabled;
  }
  _initialised = true;
  const json = env.fcmServiceAccountJson;
  if (!json) {
    _enabled = false;
    return false;
  }
  try {
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(json) as admin.ServiceAccount;
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    _enabled = true;
  } catch (err) {
    logger.error('[push-service] Failed to initialise firebase-admin:', err);
    _enabled = false;
  }
  return _enabled;
}

export function _resetPushForTesting(): void {
  _initialised = false;
  _enabled = false;
}

/**
 * Fetch all push tokens for the given user and send a notification.
 * Errors are logged but never rethrown.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureInit()) {
    return;
  }

  const rows = await db
    .selectFrom('push_tokens')
    .where('user_id', '=', userId)
    .select('token')
    .execute();

  if (rows.length === 0) {
    return;
  }

  const tokens = rows.map((r) => r.token);
  try {
    const result = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      ...(payload.data ? { data: payload.data } : {}),
    });

    result.responses.forEach((resp, idx) => {
      if (!resp.success) {
        logger.warn(`[push-service] Token send failed (${tokens[idx]}):`, resp.error?.code);
      }
    });
  } catch (err) {
    logger.error('[push-service] sendEachForMulticast error:', err);
  }
}

/**
 * Register or refresh a device push token for the given user.
 * Upserts on the unique token column so duplicate registrations are idempotent.
 */
export async function registerPushToken(
  userId: string,
  token: string,
  platform: 'ios' | 'android' | 'web',
): Promise<void> {
  await db
    .insertInto('push_tokens')
    .values({ user_id: userId, token, platform })
    .onConflict((oc) => oc.column('token').doUpdateSet({ user_id: userId, platform }))
    .execute();
}

/**
 * Remove all push tokens for the given user (called on logout).
 */
export async function clearPushTokensForUser(userId: string): Promise<void> {
  await db.deleteFrom('push_tokens').where('user_id', '=', userId).execute();
}
