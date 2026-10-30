import React from 'react';
import { clsx } from 'clsx';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
  size = 'md',
}) => {
  const sizes = {
    sm: { container: 'py-10', iconBox: 'w-12 h-12 text-xl', title: 'text-sm', desc: 'text-xs' },
    md: { container: 'py-16', iconBox: 'w-16 h-16 text-2xl', title: 'text-base', desc: 'text-sm' },
    lg: { container: 'py-24', iconBox: 'w-20 h-20 text-3xl', title: 'text-lg', desc: 'text-sm' },
  };

  const s = sizes[size];

  return (
    <div className={clsx('flex flex-col items-center justify-center text-center', s.container, className)}>
      {icon && (
        <div
          className={clsx(
            'flex items-center justify-center rounded-2xl mb-5 bg-slate-800/60 border border-slate-700/40 text-slate-400',
            s.iconBox
          )}
        >
          {icon}
        </div>
      )}
      <h3 className={clsx('font-semibold text-slate-200', s.title)}>{title}</h3>
      {description && (
        <p className={clsx('mt-2 text-slate-400 max-w-xs leading-relaxed', s.desc)}>
          {description}
        </p>
      )}
      {action && (
        <div className="mt-6">
          <Button onClick={action.onClick} size="sm" leftIcon={action.icon}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
};
