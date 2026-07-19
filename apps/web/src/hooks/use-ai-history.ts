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
      const newEntry = { ...entry, id: crypto.randomUUID(), timestamp: Date.now() };
      const updated = [newEntry, ...prev];

      // Trim per-field stack to max 5 — O(n) by counting per field
      const counts = new Map<string, number>();
      const kept: AiHistoryEntry[] = [];
      for (const e of updated) {
        const count = (counts.get(e.fieldType) ?? 0) + 1;
        if (count <= MAX_HISTORY_PER_FIELD) {
          kept.push(e);
          counts.set(e.fieldType, count);
        }
      }
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
