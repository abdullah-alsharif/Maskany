'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { CategoryBar } from '../components/property/category-bar';
import { QuickSort } from '../components/property/quick-sort';
import { PropertyCard } from '../components/property/property-card';
import { SearchBar } from '../components/property/search-bar';
import { SeoHead } from '../components/seo-head';
import { SkeletonCard } from '../components/ui/skeleton';
import { FilterSheet } from '../components/filter-sheet';
import { EmptyState, NoResults } from '../components/ui/empty-state';
import { useFilters } from '../hooks/use-filters';
import { useProperties, type CategoryFilter } from '../hooks/use-properties';

const SKELETON_COUNT = 6;
const PULL_TO_REFRESH_THRESHOLD = 80;

function usePullToRefresh(onRefresh: () => void): {
  pullDelta: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
} {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pullStartRef = useRef<number | null>(null);
  const [pullDelta, setPullDelta] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      pullStartRef.current = e.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (e: TouchEvent) => {
      const start = pullStartRef.current;
      if (start === null) return;
      const delta = (e.touches[0]?.clientY ?? start) - start;
      setPullDelta(delta > 0 ? Math.min(delta, PULL_TO_REFRESH_THRESHOLD * 1.5) : 0);
    };

    const onTouchEnd = () => {
      setPullDelta((current) => {
        if (current >= PULL_TO_REFRESH_THRESHOLD) {
          onRefresh();
        }
        return 0;
      });
      pullStartRef.current = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [onRefresh]);

  return { pullDelta, containerRef };
}

interface HomePageProps {
  mode?: 'home' | 'search';
}

export function HomePage({ mode = 'home' }: HomePageProps) {
  const { t, i18n } = useTranslation();
  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const [filterOpen, setFilterOpen] = useState(false);
  const { filters, apply, clearAll, setQuery, activeFilterCount, queryParams } = useFilters();
  const { data, isPending, isError, hasNextPage, fetchNextPage, isFetchingNextPage, refetch } =
    useProperties(category, queryParams);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);
  const { pullDelta, containerRef } = usePullToRefresh(mode === 'home' ? handleRefresh : () => {});

  useEffect(() => {
    if (mode !== 'search') return;
    searchInputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (mode !== 'home') return;
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [mode, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const properties = data?.pages.flatMap((page) => page.properties) ?? [];
  const showSkeletons = isPending;
  const showEmpty = !isPending && properties.length === 0;

  const isSearch = mode === 'search';

  return (
    <section ref={isSearch ? undefined : containerRef} className="page-content grain-overlay">
      <SeoHead
        title={isSearch ? 'Search | Maskany' : 'Maskany - Find Your Perfect Property'}
        description={
          isSearch
            ? 'Search properties by location, type, and price.'
            : 'Curated homes, rooms, and getaways near you.'
        }
      />

      <header className="px-4 pt-6 pb-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-stone-950">
            {isSearch ? t('search.heading') : t('home.heading')}
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {isSearch ? t('search.subheading') : t('home.subheading')}
          </p>
        </div>
        {!isSearch && (
          <button
            type="button"
            onClick={() => i18n.changeLanguage(i18n.language.startsWith('ar') ? 'en' : 'ar')}
            aria-label={
              i18n.language.startsWith('ar') ? t('language.switchToEn') : t('language.switchToAr')
            }
            className="shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-white border border-stone-300 text-stone-600 hover:bg-stone-50 hover:border-stone-400 active:bg-stone-100 active:scale-[0.96] transition-colors duration-150"
          >
            <Globe size={18} strokeWidth={2} />
          </button>
        )}
      </header>

      <div className="px-4 pt-2">
        <SearchBar
          ref={isSearch ? searchInputRef : undefined}
          value={filters.query ?? ''}
          onChange={setQuery}
          onFilterClick={() => setFilterOpen(true)}
          activeFilterCount={activeFilterCount}
          placeholder={isSearch ? t('search.placeholder') : undefined}
        />
      </div>

      <div className="px-4">
        <CategoryBar selected={category} onSelect={setCategory} />
      </div>

      <div className="px-4">
        <QuickSort currentSort={filters.sort} filters={filters} onApply={apply} />
      </div>

      {!isSearch && pullDelta > 0 && (
        <div
          aria-hidden="true"
          data-testid="pull-indicator"
          className="flex justify-center py-2 text-xs text-stone-500"
          style={{ height: pullDelta }}
        >
          {pullDelta >= PULL_TO_REFRESH_THRESHOLD
            ? t('home.releaseToRefresh')
            : t('home.pullToRefresh')}
        </div>
      )}

      {showSkeletons ? (
        <div
          data-testid="skeleton-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4 py-4"
        >
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={<Globe size={28} strokeWidth={1.5} />}
          title={t('empty.error')}
          description={t('empty.errorDesc')}
          actionLabel={t('empty.retry')}
          onAction={() => refetch()}
        />
      ) : showEmpty ? (
        <NoResults />
      ) : (
        <>
          <div
            data-testid="property-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4 py-4"
          >
            {properties.map((property, idx) => (
              <div
                key={property.id}
                className="animate-fade-in"
                style={{ animationDelay: `${Math.min(idx, 8) * 0.05}s` }}
              >
                <PropertyCard property={property} />
              </div>
            ))}
          </div>
          {!isSearch && (
            <div
              ref={sentinelRef}
              aria-hidden="true"
              data-testid="infinite-sentinel"
              className="h-8"
            />
          )}
          {!isSearch && isFetchingNextPage && (
            <div
              data-testid="next-page-skeletons"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4 pb-6"
            >
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          )}
        </>
      )}

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={filters}
        onApply={apply}
        onClear={clearAll}
      />
    </section>
  );
}
