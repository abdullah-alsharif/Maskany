import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useContext, useEffect, useState } from 'react';
import { addFavorite, getFavorites, removeFavorite } from '../services/api';
import { AuthContext } from '../context/auth-context';

export const FAVORITES_STORAGE_KEY = 'maskany_favorites';
const FAVORITES_UPDATED_EVENT = 'maskany:favorites:updated';
export const FAVORITES_QUERY_KEY = ['favorites'] as const;

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
    .catch(() => {});
}

export type UseFavoritesResult = {
  favorites: string[];
  count: number;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  toggleError: Error | null;
};

export function useFavorites(): UseFavoritesResult {
  const ctx = useContext(AuthContext);
  const isAuthenticated = ctx?.isAuthenticated ?? false;
  const queryClient = useQueryClient();

  const [localFavorites, setLocalFavorites] = useState<string[]>(() => readFavorites());

  const serverQuery = useQuery({
    queryKey: FAVORITES_QUERY_KEY,
    queryFn: async () => {
      const items = await getFavorites();
      return items.map((f) => f.propertyId);
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  useEffect(() => {
    const sync = () => setLocalFavorites(readFavorites());
    window.addEventListener(FAVORITES_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(FAVORITES_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const serverIds = serverQuery.data ?? [];
  const favorites = isAuthenticated ? serverIds : localFavorites;

  const toggleMutation = useMutation({
    mutationFn: async ({ id, wasFavorited }: { id: string; wasFavorited: boolean }) => {
      if (wasFavorited) {
        await removeFavorite(id);
      } else {
        await addFavorite(id);
      }
    },
    onMutate: async ({ id, wasFavorited }) => {
      await queryClient.cancelQueries({ queryKey: FAVORITES_QUERY_KEY });
      const snapshot = queryClient.getQueryData<string[]>(FAVORITES_QUERY_KEY) ?? [];
      const next = wasFavorited
        ? snapshot.filter((existing) => existing !== id)
        : [...snapshot, id];
      queryClient.setQueryData(FAVORITES_QUERY_KEY, next);
      return { snapshot };
    },
    onError: (_err, _variables, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(FAVORITES_QUERY_KEY, context.snapshot);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: FAVORITES_QUERY_KEY });
    },
  });

  const toggleFavorite = useCallback(
    (id: string) => {
      if (isAuthenticated) {
        const wasFavorited = favorites.includes(id);
        toggleMutation.mutate({ id, wasFavorited });
      } else {
        const current = readFavorites();
        const next = current.includes(id)
          ? current.filter((existing) => existing !== id)
          : [...current, id];
        writeFavorites(next);
        setLocalFavorites(next);
      }
      triggerHaptic();
    },
    [isAuthenticated, toggleMutation, favorites],
  );

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  return {
    favorites,
    count: favorites.length,
    isFavorite,
    toggleFavorite,
    toggleError: toggleMutation.error,
  };
}
