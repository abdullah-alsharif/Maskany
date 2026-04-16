import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { FAVORITES_STORAGE_KEY, useFavorites } from '../src/hooks/use-favorites';

describe('useFavorites', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns an empty list when localStorage has no favorites', () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('hydrates favorites from localStorage on mount', () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(['alpha', 'beta']));
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual(['alpha', 'beta']);
    expect(result.current.count).toBe(2);
  });

  it('adds an id when toggleFavorite is called for the first time', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => result.current.toggleFavorite('prop-1'));
    expect(result.current.isFavorite('prop-1')).toBe(true);
    expect(result.current.favorites).toContain('prop-1');
    const stored = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? '[]');
    expect(stored).toContain('prop-1');
  });

  it('removes an id when toggleFavorite is called twice', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => result.current.toggleFavorite('prop-1'));
    act(() => result.current.toggleFavorite('prop-1'));
    expect(result.current.isFavorite('prop-1')).toBe(false);
    expect(result.current.favorites).not.toContain('prop-1');
    const stored = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? '[]');
    expect(stored).not.toContain('prop-1');
  });

  it('reports isFavorite=false for ids that were never saved', () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.isFavorite('never-saved')).toBe(false);
  });

  it('falls back to an empty list when localStorage contains malformed JSON', () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, 'not-json-at-all');
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
  });

  it('ignores non-array values stored under the favorites key', () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify({ malformed: true }));
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
  });

  it('filters out non-string entries from the stored array', () => {
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(['ok', 42, null, { id: 'bad' }]),
    );
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual(['ok']);
  });

  it('synchronises state across multiple hook instances in the same tab', () => {
    const a = renderHook(() => useFavorites());
    const b = renderHook(() => useFavorites());
    act(() => a.result.current.toggleFavorite('shared-id'));
    expect(b.result.current.isFavorite('shared-id')).toBe(true);
    act(() => b.result.current.toggleFavorite('shared-id'));
    expect(a.result.current.isFavorite('shared-id')).toBe(false);
  });

  it('reacts to cross-tab storage events by re-reading localStorage', () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
    act(() => {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(['x', 'y']));
      window.dispatchEvent(new StorageEvent('storage', { key: FAVORITES_STORAGE_KEY }));
    });
    expect(result.current.favorites).toEqual(['x', 'y']);
  });

  it('keeps existing favorites when adding a new one (idempotent insert)', () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(['a']));
    const { result } = renderHook(() => useFavorites());
    act(() => result.current.toggleFavorite('b'));
    expect(result.current.favorites).toEqual(['a', 'b']);
  });
});
