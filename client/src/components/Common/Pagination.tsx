import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems?: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  hasMore?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  pageSize,
  onPageChange,
  hasMore = true,
}) => {
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 sm:px-6 dark:border-slate-800">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 0}
          className="relative inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          Trang trước
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasMore}
          className="relative ml-3 inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          Trang sau
        </button>
      </div>

      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Hiển thị từ hàng <span className="font-semibold">{currentPage * pageSize + 1}</span> đến{' '}
            <span className="font-semibold">{(currentPage + 1) * pageSize}</span>
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-xl shadow-xs" aria-label="Pagination">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 0}
              className="relative inline-flex items-center rounded-l-xl px-3 py-2 text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 disabled:opacity-40 dark:ring-slate-800 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              <span>Trước</span>
            </button>
            <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-indigo-600 ring-1 ring-inset ring-slate-200 bg-indigo-50/50 dark:ring-slate-800 dark:bg-indigo-950/40 dark:text-indigo-400">
              Trang {currentPage + 1}
            </span>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!hasMore}
              className="relative inline-flex items-center rounded-r-xl px-3 py-2 text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 disabled:opacity-40 dark:ring-slate-800 dark:hover:bg-slate-800"
            >
              <span>Sau</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};
