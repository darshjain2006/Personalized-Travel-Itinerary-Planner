import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'outline';
type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'default',
  size = 'sm',
  dot = false,
  ...props
}) => {
  const variants: Record<BadgeVariant, string> = {
    default: 'bg-slate-800 text-slate-300 border border-slate-700/60',
    primary: 'bg-brand-500/15 text-brand-300 border border-brand-500/25',
    success: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25',
    warning: 'bg-amber-500/15 text-amber-300 border border-amber-500/25',
    danger: 'bg-rose-500/15 text-rose-300 border border-rose-500/25',
    info: 'bg-sky-500/15 text-sky-300 border border-sky-500/25',
    purple: 'bg-violet-500/15 text-violet-300 border border-violet-500/25',
    outline: 'bg-transparent text-slate-300 border border-slate-600',
  };

  const dotColors: Record<BadgeVariant, string> = {
    default: 'bg-slate-400',
    primary: 'bg-brand-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
    info: 'bg-sky-400',
    purple: 'bg-violet-400',
    outline: 'bg-slate-400',
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center rounded-full font-semibold tracking-wide',
          variants[variant],
          sizes[size],
          className
        )
      )}
      {...props}
    >
      {dot && (
        <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColors[variant])} />
      )}
      {children}
    </span>
  );
};
