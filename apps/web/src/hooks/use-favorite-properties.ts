import { useQuery } from '@tanstack/react-query';
import { apiClient, getFavorites } from '../services/api';
import { AuthContext } from '../context/auth-context';
import { useContext } from 'react';
import type { Property } from '../types/property';

export function useFavoriteProperties(favoriteIds: string[]) {
  const ctx = useContext(AuthContext);
  const isAuthenticated = ctx?.isAuthenticated ?? false;

  const serverQuery = useQuery({
    queryKey: ['favorite-properties', 'server'] as const,
    queryFn: async () => {
      const items = await getFavorites();
      return items.map((f) => f.property) as Property[];
    },
    enabled: isAuthenticated,
  });

  const ids = favoriteIds.filter(Boolean);

  const guestQuery = useQuery({
    queryKey: ['favorite-properties', ids] as const,
    queryFn: async () => {
      const response = await apiClient.get<Property[]>(`/properties/bulk?ids=${ids.join(',')}`);
      return response.data;
    },
    enabled: !isAuthenticated && ids.length > 0,
  });

  return {
    properties: isAuthenticated ? (serverQuery.data ?? []) : (guestQuery.data ?? []),
    isLoading: isAuthenticated ? serverQuery.isLoading : guestQuery.isLoading,
  };
}
