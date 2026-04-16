/**
 * `useProperties` — infinite-scroll data hook for the listing grid.
 *
 * Wraps `useInfiniteQuery` against `GET /properties` and returns the
 * server's cursor-based pages verbatim. When a category is selected, it is
 * sent to the API as the `type` query parameter so filtering happens
 * server-side rather than loading every listing and filtering client-side.
 */
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { Property, PropertyType } from '../types/property';

export type CategoryFilter = 'ALL' | PropertyType;

export type PropertyListPage = {
  properties: Property[];
  nextCursor: string | null;
  total: number;
};

type Cursor = string | null;

function sortedFilterEntries(filters: Record<string, string>): Array<[string, string]> {
  return Object.entries(filters)
    .filter(([, value]) => value.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));
}

function buildQueryKey(
  category: CategoryFilter,
  filters: Record<string, string>,
): readonly unknown[] {
  const entries = sortedFilterEntries(filters);
  if (entries.length === 0) return ['properties', category] as const;
  return ['properties', category, Object.fromEntries(entries)] as const;
}

export function useProperties(
  category: CategoryFilter = 'ALL',
  filters: Record<string, string> = {},
) {
  return useInfiniteQuery<
    PropertyListPage,
    Error,
    InfiniteData<PropertyListPage, Cursor>,
    readonly unknown[],
    Cursor
  >({
    queryKey: buildQueryKey(category, filters),
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = {};
      for (const [key, value] of sortedFilterEntries(filters)) {
        params[key] = value;
      }
      if (category !== 'ALL') {
        params.type = category;
      }
      if (typeof pageParam === 'string' && pageParam.length > 0) {
        params.cursor = pageParam;
      }
      const response = await apiClient.get<PropertyListPage>('/properties', { params });
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
