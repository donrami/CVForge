import { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import type { DialogSeverity } from '../../context/DialogContext';

interface AlertDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  severity?: DialogSeverity;
  actionText?: string;
  onAction?: () => void;
  onClose: () => void;
}

const severityConfig = {
  info: {
    icon: Info,
    iconColor: 'text-accent',
    bgColor: 'bg-accent/10',
  },
  success: {
    icon: CheckCircle,
    iconColor: 'text-status-offer',
    bgColor: 'bg-status-offer/10',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-status-interview',
    bgColor: 'bg-status-interview/10',
  },
  error: {
    icon: AlertCircle,
    iconColor: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
};

export function AlertDialog({
  isOpen,
  title,
  message,
  severity = 'info',
  actionText,
  onAction,
  onClose,
}: AlertDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const config = severityConfig[severity];
  const Icon = config.icon;

  // Focus management and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    // Focus close button after dialog opens
    const timeoutId = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Handle click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  const handleAction = () => {
    onAction?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <div className="bg-bg-surface border border-border shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`shrink-0 w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${config.iconColor}`} />
            </div>
            <div className="flex-1">
              <h3
                id="alert-dialog-title"
                className="text-lg font-medium text-text-primary mb-2"
              >
                {title}
              </h3>
              <p
                id="alert-dialog-description"
                className="text-sm text-text-secondary leading-relaxed"
              >
                {message}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-bg-elevated/50 border-t border-border flex justify-end gap-3">
          {actionText && onAction && (
            <button
              onClick={handleAction}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              {actionText}
            </button>
          )}
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-text-on-accent transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
