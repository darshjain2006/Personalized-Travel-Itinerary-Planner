import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'elevated' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = 'glass',
  padding = 'md',
  hoverable = false,
  ...props
}) => {
  const variants = {
    default: 'bg-slate-900/60 border border-slate-800/60',
    glass:
      'bg-slate-900/50 backdrop-blur-md border border-slate-700/40 shadow-xl shadow-black/20',
    elevated: 'bg-slate-900 border border-slate-800 shadow-2xl shadow-black/40',
    bordered: 'bg-transparent border border-slate-700/60',
  };

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-7',
  };

  return (
    <div
      className={twMerge(
        clsx(
          'rounded-2xl transition-all duration-200',
          variants[variant],
          paddings[padding],
          hoverable && 'hover:border-slate-600/60 hover:shadow-brand-500/5 cursor-pointer',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div className={twMerge('flex items-center justify-between mb-4', className)} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className,
  ...props
}) => (
  <h3 className={twMerge('text-base font-semibold text-slate-100', className)} {...props}>
    {children}
  </h3>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div className={twMerge('', className)} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div
    className={twMerge(
      'flex items-center justify-between pt-4 mt-4 border-t border-slate-800/60',
      className
    )}
    {...props}
  >
    {children}
  </div>
);
