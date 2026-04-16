/**
 * ReviewCard — single review entry rendered inside the reviews section.
 *
 * Presentational only: no data fetching, no mutations. The parent composes
 * the card with data from `useReviews` and decides whether the card belongs
 * to the current viewer (`isOwn`) so we can highlight it and expose an Edit
 * affordance. The avatar is a pair of initials rather than an image so the
 * component works without a media pipeline for user pictures.
 */
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { StarRating } from './star-rating';
import type { Review } from '../types/review';

type ReviewCardProps = {
  review: Review;
  /** Highlight as current user's review */
  isOwn?: boolean;
  /** When provided on an own review, renders an Edit button that calls this handler. */
  onEdit?: () => void;
};

function formatRelativeDate(
  dateString: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return t('review.today');
  if (diffDays === 1) return t('review.yesterday');
  if (diffDays < 7) return t(`review.daysAgo`, { count: diffDays });
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1
      ? t('review.weekAgo', { count: weeks })
      : t('review.weeksAgo', { count: weeks });
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1
      ? t('review.monthAgo', { count: months })
      : t('review.monthsAgo', { count: months });
  }
  const years = Math.floor(diffDays / 365);
  return years === 1
    ? t('review.yearAgo', { count: years })
    : t('review.yearsAgo', { count: years });
}

function initialsFor(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ReviewCard({ review, isOwn = false, onEdit }: ReviewCardProps) {
  const { t } = useTranslation();
  const canEdit = isOwn && typeof onEdit === 'function';
  const containerClass = isOwn
    ? 'p-4 rounded-xl bg-terracotta-50 border border-terracotta-200'
    : 'p-4 rounded-xl bg-white border border-stone-100';

  return (
    <article className={containerClass}>
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full shrink-0 bg-stone-200 text-stone-600 flex items-center justify-center text-sm font-semibold"
          aria-hidden="true"
        >
          {initialsFor(review.user.fullName)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-sm font-semibold text-stone-800">{review.user.fullName}</span>
              {isOwn && (
                <span className="ml-2 text-[10px] font-medium text-terracotta-600 uppercase tracking-wider">
                  {t('review.yourReview')}
                </span>
              )}
            </div>
            <span className="text-xs text-stone-400 shrink-0">
              {formatRelativeDate(review.createdAt, t)}
            </span>
          </div>

          <div className="mt-1">
            <StarRating value={review.rating} size="sm" showValue={false} />
          </div>

          {review.comment && (
            <p className="mt-2 text-sm text-stone-600 leading-relaxed">{review.comment}</p>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta-600 hover:text-terracotta-700 transition-colors min-h-[44px]"
            >
              <Pencil size={14} aria-hidden="true" />
              {t('review.edit')}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
