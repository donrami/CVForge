import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  disabled = false,
}: PaginationControlsProps) {
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-xs font-mono text-text-muted">
        {totalItems} {totalItems === 1 ? 'application' : 'applications'}
      </span>

      <div className="flex items-center gap-3">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={disabled || isFirstPage}
          className="flex items-center gap-1 px-2 py-1 text-xs font-mono text-text-secondary border border-border hover:text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={14} />
          Previous
        </button>

        <span className="text-xs font-mono text-text-muted">
          {currentPage} / {totalPages}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={disabled || isLastPage}
          className="flex items-center gap-1 px-2 py-1 text-xs font-mono text-text-secondary border border-border hover:text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
