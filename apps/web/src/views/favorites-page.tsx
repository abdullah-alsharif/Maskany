'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { PropertyCard } from '../components/property/property-card';
import { SeoHead } from '../components/seo-head';
import { SkeletonCard } from '../components/ui/skeleton';
import { NoFavorites } from '../components/ui/empty-state';
import { useFavorites } from '../hooks/use-favorites';
import { useFavoriteProperties } from '../hooks/use-favorite-properties';

export function FavoritesPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { favorites } = useFavorites();

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ['favorite-properties'] });
  }, [i18n.language, queryClient]);

  const { properties: loadedProperties, isLoading } = useFavoriteProperties(favorites);

  const isEmpty = favorites.length === 0;

  return (
    <section className="page-content">
      <SeoHead title={t('meta.favorites.title')} description={t('meta.favorites.desc')} />
      <h1 className="sr-only">{t('nav.favorites')}</h1>

      <header className="px-4 pt-6 pb-2">
        <p className="font-display text-3xl text-stone-950">{t('favorites.heading')}</p>
        <p className="mt-1 text-sm text-stone-600">{t('favorites.subheading')}</p>
      </header>

      {isEmpty ? (
        <NoFavorites onBrowse={() => router.push('/')} />
      ) : isLoading ? (
        <div
          data-testid="favorites-skeleton-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4 py-4"
        >
          {favorites.map((id) => (
            <SkeletonCard key={id} />
          ))}
        </div>
      ) : (
        <div
          data-testid="favorites-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4 py-4"
        >
          {loadedProperties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </section>
  );
}
