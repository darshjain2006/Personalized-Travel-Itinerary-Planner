import React from 'react';
import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'line' | 'circle' | 'rect';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'rect',
}) => {
  const base = 'animate-pulse bg-slate-800/70 relative overflow-hidden';
  const variants = {
    line: 'h-4 rounded-full w-full',
    circle: 'rounded-full',
    rect: 'rounded-xl',
  };

  return (
    <div className={clsx(base, variants[variant], className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-slate-700/40 to-transparent" />
    </div>
  );
};

export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={clsx('rounded-2xl bg-slate-900/50 border border-slate-800/60 p-5 space-y-4', className)}>
    <div className="flex items-start justify-between">
      <div className="space-y-2 flex-1">
        <Skeleton variant="line" className="h-5 w-3/4" />
        <Skeleton variant="line" className="h-3.5 w-1/2" />
      </div>
      <Skeleton variant="rect" className="h-8 w-16 ml-4" />
    </div>
    <div className="space-y-2 pt-1">
      <Skeleton variant="line" className="h-3.5 w-full" />
      <Skeleton variant="line" className="h-3.5 w-4/5" />
    </div>
    <div className="flex gap-2 pt-1">
      <Skeleton variant="rect" className="h-6 w-16 rounded-full" />
      <Skeleton variant="rect" className="h-6 w-20 rounded-full" />
    </div>
  </div>
);

export const SkeletonTripList: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);
