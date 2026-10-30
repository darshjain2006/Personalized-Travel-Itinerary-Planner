import { useState, useCallback } from 'react';
import type { ToastData, ToastVariant } from '../components/ui/Toast';

let toastCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({
      title,
      description,
      variant = 'info',
      duration = 4000,
    }: {
      title: string;
      description?: string;
      variant?: ToastVariant;
      duration?: number;
    }) => {
      const id = `toast-${++toastCounter}`;
      setToasts((prev) => [...prev, { id, title, description, variant, duration }]);
      return id;
    },
    []
  );

  const success = useCallback(
    (title: string, description?: string) => toast({ title, description, variant: 'success' }),
    [toast]
  );
  const error = useCallback(
    (title: string, description?: string) => toast({ title, description, variant: 'error', duration: 6000 }),
    [toast]
  );
  const info = useCallback(
    (title: string, description?: string) => toast({ title, description, variant: 'info' }),
    [toast]
  );
  const warning = useCallback(
    (title: string, description?: string) => toast({ title, description, variant: 'warning' }),
    [toast]
  );

  return { toasts, toast, dismiss, success, error, info, warning };
}
