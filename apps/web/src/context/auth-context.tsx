'use client';

/**
 * Auth context and provider (T-026, PRD §2.3, §2.4).
 *
 * Holds the signed-in user and auth tokens in React state, hydrating from
 * `tokenStorage` on mount so a full page reload keeps the session alive.
 * Every mutation (login, logout, token rotation) writes through to
 * `tokenStorage` so state is single-sourced between React memory and
 * persistent storage.
 *
 * The provider also installs axios request/response interceptors on the
 * shared `apiClient` so authenticated requests carry the Bearer header and
 * 401 responses transparently trigger a single refresh + retry. See
 * `services/auth-interceptors.ts` for the pure interceptor implementation.
 */
import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiClient } from '../services/api';
import { installAuthInterceptors } from '../services/auth-interceptors';
import { logoutSession } from '../services/auth-service';
import { initPushNotifications, unregisterPushToken } from '../services/push-service';
import { tokenStorage } from '../services/token-storage';
import type { AuthResponse, User } from '../types/user';

export interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (session: AuthResponse) => void;
  logout: () => Promise<void>;
  setAccessToken: (token: string) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(() => tokenStorage.getUser());
  const [accessToken, setAccessTokenState] = useState<string | null>(() =>
    tokenStorage.getAccessToken(),
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const accessTokenRef = useRef<string | null>(accessToken);
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  const login = useCallback((session: AuthResponse) => {
    tokenStorage.setSession(session);
    setUser(session.user);
    setAccessTokenState(session.accessToken);
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([logoutSession().catch(() => {}), unregisterPushToken().catch(() => {})]);
    } finally {
      tokenStorage.clear();
      setUser(null);
      setAccessTokenState(null);
      setIsLoading(false);
      if (typeof caches !== 'undefined') {
        void caches.delete('api-properties');
      }
    }
  }, []);

  const setAccessToken = useCallback((token: string) => {
    tokenStorage.setAccessToken(token);
    setAccessTokenState(token);
  }, []);

  // Init push notifications whenever the user becomes authenticated (covers both
  // the login path and hydration from tokenStorage on mount).
  useEffect(() => {
    if (accessToken && user) {
      initPushNotifications().catch(() => {});
    }
  }, [accessToken, user]);

  // Install interceptors once; use refs so they read the current tokens.
  useEffect(() => {
    const eject = installAuthInterceptors(apiClient, {
      getAccessToken: () => accessTokenRef.current,
      onTokenRefreshed: (token) => {
        tokenStorage.setAccessToken(token);
        setAccessTokenState(token);
      },
      onRefreshFailed: () => {
        tokenStorage.clear();
        setUser(null);
        setAccessTokenState(null);
      },
    });
    return eject;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: Boolean(accessToken && user),
      isLoading,
      login,
      logout,
      setAccessToken,
    }),
    [user, accessToken, isLoading, login, logout, setAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
