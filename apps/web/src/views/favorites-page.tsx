'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { PropertyCard } from '../components/property/property-card';
import { SeoHead } from '../components/seo-head';
import { SkeletonCard } from '../components/ui/skeleton';
import { NoFavorites } from '../components/ui/empty-state';
import { useFavorites } from '../hooks/use-favorites';
import { useFavoriteProperties } from '../hooks/use-favorite-properties';
import { setLangCookie } from '../utils/lang-cookie';

export function FavoritesPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { favorites, toggleError } = useFavorites();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const { properties: loadedProperties, isLoading } = useFavoriteProperties(favorites);

  const isEmpty = favorites.length === 0;

  if (!hydrated) {
    return (
      <section className="page-content">
        <SeoHead title={t('meta.favorites.title')} description={t('meta.favorites.desc')} />
        <h1 className="sr-only">{t('nav.favorites')}</h1>
        <header className="flex items-start justify-between px-4 pt-6 pb-2">
          <div>
            <p className="font-display text-3xl text-stone-950">{t('favorites.heading')}</p>
            <p className="mt-1 text-sm text-stone-600">{t('favorites.subheading')}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = i18n.language.startsWith('ar') ? 'en' : 'ar';
              void i18n.changeLanguage(next);
              setLangCookie(next);
            }}
            aria-label={
              i18n.language.startsWith('ar') ? t('language.switchToEn') : t('language.switchToAr')
            }
            className="shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-white border border-stone-300 text-stone-600 hover:bg-stone-50 hover:border-stone-400 active:bg-stone-100 active:scale-[0.96] transition-colors duration-150"
          >
            <Globe size={18} strokeWidth={2} />
          </button>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4 py-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="page-content">
      <SeoHead title={t('meta.favorites.title')} description={t('meta.favorites.desc')} />
      <h1 className="sr-only">{t('nav.favorites')}</h1>

      {toggleError && (
        <div
          role="alert"
          className="mx-4 mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200"
        >
          {t('favorites.toggleError', 'Failed to update favorite. Please try again.')}
        </div>
      )}

      <header className="flex items-start justify-between px-4 pt-6 pb-2">
        <div>
          <p className="font-display text-3xl text-stone-950">{t('favorites.heading')}</p>
          <p className="mt-1 text-sm text-stone-600">{t('favorites.subheading')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = i18n.language.startsWith('ar') ? 'en' : 'ar';
            void i18n.changeLanguage(next);
            setLangCookie(next);
          }}
          aria-label={
            i18n.language.startsWith('ar') ? t('language.switchToEn') : t('language.switchToAr')
          }
          className="shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-white border border-stone-300 text-stone-600 hover:bg-stone-50 hover:border-stone-400 active:bg-stone-100 active:scale-[0.96] transition-colors duration-150"
        >
          <Globe size={18} strokeWidth={2} />
        </button>
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
