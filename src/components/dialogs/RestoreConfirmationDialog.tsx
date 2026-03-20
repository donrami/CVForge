import { useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

interface RestoreConfirmationDialogProps {
  open: boolean;
  applicationCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RestoreConfirmationDialog({
  open,
  applicationCount,
  onConfirm,
  onCancel,
}: RestoreConfirmationDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

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
  }, [open, onCancel]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === dialogRef.current) {
      onCancel();
    }
  };

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="restore-dialog-title"
      aria-describedby="restore-dialog-description"
    >
      <div className="bg-bg-surface border border-border shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <h3
                id="restore-dialog-title"
                className="text-lg font-medium text-text-primary mb-2"
              >
                Restore from Backup
              </h3>
              <p
                id="restore-dialog-description"
                className="text-sm text-text-secondary leading-relaxed"
              >
                This backup contains {applicationCount} application{applicationCount !== 1 ? 's' : ''}.
                Existing applications with matching IDs will be updated, and new applications will be created.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-bg-elevated/50 border-t border-border flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-text-on-accent transition-colors"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}
