/**
 * `useFavorites` — client-side favorites store backed by `localStorage`
 * (T-027, PRD §7.1).
 *
 * Favorites are a list of property ids persisted under
 * `maskany_favorites` as a JSON string array. The hook reads the stored
 * list on mount, exposes `toggleFavorite` / `isFavorite`, and keeps
 * every mounted instance (and other browser tabs) in sync through:
 *
 *   - a `storage` event listener (browser-native cross-tab sync)
 *   - a `maskany:favorites:updated` custom event dispatched on writes
 *     so other hook instances in the same tab update immediately
 *
 * Writes are defensive: malformed or non-array JSON is ignored and the
 * list is replaced with the validated value. On toggle the hook fires a
 * best-effort light haptic impact via `@capacitor/haptics` when the
 * Capacitor runtime is present, silently no-oping on the web.
 */
import { useCallback, useEffect, useState } from 'react';

export const FAVORITES_STORAGE_KEY = 'maskany_favorites';
const FAVORITES_UPDATED_EVENT = 'maskany:favorites:updated';

function readFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (raw === null || raw.length === 0) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

function writeFavorites(ids: string[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent(FAVORITES_UPDATED_EVENT));
}

function triggerHaptic(): void {
  void import('@capacitor/haptics')
    .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
    .catch(() => {
      /* haptics unavailable — running on the web without Capacitor */
    });
}

export type UseFavoritesResult = {
  favorites: string[];
  count: number;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
};

export function useFavorites(): UseFavoritesResult {
  const [favorites, setFavorites] = useState<string[]>(() => readFavorites());

  useEffect(() => {
    const sync = () => setFavorites(readFavorites());
    window.addEventListener(FAVORITES_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(FAVORITES_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    const current = readFavorites();
    const next = current.includes(id)
      ? current.filter((existing) => existing !== id)
      : [...current, id];
    writeFavorites(next);
    setFavorites(next);
    triggerHaptic();
  }, []);

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  return {
    favorites,
    count: favorites.length,
    isFavorite,
    toggleFavorite,
  };
}
