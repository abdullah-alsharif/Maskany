/**
 * Unit tests for the push service (T-040).
 * Tests payload formatting and the no-op behaviour when FCM is unconfigured.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetPushForTesting,
  registerPushToken,
  clearPushTokensForUser,
} from '../src/services/push-service.js';
import { db, destroy } from '../src/lib/db.js';
import { afterAll } from 'vitest';

async function createUser(phone: string): Promise<{ id: string }> {
  const row = await db
    .insertInto('users')
    .values({ full_name: 'Push Test', phone, user_type: 'BROWSER' })
    .returning(['id'])
    .executeTakeFirstOrThrow();
  return { id: row.id };
}

describe('push-service', () => {
  beforeEach(async () => {
    _resetPushForTesting();
    await db.deleteFrom('push_tokens').execute();
    await db.deleteFrom('reviews').execute();
    await db.deleteFrom('properties').execute();
    await db.deleteFrom('refresh_tokens').execute();
    await db.deleteFrom('otp_codes').execute();
    await db.deleteFrom('users').execute();
  });

  afterAll(async () => {
    await destroy();
  });

  it('registerPushToken stores a row in push_tokens', async () => {
    const user = await createUser('+966500000020');
    await registerPushToken(user.id, 'device-token-xyz', 'ios');

    const rows = await db
      .selectFrom('push_tokens')
      .where('user_id', '=', user.id)
      .selectAll()
      .execute();
    expect(rows).toHaveLength(1);
    expect(rows[0].token).toBe('device-token-xyz');
    expect(rows[0].platform).toBe('ios');
  });

  it('clearPushTokensForUser removes all tokens for the user', async () => {
    const user = await createUser('+966500000021');
    await registerPushToken(user.id, 'tok-a', 'ios');
    await registerPushToken(user.id, 'tok-b', 'android');

    await clearPushTokensForUser(user.id);

    const rows = await db
      .selectFrom('push_tokens')
      .where('user_id', '=', user.id)
      .selectAll()
      .execute();
    expect(rows).toHaveLength(0);
  });

  it('sendPushToUser is a no-op when FCM_SERVICE_ACCOUNT_JSON is not set', async () => {
    const originalFcm = process.env.FCM_SERVICE_ACCOUNT_JSON;
    delete process.env.FCM_SERVICE_ACCOUNT_JSON;
    _resetPushForTesting();

    const { sendPushToUser } = await import('../src/services/push-service.js');
    const user = await createUser('+966500000022');

    // Should resolve without throwing even when no FCM credentials are configured.
    await expect(sendPushToUser(user.id, { title: 'Hi', body: 'Test' })).resolves.toBeUndefined();

    if (originalFcm !== undefined) {
      process.env.FCM_SERVICE_ACCOUNT_JSON = originalFcm;
    }
    _resetPushForTesting();
  });
});
