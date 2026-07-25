'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AiQualityScore } from './ai-quality-score';
import { useAiReview } from '../../hooks/use-ai-review';
import type { ReviewPropertyData, ReviewIssue, FixOption } from '../../services/ai-service';

type AiReviewPanelProps = {
  open: boolean;
  onClose: () => void;
  propertyData: ReviewPropertyData;
  locale: string;
  onApplySuggestion: (field: string, value: string) => void;
};

const CATEGORY_ORDER = ['consistency', 'content_quality', 'trust_accuracy'] as const;
const SEVERITY_ORDER = ['critical', 'major', 'minor', 'suggestion'] as const;
const STRUCTURED_FIELDS = new Set(['propertyType', 'rooms', 'bathrooms', 'city', 'area', 'price']);
const NUMERIC_FIELDS = new Set(['rooms', 'bathrooms']);

const DIGIT_TO_WORD: Record<string, string> = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
  '10': 'ten',
};

function applyFindReplace(value: unknown, findText: string, replaceWith: string): string | null {
  if (typeof value !== 'string') return null;

  if (value.includes(findText)) return value.replace(findText, replaceWith);

  for (const [digit, word] of Object.entries(DIGIT_TO_WORD)) {
    if (findText.includes(digit)) {
      const wordVariant = findText.replace(digit, word);
      if (value.includes(wordVariant)) return value.replace(wordVariant, replaceWith);
    }
  }

  const findNum = findText.match(/\d+/)?.[0];
  const replaceNum = replaceWith.match(/\d+/)?.[0];
  if (findNum && replaceNum) {
    const digitRegex = new RegExp(`\\b${findNum}\\b`);
    if (digitRegex.test(value)) return value.replace(digitRegex, replaceNum);

    const wordForm = DIGIT_TO_WORD[findNum];
    if (wordForm) {
      const wordRegex = new RegExp(`\\b${wordForm}\\b`, 'i');
      if (wordRegex.test(value)) return value.replace(wordRegex, replaceNum);
    }
  }

  return null;
}

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'major':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'minor':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'suggestion':
      return 'bg-stone-100 text-stone-600 border-stone-200';
    default:
      return 'bg-stone-100 text-stone-600 border-stone-200';
  }
}

