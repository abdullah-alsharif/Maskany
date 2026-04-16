/**
 * Token storage abstraction for the web client (T-026, PRD §2.3).
 *
 * Centralises the single boundary where auth session state is persisted so
 * the rest of the app only deals with in-memory state through
 * `AuthContext`. The current implementation uses `localStorage` on web;
 * swapping in `@capacitor/preferences` for native builds is a matter of
 * replacing these four getters/setters without touching callers.
 *
 * All keys are namespaced with a `maskany:` prefix so they do not collide
 * with other apps mounted on the same origin during shared-hosting or
 * Capacitor WebView usage.
 */
import type { AuthResponse, User } from '../types/user';

const ACCESS_KEY = 'maskany:accessToken';
const USER_KEY = 'maskany:user';

function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage quota / disabled storage — session simply won't persist.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const tokenStorage = {
  getAccessToken(): string | null {
    return readString(ACCESS_KEY);
  },

  getRefreshToken(): string | null {
    return null;
  },

  getUser(): User | null {
    const raw = readString(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },

  setSession(session: AuthResponse): void {
    writeString(ACCESS_KEY, session.accessToken);
    writeString(USER_KEY, JSON.stringify(session.user));
  },

  setAccessToken(token: string): void {
    writeString(ACCESS_KEY, token);
  },

  clear(): void {
    remove(ACCESS_KEY);
    remove(USER_KEY);
  },
};
