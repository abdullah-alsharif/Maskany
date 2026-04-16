/**
 * T-026 — Auth context and useAuth hook tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
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

  it('logout clears context state and localStorage', async () => {
    tokenStorage.setSession({
      accessToken: 'access-1',
      user: USER,
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getUser()).toBeNull();
  });

  it('setAccessToken rotates only the access token (for refresh flow)', () => {
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
  });
});

describe('useAuth outside AuthProvider', () => {
  it('throws a descriptive error so bugs surface at dev time', () => {
    function Consumer() {
      useAuth();
      return null;
    }
    const spy = console.error;
    console.error = () => {};
    try {
      expect(() => render(<Consumer />)).toThrow(/AuthProvider/);
    } finally {
      console.error = spy;
    }
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
