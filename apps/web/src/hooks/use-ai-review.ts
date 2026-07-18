import { useQuery } from '@tanstack/react-query';
import { reviewListing } from '../services/ai-service';
import type { ReviewPropertyData, ReviewResponse } from '../services/ai-service';

export function useAiReview(propertyData: ReviewPropertyData | null, locale: string) {
  return useQuery<ReviewResponse>({
    queryKey: ['ai-review', propertyData ? hashPropertyData(propertyData) : '', locale],
    queryFn: () => reviewListing(locale, propertyData!),
    enabled: !!propertyData,
    staleTime: 5 * 60 * 1000,
  });
}

function hashPropertyData(data: ReviewPropertyData): string {
  let hash = 0;
  const str = JSON.stringify(data);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return String(hash);
}
