/**
 * ReviewSection — reviews area rendered on the property detail page.
 *
 * Layout:
 *   - Header: large average rating, star display, review count, 5-bar
 *     distribution chart (via `RatingDistribution`).
 *   - List: paginated review cards (`ReviewCard`) with a "Load more" button
 *     when the server reports additional pages (10 per page per PRD §5.3).
 *   - Compose: a `ReviewForm` for authenticated non-owners, a "sign in"
 *     prompt for unauthenticated users, and an owner-blocked notice for
 *     the property owner (matches the server's 403 rule).
 *   - Edit flow: if the viewer already has a review in the list, their row
 *     is highlighted; pressing "Edit" swaps the create form for an update
 *     form seeded with the existing rating/comment.
 *
 * All mutations route through `use-reviews` hooks, which invalidate the
 * summary + list caches on success so the header and list refresh
 * together after a submit. Axios error shapes (response.data.error.message)
 * are surfaced to the user so conflict (409) and validation (400) errors
 * show inline instead of disappearing into the network tab.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { StarRating } from './star-rating';
import { RatingDistribution } from './rating-distribution';
import { ReviewCard } from './review-card';
import { ReviewForm, type ReviewFormValues } from './review-form';
import {
  REVIEW_PAGE_SIZE,
  useCreateReview,
  useReviewSummary,
  useReviews,
  useUpdateReview,
} from '../hooks/use-reviews';
import type { Review, ReviewSummary } from '../types/review';

type CurrentUser = { id: string; fullName: string };

type ReviewSectionProps = {
  propertyId: string;
  propertyOwnerId: string;
  currentUser: CurrentUser | null;
};

type ErrorResponseShape = {
  response?: { data?: { error?: { message?: string; code?: string } } };
};

function errorMessageOf(error: unknown, t: (key: string) => string): string {
  if (!error) return '';
  const maybe = error as ErrorResponseShape & { message?: string };
  return maybe.response?.data?.error?.message ?? maybe.message ?? t('review.somethingWentWrong');
}

function countLabel(count: number): string {
  return `${count} review${count === 1 ? '' : 's'}`;
}

function toDistributionNumbers(dist: ReviewSummary['distribution']): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [key, value] of Object.entries(dist)) {
    out[Number(key)] = value;
  }
  return out;
}

function SummaryHeader({ summary, t }: { summary: ReviewSummary; t: (key: string) => string }) {
  const avg = summary.averageRating;
  return (
    <section aria-label="Reviews summary" className="space-y-4">
      <div className="flex items-center gap-2">
        <Star size={22} fill="#f5b731" stroke="#f5b731" aria-hidden="true" />
        <h2 className="text-xl font-semibold text-stone-900">{t('review.heading')}</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex items-end gap-3">
          <span className="font-display text-5xl text-stone-950 leading-none">
            {avg.toFixed(1)}
          </span>
          <div className="pb-1 space-y-1">
            <StarRating value={avg} size="md" showValue={false} />
            <span className="block text-sm text-stone-500">{countLabel(summary.reviewCount)}</span>
          </div>
        </div>
        <RatingDistribution
          distribution={toDistributionNumbers(summary.distribution)}
          total={summary.reviewCount}
        />
      </div>
    </section>
  );
}

function ReviewsSkeleton() {
  return (
    <div data-testid="reviews-skeleton" className="space-y-3">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function ReviewSection({ propertyId, propertyOwnerId, currentUser }: ReviewSectionProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<Review[]>([]);
  const [editing, setEditing] = useState(false);
  const summaryQuery = useReviewSummary(propertyId);
  const listQuery = useReviews(propertyId, page);
  const createMutation = useCreateReview(propertyId);
  const updateMutation = useUpdateReview(propertyId);

  const mergedReviews = useMemo(() => {
    const currentPageReviews = listQuery.data?.reviews ?? [];
    if (page === 1) return currentPageReviews;
    const seen = new Set(accumulated.map((r) => r.id));
    const extra = currentPageReviews.filter((r) => !seen.has(r.id));
    return [...accumulated, ...extra];
  }, [accumulated, listQuery.data, page]);

  const ownReview = currentUser
    ? (mergedReviews.find((r) => r.userId === currentUser.id) ?? null)
    : null;

  const isOwner = currentUser?.id === propertyOwnerId;
  const hasMore = Boolean(listQuery.data?.nextCursor);

  const handleLoadMore = () => {
    setAccumulated(mergedReviews);
    setPage((prev) => prev + 1);
  };

  const handleCreate = async (values: ReviewFormValues) => {
    await createMutation.mutateAsync(values);
    setPage(1);
    setAccumulated([]);
  };

  const handleUpdate = async (values: ReviewFormValues) => {
    if (!ownReview) return;
    await updateMutation.mutateAsync({ reviewId: ownReview.id, ...values });
    setEditing(false);
    setPage(1);
    setAccumulated([]);
  };

  const renderComposer = () => {
    if (isOwner) {
      return (
        <p className="rounded-xl bg-stone-50 border border-stone-200 p-4 text-sm text-stone-600">
          {t('review.ownerCannotReview')}
        </p>
      );
    }
    if (!currentUser) {
      return (
        <p className="rounded-xl bg-stone-50 border border-stone-200 p-4 text-sm text-stone-600">
          {t('review.signInToReview')}
        </p>
      );
    }
    if (ownReview && editing) {
      return (
        <ReviewForm
          initialRating={ownReview.rating}
          initialComment={ownReview.comment ?? ''}
          submitLabel={t('review.updateReview')}
          isSubmitting={updateMutation.isPending}
          errorMessage={updateMutation.isError ? errorMessageOf(updateMutation.error, t) : null}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(false)}
        />
      );
    }
    if (ownReview) {
      return null;
    }
    return (
      <ReviewForm
        isSubmitting={createMutation.isPending}
        errorMessage={createMutation.isError ? errorMessageOf(createMutation.error, t) : null}
        onSubmit={handleCreate}
      />
    );
  };

  const renderList = () => {
    if (listQuery.isPending) return <ReviewsSkeleton />;
    if (mergedReviews.length === 0) {
      return (
        <p className="text-sm text-stone-500 rounded-xl bg-stone-50 p-4 border border-stone-100">
          {t('review.noReviewsYet')}
        </p>
      );
    }
    return (
      <ul className="space-y-3">
        {mergedReviews.map((review) => {
          const isOwn = currentUser?.id === review.userId;
          return (
            <li key={review.id}>
              <ReviewCard
                review={review}
                isOwn={isOwn}
                onEdit={isOwn ? () => setEditing(true) : undefined}
              />
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <section aria-label="Reviews" className="space-y-5">
      {summaryQuery.data ? (
        <SummaryHeader summary={summaryQuery.data} t={t} />
      ) : (
        <Skeleton className="h-24 w-full" />
      )}

      {renderComposer()}

      {renderList()}

      {hasMore && !listQuery.isPending && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleLoadMore}
            loading={listQuery.isFetching && page > 1}
          >
            {t('review.loadMore')}
          </Button>
        </div>
      )}
    </section>
  );
}

export const REVIEW_SECTION_PAGE_SIZE = REVIEW_PAGE_SIZE;
