import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import { apiClient } from '../src/services/api';
import { installAuthInterceptors } from '../src/services/auth-interceptors';

describe('apiClient', () => {
  it('exposes an axios instance with a configured baseURL', () => {
    expect(apiClient).toBeDefined();
    expect(typeof apiClient.get).toBe('function');
    expect(typeof apiClient.defaults.baseURL).toBe('string');
    expect(apiClient.defaults.baseURL?.length ?? 0).toBeGreaterThan(0);
  });

  it('sets JSON content-type header by default', () => {
    const headers = apiClient.defaults.headers;
    const common = (headers.common ?? {}) as Record<string, unknown>;
    const raw =
      (headers as unknown as Record<string, unknown>)['Content-Type'] ?? common['Content-Type'];
    expect(String(raw)).toMatch(/application\/json/i);
  });
});

describe('apiClient — request interceptor', () => {
  let savedAdapter: AxiosAdapter | undefined;

  beforeEach(() => {
    savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
  });

  afterEach(() => {
    apiClient.defaults.adapter = savedAdapter;
  });

  it('attaches the Bearer token via the request interceptor', async () => {
    const calls: AxiosRequestConfig[] = [];
    apiClient.defaults.adapter = (async (config) => {
      calls.push(config);
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
    }) as AxiosAdapter;

    const eject = installAuthInterceptors(apiClient, {
      getAccessToken: () => 'mytoken',
      onTokenRefreshed: () => {},
      onRefreshFailed: () => {},
    });

    await apiClient.get('/protected');

    expect(calls[0].headers?.Authorization).toBe('Bearer mytoken');
    eject();
  });
});

describe('apiClient — response interceptor', () => {
  let savedAdapter: AxiosAdapter | undefined;

  beforeEach(() => {
    savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
  });

  afterEach(() => {
    apiClient.defaults.adapter = savedAdapter;
  });

  it('handles a 401 by refreshing the token and retrying', async () => {
    let idx = 0;
    apiClient.defaults.adapter = (async (config) => {
      const callIdx = idx++;
      if (callIdx === 0) {
        const err = new Error('HTTP 401') as Error & {
          response?: AxiosResponse;
          config?: AxiosRequestConfig;
          isAxiosError?: boolean;
        };
        err.response = { data: {}, status: 401, statusText: 'Unauthorized', headers: {}, config } as AxiosResponse;
        err.config = config;
        err.isAxiosError = true;
        throw err;
      }
      if (config.url === '/auth/refresh') {
        return { data: { accessToken: 'refreshed' }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
      }
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
    }) as AxiosAdapter;

    const eject = installAuthInterceptors(apiClient, {
      getAccessToken: () => 'old',
      onTokenRefreshed: () => {},
      onRefreshFailed: () => {},
    });

    const res = await apiClient.get('/protected');
    expect(res.data).toEqual({ ok: true });
    eject();
  });
});
