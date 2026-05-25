import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { Property } from '../types/property';

type MyPropertiesResponse = { properties: Property[] };

export function useMyProperties() {
  return useQuery<MyPropertiesResponse, Error>({
    queryKey: ['my-properties'],
    queryFn: async () => {
      const response = await apiClient.get<MyPropertiesResponse>('/properties/my');
      return response.data;
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (propertyId: string) => {
      await apiClient.delete(`/properties/${propertyId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-properties'] });
    },
  });
}

export function useUpdatePropertyStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      propertyId,
      status,
    }: {
      propertyId: string;
      status: 'ACTIVE' | 'INACTIVE';
    }) => {
      const response = await apiClient.patch<{ status: string }>(
        `/properties/${propertyId}/status`,
        { status },
      );
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-properties'] });
    },
  });
}
