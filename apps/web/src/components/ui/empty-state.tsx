import { type ReactNode } from 'react';
import { SearchX, Heart, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './button';

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

function GeometricPattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.04]"
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern id="geo-diamonds" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <polygon points="20,0 40,20 20,40 0,20" fill="#e2683d" />
          <polygon points="0,0 20,20 0,40" fill="#84904d" />
          <polygon points="40,0 20,20 40,40" fill="#2b2621" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#geo-diamonds)" />
    </svg>
  );
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="relative flex flex-col items-center justify-center py-16 px-8 text-center animate-fade-in bg-gradient-to-b from-sand-50 to-sand-200 overflow-hidden">
      <GeometricPattern />
      <div className="w-16 h-16 rounded-2xl bg-terracotta-50 text-terracotta-600 flex items-center justify-center mb-5 relative">
        {icon || <SearchX size={28} strokeWidth={1.5} />}
      </div>
      <h3 className="text-lg font-semibold text-stone-800 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-stone-500 max-w-xs leading-relaxed">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction} className="mt-5">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function NoResults() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<SearchX size={28} strokeWidth={1.5} />}
      title={t('empty.noResults')}
      description={t('empty.noResultsDesc')}
    />
  );
}

export function NoFavorites({ onBrowse }: { onBrowse: () => void }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<Heart size={28} strokeWidth={1.5} />}
      title={t('empty.noFavorites')}
      description={t('empty.noFavoritesDesc')}
      actionLabel={t('empty.browseProperties')}
      onAction={onBrowse}
    />
  );
}

export function NoProperties({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<Home size={28} strokeWidth={1.5} />}
      title={t('empty.noListings')}
      description={t('empty.noListingsDesc')}
      actionLabel={t('empty.createListing')}
      onAction={onCreate}
    />
  );
}
