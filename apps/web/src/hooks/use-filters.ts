/**
 * `useFilters` — URL-synced filter state for the property listing page
 * (PRD §4.1, §4.3, §4.4 / T-016 AC).
 *
 * Filter state is stored exclusively in the URL query string so that
 * filtered views are shareable and bookmarkable. The hook reads the
 * current `useSearchParams` and exposes a typed `Filters` object,
 * an `apply(draft)` commit function (used by the Filter panel's
 * "Apply Filters" button), a `clearAll()` reset, and a `setQuery()`
 * helper used by the search bar to update only `q`.
 *
 * `queryParams` mirrors the current URL params with API-compatible
 * names (matches the filter-service accepted on `GET /properties`
 * per T-015) so downstream data hooks can pass them directly.
 *
 * `activeFilterCount` is the number of active filter *groups* shown on
 * the filter panel — query and sort are intentionally excluded (query
 * has its own control and sort is always set, just defaulting).
 */
'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { PropertyType } from '../types/property';

export type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'rating_desc';

export type Filters = {
  query?: string;
  types: PropertyType[];
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  rooms?: number;
  bathrooms?: number;
  minRating?: number;
  amenities: string[];
  sort?: SortOption;
};

const ALL_PROPERTY_TYPES: readonly PropertyType[] = [
  'APARTMENT',
  'ROOM',
  'CHALET',
  'VILLA',
  'HOUSE',
  'STUDIO',
  'PENTHOUSE',
  'DUPLEX',
  'OTHER',
] as const;

const ALL_SORT_OPTIONS: readonly SortOption[] = [
  'newest',
  'price_asc',
  'price_desc',
  'rating_desc',
] as const;

function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseTypes(value: string | null): PropertyType[] {
  return parseCsv(value).filter((item): item is PropertyType =>
    (ALL_PROPERTY_TYPES as readonly string[]).includes(item),
  );
}

function parseNumber(value: string | null): number | undefined {
  if (value === null || value.length === 0) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseSort(value: string | null): SortOption | undefined {
  if (value === null) return undefined;
  return (ALL_SORT_OPTIONS as readonly string[]).includes(value)
    ? (value as SortOption)
    : undefined;
}

function parseString(value: string | null): string | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function filtersToSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query && filters.query.length > 0) params.set('q', filters.query);
  if (filters.types.length > 0) params.set('type', filters.types.join(','));
  if (filters.city && filters.city.length > 0) params.set('city', filters.city);
  if (typeof filters.minPrice === 'number') params.set('minPrice', String(filters.minPrice));
  if (typeof filters.maxPrice === 'number') params.set('maxPrice', String(filters.maxPrice));
  if (typeof filters.rooms === 'number') params.set('rooms', String(filters.rooms));
  if (typeof filters.bathrooms === 'number') params.set('bathrooms', String(filters.bathrooms));
  if (typeof filters.minRating === 'number') params.set('minRating', String(filters.minRating));
  if (filters.amenities.length > 0) params.set('amenities', filters.amenities.join(','));
  if (filters.sort) params.set('sort', filters.sort);
  return params;
}

function computeActiveFilterCount(filters: Filters): number {
  let count = 0;
  if (filters.types.length > 0) count += 1;
  if (filters.city) count += 1;
  if (typeof filters.minPrice === 'number' || typeof filters.maxPrice === 'number') count += 1;
  if (typeof filters.rooms === 'number') count += 1;
  if (typeof filters.bathrooms === 'number') count += 1;
  if (typeof filters.minRating === 'number') count += 1;
  if (filters.amenities.length > 0) count += 1;
  return count;
}

export type UseFiltersResult = {
  filters: Filters;
  apply: (draft: Filters) => void;
  clearAll: () => void;
  setQuery: (value: string) => void;
  activeFilterCount: number;
  queryParams: Record<string, string>;
};

export function useFilters(): UseFiltersResult {
  const rawSearchParams = useSearchParams();
  const searchParams = useMemo(() => rawSearchParams ?? new URLSearchParams(), [rawSearchParams]);
  const router = useRouter();
  const pathname = usePathname() ?? '/';

  const setSearchParams = useCallback(
    (paramsOrUpdater: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams)) => {
      const current = new URLSearchParams(searchParams.toString());
      const next =
        typeof paramsOrUpdater === 'function' ? paramsOrUpdater(current) : paramsOrUpdater;
      const search = next.toString();
      router.replace(search ? `${pathname}?${search}` : pathname);
    },
    [searchParams, router, pathname],
  );

  const filters = useMemo<Filters>(
    () => ({
      query: parseString(searchParams.get('q')),
      types: parseTypes(searchParams.get('type')),
      city: parseString(searchParams.get('city')),
      minPrice: parseNumber(searchParams.get('minPrice')),
      maxPrice: parseNumber(searchParams.get('maxPrice')),
      rooms: parseNumber(searchParams.get('rooms')),
      bathrooms: parseNumber(searchParams.get('bathrooms')),
      minRating: parseNumber(searchParams.get('minRating')),
      amenities: parseCsv(searchParams.get('amenities')),
      sort: parseSort(searchParams.get('sort')),
    }),
    [searchParams],
  );

  const apply = useCallback(
    (draft: Filters) => {
      setSearchParams(filtersToSearchParams(draft));
    },
    [setSearchParams],
  );

  const clearAll = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const setQuery = useCallback(
    (value: string) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (value.length === 0) {
          next.delete('q');
        } else {
          next.set('q', value);
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const activeFilterCount = useMemo(() => computeActiveFilterCount(filters), [filters]);

  const queryParams = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }, [searchParams]);

  return { filters, apply, clearAll, setQuery, activeFilterCount, queryParams };
}
