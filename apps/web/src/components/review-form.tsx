/**
 * ReviewForm — interactive star rating + comment textarea used to create or
 * edit a review. The component is presentational: it owns its transient
 * input state but defers the network call to the `onSubmit` callback so the
 * same form backs both "new review" and "edit existing review" flows.
 *
 * A required-rating guard lives in the component because the server's zod
 * schema rejects rating=0; catching it client-side saves a round trip and
 * produces a clearer inline message than the generic validation toast.
 */
import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { StarRating } from './star-rating';

export type ReviewFormValues = {
  rating: number;
  comment: string | null;
};

type ReviewFormProps = {
  onSubmit: (values: ReviewFormValues) => void | Promise<void>;
  onCancel?: () => void;
  initialRating?: number;
  initialComment?: string | null;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  submitLabel?: string;
};

export function ReviewForm({
  onSubmit,
  onCancel,
  initialRating = 0,
  initialComment = '',
  isSubmitting = false,
  errorMessage = null,
  submitLabel,
}: ReviewFormProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState<number>(initialRating);
  const [comment, setComment] = useState<string>(initialComment ?? '');
  const [localError, setLocalError] = useState<string | null>(null);
  const textareaId = useId();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (rating <= 0) {
      setLocalError(t('review.errorRatingRequired'));
      return;
    }
    setLocalError(null);
    const trimmed = comment.trim();
    await onSubmit({ rating, comment: trimmed.length === 0 ? null : trimmed });
  };

  const displayedError = localError ?? errorMessage;
  const label = submitLabel ?? t('review.submitReview');

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]"
      noValidate
    >
      <div className="space-y-2">
        <span className="block text-sm font-semibold text-stone-800">{t('review.yourRating')}</span>
        <StarRating
          value={rating}
          onChange={(next) => {
            setRating(next);
            if (localError) setLocalError(null);
          }}
          size="lg"
          showValue={false}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor={textareaId} className="block text-sm font-semibold text-stone-800">
          {t('review.comment')}
        </label>
        <textarea
          id={textareaId}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={4}
          placeholder={t('review.commentPlaceholder')}
          className="w-full rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 resize-none"
        />
      </div>

      {displayedError && (
        <p role="alert" className="text-sm text-red-600">
          {displayedError}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="md" loading={isSubmitting}>
          {label}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" size="md" onClick={onCancel}>
            {t('review.cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}
