/**
 * Unit tests verifying the FCM payload shape produced by sendPushToUser (T-040).
 *
 * firebase-admin is fully mocked so no real credentials are needed.
 * The mock places a pre-existing app in admin.apps to skip initializeApp.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sendEachForMulticastMock = vi.fn().mockResolvedValue({
  responses: [{ success: true }],
  successCount: 1,
  failureCount: 0,
});

vi.mock('firebase-admin', () => ({
  apps: ['fake-app'],
  initializeApp: vi.fn(),
  credential: { cert: vi.fn() },
  messaging: vi.fn(() => ({ sendEachForMulticast: sendEachForMulticastMock })),
}));

import {
  _resetPushForTesting,
  sendPushToUser,
  registerPushToken,
} from '../src/services/push-service.js';
import { db, destroy } from '../src/lib/db.js';

describe('push-service payload formatting', () => {
  beforeEach(async () => {
    _resetPushForTesting();
    process.env.FCM_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: 'service_account' });
    sendEachForMulticastMock.mockClear();

    await db.deleteFrom('push_tokens').execute();
    await db.deleteFrom('reviews').execute();
    await db.deleteFrom('properties').execute();
    await db.deleteFrom('refresh_tokens').execute();
    await db.deleteFrom('otp_codes').execute();
    await db.deleteFrom('users').execute();
  });

  afterAll(async () => {
    _resetPushForTesting();
    delete process.env.FCM_SERVICE_ACCOUNT_JSON;
    await destroy();
  });

  it('passes title, body, and data to sendEachForMulticast', async () => {
    const row = await db
      .insertInto('users')
      .values({ full_name: 'Payload Test', phone: '+966500000030', user_type: 'OWNER' })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    await registerPushToken(row.id, 'device-token-payload', 'ios');

    await sendPushToUser(row.id, {
      title: 'New review on your listing',
      body: 'Someone left a 4-star review on your property.',
      data: { propertyId: 'prop-uuid-123' },
    });

    expect(sendEachForMulticastMock).toHaveBeenCalledOnce();
    expect(sendEachForMulticastMock).toHaveBeenCalledWith({
      tokens: ['device-token-payload'],
      notification: {
        title: 'New review on your listing',
        body: 'Someone left a 4-star review on your property.',
      },
      data: { propertyId: 'prop-uuid-123' },
    });
  });

  it('omits the data key from the multicast message when payload.data is undefined', async () => {
    const row = await db
      .insertInto('users')
      .values({ full_name: 'No Data Test', phone: '+966500000031', user_type: 'OWNER' })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    await registerPushToken(row.id, 'device-token-nodata', 'android');

    await sendPushToUser(row.id, { title: 'Hello', body: 'World' });

    expect(sendEachForMulticastMock).toHaveBeenCalledOnce();
    const msg = sendEachForMulticastMock.mock.calls[0][0] as Record<string, unknown>;
    expect(msg).not.toHaveProperty('data');
    expect(msg.notification).toEqual({ title: 'Hello', body: 'World' });
    expect(msg.tokens).toEqual(['device-token-nodata']);
  });
});
