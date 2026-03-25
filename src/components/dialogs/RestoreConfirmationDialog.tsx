import { RotateCcw } from 'lucide-react';

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
  if (!open) return null;

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div 
        className="dialog-content border-l-4 border-l-accent"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-10 h-10 rounded-full bg-accent-subtle flex items-center justify-center">
              <RotateCcw size={20} className="text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-serif text-lg text-text-primary mb-2">Restore Backup</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                This will import <strong>{applicationCount}</strong> application{applicationCount !== 1 ? 's' : ''} from the backup file. 
                Existing applications with the same company and role will be updated.
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-bg-elevated border-t border-border flex justify-end gap-3">
          <button onClick={onCancel} className="btn-refined btn-refined-secondary">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn-refined btn-refined-primary">
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}
