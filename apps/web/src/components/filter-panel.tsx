import { useEffect, useState, type ChangeEvent } from 'react';
import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import type { Filters, SortOption } from '../hooks/use-filters';
import type { PropertyType } from '../types/property';
import { amenityConfig, propertyTypeConfig } from '../styles/design-tokens';

const PROPERTY_TYPE_ORDER: readonly PropertyType[] = [
  'APARTMENT',
  'ROOM',
  'CHALET',
  'VILLA',
  'HOUSE',
  'STUDIO',
  'PENTHOUSE',
  'DUPLEX',
  'OTHER',
] as const;

const CITY_OPTIONS: readonly string[] = [
  'Riyadh',
  'Jeddah',
  'Mecca',
  'Medina',
  'Dammam',
  'Khobar',
  'Taif',
  'Abha',
];

const ROOM_OPTIONS: readonly number[] = [1, 2, 3, 4, 5] as const;
const BATHROOM_OPTIONS: readonly number[] = [1, 2, 3] as const;
const RATING_OPTIONS: readonly number[] = [1, 2, 3, 4, 5] as const;

const SORT_OPTION_KEYS: Record<SortOption, string> = {
  newest: 'filter.sortNewest',
  price_asc: 'filter.sortPriceAsc',
  price_desc: 'filter.sortPriceDesc',
  rating_desc: 'filter.sortRatingDesc',
};

function toggleInArray<T>(array: readonly T[], value: T): T[] {
  return array.includes(value) ? array.filter((item) => item !== value) : [...array, value];
}

