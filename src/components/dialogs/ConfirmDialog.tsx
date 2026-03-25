import { useEffect } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  severity?: 'warning' | 'destructive' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  severity = 'warning',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
    warning: {
      border: 'border-l-warning',
      icon: 'text-warning',
      bg: 'bg-warning-subtle',
    },
    destructive: {
      border: 'border-l-destructive',
      icon: 'text-destructive',
      bg: 'bg-destructive-subtle',
    },
    info: {
      border: 'border-l-accent',
      icon: 'text-accent',
      bg: 'bg-accent-subtle',
    },
  };

  const style = severityStyles[severity];

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div 
        className={`dialog-content border-l-4 ${style.border}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${style.bg}`}>
              {severity === 'destructive' ? (
                <AlertTriangle size={20} className={style.icon} />
              ) : (
                <Info size={20} className={style.icon} />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-serif text-lg text-text-primary mb-2">{title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-bg-elevated border-t border-border flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="btn-refined btn-refined-secondary"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={severity === 'destructive' || severity === 'warning' ? 'btn-refined bg-destructive text-text-on-accent hover:bg-destructive/90' : 'btn-refined btn-refined-primary'}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
