'use client';

import { useTranslation } from 'react-i18next';
import type { AiHistoryEntry } from '../../hooks/use-ai-history';

type AiHistoryProps = {
  entries: AiHistoryEntry[];
  onRevert: (entryId: string) => void;
  onRevertAll: () => void;
};

export function AiHistory({ entries, onRevert, onRevertAll }: AiHistoryProps) {
  const { t } = useTranslation();

  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-700">✨ {t('ai.historyHeading')}</h3>
        <button
          type="button"
          onClick={onRevertAll}
          className="text-xs text-red-500 hover:text-red-600 font-medium"
        >
          {t('ai.revertAll')}
        </button>
      </div>
      <div className="divide-y divide-stone-100">
        {entries.map((entry) => (
          <div key={entry.id} className="px-4 py-2.5 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-stone-500 uppercase">
                  {entry.fieldType}
                </span>
                <span className="text-xs text-stone-400">{entry.action}</span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRevert(entry.id)}
              className="text-xs text-terracotta-600 hover:text-terracotta-700 font-medium shrink-0"
            >
              {t('ai.revert')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
