/**
 * Unit tests for useFilters (T-016 AC).
 *
 * Verifies that the hook reads filter state from URL query params,
 * commits draft filters back to the URL on apply, clears all filters,
 * computes an active-filter-count, and produces an API-ready queryParams
 * object.
 *
 * Uses next-navigation mock to provide search params and track URL changes.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFilters, type Filters } from '../src/hooks/use-filters';
import { setCurrentPath, resetRouter, getReplacedPaths } from './mocks/next-navigation';

beforeEach(() => {
  resetRouter();
});

afterEach(() => {
  resetRouter();
});

describe('useFilters', () => {
  it('parses filters from URL query params', () => {
    setCurrentPath(
      '/?q=pool&type=APARTMENT,VILLA&city=Riyadh&minPrice=100&maxPrice=500' +
        '&rooms=2&bathrooms=1&minRating=4&amenities=wifi,parking&sort=price_asc',
    );
    const { result } = renderHook(() => useFilters());
    const f = result.current.filters;
    expect(f.query).toBe('pool');
    expect(f.types).toEqual(['APARTMENT', 'VILLA']);
    expect(f.city).toBe('Riyadh');
    expect(f.minPrice).toBe(100);
    expect(f.maxPrice).toBe(500);
    expect(f.rooms).toBe(2);
    expect(f.bathrooms).toBe(1);
    expect(f.minRating).toBe(4);
    expect(f.amenities).toEqual(['wifi', 'parking']);
    expect(f.sort).toBe('price_asc');
  });

  it('returns safe defaults when the URL has no filters', () => {
    setCurrentPath('/');
    const { result } = renderHook(() => useFilters());
    const f = result.current.filters;
    expect(f.query).toBeUndefined();
    expect(f.types).toEqual([]);
    expect(f.amenities).toEqual([]);
    expect(f.minPrice).toBeUndefined();
    expect(f.sort).toBeUndefined();
    expect(result.current.activeFilterCount).toBe(0);
  });

  it('activeFilterCount counts each active filter group (excluding query and sort)', () => {
    setCurrentPath(
      '/?q=pool&type=APARTMENT&city=Riyadh&minPrice=100&rooms=2&amenities=wifi&sort=price_asc',
    );
    const { result } = renderHook(() => useFilters());
    // Active groups: types, city, price (min or max), rooms, amenities → 5
    expect(result.current.activeFilterCount).toBe(5);
  });

  it('counts a price range as a single active filter even if both min and max are set', () => {
    setCurrentPath('/?minPrice=100&maxPrice=300');
    const { result } = renderHook(() => useFilters());
    expect(result.current.activeFilterCount).toBe(1);
  });

  it('apply() navigates to URL with filter query params', () => {
    setCurrentPath('/');
    const { result } = renderHook(() => useFilters());
    const draft: Filters = {
      query: 'villa',
      types: ['VILLA', 'APARTMENT'],
      city: 'Jeddah',
      minPrice: 200,
      maxPrice: 1000,
      rooms: 3,
      bathrooms: 2,
      minRating: 4,
      amenities: ['pool', 'wifi'],
      sort: 'rating_desc',
    };
    act(() => {
      result.current.apply(draft);
    });
    const paths = getReplacedPaths();
    expect(paths.length).toBeGreaterThan(0);
    const lastPath = paths[paths.length - 1]!;
    const params = new URLSearchParams(lastPath.split('?')[1] ?? '');
    expect(params.get('q')).toBe('villa');
    expect(params.get('type')).toBe('VILLA,APARTMENT');
    expect(params.get('city')).toBe('Jeddah');
    expect(params.get('minPrice')).toBe('200');
    expect(params.get('maxPrice')).toBe('1000');
    expect(params.get('rooms')).toBe('3');
    expect(params.get('bathrooms')).toBe('2');
    expect(params.get('minRating')).toBe('4');
    expect(params.get('amenities')).toBe('pool,wifi');
    expect(params.get('sort')).toBe('rating_desc');
  });

  it('apply() omits empty/default fields from the URL', () => {
    setCurrentPath('/?q=old');
    const { result } = renderHook(() => useFilters());
    act(() => {
      result.current.apply({ types: [], amenities: [] });
    });
    const paths = getReplacedPaths();
    const lastPath = paths[paths.length - 1]!;
    expect(lastPath).not.toContain('q=');
    expect(lastPath).not.toContain('type=');
  });

  it('clearAll() resets the URL to empty query string', () => {
    setCurrentPath('/?type=APARTMENT&city=Riyadh');
    const { result } = renderHook(() => useFilters());
    act(() => {
      result.current.clearAll();
    });
    const paths = getReplacedPaths();
    const lastPath = paths[paths.length - 1]!;
    expect(lastPath).not.toContain('?');
  });

  it('setQuery() updates only the q param', () => {
    setCurrentPath('/?type=APARTMENT&city=Riyadh');
    const { result } = renderHook(() => useFilters());
    act(() => {
      result.current.setQuery('pool');
    });
    const paths = getReplacedPaths();
    const lastPath = paths[paths.length - 1]!;
    const params = new URLSearchParams(lastPath.split('?')[1] ?? '');
    expect(params.get('q')).toBe('pool');
    expect(params.get('type')).toBe('APARTMENT');
    expect(params.get('city')).toBe('Riyadh');
  });

  it('setQuery("") removes the q param', () => {
    setCurrentPath('/?q=pool&type=APARTMENT');
    const { result } = renderHook(() => useFilters());
    act(() => {
      result.current.setQuery('');
    });
    const paths = getReplacedPaths();
    const lastPath = paths[paths.length - 1]!;
    const params = new URLSearchParams(lastPath.split('?')[1] ?? '');
    expect(params.get('q')).toBeNull();
    expect(params.get('type')).toBe('APARTMENT');
  });

  it('queryParams exposes an API-ready param object (API param names)', () => {
    setCurrentPath('/?q=pool&type=APARTMENT,VILLA&minPrice=100&amenities=wifi');
    const { result } = renderHook(() => useFilters());
    expect(result.current.queryParams).toEqual({
      q: 'pool',
      type: 'APARTMENT,VILLA',
      minPrice: '100',
      amenities: 'wifi',
    });
  });
});
