import { useEffect, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import type { DialogSeverity } from '../../context/DialogContext';

export interface Toast {
  id: number;
  message: string;
  severity: DialogSeverity;
  duration: number;
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: number) => void;
}

const severityConfig = {
  info: {
    icon: Info,
    borderColor: 'border-accent',
    iconColor: 'text-accent',
  },
  success: {
    icon: CheckCircle,
    borderColor: 'border-status-offer',
    iconColor: 'text-status-offer',
  },
  warning: {
    icon: AlertTriangle,
    borderColor: 'border-status-interview',
    iconColor: 'text-status-interview',
  },
  error: {
    icon: AlertCircle,
    borderColor: 'border-destructive',
    iconColor: 'text-destructive',
  },
};

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: number) => void;
}) {
  const config = severityConfig[toast.severity];
  const Icon = config.icon;
  const isPersistent = toast.duration <= 0;

  const handleRemove = useCallback(() => {
    onRemove(toast.id);
  }, [onRemove, toast.id]);

  useEffect(() => {
    if (isPersistent) return;

    const timeoutId = setTimeout(() => {
      handleRemove();
    }, toast.duration);

    return () => clearTimeout(timeoutId);
  }, [isPersistent, toast.duration, handleRemove]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 bg-bg-surface border-l-2 ${config.borderColor} shadow-lg animate-in slide-in-from-right-full duration-300 ${isPersistent ? 'min-w-[300px]' : ''}`}
      role="alert"
    >
      <Icon className={`w-5 h-5 ${config.iconColor} shrink-0`} />
      <p className="flex-1 text-sm text-text-primary">{toast.message}</p>
      <button
        onClick={handleRemove}
        className="shrink-0 text-text-muted hover:text-text-secondary transition-colors"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}