export function AiReviewPanel({
  open,
  onClose,
  propertyData,
  locale,
  onApplySuggestion,
}: AiReviewPanelProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fixed, setFixed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [alternative, setAlternative] = useState<Record<string, FixOption | null>>({});
  const [animatingId, setAnimatingId] = useState<string | null>(null);

  const [snapshot, setSnapshot] = useState<ReviewPropertyData | null>(null);
  useEffect(() => {
    if (open && !snapshot) {
      setSnapshot(propertyData);
    }
    if (!open) {
      setSnapshot(null);
    }
  }, [open, propertyData, snapshot]);

  const { data, isLoading, error, refetch } = useAiReview(open ? snapshot : null, locale);

  const displayScore = data?.qualityScore ?? null;

  const allIssues = useMemo(() => {
    if (!data) return [];
    return data.issues;
  }, [data]);

  const groupedIssues = useMemo(() => {
    const groups: Record<string, ReviewIssue[]> = {};
    for (const cat of CATEGORY_ORDER) {
      const items = allIssues.filter((i) => i.category === cat);
      if (items.length > 0) {
        groups[cat] = items.sort(
          (a, b) => SEVERITY_ORDER.indexOf(b.severity) - SEVERITY_ORDER.indexOf(a.severity),
        );
      }
    }
    return groups;
  }, [allIssues]);

  const fixedCount = useMemo(() => {
    if (!data) return 0;
    return data.issues.filter((i) => fixed.has(i.id)).length;
  }, [data, fixed]);

  const selectedCount = selected.size;

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const markFixed = useCallback((id: string) => {
    setAnimatingId(id);
    setTimeout(() => {
      setFixed((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setAnimatingId(null);
    }, 400);
  }, []);

  const resolveFixes = useCallback(
    (issue: ReviewIssue, override?: FixOption | null): Array<{ field: string; value: string }> => {
      const opt = override ?? issue;
      if (!opt.field) return [];

      const applyOne = (fix: {
        field: string;
        findText?: string;
        replaceWith?: string;
        suggestion?: string;
      }) => {
        if (!fix.field) return [] as Array<{ field: string; value: string }>;
        const ft = fix.findText;
        const rw = fix.replaceWith;
        const sug = fix.suggestion;
        if (ft && rw) {
          const replaced = applyFindReplace(
            propertyData[fix.field as keyof ReviewPropertyData],
            ft,
            rw,
          );
          if (replaced !== null) return [{ field: fix.field, value: replaced }];
        }
        if (sug) {
          return [{ field: fix.field, value: sug }];
        }
        return [] as Array<{ field: string; value: string }>;
      };

      const results: Array<{ field: string; value: string }> = [];

      if (opt.fixes && opt.fixes.length > 0) {
        for (const f of opt.fixes) results.push(...applyOne(f));
      }

      const ft = opt.findText;
      const rw = opt.replaceWith;

      const textFix = (find: string, repl: string) => {
        const fixed: Array<{ field: string; value: string }> = [];
        for (const f of ['title', 'summary', 'description', 'amenities'] as const) {
          if (results.some((r) => r.field === f)) continue;
          const val = propertyData[f];
          const replaced = applyFindReplace(val, find, repl);
          if (replaced !== null) fixed.push({ field: f, value: replaced });
        }
        return fixed;
      };

      const issueField = issue.field;
      if (issueField && NUMERIC_FIELDS.has(issueField)) {
        if (ft && rw) {
          results.push(...textFix(ft, rw));
        }
        if (results.length > 0) return results;
        if (!opt.suggestion || isNaN(Number(opt.suggestion))) return [];
        return [{ field: opt.field, value: opt.suggestion }];
      }

      if (STRUCTURED_FIELDS.has(opt.field)) {
        if (results.length > 0) return results;
        if (!opt.suggestion) return [];
        return [{ field: opt.field, value: opt.suggestion }];
      }

      if (results.length === 0) {
        if (ft && rw) {
          const replaced = applyFindReplace(
            propertyData[opt.field as keyof ReviewPropertyData],
            ft,
            rw,
          );
          if (replaced !== null) return [{ field: opt.field, value: replaced }];
        }
        if (opt.suggestion) {
          return [{ field: opt.field, value: opt.suggestion }];
        }
      }

      return results;
    },
    [propertyData],
  );

  const handleApply = useCallback(
    (issue: ReviewIssue) => {
      const alt = alternative[issue.id] ?? null;
      const fixes = resolveFixes(issue, alt);
      if (fixes.length > 0) {
        for (const fix of fixes) onApplySuggestion(fix.field, fix.value);
        markFixed(issue.id);
      }
    },
    [alternative, resolveFixes, onApplySuggestion, markFixed],
  );

  const handleApplyAll = useCallback(() => {
    for (const id of selected) {
      const issue = data?.issues.find((i) => i.id === id);
      if (issue) {
        const alt = alternative[id] ?? null;
        const fixes = resolveFixes(issue, alt);
        for (const fix of fixes) onApplySuggestion(fix.field, fix.value);
      }
    }
    setFixed((prev) => {
      const next = new Set(prev);
      for (const id of selected) next.add(id);
      return next;
    });
    setSelected(new Set());
  }, [selected, data, alternative, resolveFixes, onApplySuggestion]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col max-h-screen">
        <div className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between shrink-0">
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

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 pb-28 space-y-4">
            {isLoading && (
              <div className="space-y-3">
                <div className="h-24 rounded-xl bg-stone-100 animate-pulse" />
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-stone-100 animate-pulse" />
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
                <AiQualityScore score={displayScore!} />

                {fixedCount > 0 && (
                  <p className="text-xs text-green-600 font-medium">
                    {t('ai.fixedCount', { count: fixedCount })}
                  </p>
                )}

                {data.issues.length === 0 && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-2xl text-green-600">✓</span>
                    </div>
                    <p className="text-sm font-medium text-stone-700">{t('ai.noIssuesFound')}</p>
                  </div>
                )}

                {data.issues.length > 0 && (
                  <div className="space-y-4">
                    {CATEGORY_ORDER.map((category) => {
                      const issues = groupedIssues[category];
                      if (!issues || issues.length === 0) return null;

                      return (
                        <div key={category}>
                          <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 px-1">
                            {t(`ai.category.${category}`)}
                          </h3>
                          <div className="space-y-1.5">
                            {issues.map((issue) => {
                              const isAnimating = animatingId === issue.id;
                              const isExpanded = expanded === issue.id;
                              const isSelected = selected.has(issue.id);
                              const isFixed = fixed.has(issue.id);

                              return (
                                <div
                                  key={issue.id}
                                  className={`rounded-xl border overflow-hidden transition-all duration-300 ${
                                    isFixed
                                      ? 'border-green-200 bg-green-50/40 opacity-70'
                                      : isSelected
                                        ? 'border-terracotta-300 bg-terracotta-50/30'
                                        : 'border-stone-200 bg-white'
                                  } ${isAnimating ? 'scale-[0.98] opacity-50' : ''}`}
                                >
                                  <div className="flex items-start">
                                    <label className="flex items-center justify-center min-w-[44px] min-h-[48px] cursor-pointer shrink-0">
                                      {isFixed ? (
                                        <span className="w-4 h-4 flex items-center justify-center text-green-600 text-sm font-bold">
                                          ✓
                                        </span>
                                      ) : (
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => toggleSelected(issue.id)}
                                          className="w-4 h-4 rounded border-stone-300 text-terracotta-600 focus:ring-terracotta-500"
                                          aria-label={issue.title}
                                        />
                                      )}
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => setExpanded(isExpanded ? null : issue.id)}
                                      className="flex-1 flex items-start gap-3 py-3 pe-4 min-h-[48px] text-start"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p
                                          className={`text-sm font-medium ${isFixed ? 'text-stone-400 line-through' : 'text-stone-700'}`}
                                        >
                                          {issue.title}
                                        </p>
                                        {isFixed ? (
                                          <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 bg-green-100 text-green-700 border border-green-200">
                                            {t('ai.applied')}
                                          </span>
                                        ) : (
                                          <span
                                            className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full border mt-1 ${severityBadgeClass(issue.severity)}`}
                                          >
                                            {t(`ai.severity.${issue.severity}`)}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  </div>

                                  {isExpanded && (
                                    <div className="px-4 pb-3 pt-0 space-y-2 animate-fade-in">
                                      <div className="h-px bg-stone-200" />
                                      <p className="text-xs text-stone-500 leading-relaxed">
                                        {issue.description}
                                      </p>
                                      {issue.evidence && (
                                        <div className="bg-stone-50 rounded-lg p-2.5 border border-stone-100">
                                          <p className="text-[11px] text-stone-400 font-medium mb-1">
                                            {t('ai.evidence')}
                                          </p>
                                          <p className="text-xs text-stone-600 italic leading-relaxed">
                                            {'\u201C'}
                                            {issue.evidence}
                                            {'\u201D'}
                                          </p>
                                        </div>
                                      )}
                                      {!isFixed &&
                                        issue.alternatives &&
                                        issue.alternatives.length > 0 && (
                                          <div className="space-y-1">
                                            <p className="text-[11px] text-stone-400 font-medium">
                                              {t('ai.fixOptions')}
                                            </p>
                                            <div className="space-y-1">
                                              <label
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                                  !alternative[issue.id]
                                                    ? 'border-terracotta-300 bg-terracotta-50/50'
                                                    : 'border-stone-200 hover:border-stone-300'
                                                }`}
                                              >
                                                <input
                                                  type="radio"
                                                  name={`fix-${issue.id}`}
                                                  checked={!alternative[issue.id]}
                                                  onChange={() =>
                                                    setAlternative((prev) => {
                                                      const next = { ...prev };
                                                      delete next[issue.id];
                                                      return next;
                                                    })
                                                  }
                                                  className="w-3.5 h-3.5 text-terracotta-600"
                                                />
                                                <span className="text-xs text-stone-700">
                                                  {issue.field &&
                                                  (issue.findText || issue.suggestion)
                                                    ? `${issue.field}: ${issue.findText ?? ''} → ${issue.replaceWith ?? issue.suggestion ?? ''}`
                                                    : t('ai.fixDefault')}
                                                </span>
                                              </label>
                                              {issue.alternatives.map((alt, idx) => (
                                                <label
                                                  key={idx}
                                                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                                    alternative[issue.id] === alt
                                                      ? 'border-terracotta-300 bg-terracotta-50/50'
                                                      : 'border-stone-200 hover:border-stone-300'
                                                  }`}
                                                >
                                                  <input
                                                    type="radio"
                                                    name={`fix-${issue.id}`}
                                                    checked={alternative[issue.id] === alt}
                                                    onChange={() =>
                                                      setAlternative((prev) => ({
                                                        ...prev,
                                                        [issue.id]: alt,
                                                      }))
                                                    }
                                                    className="w-3.5 h-3.5 text-terracotta-600"
                                                  />
                                                  <span className="text-xs text-stone-700">
                                                    {alt.label}
                                                  </span>
                                                </label>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      {isFixed ? (
                                        <div className="flex items-center gap-2 py-1">
                                          <span className="text-xs text-green-600 font-medium">
                                            {t('ai.fixApplied')}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="flex gap-2">
                                          {(issue.suggestion ||
                                            issue.findText ||
                                            (issue.alternatives &&
                                              issue.alternatives.length > 0)) &&
                                            issue.field && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleApply(issue);
                                                }}
                                                className="flex-1 h-9 rounded-lg bg-terracotta-600 text-white text-xs font-medium hover:bg-terracotta-700 transition-colors"
                                              >
                                                {t('ai.apply')}
                                              </button>
                                            )}
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelected((prev) => {
                                                const next = new Set(prev);
                                                next.delete(issue.id);
                                                return next;
                                              });
                                              markFixed(issue.id);
                                            }}
                                            className={`${
                                              (issue.suggestion ||
                                                issue.findText ||
                                                (issue.alternatives &&
                                                  issue.alternatives.length > 0)) &&
                                              issue.field
                                                ? 'flex-1'
                                                : 'w-full'
                                            } h-9 rounded-lg border border-stone-200 text-stone-600 text-xs font-medium hover:bg-stone-50 transition-colors`}
                                          >
                                            {t('ai.skip')}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
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

        {selectedCount > 0 && (
          <div className="absolute bottom-15 left-3 right-3 bg-white rounded-xl border border-stone-200 px-4 py-3 shadow-lg flex items-center justify-between">
            <p className="text-sm font-semibold text-stone-800">
              {t('ai.fixSelected', { count: selectedCount })}
            </p>
            <button
              type="button"
              onClick={handleApplyAll}
              className="h-9 px-4 rounded-lg bg-terracotta-600 text-white text-xs font-semibold hover:bg-terracotta-700 transition-colors"
            >
              {t('ai.applyAll')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
