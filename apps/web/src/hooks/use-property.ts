/**
 * `useProperty` — fetches a single property by ID via `GET /properties/:id`.
 *
 * The detail page is driven entirely off this hook: loading skeleton while
 * the query is pending, the 404 empty-state when the server responds 404,
 * and the populated view when `data` is defined. The query is disabled
 * when `id` is falsy so routes without a param do not fire a spurious
 * request to `/properties/undefined`.
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { Property } from '../types/property';

export function useProperty(id: string | undefined) {
  return useQuery<Property, Error>({
    queryKey: ['property', id ?? ''],
    enabled: Boolean(id),
    queryFn: async () => {
      const response = await apiClient.get<Property>(`/properties/${id}`);
      return response.data;
    },
  });
}
