import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FAVORITES_STORAGE_KEY, useFavorites } from '../src/hooks/use-favorites';
import { AuthContext } from '../src/context/auth-context';
import type { AuthContextValue } from '../src/context/auth-context';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    getFavorites: vi.fn<() => Promise<{ propertyId: string }[]>>().mockResolvedValue([]),
    addFavorite: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    removeFavorite: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    mergeFavorites: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  },
}));

vi.mock('../src/services/api', () => mockApi);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useFavorites', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns an empty list when localStorage has no favorites', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper: createWrapper() });
    expect(result.current.favorites).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('hydrates favorites from localStorage on mount', () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(['alpha', 'beta']));
    const { result } = renderHook(() => useFavorites(), { wrapper: createWrapper() });
    expect(result.current.favorites).toEqual(['alpha', 'beta']);
    expect(result.current.count).toBe(2);
  });

  it('adds an id when toggleFavorite is called for the first time', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper: createWrapper() });
    act(() => result.current.toggleFavorite('prop-1'));
    expect(result.current.isFavorite('prop-1')).toBe(true);
    expect(result.current.favorites).toContain('prop-1');
    const stored = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? '[]');
    expect(stored).toContain('prop-1');
  });

  it('removes an id when toggleFavorite is called twice', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper: createWrapper() });
    act(() => result.current.toggleFavorite('prop-1'));
    act(() => result.current.toggleFavorite('prop-1'));
    expect(result.current.isFavorite('prop-1')).toBe(false);
    expect(result.current.favorites).not.toContain('prop-1');
    const stored = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? '[]');
    expect(stored).not.toContain('prop-1');
  });

  it('reports isFavorite=false for ids that were never saved', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper: createWrapper() });
    expect(result.current.isFavorite('never-saved')).toBe(false);
  });

  it('falls back to an empty list when localStorage contains malformed JSON', () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, 'not-json-at-all');
    const { result } = renderHook(() => useFavorites(), { wrapper: createWrapper() });
    expect(result.current.favorites).toEqual([]);
  });

  it('ignores non-array values stored under the favorites key', () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify({ malformed: true }));
    const { result } = renderHook(() => useFavorites(), { wrapper: createWrapper() });
    expect(result.current.favorites).toEqual([]);
  });

  it('filters out non-string entries from the stored array', () => {
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(['ok', 42, null, { id: 'bad' }]),
    );
    const { result } = renderHook(() => useFavorites(), { wrapper: createWrapper() });
    expect(result.current.favorites).toEqual(['ok']);
  });

  it('synchronises state across multiple hook instances in the same tab', () => {
    const wrapper = createWrapper();
    const a = renderHook(() => useFavorites(), { wrapper });
    const b = renderHook(() => useFavorites(), { wrapper });
    act(() => a.result.current.toggleFavorite('shared-id'));
    expect(b.result.current.isFavorite('shared-id')).toBe(true);
    act(() => b.result.current.toggleFavorite('shared-id'));
    expect(a.result.current.isFavorite('shared-id')).toBe(false);
  });

  it('reacts to cross-tab storage events by re-reading localStorage', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper: createWrapper() });
    expect(result.current.favorites).toEqual([]);
    act(() => {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(['x', 'y']));
      window.dispatchEvent(new StorageEvent('storage', { key: FAVORITES_STORAGE_KEY }));
    });
    expect(result.current.favorites).toEqual(['x', 'y']);
  });

  it('keeps existing favorites when adding a new one (idempotent insert)', () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(['a']));
    const { result } = renderHook(() => useFavorites(), { wrapper: createWrapper() });
    act(() => result.current.toggleFavorite('b'));
    expect(result.current.favorites).toEqual(['a', 'b']);
  });

  describe('authenticated (useMutation)', () => {
    function createAuthWrapper(isAuthenticated = true) {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      if (isAuthenticated) {
        queryClient.setQueryData(['favorites'], []);
      }
      const authValue: AuthContextValue = {
        user: {
          id: 'user-1',
          fullName: 'A',
          phone: '123',
          email: 'a@b.com',
          userType: 'BROWSER',
          createdAt: '2025-01-01',
        },
        accessToken: 'token',
        isAuthenticated,
        isLoading: false,
        hydrated: true,
        login: vi.fn(),
        logout: vi.fn(),
        setAccessToken: vi.fn(),
      };
      return {
        wrapper: function Wrapper({ children }: { children: ReactNode }) {
          return (
            <AuthContext.Provider value={authValue}>
              <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            </AuthContext.Provider>
          );
        },
        queryClient,
      };
    }

    it('exposes toggleError as null initially', () => {
      const { wrapper } = createAuthWrapper();
      const { result } = renderHook(() => useFavorites(), { wrapper });
      expect(result.current.toggleError).toBeNull();
    });

    it('exposes toggleError on mutation failure', async () => {
      mockApi.addFavorite.mockRejectedValueOnce(new Error('Network error'));
      const { wrapper } = createAuthWrapper();
      const { result } = renderHook(() => useFavorites(), { wrapper });
      await act(async () => {
        result.current.toggleFavorite('prop-1');
        await vi.waitFor(() => expect(result.current.toggleError).not.toBeNull());
      });
      expect(result.current.toggleError).toBeInstanceOf(Error);
    });

    it('clears toggleError on successful mutation after a failure', async () => {
      mockApi.addFavorite.mockRejectedValueOnce(new Error('Network error'));
      const { wrapper } = createAuthWrapper();
      const { result } = renderHook(() => useFavorites(), { wrapper });
      await act(async () => {
        result.current.toggleFavorite('prop-1');
        await vi.waitFor(() => expect(result.current.toggleError).not.toBeNull());
      });
      mockApi.addFavorite.mockResolvedValue(undefined);
      await act(async () => {
        result.current.toggleFavorite('prop-2');
        await vi.waitFor(() => expect(result.current.toggleError).toBeNull());
      });
    });

    it('rolls back optimistic update on failure', async () => {
      mockApi.addFavorite.mockRejectedValueOnce(new Error('fail'));
      const { wrapper, queryClient } = createAuthWrapper();
      queryClient.setQueryData(['favorites'], []);
      const { result } = renderHook(() => useFavorites(), { wrapper });
      await act(async () => {
        result.current.toggleFavorite('prop-1');
        await vi.waitFor(() => expect(result.current.toggleError).not.toBeNull());
      });
      expect(result.current.favorites).not.toContain('prop-1');
    });

    it('calls removeFavorite for already-favorited properties', async () => {
      const { wrapper, queryClient } = createAuthWrapper();
      queryClient.setQueryData(['favorites'], ['prop-1']);
      const { result } = renderHook(() => useFavorites(), { wrapper });
      await act(async () => {
        result.current.toggleFavorite('prop-1');
      });
      await vi.waitFor(() => expect(mockApi.removeFavorite).toHaveBeenCalledWith('prop-1'));
    });

    it('calls addFavorite for non-favorited properties', async () => {
      const { wrapper, queryClient } = createAuthWrapper();
      queryClient.setQueryData(['favorites'], []);
      const { result } = renderHook(() => useFavorites(), { wrapper });
      await act(async () => {
        result.current.toggleFavorite('prop-1');
      });
      await vi.waitFor(() => expect(mockApi.addFavorite).toHaveBeenCalledWith('prop-1'));
    });
  });
});
