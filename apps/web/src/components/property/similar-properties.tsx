'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, BedDouble, MapPin } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResponsiveImage } from '../ui/responsive-image';
import { useSimilarProperties, type SimilarProperty } from '../../hooks/use-similar-properties';

type SimilarPropertiesProps = {
  propertyId: string;
};

export function SimilarProperties({ propertyId }: SimilarPropertiesProps) {
  const { t } = useTranslation();
  const { data: properties, isLoading } = useSimilarProperties(propertyId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  if (isLoading) return null;
  if (!properties || properties.length === 0) return null;

  function updateScrollState() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }

  function scroll(direction: 'left' | 'right') {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  }

  return (
    <section className="mt-8" data-testid="similar-properties">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-stone-800">
          {t('similarProperties.title', 'Similar Properties')}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className="p-1.5 rounded-full border border-stone-200 disabled:opacity-30 hover:bg-stone-100 transition"
            aria-label={t('similarProperties.scrollLeft', 'Scroll left')}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className="p-1.5 rounded-full border border-stone-200 disabled:opacity-30 hover:bg-stone-100 transition"
            aria-label={t('similarProperties.scrollRight', 'Scroll right')}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pb-2"
      >
        {properties.map((property) => (
          <SimilarPropertyCard key={property.id} property={property} />
        ))}
      </div>
    </section>
  );
}

function SimilarPropertyCard({ property }: { property: SimilarProperty }) {
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(Number(property.price));

  return (
    <Link
      href={`/properties/${property.id}`}
      className="flex-shrink-0 w-64 snap-start rounded-xl overflow-hidden bg-white border border-stone-200 hover:border-terracotta-200 transition-colors shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="relative aspect-[4/3] bg-stone-100">
        {property.coverImage ? (
          <ResponsiveImage
            src={property.coverImage.thumbnailUrl || property.coverImage.url}
            fullSrc={property.coverImage.url}
            alt={property.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300">
            <BedDouble size={28} strokeWidth={1.2} />
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <h3 className="text-sm font-medium text-stone-800 truncate">{property.title}</h3>
        <div className="flex items-center text-xs text-stone-500 gap-1">
          <MapPin size={12} />
          <span className="truncate">
            {property.city}
            {property.area ? `, ${property.area}` : ''}
          </span>
        </div>
        <p className="text-sm font-semibold text-terracotta-600">
          {formattedPrice} {property.currency}
        </p>
      </div>
    </Link>
  );
}
