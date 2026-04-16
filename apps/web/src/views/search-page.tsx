'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CategoryBar } from '../components/category-bar';
import { PropertyCard } from '../components/property-card';
import { SearchBar } from '../components/search-bar';
import { SeoHead } from '../components/seo-head';
import { SkeletonCard } from '../components/skeleton-card';
import { FilterSheet } from '../components/filter-sheet';
import { NoResults } from '../components/ui/empty-state';
import { useFilters } from '../hooks/use-filters';
import { useProperties, type CategoryFilter } from '../hooks/use-properties';

const SKELETON_COUNT = 6;

export function SearchPage() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const [filterOpen, setFilterOpen] = useState(false);
  const { filters, apply, clearAll, setQuery, activeFilterCount, queryParams } = useFilters();
  const { data, isPending } = useProperties(category, queryParams);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const properties = data?.pages.flatMap((page) => page.properties) ?? [];
  const showSkeletons = isPending;
  const showEmpty = !isPending && properties.length === 0;

  return (
    <section className="page-content">
      <SeoHead
        title="Search | Maskany"
        description="Search properties by location, type, and price."
      />
      <h1 className="sr-only">{t('nav.search')}</h1>

      <header className="px-4 pt-6 pb-2">
        <p className="font-display text-3xl text-stone-950">{t('search.heading')}</p>
        <p className="mt-1 text-sm text-stone-600">{t('search.subheading')}</p>
      </header>

      <div className="px-4 pt-2">
        <SearchBar
          ref={searchInputRef}
          value={filters.query ?? ''}
          onChange={setQuery}
          onFilterClick={() => setFilterOpen(true)}
          activeFilterCount={activeFilterCount}
          placeholder={t('search.placeholder')}
        />
      </div>

      <div className="px-4">
        <CategoryBar selected={category} onSelect={setCategory} />
      </div>

      {showSkeletons ? (
        <div
          data-testid="skeleton-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4 py-4"
        >
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : showEmpty ? (
        <NoResults />
      ) : (
        <div
          data-testid="property-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4 py-4"
        >
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
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
