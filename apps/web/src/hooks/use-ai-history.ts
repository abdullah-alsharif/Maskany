import { useState, useCallback } from 'react';

export interface AiHistoryEntry {
  id: string;
  fieldType: string;
  action: string;
  previousValue: string;
  newValue: string;
  timestamp: number;
}

const MAX_HISTORY_PER_FIELD = 5;

export function useAiHistory() {
  const [history, setHistory] = useState<AiHistoryEntry[]>([]);

  const addEntry = useCallback((entry: Omit<AiHistoryEntry, 'id' | 'timestamp'>) => {
    setHistory((prev) => {
      const updated = [{ ...entry, id: crypto.randomUUID(), timestamp: Date.now() }, ...prev];
      // Trim per-field stack to max 5
      const kept = updated.filter((e) => {
        const count = updated.filter((x) => x.fieldType === e.fieldType).indexOf(e);
        return count < MAX_HISTORY_PER_FIELD;
      });
      return kept;
    });
  }, []);

  const revertEntry = useCallback(
    (entryId: string): AiHistoryEntry | null => {
      const entry = history.find((e) => e.id === entryId);
      if (entry) {
        setHistory((prev) => prev.filter((e) => e.id !== entryId));
      }
      return entry ?? null;
    },
    [history],
  );

  const revertAll = useCallback((): AiHistoryEntry[] => {
    const entries = [...history];
    setHistory([]);
    return entries;
  }, [history]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return { history, addEntry, revertEntry, revertAll, clearHistory };
}
