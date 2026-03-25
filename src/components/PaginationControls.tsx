import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  containerClassName?: string;
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
  onPageChange,
  disabled = false,
  containerClassName = '',
}: PaginationControlsProps) {
  if (totalPages <= 1 && !totalItems) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems || totalPages * pageSize);

  return (
    <div className={`flex items-center justify-between gap-4 ${containerClassName}`}>
      <div className="text-sm text-text-secondary">
        {totalItems !== undefined ? (
          <span>{startItem}–{endItem} of {totalItems} applications</span>
        ) : (
          <span>Page {currentPage} of {totalPages}</span>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={disabled || currentPage <= 1}
          className="btn-refined btn-refined-secondary px-3 py-2 disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              disabled={disabled}
              className={`
                w-9 h-9 rounded-lg text-sm font-medium transition-all duration-200
                ${pageNum === currentPage
                  ? 'bg-accent text-text-on-accent shadow-sm'
                  : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary disabled:hover:bg-transparent disabled:hover:text-text-secondary'
                }
                ${disabled ? 'disabled:opacity-40' : ''}
              `}
            >
              {pageNum}
            </button>
          ))}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={disabled || currentPage >= totalPages}
          className="btn-refined btn-refined-secondary px-3 py-2 disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
