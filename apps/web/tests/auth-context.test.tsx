/**
 * T-026 — Auth context and useAuth hook tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import { AuthProvider } from '../src/context/auth-context';
import { useAuth } from '../src/hooks/use-auth';
import { apiClient } from '../src/services/api';
import { tokenStorage } from '../src/services/token-storage';
import type { User } from '../src/types/user';

const USER: User = {
  id: 'user-1',
  fullName: 'Amal Example',
  phone: '+966500000000',
  email: 'amal@example.com',
  userType: 'OWNER',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

let savedAdapter: AxiosAdapter | undefined;

beforeEach(() => {
  localStorage.clear();
  savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
  apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
    return {
      data: { message: 'ok' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    } as AxiosResponse;
  }) as AxiosAdapter;
});

afterEach(() => {
  localStorage.clear();
  apiClient.defaults.adapter = savedAdapter;
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthProvider + useAuth', () => {
  it('starts unauthenticated when no tokens are persisted', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('hydrates its state from tokenStorage on mount', () => {
    tokenStorage.setSession({
      accessToken: 'hydrated-access',
      user: USER,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(USER);
    expect(result.current.accessToken).toBe('hydrated-access');
  });

  it('login(authResponse) updates context state and persists to localStorage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.login({
        accessToken: 'access-1',
        user: USER,
      });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(USER);
    expect(tokenStorage.getAccessToken()).toBe('access-1');
    expect(tokenStorage.getUser()).toEqual(USER);
  });

  it('logout sets isLoading to true during the operation', async () => {
    let resolveLogout: (value: unknown) => void;
    const logoutGate = new Promise((r) => {
      resolveLogout = r;
    });

    const saved = apiClient.defaults.adapter;
    apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
      if (config.url === '/auth/logout') {
        await logoutGate;
      }
      if (config.url?.startsWith('/auth/me')) {
        return { data: USER, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
      }
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
    }) as AxiosAdapter;

    tokenStorage.setSession({ accessToken: 'access-1', user: USER });
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(false);

    const logoutPromise = result.current.logout();

    await act(async () => {});
    expect(result.current.isLoading).toBe(true);

    resolveLogout!(undefined);

    await act(async () => {
      await logoutPromise;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);

    apiClient.defaults.adapter = saved;
  });

  it('setAccessToken updates state AND persists to tokenStorage', () => {
    tokenStorage.setSession({
      accessToken: 'old-access',
      user: USER,
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.setAccessToken('new-access');
    });

    expect(result.current.accessToken).toBe('new-access');
    expect(tokenStorage.getAccessToken()).toBe('new-access');
    expect(tokenStorage.getUser()).toEqual(USER);
  });
});

describe('useAuth outside AuthProvider', () => {
  it('throws a descriptive error so bugs surface at dev time', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Consumer() {
      useAuth();
      return null;
    }
    expect(() => render(<Consumer />)).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});

describe('AuthProvider — interceptor lifecycle', () => {
  it('installs auth interceptors on mount that attach the Bearer header', async () => {
    const adapterCalls: AxiosRequestConfig[] = [];
    const saved = apiClient.defaults.adapter;
    apiClient.defaults.adapter = (async (config) => {
      adapterCalls.push(config);
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
    }) as AxiosAdapter;

    tokenStorage.setSession({ accessToken: 'intercepted', user: USER });

    render(
      <AuthProvider>
        <div />
      </AuthProvider>,
    );

    await waitFor(async () => {
      await apiClient.get('/test');
    });
    expect(adapterCalls[0].headers?.Authorization).toBe('Bearer intercepted');

    apiClient.defaults.adapter = saved;
  });

  it('removes interceptors on unmount (eject is called)', async () => {
    const saved = apiClient.defaults.adapter;

    const ejectSpy = vi.spyOn(apiClient.interceptors.request, 'eject');
    const ejectSpyResp = vi.spyOn(apiClient.interceptors.response, 'eject');

    const { unmount } = render(
      <AuthProvider>
        <div />
      </AuthProvider>,
    );

    unmount();

    await vi.waitFor(() => {
      expect(ejectSpy).toHaveBeenCalled();
      expect(ejectSpyResp).toHaveBeenCalled();
    });

    apiClient.defaults.adapter = saved;
  });
});

describe('AuthProvider exposes context to children', () => {
  it('children can read isAuthenticated via useAuth', () => {
    tokenStorage.setSession({
      accessToken: 'a',
      user: USER,
    });
    function Status() {
      const { isAuthenticated, user } = useAuth();
      return (
        <div>
          <span data-testid="auth-status">{isAuthenticated ? 'in' : 'out'}</span>
          <span data-testid="user-name">{user?.fullName ?? ''}</span>
        </div>
      );
    }
    render(
      <AuthProvider>
        <Status />
      </AuthProvider>,
    );
    expect(screen.getByTestId('auth-status')).toHaveTextContent('in');
    expect(screen.getByTestId('user-name')).toHaveTextContent('Amal Example');
  });
});

describe('AuthProvider — interceptor callbacks', () => {
  beforeEach(() => {
    localStorage.clear();
    savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
  });

  afterEach(() => {
    localStorage.clear();
    apiClient.defaults.adapter = savedAdapter;
  });

  it('invokes onTokenRefreshed and persists the new token on 401 retry', async () => {
    let callCount = 0;
    apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
      if (config.url === '/test' && callCount === 0) {
        callCount++;
        const err = new Error('Unauthorized') as Error & {
          response?: AxiosResponse;
          config?: AxiosRequestConfig;
          isAxiosError?: boolean;
        };
        err.response = {
          data: {},
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config,
        } as AxiosResponse;
        err.config = config;
        err.isAxiosError = true;
        throw err;
      }
      if (config.url === '/auth/refresh') {
        return {
          data: { accessToken: 'refreshed-token' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse;
      }
      callCount++;
      return {
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse;
    }) as AxiosAdapter;

    tokenStorage.setSession({ accessToken: 'old-token', user: USER });
    render(
      <AuthProvider>
        <div />
      </AuthProvider>,
    );

    await waitFor(async () => {
      await apiClient.get('/test');
    });

    expect(tokenStorage.getAccessToken()).toBe('refreshed-token');
  });

  it('invokes onRefreshFailed and clears storage on failed refresh', async () => {
    apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
      if (config.url === '/test') {
        const err = new Error('Unauthorized') as Error & {
          response?: AxiosResponse;
          config?: AxiosRequestConfig;
          isAxiosError?: boolean;
        };
        err.response = {
          data: {},
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config,
        } as AxiosResponse;
        err.config = config;
        err.isAxiosError = true;
        throw err;
      }
      if (config.url === '/auth/refresh') {
        const err = new Error('Unauthorized') as Error & {
          response?: AxiosResponse;
          config?: AxiosRequestConfig;
          isAxiosError?: boolean;
        };
        err.response = {
          data: {},
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config,
        } as AxiosResponse;
        err.config = config;
        err.isAxiosError = true;
        throw err;
      }
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
    }) as AxiosAdapter;

    tokenStorage.setSession({ accessToken: 'will-be-cleared', user: USER });
    render(
      <AuthProvider>
        <div />
      </AuthProvider>,
    );

    await expect(apiClient.get('/test')).rejects.toThrow();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getUser()).toBeNull();
  });
});

describe('AuthProvider — logout cache cleanup', () => {
  beforeEach(() => {
    localStorage.clear();
    savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: {
        delete: vi.fn().mockResolvedValue(true),
      },
    });
  });

  afterEach(() => {
    localStorage.clear();
    apiClient.defaults.adapter = savedAdapter;
    delete (globalThis as Record<string, unknown>).caches;
  });

  it('deletes api-properties cache on logout', async () => {
    apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
    }) as AxiosAdapter;

    tokenStorage.setSession({ accessToken: 'token', user: USER });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.logout();
    });

    expect(globalThis.caches.delete).toHaveBeenCalledWith('api-properties');
    expect(result.current.isAuthenticated).toBe(false);
  });
});
