import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';

export type SimilarProperty = {
  id: string;
  title: string;
  city: string;
  area: string | null;
  price: string;
  currency: string;
  propertyType: string;
  coverImage: { url: string; thumbnailUrl: string | null } | null;
};

export function useSimilarProperties(propertyId: string) {
  return useQuery({
    queryKey: ['similar-properties', propertyId] as const,
    queryFn: async () => {
      const response = await apiClient.get<SimilarProperty[]>(`/properties/${propertyId}/similar`);
      return response.data;
    },
    enabled: propertyId.length > 0,
  });
}
