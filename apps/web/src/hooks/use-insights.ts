import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { InsightsResponse } from '../types/insights';

export function useInsights() {
  return useQuery<InsightsResponse, Error>({
    queryKey: ['insights'],
    queryFn: async () => {
      const response = await apiClient.get<InsightsResponse>('/properties/dashboard');
      return response.data;
    },
  });
}