function parseIntOrUndefined(raw: string): number | undefined {
  if (raw.length === 0) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function roomLabel(value: number, max: number): string {
  return value === max ? `${value}+` : String(value);
}

type FilterPanelProps = {
  value: Filters;
  onApply: (filters: Filters) => void;
  onClear: () => void;
  filterCounts?: Record<string, number>;
};

export function FilterPanel({ value, onApply, onClear, filterCounts }: FilterPanelProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Filters>(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const toggleType = (type: PropertyType) => {
    setDraft((d) => ({ ...d, types: toggleInArray(d.types, type) }));
  };

  const toggleAmenity = (key: string) => {
    setDraft((d) => ({ ...d, amenities: toggleInArray(d.amenities, key) }));
  };

  const handlePrice = (field: 'minPrice' | 'maxPrice') => (e: ChangeEvent<HTMLInputElement>) => {
    setDraft((d) => ({ ...d, [field]: parseIntOrUndefined(e.target.value) }));
  };

  const handleDropdown = (field: 'rooms' | 'bathrooms') => (e: ChangeEvent<HTMLSelectElement>) => {
    setDraft((d) => ({ ...d, [field]: parseIntOrUndefined(e.target.value) }));
  };

  const handleCity = (e: ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setDraft((d) => ({ ...d, city: v.length === 0 ? undefined : v }));
  };

  const handleSort = (e: ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value as SortOption | '';
    setDraft((d) => ({ ...d, sort: v === '' ? undefined : v }));
  };

  const setRating = (rating: number) => {
    setDraft((d) => ({ ...d, minRating: d.minRating === rating ? undefined : rating }));
  };

  const inputClass =
    'w-full h-11 px-3 rounded-xl bg-white border border-stone-200 text-[15px] text-stone-800 ' +
    'focus:outline-none focus:border-terracotta-300 focus:ring-2 focus:ring-terracotta-100 transition-shadow duration-200';

  return (
    <div className="flex flex-col gap-6">
      {/* Property Type — pill chips */}
      <fieldset role="group" aria-label={t('filter.propertyType')} className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-stone-900 mb-1">
          {t('filter.propertyType')}
        </legend>
        <div className="flex flex-wrap gap-2">
          {PROPERTY_TYPE_ORDER.map((type) => {
            const checked = draft.types.includes(type);
            return (
              <button
                key={type}
                type="button"
                aria-pressed={checked}
                onClick={() => toggleType(type)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium min-h-[36px] transition-colors ${
                  checked
                    ? 'bg-terracotta-500 text-white'
                    : 'bg-stone-100 text-stone-800 hover:bg-stone-200'
                }`}
              >
                {t(`propertyType.${type}`, { defaultValue: propertyTypeConfig[type].label })}
                {filterCounts?.[type] !== undefined && (
                  <span
                    className={`text-xs ms-0.5 ${checked ? 'text-white/70' : 'text-stone-400'}`}
                  >
                    {filterCounts[type]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* City */}
      <div className="flex flex-col gap-2">
        <label htmlFor="filter-city" className="text-sm font-semibold text-stone-900">
          {t('filter.city')}
        </label>
        <select
          id="filter-city"
          value={draft.city ?? ''}
          onChange={handleCity}
          className={inputClass}
        >
          <option value="">{t('filter.allCities')}</option>
          {CITY_OPTIONS.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>

      {/* Price Range */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-stone-900">{t('filter.priceRange')}</span>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-min-price" className="text-xs text-stone-600">
              {t('filter.minPrice')}
            </label>
            <input
              id="filter-min-price"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="0"
              value={draft.minPrice ?? ''}
              onChange={handlePrice('minPrice')}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-max-price" className="text-xs text-stone-600">
              {t('filter.maxPrice')}
            </label>
            <input
              id="filter-max-price"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder={t('filter.any')}
              value={draft.maxPrice ?? ''}
              onChange={handlePrice('maxPrice')}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Rooms / Bathrooms */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="filter-rooms" className="text-sm font-semibold text-stone-900">
            {t('filter.rooms')}
          </label>
          <select
            id="filter-rooms"
            value={draft.rooms ?? ''}
            onChange={handleDropdown('rooms')}
            className={inputClass}
          >
            <option value="">{t('filter.any')}</option>
            {ROOM_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {roomLabel(n, 5)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="filter-bathrooms" className="text-sm font-semibold text-stone-900">
            {t('filter.bathrooms')}
          </label>
          <select
            id="filter-bathrooms"
            value={draft.bathrooms ?? ''}
            onChange={handleDropdown('bathrooms')}
            className={inputClass}
          >
            <option value="">{t('filter.any')}</option>
            {BATHROOM_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {roomLabel(n, 3)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Minimum Rating */}
      <fieldset role="group" aria-label={t('filter.minRating')} className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-stone-900 mb-1">
          {t('filter.minRating')}
        </legend>
        <div className="flex gap-2">
          {RATING_OPTIONS.map((rating) => {
            const active = typeof draft.minRating === 'number' && draft.minRating >= rating;
            return (
              <button
                key={rating}
                type="button"
                aria-label={t('filter.nStars', { n: rating })}
                onClick={() => setRating(rating)}
                className={`min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl border flex items-center justify-center transition-colors ${
                  active
                    ? 'bg-amber-400 border-amber-400 text-white'
                    : 'bg-white border-stone-200 text-stone-400 hover:bg-stone-50'
                }`}
              >
                <Star size={18} strokeWidth={2} fill={active ? 'currentColor' : 'none'} />
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Amenities */}
      <fieldset role="group" aria-label={t('filter.amenities')} className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-stone-900 mb-1">
          {t('filter.amenities')}
        </legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(amenityConfig).map(([key, config]) => {
            const active = draft.amenities.includes(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => toggleAmenity(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium min-h-[36px] transition-colors ${
                  active
                    ? 'bg-terracotta-500 text-white'
                    : 'bg-stone-100 text-stone-800 hover:bg-stone-200'
                }`}
              >
                {t(`amenity.${key}`, { defaultValue: config.label })}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Sort By */}
      <div className="flex flex-col gap-2">
        <label htmlFor="filter-sort" className="text-sm font-semibold text-stone-900">
          {t('filter.sortBy')}
        </label>
        <select
          id="filter-sort"
          value={draft.sort ?? ''}
          onChange={handleSort}
          className={inputClass}
        >
          <option value="">{t('filter.sortDefault')}</option>
          {(Object.keys(SORT_OPTION_KEYS) as SortOption[]).map((option) => (
            <option key={option} value={option}>
              {t(SORT_OPTION_KEYS[option])}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 sticky bottom-0 bg-white pb-1 border-t border-stone-100 shadow-[0_-4px_12px_rgba(43,38,33,0.04)]">
        <Button
          type="button"
          variant="secondary"
          size="md"
          className="flex-1"
          onClick={() => {
            setDraft({ types: [], amenities: [] });
            onClear();
          }}
        >
          {t('filter.clearAll')}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="md"
          className="flex-1"
          onClick={() => onApply(draft)}
        >
          {t('filter.applyFilters')}
        </Button>
      </div>
    </div>
  );
}
