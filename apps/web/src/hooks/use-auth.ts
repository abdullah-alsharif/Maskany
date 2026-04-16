/**
 * useAuth — accessor hook for the auth context (T-026).
 *
 * Throws when used outside an `AuthProvider` so misuse surfaces immediately
 * at development time rather than silently returning `undefined`.
 */
import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '../context/auth-context';

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be called within an AuthProvider.');
  }
  return ctx;
}
