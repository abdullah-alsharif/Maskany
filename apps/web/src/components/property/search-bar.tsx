import { useState, useEffect, useRef, type Ref } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  onFilterClick?: () => void;
  activeFilterCount?: number;
  placeholder?: string;
  /**
   * Optional ref forwarded to the underlying search input so parents can
   * focus it programmatically (e.g. the SearchPage auto-focus on mount).
   */
  ref?: Ref<HTMLInputElement>;
};

export function SearchBar({
  value,
  onChange,
  onFilterClick,
  activeFilterCount = 0,
  placeholder = 'Search properties...',
  ref,
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(newValue);
    }, 300);
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
    inputRef.current?.focus();
  };

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  return (
    <div className="flex items-center gap-2">
      {/* Search input */}
      <div className="relative flex-1">
        <Search
          size={18}
          strokeWidth={2}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
        />
        <input
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
          }}
          type="search"
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="
            w-full h-11
            pl-10 pr-9
            rounded-xl
            bg-white border border-stone-300
            text-[15px] text-stone-800
            placeholder:text-stone-400
            focus:outline-none focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100
            transition-shadow duration-200
          "
          aria-label="Search properties"
        />
        {localValue && (
          <button
            onClick={handleClear}
            className="
              absolute right-2.5 top-1/2 -translate-y-1/2
              w-6 h-6 rounded-full
              flex items-center justify-center
              text-stone-400 hover:text-stone-600
              hover:bg-stone-100
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-100
              transition-colors duration-150
            "
            aria-label="Clear search"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Filter button */}
      {onFilterClick && (
        <button
          onClick={onFilterClick}
          className="
            relative
            flex items-center justify-center
            w-11 h-11
            rounded-xl
            bg-white border border-stone-300
            text-stone-600
            hover:border-stone-400 hover:bg-stone-50
            active:bg-stone-100 active:scale-[0.96]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-100 focus-visible:border-terracotta-400
            transition-colors transition-shadow transition-transform duration-200
            shrink-0
          "
          aria-label={`Filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
        >
          <SlidersHorizontal size={18} strokeWidth={2} />
          {activeFilterCount > 0 && (
            <span
              className="
                absolute -top-1 -right-1
                min-w-[18px] h-[18px] px-1
                flex items-center justify-center
                bg-terracotta-500 text-white
                text-[10px] font-bold rounded-full
                leading-none
              "
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
