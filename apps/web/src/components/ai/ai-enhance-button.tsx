'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAiEnhance } from '../../hooks/use-ai-enhance';
import { useAiStreamEnhance } from '../../hooks/use-ai-stream-enhance';
import type { useAiHistory } from '../../hooks/use-ai-history';
import type { PropertyMetadata } from '../../services/ai-service';

type AiEnhanceButtonProps = {
  fieldKey: string;
  currentValue: string;
  fieldType: 'title' | 'summary' | 'description' | 'area' | 'city' | 'amenities';
  action?: 'enhance' | 'rewrite' | 'fix_grammar';
  metadata: PropertyMetadata;
  onResult: (newValue: string) => void;
  locale: 'en' | 'ar';
  onUndo?: (previousValue: string) => void;
  history?: ReturnType<typeof useAiHistory>;
};

export function AiEnhanceButton({
  currentValue,
  fieldType,
  action = 'enhance',
  metadata,
  onResult,
  locale,
  onUndo,
  history,
}: AiEnhanceButtonProps) {
  const { i18n } = useTranslation();
  const t = i18n.getFixedT(locale);
  const [showUndo, setShowUndo] = useState(false);
  const [previousValue, setPreviousValue] = useState<string | null>(null);

  const isEmpty = !currentValue.trim();

  const useStreaming = fieldType === 'description';
  const aiEnhance = useAiEnhance({
    fieldType,
    action,
    metadata,
    locale,
  });
  const aiStreamEnhance = useAiStreamEnhance({
    fieldType,
    action,
    metadata,
    locale,
  });

  const handleEnhance = useCallback(async () => {
    if (isEmpty) return;
    setPreviousValue(currentValue);
    setShowUndo(false);

    try {
      const result = useStreaming
        ? await aiStreamEnhance.enhance(currentValue)
        : await aiEnhance.enhance(currentValue);

      onResult(result);
      setShowUndo(true);

      if (previousValue !== null && history) {
        history.addEntry({
          fieldType,
          action,
          previousValue,
          newValue: result,
        });
      }
    } catch {
      // error state is handled by the hook
    }
  }, [
    currentValue,
    useStreaming,
    aiStreamEnhance,
    aiEnhance,
    onResult,
    previousValue,
    history,
    fieldType,
    action,
    isEmpty,
  ]);

  const handleUndo = useCallback(() => {
    if (previousValue !== null) {
      onResult(previousValue);
      setShowUndo(false);
      onUndo?.(previousValue);
    }
  }, [previousValue, onResult, onUndo]);

  const loading = aiEnhance.status === 'loading' || aiStreamEnhance.status === 'loading';
  const errorMessage = aiEnhance.errorMessage || aiStreamEnhance.errorMessage;
  const isRateLimited =
    aiEnhance.status === 'rate_limited' || aiStreamEnhance.status === 'rate_limited';

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleEnhance}
        disabled={loading || isEmpty}
        className="min-h-[44px] flex items-center gap-1 rounded-xl px-2.5 hover:bg-stone-100 disabled:opacity-40 disabled:pointer-events-none transition-colors text-xs font-medium text-stone-500"
        title={t('ai.enhance')}
        aria-label={t('ai.enhance')}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          '✨'
        )}
        {t('ai.enhance')}
      </button>

      {showUndo && (
        <button
          type="button"
          onClick={handleUndo}
          className="text-xs text-terracotta-600 hover:text-terracotta-700 font-medium px-2 py-1 rounded-lg hover:bg-terracotta-50 transition-colors"
        >
          ✨ {t('ai.undo')}
        </button>
      )}

      {!showUndo && isRateLimited && <span className="text-xs text-amber-600">{errorMessage}</span>}
      {!showUndo && !isRateLimited && aiEnhance.status === 'error' && (
        <span className="text-xs text-red-500">{errorMessage}</span>
      )}
    </div>
  );
}
