import React, { useEffect, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastItemProps extends ToastData {
  onDismiss: (id: string) => void;
}

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 size={18} className="text-emerald-400" />,
  error: <AlertCircle size={18} className="text-rose-400" />,
  info: <Info size={18} className="text-sky-400" />,
  warning: <AlertTriangle size={18} className="text-amber-400" />,
};

const borderColors: Record<ToastVariant, string> = {
  success: 'border-l-emerald-500',
  error: 'border-l-rose-500',
  info: 'border-l-sky-500',
  warning: 'border-l-amber-500',
};

const ToastItem: React.FC<ToastItemProps> = ({
  id,
  title,
  description,
  variant = 'info',
  duration = 4000,
  onDismiss,
}) => {
  const dismiss = useCallback(() => onDismiss(id), [id, onDismiss]);

  useEffect(() => {
    if (duration === Infinity) return;
    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
  }, [dismiss, duration]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={clsx(
        'flex items-start gap-3 w-80 rounded-xl bg-slate-900 border border-slate-700/60 border-l-2 p-4 shadow-2xl shadow-black/40 animate-in slide-in-from-right-full duration-300',
        borderColors[variant]
      )}
    >
      <div className="flex-shrink-0 mt-0.5">{icons[variant]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-100 leading-tight">{title}</p>
        {description && (
          <p className="mt-0.5 text-xs text-slate-400 leading-snug">{description}</p>
        )}
      </div>
      <button
        onClick={dismiss}
        className="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
        aria-label="Dismiss"
      >
        <X size={15} />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
