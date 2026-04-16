/**
 * T-026 — Token storage unit tests.
 *
 * The token storage abstraction is the single persistence boundary for auth
 * session state. localStorage is used on web; the shape is designed so a
 * Capacitor Preferences adapter can be swapped in without touching callers.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

describe('tokenStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns null for every field when nothing is persisted', () => {
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
    expect(tokenStorage.getUser()).toBeNull();
  });

  it('persists and reads back tokens and the user profile via setSession', () => {
    tokenStorage.setSession({
      accessToken: 'access-xyz',
      user: USER,
    });

    expect(tokenStorage.getAccessToken()).toBe('access-xyz');
    expect(tokenStorage.getUser()).toEqual(USER);
  });

  it('setAccessToken rotates only the access token and leaves user intact', () => {
    tokenStorage.setSession({
      accessToken: 'old-access',
      user: USER,
    });

    tokenStorage.setAccessToken('new-access');

    expect(tokenStorage.getAccessToken()).toBe('new-access');
    expect(tokenStorage.getUser()).toEqual(USER);
  });

  it('clear removes every key so a logged-out user reads back null', () => {
    tokenStorage.setSession({
      accessToken: 'access-xyz',
      user: USER,
    });

    tokenStorage.clear();

    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getUser()).toBeNull();
  });

  it('returns null (not a parse error) when the persisted user is malformed JSON', () => {
    localStorage.setItem('maskany:user', '{not valid json');
    expect(tokenStorage.getUser()).toBeNull();
  });
});
