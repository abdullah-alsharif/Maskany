'use client';

import { useTranslation } from 'react-i18next';

type AiQualityScoreProps = {
  score: number;
};

function scoreColor(score: number): string {
  if (score < 40) return 'text-red-600';
  if (score < 70) return 'text-amber-600';
  return 'text-green-600';
}

function scoreBgColor(score: number): string {
  if (score < 40) return 'bg-red-50 border-red-200';
  if (score < 70) return 'bg-amber-50 border-amber-200';
  return 'bg-green-50 border-green-200';
}

export function AiQualityScore({ score }: AiQualityScoreProps) {
  const { t } = useTranslation();
  const color = scoreColor(score);
  const bg = scoreBgColor(score);

  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <div className="flex items-center gap-3">
        <div className={`text-3xl font-bold ${color}`}>{score}</div>
        <div className="flex-1">
          <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                score < 40 ? 'bg-red-500' : score < 70 ? 'bg-amber-500' : 'bg-green-500'
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-stone-500">{t('ai.qualityLabel', { score })}</p>
    </div>
  );
}
