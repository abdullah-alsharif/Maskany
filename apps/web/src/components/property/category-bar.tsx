import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  DoorOpen,
  TreePine,
  Castle,
  Home,
  LayoutGrid,
  Layers,
  Grid3X3,
} from 'lucide-react';
import type { PropertyType } from '../../types/property';

type CategoryItem = {
  value: PropertyType | 'ALL';
  labelKey: string;
  icon: React.ReactNode;
};

const categories: CategoryItem[] = [
  { value: 'ALL', labelKey: 'category.ALL', icon: <Grid3X3 size={18} strokeWidth={1.8} /> },
  {
    value: 'APARTMENT',
    labelKey: 'category.APARTMENT',
    icon: <Building2 size={18} strokeWidth={1.8} />,
  },
  { value: 'ROOM', labelKey: 'category.ROOM', icon: <DoorOpen size={18} strokeWidth={1.8} /> },
  { value: 'CHALET', labelKey: 'category.CHALET', icon: <TreePine size={18} strokeWidth={1.8} /> },
  { value: 'VILLA', labelKey: 'category.VILLA', icon: <Castle size={18} strokeWidth={1.8} /> },
  { value: 'HOUSE', labelKey: 'category.HOUSE', icon: <Home size={18} strokeWidth={1.8} /> },
  {
    value: 'STUDIO',
    labelKey: 'category.STUDIO',
    icon: <LayoutGrid size={18} strokeWidth={1.8} />,
  },
  { value: 'OTHER', labelKey: 'category.OTHER', icon: <Layers size={18} strokeWidth={1.8} /> },
];

type CategoryBarProps = {
  selected: PropertyType | 'ALL';
  onSelect: (value: PropertyType | 'ALL') => void;
};

export function CategoryBar({ selected, onSelect }: CategoryBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  return (
    <div
      ref={scrollRef}
      className="
        flex gap-1.5 overflow-x-auto scrollbar-hide
        px-4 py-3
        -mx-4
      "
      role="tablist"
      aria-label="Property categories"
    >
      {categories.map(({ value, labelKey, icon }) => {
        const label = t(labelKey);
        const isActive = selected === value;
        return (
          <button
            key={value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(value)}
            className={`
              flex items-center gap-1.5
              px-3.5 h-9
              rounded-full whitespace-nowrap
              text-[13px] font-medium
              transition-all duration-200
              shrink-0
              ${
                isActive
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              }
            `}
          >
            <span className={isActive ? 'text-white' : 'text-stone-400'}>{icon}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
