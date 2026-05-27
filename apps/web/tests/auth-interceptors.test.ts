/**
 * T-026 — Axios interceptor tests.
 *
 * The interceptor module attaches the access token to outbound requests and,
 * on 401, attempts a single refresh before retrying the original request.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios, { type AxiosAdapter, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { installAuthInterceptors } from '../src/services/auth-interceptors';

function buildAdapter(
  respond: (req: AxiosRequestConfig, callIndex: number) => Partial<AxiosResponse>,
): {
  adapter: AxiosAdapter;
  calls: AxiosRequestConfig[];
} {
  const calls: AxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    const idx = calls.length;
    calls.push(config);
    const partial = respond(config, idx);
    if ((partial.status ?? 200) >= 400) {
      const error = new Error(`HTTP ${partial.status}`) as Error & {
        response?: AxiosResponse;
        config?: AxiosRequestConfig;
        isAxiosError?: boolean;
      };
      error.response = {
        data: partial.data ?? {},
        status: partial.status ?? 500,
        statusText: 'Error',
        headers: {},
        config,
      } as AxiosResponse;
      error.config = config;
      error.isAxiosError = true;
      throw error;
    }
    return {
      data: partial.data ?? {},
      status: partial.status ?? 200,
      statusText: 'OK',
      headers: {},
      config,
    } as AxiosResponse;
  };
  return { adapter, calls };
}

describe('installAuthInterceptors — request', () => {
  it('attaches an Authorization: Bearer <token> header when an access token is present', async () => {
    const { adapter, calls } = buildAdapter(() => ({ data: {} }));
    const client = axios.create({ adapter });
    installAuthInterceptors(client, {
      getAccessToken: () => 'access-xyz',
      onTokenRefreshed: () => {},
      onRefreshFailed: () => {},
    });

    await client.get('/some-protected');

    expect(String(calls[0].headers?.Authorization)).toBe('Bearer access-xyz');
  });

  it('does not attach an Authorization header when no access token is available', async () => {
    const { adapter, calls } = buildAdapter(() => ({ data: {} }));
    const client = axios.create({ adapter });
    installAuthInterceptors(client, {
      getAccessToken: () => null,
      onTokenRefreshed: () => {},
      onRefreshFailed: () => {},
    });

    await client.get('/public');

    expect(calls[0].headers?.Authorization).toBeUndefined();
  });
});

describe('installAuthInterceptors — 401 refresh', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('on 401, calls refresh, then retries the original request with the new token and resolves', async () => {
    const { adapter, calls } = buildAdapter((config, idx) => {
      if (idx === 0) return { status: 401, data: { error: { code: 'UNAUTHORIZED' } } };
      if (config.url === '/auth/refresh') return { status: 200, data: { accessToken: 'new' } };
      return { status: 200, data: { ok: true } };
    });
    const client = axios.create({ adapter });
    let stored = 'old';
    const onTokenRefreshed = vi.fn((t: string) => {
      stored = t;
    });
    installAuthInterceptors(client, {
      getAccessToken: () => stored,
      onTokenRefreshed,
      onRefreshFailed: () => {},
    });

    const res = await client.get('/protected');

    expect(res.data).toEqual({ ok: true });
    expect(onTokenRefreshed).toHaveBeenCalledWith('new');
    expect(calls).toHaveLength(3);
    expect(calls[1].url).toBe('/auth/refresh');
    expect(String(calls[2].headers?.Authorization)).toBe('Bearer new');
  });

  it('calls onRefreshFailed and rejects when the refresh call itself fails', async () => {
    const { adapter } = buildAdapter((config, idx) => {
      if (idx === 0) return { status: 401, data: {} };
      if (config.url === '/auth/refresh') return { status: 401, data: {} };
      return { status: 200, data: {} };
    });
    const client = axios.create({ adapter });
    const onRefreshFailed = vi.fn();
    installAuthInterceptors(client, {
      getAccessToken: () => 'old',
      onTokenRefreshed: () => {},
      onRefreshFailed,
    });

    await expect(client.get('/protected')).rejects.toBeTruthy();
    expect(onRefreshFailed).toHaveBeenCalledTimes(1);
  });

  it('tries refresh on 401 (cookie is auto-sent) and calls onRefreshFailed when it also fails', async () => {
    const { adapter, calls } = buildAdapter(() => ({ status: 401, data: {} }));
    const client = axios.create({ adapter });
    const onRefreshFailed = vi.fn();
    installAuthInterceptors(client, {
      getAccessToken: () => 'old',
      onTokenRefreshed: () => {},
      onRefreshFailed,
    });

    await expect(client.get('/protected')).rejects.toBeTruthy();
    // Calls: 0 = original 401, 1 = /auth/refresh attempt (which also 401s)
    expect(calls).toHaveLength(2);
    expect(onRefreshFailed).toHaveBeenCalledTimes(1);
  });

  it('does not loop: a 401 on the retry rejects rather than triggering another refresh', async () => {
    const { adapter, calls } = buildAdapter((config, idx) => {
      if (idx === 0) return { status: 401, data: {} };
      if (config.url === '/auth/refresh') return { status: 200, data: { accessToken: 'new' } };
      return { status: 401, data: {} };
    });
    const client = axios.create({ adapter });
    const onRefreshFailed = vi.fn();
    installAuthInterceptors(client, {
      getAccessToken: () => 'old',
      onTokenRefreshed: () => {},
      onRefreshFailed,
    });

    await expect(client.get('/protected')).rejects.toBeTruthy();
    expect(calls.filter((c) => c.url === '/auth/refresh')).toHaveLength(1);
  });

  it('non-401 error (500) passes through without triggering refresh', async () => {
    const { adapter, calls } = buildAdapter(() => ({ status: 500, data: {} }));
    const client = axios.create({ adapter });
    const onRefreshFailed = vi.fn();
    installAuthInterceptors(client, {
      getAccessToken: () => 'old',
      onTokenRefreshed: () => {},
      onRefreshFailed,
    });

    await expect(client.get('/broken')).rejects.toBeTruthy();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/broken');
    expect(onRefreshFailed).not.toHaveBeenCalled();
  });

  it('401 on /auth/refresh itself propagates without retry', async () => {
    const { adapter, calls } = buildAdapter(() => ({ status: 401, data: {} }));
    const client = axios.create({ adapter });
    const onRefreshFailed = vi.fn();
    installAuthInterceptors(client, {
      getAccessToken: () => 'old',
      onTokenRefreshed: () => {},
      onRefreshFailed,
    });

    await expect(client.post('/auth/refresh')).rejects.toBeTruthy();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/auth/refresh');
  });

  it('multiple concurrent 401s trigger only one refresh (queue behavior)', async () => {
    let refreshCount = 0;
    let refreshed = false;
    const { adapter, calls } = buildAdapter((config) => {
      if (config.url === '/auth/refresh') {
        refreshCount++;
        refreshed = true;
        return { data: { accessToken: 'new' }, status: 200 };
      }
      if (refreshed) {
        return { data: {}, status: 200 };
      }
      return { status: 401, data: {} };
    });
    const client = axios.create({ adapter });
    let stored = 'old';
    const onTokenRefreshed = vi.fn((t: string) => { stored = t; });
    const onRefreshFailed = vi.fn();
    installAuthInterceptors(client, {
      getAccessToken: () => stored,
      onTokenRefreshed,
      onRefreshFailed,
    });

    const [r1, r2] = await Promise.allSettled([client.get('/res1'), client.get('/res2')]);

    expect(refreshCount).toBe(1);
    expect(calls.filter((c) => c.url === '/auth/refresh')).toHaveLength(1);
    expect(onTokenRefreshed).toHaveBeenCalledTimes(1);
    expect(r1.status).toBe('fulfilled');
    expect(r2.status).toBe('fulfilled');
  });

  it('refresh response without accessToken calls onRefreshFailed', async () => {
    const { adapter, calls } = buildAdapter((config, idx) => {
      if (idx === 0) return { status: 401, data: {} };
      if (config.url === '/auth/refresh') return { status: 200, data: {} };
      return { status: 200, data: {} };
    });
    const client = axios.create({ adapter });
    const onRefreshFailed = vi.fn();
    installAuthInterceptors(client, {
      getAccessToken: () => 'old',
      onTokenRefreshed: () => {},
      onRefreshFailed,
    });

    await expect(client.get('/protected')).rejects.toBeTruthy();
    expect(calls.filter((c) => c.url === '/auth/refresh')).toHaveLength(1);
    expect(onRefreshFailed).toHaveBeenCalledTimes(1);
  });

  it('eject removes both interceptors', async () => {
    const { adapter, calls } = buildAdapter(() => ({ status: 401, data: {} }));
    const client = axios.create({ adapter });
    const onRefreshFailed = vi.fn();
    const eject = installAuthInterceptors(client, {
      getAccessToken: () => 'old',
      onTokenRefreshed: () => {},
      onRefreshFailed,
    });

    eject();

    await expect(client.get('/no-auth')).rejects.toBeTruthy();
    // Without interceptors, no refresh is attempted — only the original 401 call
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/no-auth');
    expect(onRefreshFailed).not.toHaveBeenCalled();
  });
});
