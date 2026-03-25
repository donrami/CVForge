import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface AlertDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  severity?: 'warning' | 'error' | 'info';
  onConfirm: () => void;
}

export function AlertDialog({
  open,
  title,
  message,
  confirmText = 'OK',
  severity = 'info',
  onConfirm,
}: AlertDialogProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const severityStyles = {
    warning: 'border-l-warning',
    error: 'border-l-destructive',
    info: 'border-l-accent',
  };

  return (
    <div className="dialog-backdrop" onClick={onConfirm}>
      <div 
        className={`dialog-content border-l-4 ${severityStyles[severity]}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              severity === 'warning' ? 'bg-warning-subtle' :
              severity === 'error' ? 'bg-destructive-subtle' :
              'bg-accent-subtle'
            }`}>
              <AlertCircle size={20} className={
                severity === 'warning' ? 'text-warning' :
                severity === 'error' ? 'text-destructive' :
                'text-accent'
              } />
            </div>
            <div className="flex-1">
              <h3 className="font-serif text-lg text-text-primary mb-2">{title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-bg-elevated border-t border-border flex justify-end">
          <button
            onClick={onConfirm}
            className="btn-primary"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
