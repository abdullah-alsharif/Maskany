import { useId, useState } from 'react';

type StarRatingProps = {
  /** Current rating value (0-5, supports half values) */
  value: number;
  /** Interactive mode — fires onChange when user selects a rating */
  onChange?: (value: number) => void;
  /** Number of reviews (displayed next to stars in display mode) */
  reviewCount?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show numeric value alongside stars */
  showValue?: boolean;
};

const sizeConfig = {
  sm: { starSize: 14, gap: 1, textClass: 'text-xs' },
  md: { starSize: 18, gap: 1.5, textClass: 'text-sm' },
  lg: { starSize: 24, gap: 2, textClass: 'text-base' },
};

const FILLED_COLOR = '#f5b731'; // amber-400, per design system
const EMPTY_COLOR = '#e8e4dd';
const STROKE_EMPTY = '#d5cfc4';

type Fill = 'full' | 'half' | 'empty';

function StarIcon({ fill, size, gradientId }: { fill: Fill; size: number; gradientId: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-fill={fill}
      className="transition-transform duration-150"
    >
      {fill === 'half' && (
        <defs>
          <linearGradient id={gradientId}>
            <stop offset="50%" stopColor={FILLED_COLOR} />
            <stop offset="50%" stopColor={EMPTY_COLOR} />
          </linearGradient>
        </defs>
      )}
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={
          fill === 'full' ? FILLED_COLOR : fill === 'half' ? `url(#${gradientId})` : EMPTY_COLOR
        }
        stroke={fill === 'empty' ? STROKE_EMPTY : FILLED_COLOR}
        strokeWidth="0.5"
      />
    </svg>
  );
}

function getFill(displayValue: number, starIndex: number): Fill {
  if (displayValue >= starIndex) return 'full';
  if (displayValue >= starIndex - 0.5) return 'half';
  return 'empty';
}

function starLabel(n: number): string {
  return `${n} star${n === 1 ? '' : 's'}`;
}

export function StarRating({
  value,
  onChange,
  reviewCount,
  size = 'md',
  showValue = true,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const interactive = !!onChange;
  const displayValue = hoverValue ?? value;
  const { starSize, gap, textClass } = sizeConfig[size];
  const baseGradientId = useId();

  const handleStarSelect = (starIndex: number, isLeftHalf: boolean) => {
    if (!onChange) return;
    onChange(isLeftHalf ? starIndex - 0.5 : starIndex);
  };

  return (
    <div className="inline-flex flex-col gap-1">
      <div
        className="flex items-center"
        style={{ gap: `${gap * 4}px` }}
        role={interactive ? 'radiogroup' : 'img'}
        aria-label={interactive ? 'Rate this property' : `${value} out of 5 stars`}
      >
        <div
          className="flex"
          style={{ gap: `${gap}px` }}
          onMouseLeave={() => interactive && setHoverValue(null)}
        >
          {[1, 2, 3, 4, 5].map((starIndex) => (
            <span
              key={starIndex}
              className="relative inline-block"
              style={{ width: starSize, height: starSize }}
            >
              <StarIcon
                fill={getFill(displayValue, starIndex)}
                size={starSize}
                gradientId={`${baseGradientId}-${starIndex}`}
              />
              {interactive && (
                <>
                  <button
                    type="button"
                    className="absolute inset-y-0 left-0 w-1/2 cursor-pointer transition-transform duration-150 hover:scale-110 active:scale-95"
                    onMouseEnter={() => setHoverValue(starIndex - 0.5)}
                    onFocus={() => setHoverValue(starIndex - 0.5)}
                    onBlur={() => setHoverValue(null)}
                    onClick={() => handleStarSelect(starIndex, true)}
                    aria-label={`Rate ${starIndex - 0.5} stars`}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 w-1/2 cursor-pointer transition-transform duration-150 hover:scale-110 active:scale-95"
                    onMouseEnter={() => setHoverValue(starIndex)}
                    onFocus={() => setHoverValue(starIndex)}
                    onBlur={() => setHoverValue(null)}
                    onClick={() => handleStarSelect(starIndex, false)}
                    aria-label={`Rate ${starLabel(starIndex)}`}
                  />
                </>
              )}
            </span>
          ))}
        </div>

        {showValue && value > 0 && !interactive && (
          <span className={`${textClass} font-semibold text-stone-700`}>{value.toFixed(1)}</span>
        )}

        {reviewCount !== undefined && reviewCount > 0 && !interactive && (
          <span className={`${textClass} text-stone-400`}>
            ({reviewCount} review{reviewCount === 1 ? '' : 's'})
          </span>
        )}
      </div>

      {interactive && value > 0 && (
        <span className={`${textClass} text-stone-600`} aria-live="polite">
          Selected: {value} out of 5
        </span>
      )}
    </div>
  );
}
