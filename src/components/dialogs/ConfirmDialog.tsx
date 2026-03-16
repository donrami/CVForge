import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  severity?: 'destructive' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  severity = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus management and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    // Focus confirm button after dialog opens
    const timeoutId = setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onCancel]);

  // Handle click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === dialogRef.current) {
      onCancel();
    }
  };

  if (!isOpen) return null;

  const isDestructive = severity === 'destructive';

  return (
    <div
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <div className="bg-bg-surface border border-border rounded-sm shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            {isDestructive && (
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
            )}
            <div className="flex-1">
              <h3
                id="confirm-dialog-title"
                className="text-lg font-medium text-text-primary mb-2"
              >
                {title}
              </h3>
              <p
                id="confirm-dialog-description"
                className="text-sm text-text-secondary leading-relaxed"
              >
                {message}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-bg-elevated/50 border-t border-border flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            {cancelText}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-sm transition-colors ${
              isDestructive
                ? 'bg-transparent border border-destructive text-destructive hover:bg-destructive/10'
                : 'bg-accent hover:bg-accent-hover text-bg-base'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
