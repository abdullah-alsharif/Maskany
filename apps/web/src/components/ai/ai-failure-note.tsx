'use client';

import { useEffect, useState } from 'react';
import { CircleAlert, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type AiFailureVariant = 'error' | 'rate_limit';

const COMPACT_VISIBLE_MS = 8000;
const COMPACT_EXIT_MS = 300;

type AiFailureNoteProps = {
  variant: AiFailureVariant;
  /** Compact pill for inline use (e.g. next to the enhance button). */
  compact?: boolean;
  title?: string;
  hint?: string;
  onRetry?: () => void;
};

export function AiFailureNote({
  variant,
  compact = false,
  title,
  hint,
  onRetry,
}: AiFailureNoteProps) {
  const { t } = useTranslation();
  const [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!compact) return;
    const startExit = setTimeout(() => setLeaving(true), COMPACT_VISIBLE_MS);
    const remove = setTimeout(() => setHidden(true), COMPACT_VISIBLE_MS + COMPACT_EXIT_MS);
    return () => {
      clearTimeout(startExit);
      clearTimeout(remove);
    };
  }, [compact]);

  const isRateLimit = variant === 'rate_limit';
  const Icon = isRateLimit ? Clock : CircleAlert;

  const resolvedTitle = title ?? (isRateLimit ? t('ai.rateLimited') : t('ai.generationFailed'));
  const resolvedHint =
    hint ?? (isRateLimit ? t('ai.rateLimitedHint') : t('ai.generationFailedHint'));

  if (compact) {
    if (hidden) return null;
    return (
      <span
        role="alert"
        style={{ animationDelay: leaving ? undefined : '450ms' }}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold animate-fade-in ${
          (leaving && 'animate-fade-out') || ''
        } ${
          isRateLimit
            ? 'bg-amber-400/15 text-amber-700 border-amber-500/30'
            : 'bg-error/10 text-error border-error/25'
        }`}
      >
        <Icon size={13} aria-hidden="true" />
        {resolvedTitle}
      </span>
    );
  }

  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-xl border p-3 animate-fade-in ${
        isRateLimit ? 'bg-amber-400/10 border-amber-500/30' : 'bg-error/5 border-error/25'
      }`}
    >
      <span
        className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${
          isRateLimit ? 'bg-amber-400/20 text-amber-700' : 'bg-error/10 text-error'
        }`}
      >
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-stone-900">{resolvedTitle}</span>
        <span className="block mt-0.5 text-xs leading-relaxed text-stone-700">{resolvedHint}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={`mt-1 inline-block text-xs font-semibold underline underline-offset-2 ${
              isRateLimit ? 'text-amber-700' : 'text-error'
            } hover:opacity-80 transition-opacity`}
          >
            {t('ai.retry')}
          </button>
        )}
      </span>
    </div>
  );
}
