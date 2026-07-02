'use client';

import { useTranslation } from 'react-i18next';
import { ArrowUpDown, Clock, Star } from 'lucide-react';
import type { Filters, SortOption } from '../../hooks/use-filters';

type QuickSortProps = {
  currentSort?: SortOption;
  filters: Filters;
  onApply: (filters: Filters) => void;
};

const options: { value: SortOption; labelKey: string; icon: React.ReactNode }[] = [
  { value: 'newest', labelKey: 'filter.sortNewest', icon: <Clock size={15} strokeWidth={1.8} /> },
  {
    value: 'price_asc',
    labelKey: 'filter.sortPriceAsc',
    icon: <ArrowUpDown size={15} strokeWidth={1.8} />,
  },
  {
    value: 'price_desc',
    labelKey: 'filter.sortPriceDesc',
    icon: <ArrowUpDown size={15} strokeWidth={1.8} />,
  },
  {
    value: 'rating_desc',
    labelKey: 'filter.sortRatingDesc',
    icon: <Star size={15} strokeWidth={1.8} />,
  },
];

export function QuickSort({ currentSort, filters, onApply }: QuickSortProps) {
  const { t } = useTranslation();

  const handleToggle = (value: SortOption) => {
    const nextSort = currentSort === value ? undefined : value;
    onApply({ ...filters, sort: nextSort });
  };

  const hasActiveSort = currentSort !== undefined;

  return (
    <div
      className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-4 py-3 -mx-4"
      role="group"
      aria-label="Sort properties"
    >
      <span
        className={`
          flex items-center gap-1.5 shrink-0 mr-0.5
          text-[12px] font-semibold tracking-wide
          transition-colors duration-300
          ${hasActiveSort ? 'text-terracotta-600' : 'text-stone-400'}
        `}
      >
        <ArrowUpDown size={14} strokeWidth={2} />
        {t('filter.sortBy')}
      </span>

      <span className="w-px h-5 bg-stone-200 shrink-0" aria-hidden />

      {options.map((opt) => {
        const isActive = currentSort === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleToggle(opt.value)}
            className={`
              flex items-center gap-1.5
              px-4 h-11
              rounded-[11px] whitespace-nowrap
              text-[13px] font-medium
              transition-colors transition-shadow transition-transform duration-200 ease-out
              active:scale-[0.97]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500/50 focus-visible:ring-offset-1
              shrink-0
              ${
                isActive
                  ? 'bg-terracotta-500 text-white shadow-sm shadow-terracotta-500/20'
                  : 'bg-stone-100/70 text-stone-600 hover:bg-stone-200/70 hover:text-stone-800 border border-stone-200/50'
              }
            `}
            aria-pressed={isActive}
          >
            <span className={isActive ? 'text-white/90' : 'text-stone-400'}>{opt.icon}</span>
            <span>{t(opt.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
