/**
 * PropertyDetailPage — full detail view for a single listing (PRD §3.4).
 *
 * Composition:
 *   - <Header>             back button + share button (transparent over hero)
 *   - <ImageGallery>       swipeable hero gallery with dot indicators
 *   - Info block           title, type badge, location, rating
 *   - Price                prominently displayed with currency + unit
 *   - Specs row            bedrooms / bathrooms / area (m²) with icons
 *   - Description          read-more toggle for long copy
 *   - <AmenityChips>       horizontal wrap of icon chips
 *   - Owner card           name + "Member since" date
 *   - <WhatsAppFab>        floating contact CTA
 *   - 404 state            shown when the property is missing
 *   - Loading skeleton     shown while the query is pending
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { BedDouble, Bath, Ruler, MapPin, Star, UserCircle2 } from 'lucide-react';
import { Header } from '../components/layout/header';
import { Badge } from '../components/ui/badge';
import { formatMemberSince, formatPrice } from '../utils/format';
import { SkeletonDetailPage } from '../components/ui/skeleton';
import { EmptyState } from '../components/ui/empty-state';
import { ImageGallery } from '../components/property/image-gallery';
import { AmenityChips } from '../components/amenity-chips';
import { ReviewSection } from '../components/review-section';
import { SeoHead } from '../components/seo-head';
import { FavoriteButton } from '../components/property/favorite-button';
import { WhatsAppFab } from '../components/property/whatsapp-button';
import { SimilarProperties } from '../components/property/similar-properties';
import { useProperty } from '../hooks/use-property';
import { useTranslationContent } from '../hooks/useTranslationContent';
import { useFavorites } from '../hooks/use-favorites';
import { useAuth } from '../hooks/use-auth';
import { apiClient } from '../services/api';
import { propertyTypeConfig } from '../styles/design-tokens';
import type { Property } from '../types/property';

const DESCRIPTION_CLAMP = 200;

type ErrorWithStatus = Error & { response?: { status?: number } };

function isNotFoundError(error: unknown): boolean {
  if (!error) return false;
  const status = (error as ErrorWithStatus).response?.status;
  return status === 404;
}

function PropertyBody({ property }: { property: Property }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();

  const trackedRef = useRef<string | null>(null);

  useEffect(() => {
    if (trackedRef.current === property.id) return;
    trackedRef.current = property.id;
    apiClient.post(`/properties/${property.id}/track-view`).catch(() => {});
  }, [property.id]);
  const { user } = useAuth();
  const reviewViewer = user ? { id: user.id, fullName: user.fullName } : null;
  const typeConfig = propertyTypeConfig[property.propertyType] ?? propertyTypeConfig.OTHER;
  const translationContent = useTranslationContent(property);
  const displayTitle = translationContent.title ?? property.title;
  const displaySummary = translationContent.summary ?? property.summary;
  const displayDescriptionRaw = translationContent.description ?? property.description;
  const displayCity = translationContent.city ?? property.city;
  const displayArea = translationContent.area ?? property.area;
  const _displayCountry = translationContent.country ?? property.country;
  const displayAmenities = translationContent.amenities ?? property.amenities;
  const isLong = (displayDescriptionRaw ?? '').length > DESCRIPTION_CLAMP;
  const displayDescription =
    isLong && !expanded
      ? `${(displayDescriptionRaw ?? '').slice(0, DESCRIPTION_CLAMP).trimEnd()}…`
      : (displayDescriptionRaw ?? '');

  const handleShare = async () => {
    const shareData = {
      title: displayTitle,
      text: displaySummary ?? undefined,
      url: window.location.href,
    };
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
      } catch {
        /* user cancelled — ignore */
      }
      return;
    }
    await navigator.clipboard.writeText(shareData.url);
  };

  return (
    <>
      <SeoHead
        title={`${displayTitle} | Maskany`}
        description={displaySummary ?? undefined}
        ogType="article"
        ogImage={property.images?.[0]?.url}
        ogUrl={
          typeof window !== 'undefined'
            ? `${window.location.origin}/properties/${property.id}`
            : undefined
        }
        property={property}
      />
      <Header
        showBack
        showShare
        transparent
        onShare={handleShare}
        actions={
          <FavoriteButton
            propertyId={property.id}
            isFavorite={isFavorite(property.id)}
            onToggle={toggleFavorite}
            size="md"
          />
        }
      />

      <article className="page-content -mt-14">
        <ImageGallery images={property.images ?? []} alt={displayTitle} />

        <div className="px-4 py-5 space-y-7">
          {/* Title + type badge + location + rating */}
          <section className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display text-3xl text-stone-950 leading-tight">{displayTitle}</h1>
              <Badge variant={typeConfig.color.includes('terracotta') ? 'terracotta' : 'olive'}>
                {t(`propertyType.${property.propertyType}`)}
              </Badge>
            </div>
            <p className="text-stone-600 text-base">{displaySummary}</p>
            <div className="flex items-center gap-4 text-sm text-stone-600">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={16} strokeWidth={2} aria-hidden="true" />
                {displayArea ? `${displayArea}, ` : ''}
                {displayCity}
              </span>
              {property.averageRating > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Star size={14} fill="#f5b731" stroke="#f5b731" aria-hidden="true" />
                  <span className="font-semibold text-stone-800">
                    {property.averageRating.toFixed(1)}
                  </span>
                  <span className="text-stone-400">({property.reviewCount})</span>
                </span>
              )}
            </div>
          </section>

          {/* Price */}
          <section>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-stone-950">
                {property.currency} {formatPrice(property.price)}
              </span>
              <span className="text-sm text-stone-500 font-medium">
                {t(`priceUnit.${property.priceUnit}`)}
              </span>
            </div>
          </section>

          {/* Specs */}
          <section
            aria-label="Property specifications"
            className="
              flex items-center justify-around
              rounded-2xl bg-white py-4 px-2
              shadow-[var(--shadow-card)] border border-stone-100
            "
          >
            <div className="flex-1 flex flex-col items-center gap-1 text-stone-800 border-r border-stone-100">
              <BedDouble
                size={20}
                strokeWidth={1.8}
                className="text-stone-500"
                aria-hidden="true"
              />
              <span className="text-[13px] font-semibold text-stone-900">
                {property.rooms === 1
                  ? t('propertyDetail.bedroom', { count: property.rooms })
                  : t('propertyDetail.bedrooms', { count: property.rooms })}
              </span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-1 text-stone-800 border-r border-stone-100">
              <Bath size={20} strokeWidth={1.8} className="text-stone-500" aria-hidden="true" />
              <span className="text-[13px] font-semibold text-stone-900">
                {property.bathrooms === 1
                  ? t('propertyDetail.bathroom', { count: property.bathrooms })
                  : t('propertyDetail.bathrooms', { count: property.bathrooms })}
              </span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-1 text-stone-800">
              <Ruler size={20} strokeWidth={1.8} className="text-stone-500" aria-hidden="true" />
              <span className="text-[13px] font-semibold text-stone-900">
                {t('propertyDetail.areaValue', { count: property.areaSqm ?? 0 })}
              </span>
            </div>
          </section>

          {/* Description */}
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-stone-900">
              {t('propertyDetail.aboutThisPlace')}
            </h2>
            <p className="text-stone-700 leading-relaxed whitespace-pre-wrap">
              {displayDescription}
            </p>
            {isLong && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="text-terracotta-600 font-semibold text-sm hover:text-terracotta-700 transition-colors"
              >
                {expanded ? t('propertyDetail.readLess') : t('propertyDetail.readMore')}
              </button>
            )}
          </section>

          {/* Amenities */}
          {displayAmenities.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-stone-900">
                {t('propertyDetail.amenities')}
              </h2>
              <AmenityChips amenities={displayAmenities} />
            </section>
          )}

          {/* Owner */}
          {property.owner && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-stone-900">
                {t('propertyDetail.aboutOwner')}
              </h2>
              <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
                <UserCircle2 size={40} strokeWidth={1.5} className="text-stone-400" />
                <div>
                  <p className="font-semibold text-stone-900">{property.owner.fullName}</p>
                  <p className="text-sm text-stone-500">
                    {t('propertyDetail.memberSince', {
                      date: formatMemberSince(property.owner.createdAt),
                    })}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Reviews */}
          {property.owner && (
            <ReviewSection
              propertyId={property.id}
              propertyOwnerId={property.owner.id}
              currentUser={reviewViewer}
            />
          )}

          {/* Similar Properties */}
          <SimilarProperties propertyId={property.id} />
        </div>
      </article>

      <WhatsAppFab
        whatsappNumber={property.whatsappNumber}
        propertyTitle={displayTitle}
        propertyId={property.id}
      />
    </>
  );
}

export function PropertyDetailPage() {
  const { t } = useTranslation();
  const params = useParams() ?? {};
  const id = params['id'] as string | undefined;
  const { data: property, isPending, error } = useProperty(id);

  if (isNotFoundError(error)) {
    return (
      <section className="page-content">
        <Header showBack />
        <EmptyState
          title={t('propertyDetail.notFound')}
          description={t('propertyDetail.notFoundDesc')}
        />
      </section>
    );
  }

  if (isPending || !property) {
    return (
      <section className="page-content" data-testid="detail-skeleton">
        <Header showBack />
        <SkeletonDetailPage />
      </section>
    );
  }

  return <PropertyBody property={property} />;
}
