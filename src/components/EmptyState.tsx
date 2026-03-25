import { FileText } from 'lucide-react';

interface EmptyStateProps {
  message?: string;
}

export function EmptyState({ message = 'No items found.' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8">
      <div className="w-16 h-16 rounded-full bg-bg-elevated flex items-center justify-center mb-4">
        <FileText size={28} className="text-text-muted" />
      </div>
      <p className="text-text-secondary text-center">{message}</p>
    </div>
  );
}
