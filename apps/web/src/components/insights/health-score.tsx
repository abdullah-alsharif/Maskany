'use client';

const SCORE_COLOR: Record<string, string> = {
  high: 'var(--color-success)',
  mid: 'var(--color-amber-500)',
  low: 'var(--color-error)',
};

function scoreColor(score: number): string {
  if (score >= 80) return SCORE_COLOR.high;
  if (score >= 50) return SCORE_COLOR.mid;
  return SCORE_COLOR.low;
}

export function HealthBadge({ score }: { score: number }) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className="relative w-8 h-8 shrink-0">
      <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
        <circle
          cx="16"
          cy="16"
          r={radius}
          fill="none"
          stroke="var(--color-stone-200)"
          strokeWidth="3"
        />
        <circle
          cx="16"
          cy="16"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-stone-700">
        {score}
      </span>
    </div>
  );
}
