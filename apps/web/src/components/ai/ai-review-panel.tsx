'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AiQualityScore } from './ai-quality-score';
import { useAiReview } from '../../hooks/use-ai-review';
import type { ReviewPropertyData, ReviewSuggestion } from '../../services/ai-service';

type AiReviewPanelProps = {
  open: boolean;
  onClose: () => void;
  propertyData: ReviewPropertyData;
  locale: string;
  onApplySuggestion: (field: string, value: string) => void;
};

const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
const severityColor: Record<string, string> = {
  high: 'bg-red-50 border-red-200 text-red-700',
  medium: 'bg-amber-50 border-amber-200 text-amber-700',
  low: 'bg-stone-50 border-stone-200 text-stone-600',
};
const severityDot: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-stone-400',
};

function suggestionId(s: ReviewSuggestion, idx: number): string {
  return `${s.field}-${s.type}-${idx}`;
}

export function AiReviewPanel({
  open,
  onClose,
  propertyData,
  locale,
  onApplySuggestion,
}: AiReviewPanelProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  const { data, isLoading, error, refetch } = useAiReview(open ? propertyData : null, locale);

  const suggestions: (ReviewSuggestion & { _id: string })[] = useMemo(
    () =>
      (data?.suggestions ?? [])
        .map((s, i) => ({ ...s, _id: suggestionId(s, i) }))
        .sort((a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99)),
    [data?.suggestions],
  );

  const toggleSuggestion = (id: string) => {
    if (applied.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApplySelected = async () => {
    setApplying(true);
    for (const suggestion of suggestions) {
      if (selected.has(suggestion._id) && suggestion.suggestion) {
        onApplySuggestion(suggestion.field, suggestion.suggestion);
      }
    }
    setApplied((prev) => {
      const next = new Set(prev);
      for (const id of selected) next.add(id);
      return next;
    });
    setSelected(new Set());
    setApplying(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-xl max-h-screen overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-stone-800">{t('ai.reviewHeading')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-stone-400 hover:text-stone-600"
            aria-label={t('ai.close')}
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-stone-100 animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-sm text-stone-500 mb-3">{t('ai.reviewError')}</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-sm text-terracotta-600 hover:text-terracotta-700 font-medium"
              >
                {t('ai.retry')}
              </button>
            </div>
          )}

          {data && (
            <>
              <AiQualityScore
                score={data.score}
                maxScore={data.maxScore}
                benchmark={suggestions.length === 0 ? t('ai.listingGreat') : undefined}
              />

              {suggestions.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-2xl mb-2">🎉</p>
                  <p className="text-sm text-stone-600">{t('ai.listingGreat')}</p>
                </div>
              )}

              {suggestions.length > 0 && (
                <div className="space-y-2">
                  {suggestions.map((suggestion) => {
                    const isApplied = applied.has(suggestion._id);
                    return (
                      <div
                        key={suggestion._id}
                        className={`rounded-xl border p-3 transition-opacity ${
                          isApplied
                            ? 'opacity-50 border-green-300 bg-green-50'
                            : severityColor[suggestion.severity ?? 'medium']
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {isApplied ? (
                            <span className="mt-1 text-green-600 text-lg leading-none">✓</span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={selected.has(suggestion._id)}
                              onChange={() => toggleSuggestion(suggestion._id)}
                              disabled={!suggestion.suggestion || applying}
                              className="mt-1 rounded border-stone-300 text-terracotta-600 focus:ring-terracotta-500"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`w-2 h-2 rounded-full ${severityDot[suggestion.severity ?? 'medium']}`}
                              />
                              <span className="text-xs font-semibold uppercase tracking-wide">
                                {t(
                                  `ai.severity${(suggestion.severity ?? 'medium').charAt(0).toUpperCase() + (suggestion.severity ?? 'medium').slice(1)}` as const,
                                )}
                              </span>
                              <span className="text-xs text-stone-400 font-mono">
                                {suggestion.field}
                              </span>
                              {isApplied && (
                                <span className="text-xs text-green-600 font-medium">
                                  {t('ai.applied')}
                                </span>
                              )}
                            </div>
                            <p className="text-sm">{suggestion.message}</p>
                            {suggestion.suggestion && (
                              <p className="text-xs text-stone-500 mt-1 italic truncate">
                                {suggestion.suggestion}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {selected.size > 0 && (
                    <button
                      type="button"
                      onClick={handleApplySelected}
                      disabled={applying}
                      className="w-full h-12 rounded-xl bg-terracotta-600 text-white font-medium hover:bg-terracotta-700 disabled:opacity-50 disabled:pointer-events-none transition-colors mb-12"
                    >
                      {applying
                        ? t('ai.applying')
                        : t('ai.applySelected', { count: selected.size })}
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {!isLoading && !data && !error && (
            <button
              type="button"
              onClick={() => refetch()}
              className="w-full h-12 rounded-xl bg-terracotta-600 text-white font-medium hover:bg-terracotta-700 transition-colors"
            >
              {t('ai.startReview')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
