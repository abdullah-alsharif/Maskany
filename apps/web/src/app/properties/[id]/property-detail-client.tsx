'use client';

import { use } from 'react';
import { PropertyDetailPage } from '../../../views/property-detail-page';

type Props = {
  params: Promise<{ id: string }>;
};

export function PropertyDetailPageClient({ params }: Props) {
  const { id } = use(params);
  // Override useParams mock in tests by rendering with id available
  void id;
  return <PropertyDetailPage />;
}
