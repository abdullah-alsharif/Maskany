/**
 * `AmenityChips` — renders a property's amenities as an inline wrap of
 * icon + label chips. Keys are looked up in `amenityConfig` for the
 * canonical label and icon; unknown keys render the raw key as the label
 * with a generic sparkle icon so new amenity types degrade gracefully.
 */
import {
  AirVent,
  ArrowUpDown,
  Car,
  CookingPot,
  Dumbbell,
  Fence,
  Flower2,
  ShieldCheck,
  Sofa,
  Sparkles,
  WashingMachine,
  Waves,
  Wifi,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { amenityConfig } from '../styles/design-tokens';

const iconMap: Record<string, LucideIcon> = {
  Wifi,
  Car,
  Waves,
  Dumbbell,
  AirVent,
  Sofa,
  CookingPot,
  Fence,
  ShieldCheck,
  ArrowUpDown,
  Flower2,
  WashingMachine,
};

type AmenityChipsProps = {
  amenities: string[];
};

export function AmenityChips({ amenities }: AmenityChipsProps) {
  const { t } = useTranslation();
  if (amenities.length === 0) return null;

  return (
    <ul aria-label={t('aria.amenities')} className="flex flex-wrap gap-2">
      {amenities.map((key) => {
        const config = amenityConfig[key];
        const Icon = config ? (iconMap[config.icon] ?? Sparkles) : Sparkles;
        const label = config?.label ?? key;
        return (
          <li
            key={key}
            className="
              inline-flex items-center gap-1.5
              px-3 py-1.5 rounded-full
              bg-stone-100 text-stone-800
              text-sm font-medium
              min-h-[32px]
            "
          >
            <Icon size={16} strokeWidth={2} aria-hidden="true" />
            <span>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}
