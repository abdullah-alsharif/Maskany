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

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-5 text-stone-400">
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
