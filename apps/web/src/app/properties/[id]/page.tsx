import type { Metadata } from 'next';
import { PropertyDetailPageClient } from './property-detail-client';

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiBase}/api/properties/${id}`);
    if (!res.ok) return { title: 'Property | Maskany' };
    const property = (await res.json()) as {
      title: string;
      summary?: string;
      images?: Array<{ url: string }>;
    };
    return {
      title: `${property.title} | Maskany`,
      description: property.summary,
      openGraph: {
        title: `${property.title} | Maskany`,
        description: property.summary,
        images: property.images?.[0] ? [{ url: property.images[0].url }] : [],
        type: 'article',
      },
    };
  } catch {
    return { title: 'Property | Maskany' };
  }
}

export default function PropertyPage({ params }: Props) {
  return <PropertyDetailPageClient params={params} />;
}
