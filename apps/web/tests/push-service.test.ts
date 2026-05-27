import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import { apiClient } from '@/services/api';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
    getPlatform: vi.fn(),
  },
}));

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    addListener: vi.fn(),
    removeAllListeners: vi.fn(),
    register: vi.fn(),
  },
}));

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { initPushNotifications, unregisterPushToken } from '@/services/push-service';

let savedAdapter: AxiosAdapter | undefined;

function captureAdapter(): CapturedRequest[] {
  const captured: CapturedRequest[] = [];
  apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
    captured.push({
      url: config.url,
      method: config.method,
      data: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
      headers: config.headers as Record<string, unknown>,
    });
    const response = {
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    } as AxiosResponse;
    const validate = config.validateStatus ?? ((s: number) => s >= 200 && s < 300);
    if (!validate(response.status)) {
      throw new Error(`Request failed with status code ${response.status}`);
    }
    return response;
  }) as AxiosAdapter;
  return captured;
}

type CapturedRequest = {
  url?: string;
  method?: string;
  data?: unknown;
  headers?: Record<string, unknown>;
};

beforeEach(() => {
  savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
  vi.clearAllMocks();
});

afterEach(() => {
  apiClient.defaults.adapter = savedAdapter;
});

describe('initPushNotifications', () => {
  it('no-op on web platform', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    const captured = captureAdapter();
    await initPushNotifications();
    expect(PushNotifications.register).not.toHaveBeenCalled();
    expect(captured).toHaveLength(0);
  });

  it('returns without registering when permission is denied on native', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(PushNotifications.checkPermissions).mockResolvedValue({ receive: 'denied' });
    const captured = captureAdapter();
    await initPushNotifications();
    expect(PushNotifications.register).not.toHaveBeenCalled();
    expect(captured).toHaveLength(0);
  });

  it('prompts user when permission is prompt and then registers if granted', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
    vi.mocked(PushNotifications.checkPermissions).mockResolvedValue({ receive: 'prompt' });
    vi.mocked(PushNotifications.requestPermissions).mockResolvedValue({ receive: 'granted' });
    const captured = captureAdapter();

    let registrationCallback: (token: { value: string }) => void;
    vi.mocked(PushNotifications.addListener).mockImplementation((event, cb) => {
      if (event === 'registration') {
        registrationCallback = cb as (token: { value: string }) => void;
      }
    });

    await initPushNotifications();
    expect(PushNotifications.requestPermissions).toHaveBeenCalled();
    expect(PushNotifications.addListener).toHaveBeenCalledWith(
      'registration',
      expect.any(Function),
    );
    expect(PushNotifications.addListener).toHaveBeenCalledWith(
      'registrationError',
      expect.any(Function),
    );
    expect(PushNotifications.register).toHaveBeenCalled();

    await registrationCallback!({ value: 'device-token-123' });
    expect(captured).toHaveLength(1);
    expect(captured[0].method?.toLowerCase()).toBe('post');
    expect(captured[0].url).toBe('/api/push/register');
    expect(captured[0].data).toEqual({
      token: 'device-token-123',
      platform: expect.any(String),
    });
  });

  it('requests permission and registers when already granted', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
    vi.mocked(PushNotifications.checkPermissions).mockResolvedValue({ receive: 'granted' });

    let registrationCallback: (token: { value: string }) => void;
    vi.mocked(PushNotifications.addListener).mockImplementation((event, cb) => {
      if (event === 'registration') {
        registrationCallback = cb as (token: { value: string }) => void;
      }
    });

    const captured = captureAdapter();
    await initPushNotifications();
    expect(PushNotifications.requestPermissions).not.toHaveBeenCalled();
    expect(PushNotifications.register).toHaveBeenCalled();

    await registrationCallback!({ value: 'token-456' });
    expect(captured[0].url).toBe('/api/push/register');
  });
});

describe('unregisterPushToken', () => {
  it('no-op on web platform', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    const captured = captureAdapter();
    await unregisterPushToken();
    expect(PushNotifications.removeAllListeners).not.toHaveBeenCalled();
    expect(captured).toHaveLength(0);
  });

  it('removes listeners and sends DELETE on native platform', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const captured = captureAdapter();
    await unregisterPushToken();
    expect(PushNotifications.removeAllListeners).toHaveBeenCalled();
    expect(captured).toHaveLength(1);
    expect(captured[0].method?.toLowerCase()).toBe('delete');
    expect(captured[0].url).toBe('/api/push/token');
  });

  it('does not throw when the API call fails', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    apiClient.defaults.adapter = (async () => {
      throw new Error('Network error');
    }) as AxiosAdapter;
    await expect(unregisterPushToken()).resolves.toBeUndefined();
  });
});
