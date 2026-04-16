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
  const coverImage = property.coverImage;

  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(property.price);

  return (
    <article className="group relative animate-fade-in">
      <Link
        href={`/properties/${property.id}`}
        className="
          block rounded-2xl overflow-hidden
          bg-white
          shadow-[var(--shadow-card)]
          hover:shadow-[var(--shadow-card-hover)]
          transition-shadow duration-300
          focus-visible:ring-2 focus-visible:ring-terracotta-400
          focus-visible:ring-offset-2 focus-visible:outline-none
        "
      >
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-stone-200">
          {coverImage ? (
            <ResponsiveImage
              src={coverImage.thumbnailUrl || coverImage.url}
              fullSrc={coverImage.url}
              alt={coverImage.altText || property.title}
              className="
                w-full h-full object-cover
                group-hover:scale-105 transition-transform duration-500
              "
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-400">
              <BedDouble size={40} strokeWidth={1} />
            </div>
          )}

          {/* Top overlay: badge + favorite */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
            <Badge variant={typeConfig.color.includes('terracotta') ? 'terracotta' : 'olive'}>
              {typeConfig.label}
            </Badge>
          </div>

          {/* Bottom gradient */}
          <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        {/* Content */}
        <div className="p-3.5 space-y-1.5">
          {/* Title */}
          <h3 className="text-[15px] font-semibold text-stone-900 leading-snug line-clamp-1">
            {property.title}
          </h3>

          {/* Location */}
          <div className="flex items-center gap-1 text-stone-500">
            <MapPin size={13} strokeWidth={2} />
            <span className="text-[13px] truncate">
              {property.area ? `${property.area}, ` : ''}
              {property.city}
            </span>
          </div>

          {/* Price + Rating */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-baseline gap-0.5">
              <span className="text-lg font-bold text-stone-950">
                {property.currency} {formattedPrice}
              </span>
              <span className="text-xs text-stone-400 font-medium">
                {priceUnitLabels[property.priceUnit]}
              </span>
            </div>

            {property.averageRating > 0 && (
              <div className="flex items-center gap-1">
                <Star size={13} fill="#f5b731" stroke="#f5b731" />
                <span className="text-[13px] font-semibold text-stone-700">
                  {property.averageRating.toFixed(1)}
                </span>
                <span className="text-[11px] text-stone-400">({property.reviewCount})</span>
              </div>
            )}
          </div>

          {/* Rooms */}
          <div className="flex items-center gap-1.5 text-[12px] text-stone-400 pt-0.5">
            <BedDouble size={12} strokeWidth={2} />
            <span>
              {property.rooms} bed{property.rooms !== 1 ? 's' : ''}
            </span>
            {property.bathrooms > 0 && (
              <>
                <span className="text-stone-300">·</span>
                <span>
                  {property.bathrooms} bath{property.bathrooms !== 1 ? 's' : ''}
                </span>
              </>
            )}
            {property.areaSqm !== null && property.areaSqm > 0 && (
              <>
                <span className="text-stone-300">·</span>
                <span>{property.areaSqm} m²</span>
              </>
            )}
          </div>
        </div>
      </Link>

      {/* Floating actions (outside <Link> to prevent nav) */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5">
        <FavoriteButton propertyId={property.id} isFavorite={favorited} onToggle={toggleFavorite} />
      </div>
      <div className="absolute bottom-[5.5rem] right-3">
        <WhatsAppIconButton
          whatsappNumber={property.whatsappNumber}
          propertyTitle={property.title}
          propertyId={property.id}
        />
      </div>
    </article>
  );
}
