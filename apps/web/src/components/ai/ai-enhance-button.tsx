'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAiEnhance } from '../../hooks/use-ai-enhance';
import type { useAiHistory } from '../../hooks/use-ai-history';
import type { PropertyMetadata } from '../../services/ai-service';

type AiEnhanceButtonProps = {
  fieldKey: string;
  currentValue: string;
  fieldType: 'title' | 'summary' | 'description' | 'area' | 'amenities';
  metadata: PropertyMetadata;
  onResult: (newValue: string) => void;
  locale: 'en' | 'ar';
  onUndo?: (previousValue: string) => void;
  history?: ReturnType<typeof useAiHistory>;
};

export function AiEnhanceButton({
  currentValue,
  fieldType,
  metadata,
  onResult,
  locale,
  onUndo,
  history,
}: AiEnhanceButtonProps) {
  const { t } = useTranslation();
  const [showUndo, setShowUndo] = useState(false);
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onResultRef = useRef(onResult);
  const onUndoRef = useRef(onUndo);
  const historyRef = useRef(history);
  onResultRef.current = onResult;
  onUndoRef.current = onUndo;
  historyRef.current = history;

  const isEmpty = !currentValue.trim();

  const aiEnhance = useAiEnhance({
    fieldType,
    action: 'enhance',
    metadata,
    locale,
    stream: fieldType === 'description',
  });

  const handleEnhance = useCallback(async () => {
    if (isEmpty) return;
    setPreviousValue(currentValue);
    setShowUndo(false);
    await aiEnhance.enhance(currentValue);
  }, [currentValue, aiEnhance, isEmpty]);

  useEffect(() => {
    if (aiEnhance.status === 'success' && aiEnhance.enhancedValue) {
      onResultRef.current(aiEnhance.enhancedValue);
      setShowUndo(true);

      if (previousValue !== null && historyRef.current) {
        historyRef.current.addEntry({
          fieldType,
          action: 'enhance',
          previousValue,
          newValue: aiEnhance.enhancedValue,
        });
      }

      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = setTimeout(() => setShowUndo(false), 8000);
    }
  }, [aiEnhance.status, aiEnhance.enhancedValue, previousValue, fieldType]);

  const handleUndo = useCallback(() => {
    if (previousValue !== null) {
      onResultRef.current(previousValue);
      setShowUndo(false);
      onUndoRef.current?.(previousValue);
    }
  }, [previousValue]);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleEnhance}
        disabled={aiEnhance.status === 'loading' || isEmpty}
        className="min-h-[44px] flex items-center gap-1 rounded-xl px-2.5 hover:bg-stone-100 disabled:opacity-40 disabled:pointer-events-none transition-colors text-xs font-medium text-stone-500"
        title={t('ai.enhance')}
        aria-label={t('ai.enhance')}
      >
        {aiEnhance.status === 'loading' ? (
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

      {aiEnhance.status === 'error' && (
        <span className="text-xs text-red-500">{aiEnhance.errorMessage}</span>
      )}
      {aiEnhance.status === 'rate_limited' && (
        <span className="text-xs text-amber-600">{aiEnhance.errorMessage}</span>
      )}
    </div>
  );
}
