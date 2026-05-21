'use client';

import Link from 'next/link';
import { MapPin, BedDouble, Star } from 'lucide-react';
import { Badge } from '../ui/badge';
import { ResponsiveImage } from '../ui/responsive-image';
import { FavoriteButton } from './favorite-button';
import { WhatsAppIconButton } from './whatsapp-button';
import { propertyTypeConfig, priceUnitLabels } from '../../styles/design-tokens';
import { useFavorites } from '../../hooks/use-favorites';
import type { Property } from '../../types/property';

type PropertyCardProps = {
  property: Property;
};

export function PropertyCard({ property }: PropertyCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(property.id);
  const typeConfig = propertyTypeConfig[property.propertyType] ?? propertyTypeConfig.OTHER;
  const coverImage =
    property.coverImage ??
    (property.images?.[0]
      ? {
          url: property.images[0].url,
          thumbnailUrl: property.images[0].thumbnailUrl,
          altText: property.images[0].altText,
        }
      : null);

  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(property.price);

  return (
    <article
      className="
        group relative flex flex-col
        rounded-2xl overflow-hidden
        bg-white
        shadow-[var(--shadow-card)]
        hover:shadow-[var(--shadow-card-hover)]
        transition-all duration-300 ease-out
        hover:-translate-y-0.5
      "
    >
      {/* Media Wrapper */}
      <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
        <Link
          href={`/properties/${property.id}`}
          className="block w-full h-full focus-visible:outline-none"
          aria-label={`View details for ${property.title}`}
        >
          {coverImage ? (
            <ResponsiveImage
              src={coverImage.thumbnailUrl || coverImage.url}
              fullSrc={coverImage.url}
              alt={coverImage.altText || property.title}
              className="
                w-full h-full object-cover
                group-hover:scale-105 transition-transform duration-700 ease-out
              "
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-300">
              <BedDouble size={40} strokeWidth={1.2} />
            </div>
          )}
          {/* Bottom gradient overlay for image depth */}
          <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        </Link>

        {/* Top-Left Badge */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <Badge variant={typeConfig.color.includes('terracotta') ? 'terracotta' : 'olive'}>
            {typeConfig.label}
          </Badge>
        </div>

        {/* Top-Right Favorite Button */}
        <div className="absolute top-3 right-3 z-10">
          <FavoriteButton
            propertyId={property.id}
            isFavorite={favorited}
            onToggle={toggleFavorite}
          />
        </div>

        {/* Bottom-Right WhatsApp Action */}
        <div className="absolute bottom-3 right-3 z-10">
          <WhatsAppIconButton
            whatsappNumber={property.whatsappNumber}
            propertyTitle={property.title}
            propertyId={property.id}
          />
        </div>
      </div>

      {/* Content Wrapper */}
      <Link
        href={`/properties/${property.id}`}
        className="
          flex-1 p-3.5 space-y-2
          focus-visible:ring-2 focus-visible:ring-terracotta-400 focus-visible:ring-offset-2 focus-visible:outline-none
        "
      >
        {/* Title */}
        <h3 className="text-[15px] font-semibold text-stone-900 leading-snug line-clamp-1 group-hover:text-terracotta-600 transition-colors duration-200">
          {property.title}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-1.5 text-stone-500">
          <MapPin size={13} strokeWidth={2} className="text-stone-400 shrink-0" />
          <span className="text-[13px] truncate">
            {property.area ? `${property.area}, ` : ''}
            {property.city}
          </span>
        </div>

        {/* Price + Rating */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-baseline gap-0.5">
            <span className="text-lg font-bold text-stone-950">
              {property.currency} {formattedPrice}
            </span>
            <span className="text-xs text-stone-400 font-medium">
              {priceUnitLabels[property.priceUnit]}
            </span>
          </div>

          {property.averageRating > 0 && (
            <div className="flex items-center gap-1 bg-stone-50 px-1.5 py-0.5 rounded-md border border-stone-200/50">
              <Star size={12} fill="#f5b731" stroke="#f5b731" />
              <span className="text-[12px] font-bold text-stone-800">
                {property.averageRating.toFixed(1)}
              </span>
              <span className="text-[10px] text-stone-400">({property.reviewCount})</span>
            </div>
          )}
        </div>

        {/* Specifications */}
        <div className="flex items-center gap-2 text-[12px] text-stone-500 pt-1 border-t border-stone-100">
          <span className="flex items-center gap-1 text-stone-600">
            <BedDouble size={12} strokeWidth={2} className="text-stone-400" />
            {property.rooms} bed{property.rooms !== 1 ? 's' : ''}
          </span>
          {property.bathrooms > 0 && (
            <>
              <span className="text-stone-200" aria-hidden="true">
                |
              </span>
              <span className="flex items-center gap-1">
                {property.bathrooms} bath{property.bathrooms !== 1 ? 's' : ''}
              </span>
            </>
          )}
          {property.areaSqm !== null && property.areaSqm > 0 && (
            <>
              <span className="text-stone-200" aria-hidden="true">
                |
              </span>
              <span>{property.areaSqm} m²</span>
            </>
          )}
        </div>
      </Link>
    </article>
  );
}
