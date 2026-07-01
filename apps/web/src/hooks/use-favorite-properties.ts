import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { Property } from '../types/property';

export function useFavoriteProperties(favoriteIds: string[]) {
  const ids = favoriteIds.filter(Boolean);

  const { data, isLoading } = useQuery({
    queryKey: ['favorite-properties', ids] as const,
    queryFn: async () => {
      const response = await apiClient.get<Property[]>(`/properties/bulk?ids=${ids.join(',')}`);
      return response.data;
    },
    enabled: ids.length > 0,
  });

  return { properties: data ?? [], isLoading, queries: [] };
}
