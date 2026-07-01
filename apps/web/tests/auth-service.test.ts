/**
 * T-026 — Auth service unit tests.
 *
 * Each test swaps the shared `apiClient`'s adapter for a capture-and-respond
 * function so we exercise the real axios pipeline (interceptors,
 * request/response transforms, status handling) without hitting the network.
 * The axios `adapter` is a first-class configuration hook — this is not
 * module mocking.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import { apiClient } from '../src/services/api';
import {
  fetchCurrentUser,
  logoutSession,
  refreshAccessToken,
  registerUser,
  requestLoginOtp,
  verifyOtpCode,
} from '../src/services/auth-service';

type CapturedRequest = {
  url?: string;
  method?: string;
  data?: unknown;
  headers?: Record<string, unknown>;
};

function installAdapter(respond: (req: CapturedRequest) => Partial<AxiosResponse>): {
  captured: CapturedRequest[];
} {
  const captured: CapturedRequest[] = [];
  const adapter: AxiosAdapter = async (config: AxiosRequestConfig) => {
    const req: CapturedRequest = {
      url: config.url,
      method: config.method,
      data: config.data ? JSON.parse(config.data as string) : undefined,
      headers: config.headers as Record<string, unknown>,
    };
    captured.push(req);
    const partial = respond(req);
    const response = {
      data: partial.data ?? {},
      status: partial.status ?? 200,
      statusText: partial.statusText ?? 'OK',
      headers: partial.headers ?? {},
      config,
    } as AxiosResponse;
    const validate = config.validateStatus ?? ((s: number) => s >= 200 && s < 300);
    if (validate(response.status)) {
      return response;
    }
    throw new Error(`Request failed with status code ${response.status}`);
  };
  apiClient.defaults.adapter = adapter;
  return { captured };
}

let savedAdapter: AxiosAdapter | undefined;

beforeEach(() => {
  savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
});

afterEach(() => {
  apiClient.defaults.adapter = savedAdapter;
});

describe('authService.registerUser', () => {
  it('POSTs to /auth/register with the registration payload and returns the server body', async () => {
    const { captured } = installAdapter(() => ({
      status: 201,
      data: { message: 'Registration started.', userId: 'user-1' },
    }));

    const result = await registerUser({
      fullName: 'Amal Example',
      phone: '+966500000000',
      email: 'amal@example.com',
      userType: 'OWNER',
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].method?.toLowerCase()).toBe('post');
    expect(captured[0].url).toBe('/auth/register');
    expect(captured[0].data).toEqual({
      fullName: 'Amal Example',
      phone: '+966500000000',
      email: 'amal@example.com',
      userType: 'OWNER',
    });
    expect(result).toEqual({ message: 'Registration started.', userId: 'user-1' });
  });

  it('omits email from the body when email is not provided', async () => {
    const { captured } = installAdapter(() => ({
      status: 201,
      data: { message: 'Registration started.', userId: 'user-1' },
    }));

    await registerUser({
      fullName: 'No Email User',
      phone: '+966500000001',
      userType: 'BROWSER',
    });

    expect(captured[0].data).toEqual({
      fullName: 'No Email User',
      phone: '+966500000001',
      userType: 'BROWSER',
    });
    expect(captured[0].data).not.toHaveProperty('email');
  });

  it('rejects when the adapter throws a network error', async () => {
    installAdapter(() => {
      throw new Error('Network Error');
    });

    await expect(
      registerUser({ fullName: 'T', phone: '+966500000000', userType: 'BROWSER' }),
    ).rejects.toThrow();
  });

  it('rejects on a 409 conflict response', async () => {
    installAdapter(() => ({
      status: 409,
      data: { error: { code: 'PHONE_TAKEN' } },
    }));

    await expect(
      registerUser({ fullName: 'T', phone: '+966500000000', userType: 'BROWSER' }),
    ).rejects.toThrow();
  });
});

describe('authService.requestLoginOtp', () => {
  it('POSTs the identifier to /auth/login and returns the channel', async () => {
    const { captured } = installAdapter(() => ({
      data: { message: 'OTP sent.', type: 'sms' },
    }));

    const result = await requestLoginOtp('+966500000000');

    expect(captured[0].url).toBe('/auth/login');
    expect(captured[0].data).toEqual({ identifier: '+966500000000' });
    expect(result).toEqual({ message: 'OTP sent.', type: 'sms' });
  });
});

describe('authService.verifyOtpCode', () => {
  it('POSTs identifier+code to /auth/verify and returns the issued session', async () => {
    const { captured } = installAdapter(() => ({
      data: {
        accessToken: 'access-abc',
        user: {
          id: 'user-1',
          fullName: 'Amal Example',
          phone: '+966500000000',
          email: null,
          userType: 'BROWSER',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      },
    }));

    const result = await verifyOtpCode('+966500000000', '123456');

    expect(captured[0].url).toBe('/auth/verify');
    expect(captured[0].data).toEqual({ identifier: '+966500000000', code: '123456' });
    expect(result.accessToken).toBe('access-abc');
    expect(result.user.id).toBe('user-1');
  });

  it('sends an empty code string when called with empty code', async () => {
    const { captured } = installAdapter(() => ({
      status: 400,
      data: { error: { code: 'INVALID_CODE' } },
    }));

    await expect(verifyOtpCode('+966500000000', '')).rejects.toThrow();
    expect(captured[0].data).toEqual({ identifier: '+966500000000', code: '' });
  });
});

describe('authService.refreshAccessToken', () => {
  it('POSTs to /auth/refresh and returns the new access token', async () => {
    const { captured } = installAdapter(() => ({ data: { accessToken: 'new-access' } }));

    const result = await refreshAccessToken();

    expect(captured[0].url).toBe('/auth/refresh');
    expect(captured[0].data).toBeUndefined();
    expect(result).toEqual({ accessToken: 'new-access' });
  });
});

describe('authService.logoutSession', () => {
  it('POSTs to /auth/logout to revoke the session', async () => {
    const { captured } = installAdapter(() => ({ data: { message: 'Logged out.' } }));

    await logoutSession();

    expect(captured[0].url).toBe('/auth/logout');
    expect(captured[0].data).toBeUndefined();
  });
});

describe('authService.fetchCurrentUser', () => {
  it('GETs /auth/me and returns the user profile', async () => {
    const { captured } = installAdapter(() => ({
      data: {
        id: 'user-1',
        fullName: 'Amal Example',
        phone: '+966500000000',
        email: null,
        userType: 'BROWSER',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    }));

    const result = await fetchCurrentUser();

    expect(captured[0].method?.toLowerCase()).toBe('get');
    expect(captured[0].url).toBe('/auth/me');
    expect(result.id).toBe('user-1');
  });
});
