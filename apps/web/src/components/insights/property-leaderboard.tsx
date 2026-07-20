'use client';

import Link from 'next/link';
import { Award, Eye, ImageIcon, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { InsightsProperty } from '../../types/insights';
import { HealthBadge } from './health-score';

function rankColor(index: number): string {
  if (index === 0) return 'text-amber-500';
  if (index === 1) return 'text-stone-400';
  if (index === 2) return 'text-stone-600';
  return 'text-stone-300';
}

export function PropertyLeaderboard({ properties }: { properties: InsightsProperty[] }) {
  const { t } = useTranslation();

  if (properties.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-stone-200 p-6 text-center animate-fade-in">
        <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
          <Award size={20} strokeWidth={1.5} />
        </div>
        <p className="mt-3 text-sm text-stone-500">{t('insights.noTopProperties')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-stone-200 divide-y divide-stone-100">
      {properties.map((property, index) => (
        <Link
          key={property.id}
          href={`/properties/${property.id}`}
          className="flex items-center gap-3 px-4 py-3 min-h-[56px] transition-colors hover:bg-stone-50 active:bg-stone-100"
        >
          <span className={`w-6 text-center text-sm font-bold ${rankColor(index)}`}>
            {index + 1}
          </span>

          <div className="w-10 h-10 rounded-lg bg-stone-100 overflow-hidden shrink-0">
            {property.coverImage ? (
              <img
                src={property.coverImage.thumbnailUrl || property.coverImage.url}
                alt={property.coverImage.altText ?? property.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon size={16} className="text-stone-300" strokeWidth={1.2} />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-stone-800 truncate">{property.title}</p>
            <p className="text-xs text-stone-400">{property.city}</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1 text-xs text-stone-500">
              <Eye size={13} strokeWidth={1.5} />
              {property.viewCount30d}
            </div>
            <div className="flex items-center gap-1 text-xs text-stone-500">
              <MessageSquare size={13} strokeWidth={1.5} />
              {property.inquiryCount30d}
            </div>
            <HealthBadge score={property.healthScore} />
          </div>
        </Link>
      ))}
    </div>
  );
}
