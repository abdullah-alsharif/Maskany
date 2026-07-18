'use client';

type AiQualityScoreProps = {
  score: number;
  maxScore: number;
  benchmark?: string;
};

function scoreColor(score: number, maxScore: number): string {
  const ratio = score / maxScore;
  if (ratio < 0.4) return 'text-red-600';
  if (ratio < 0.7) return 'text-amber-600';
  return 'text-green-600';
}

function scoreBgColor(score: number, maxScore: number): string {
  const ratio = score / maxScore;
  if (ratio < 0.4) return 'bg-red-50 border-red-200';
  if (ratio < 0.7) return 'bg-amber-50 border-amber-200';
  return 'bg-green-50 border-green-200';
}

export function AiQualityScore({ score, maxScore, benchmark }: AiQualityScoreProps) {
  const color = scoreColor(score, maxScore);
  const bg = scoreBgColor(score, maxScore);

  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <div className="flex items-center gap-3">
        <div className={`text-3xl font-bold ${color}`}>
          {score.toFixed(1)}
          <span className="text-base font-normal text-stone-400">/{maxScore}</span>
        </div>
        <div className="flex-1">
          <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${color === 'text-red-600' ? 'bg-red-500' : color === 'text-amber-600' ? 'bg-amber-500' : 'bg-green-500'}`}
              style={{ width: `${(score / maxScore) * 100}%` }}
            />
          </div>
        </div>
      </div>
      {benchmark && <p className="mt-2 text-xs text-stone-500">{benchmark}</p>}
    </div>
  );
}
