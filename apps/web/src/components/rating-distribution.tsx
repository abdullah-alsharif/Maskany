import { Star } from 'lucide-react';

type RatingDistributionProps = {
  /** Count of reviews per star tier (keys: 1-5) */
  distribution: Record<number, number>;
  /** Total review count used to compute bar fill percentages */
  total: number;
};

const TIERS = [5, 4, 3, 2, 1] as const;

export function RatingDistribution({ distribution, total }: RatingDistributionProps) {
  return (
    <div className="space-y-1.5" role="group" aria-label="Rating distribution">
      {TIERS.map((stars) => {
        const count = distribution[stars] ?? 0;
        const percentage = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={stars} className="flex items-center gap-2.5">
            <span
              data-testid="distribution-label"
              className="text-xs text-stone-500 w-3 text-right font-medium"
            >
              {stars}
            </span>
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
            <div
              className="flex-1 h-1.5 bg-stone-200/50 rounded-full overflow-hidden"
              role="presentation"
            >
              <div
                data-testid="distribution-fill"
                className="h-full bg-amber-400 rounded-full transition-all duration-700 ease-[var(--ease-out-expo)]"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span
              data-testid="distribution-count"
              className="text-xs text-stone-400 w-7 text-right tabular-nums"
            >
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
