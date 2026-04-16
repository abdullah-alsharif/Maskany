/**
 * Web push notification service (T-040, PRD §7.2).
 *
 * Wraps @capacitor/push-notifications for native (iOS/Android) builds.
 * On plain web browsers Capacitor.isNativePlatform() returns false and all
 * operations silently no-op — no Web Push API is attempted.
 *
 * Usage:
 *   - Call initPushNotifications() after the user is authenticated.
 *   - Call unregisterPushToken() on logout.
 */
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { apiClient } from './api';

async function registerTokenWithApi(token: string): Promise<void> {
  const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';
  await apiClient.post('/api/push/register', { token, platform });
}

/**
 * Request permission, register with FCM/APNs, and send the device token to
 * the API. Safe to call on every authenticated load — the API upserts.
 */
export async function initPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  const permStatus = await PushNotifications.checkPermissions();
  const resolvedStatus =
    permStatus.receive === 'prompt'
      ? (await PushNotifications.requestPermissions()).receive
      : permStatus.receive;

  if (resolvedStatus !== 'granted') {
    return;
  }

  PushNotifications.addListener('registration', async (token) => {
    try {
      await registerTokenWithApi(token.value);
    } catch (err) {
      console.warn('[push-service] Failed to register token with API:', err);
    }
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.warn('[push-service] Registration error:', err.error);
  });

  await PushNotifications.register();
}

/**
 * Remove all listeners and clear the device token from the API (on logout).
 */
export async function unregisterPushToken(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  await PushNotifications.removeAllListeners();
  try {
    await apiClient.delete('/api/push/token');
  } catch (err) {
    console.warn('[push-service] Failed to clear push token on logout:', err);
  }
}
