import { useQueries } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { Property } from '../types/property';

export function useFavoriteProperties(favoriteIds: string[]) {
  const queries = useQueries({
    queries: favoriteIds.map((id) => ({
      queryKey: ['property', id] as const,
      queryFn: async () => {
        const response = await apiClient.get<Property>(`/properties/${id}`);
        return response.data;
      },
      retry: false,
    })),
  });

  const properties = queries
    .map((query) => query.data)
    .filter((property): property is Property => property !== undefined);

  const isLoading =
    favoriteIds.length > 0 && properties.length === 0 && queries.some((q) => q.isPending);

  return { properties, isLoading, queries };
}
