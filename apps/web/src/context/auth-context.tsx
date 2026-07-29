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
import { apiClient, mergeFavorites } from '../services/api';
import { installAuthInterceptors } from '../services/auth-interceptors';
import { logoutSession } from '../services/auth-service';
import { initPushNotifications, unregisterPushToken } from '../services/push-service';
import { tokenStorage } from '../services/token-storage';
import type { AuthResponse, User } from '../types/user';

const FAVORITES_STORAGE_KEY = 'maskany_favorites';

export interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hydrated: boolean;
  login: (session: AuthResponse) => void;
  logout: () => Promise<void>;
  setAccessToken: (token: string) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  const accessTokenRef = useRef<string | null>(accessToken);

  // Hydrate from localStorage on client mount. The useState initializer
  // cannot do this because it runs on the server during SSR, where
  // localStorage is unavailable, and React does not re-run it during
  // client hydration.
  useEffect(() => {
    setUser(tokenStorage.getUser());
    setAccessTokenState(tokenStorage.getAccessToken());
    setHydrated(true);
  }, []);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  const login = useCallback((session: AuthResponse) => {
    tokenStorage.setSession(session);
    setUser(session.user);
    setAccessTokenState(session.accessToken);
    void (async () => {
      try {
        const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const ids = parsed.filter((id): id is string => typeof id === 'string');
            if (ids.length > 0) {
              await mergeFavorites(ids);
              localStorage.removeItem(FAVORITES_STORAGE_KEY);
            }
          }
        }
      } catch {
        /* best-effort merge — never block login */
      }
    })();
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
      getRefreshToken: () => tokenStorage.getRefreshToken(),
      onTokenRefreshed: (token) => {
        tokenStorage.setAccessToken(token);
        setAccessTokenState(token);
      },
      onRefreshTokenRefreshed: (token) => {
        tokenStorage.setRefreshToken(token);
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
      hydrated,
      login,
      logout,
      setAccessToken,
    }),
    [user, accessToken, isLoading, hydrated, login, logout, setAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
