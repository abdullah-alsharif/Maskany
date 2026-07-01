import { type ComponentProps } from 'react';

type SkeletonProps = ComponentProps<'div'> & {
  /** Render as a circle (avatar, icon placeholder) */
  circle?: boolean;
};

export function Skeleton({ className = '', circle, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`
        animate-skeleton bg-sand-100
        ${circle ? 'rounded-full aspect-square' : 'rounded-lg'}
        ${className}
      `}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-[var(--shadow-card)]">
      {/* Image placeholder */}
      <Skeleton className="w-full aspect-[4/3]" />
      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16 rounded-full" />
          <Skeleton className="h-3 w-12 rounded-full" />
        </div>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3.5 w-1/2" />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonDetailPage() {
  return (
    <div className="animate-fade-in">
      <Skeleton className="w-full aspect-[16/10] rounded-none" />
      <div className="p-5 space-y-4">
        <Skeleton className="h-4 w-20 rounded-full" />
        <Skeleton className="h-7 w-4/5" />
        <Skeleton className="h-4 w-2/5" />
        <div className="flex gap-6 pt-2">
          <Skeleton className="h-10 w-20 rounded-xl" />
          <Skeleton className="h-10 w-20 rounded-xl" />
          <Skeleton className="h-10 w-20 rounded-xl" />
        </div>
        <div className="space-y-2 pt-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}
