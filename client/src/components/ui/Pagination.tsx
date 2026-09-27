import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { pageWindow } from "../../utils/pagination";

/**
 * Footer pagination for server-paginated lists: "Showing 11–20 of 57",
 * a rows-per-page picker, and numbered pages (with ellipses on long lists).
 * Stays visible whenever there are items, so the page size is always
 * reachable -- even when everything fits on one page.
 */

export interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  /** Plural noun for the summary, e.g. "questions". */
  itemLabel?: string;
  /** Dims and locks the controls while a page is loading. */
  busy?: boolean;
}

const NAV_BTN =
  "flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-slate-600 transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-gray-700 dark:text-slate-300 dark:hover:bg-gray-800";

const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  itemLabel = "items",
  busy = false,
}) => {
  if (totalItems <= 0) return null;
  const pages = Math.max(1, totalPages);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  const go = (p: number) => {
    const next = Math.min(pages, Math.max(1, p));
    if (next !== page) onPageChange(next);
  };

  return (
    <nav
      aria-label="Pagination"
      className={`flex flex-col gap-3 border-t border-border-light bg-surface-light px-5 py-3 transition-opacity dark:border-border-dark/30 dark:bg-surface-dark/30 sm:flex-row sm:items-center sm:justify-between ${
        busy ? "opacity-70" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
        <span aria-live="polite">
          Showing{" "}
          <span className="font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark">
            {from}–{to}
          </span>{" "}
          of{" "}
          <span className="font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark">
            {totalItems}
          </span>{" "}
          {itemLabel}
        </span>
        {onPageSizeChange && (
          <label className="inline-flex items-center gap-2 text-xs">
            Rows per page
            <select
              value={pageSize}
              disabled={busy}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-text-primary-light focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-text-primary-dark"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <button type="button" className={`${NAV_BTN} hidden sm:flex`} onClick={() => go(1)} disabled={busy || page === 1} aria-label="First page">
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button type="button" className={NAV_BTN} onClick={() => go(page - 1)} disabled={busy || page === 1} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </button>
          {/* Numbered pages on wider screens; a compact "3 / 12" on phones. */}
          <span className="px-2 text-sm font-medium tabular-nums text-slate-600 dark:text-slate-300 sm:hidden">
            {page} / {pages}
          </span>
          <div className="hidden items-center gap-1 sm:flex">
            {pageWindow(page, pages).map((p, i) =>
              p === "gap" ? (
                <span key={`gap-${i}`} className="px-1 text-sm text-slate-500" aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => go(p)}
                  disabled={busy}
                  aria-label={`Page ${p}`}
                  aria-current={p === page ? "page" : undefined}
                  className={`h-8 min-w-8 rounded-lg px-2 text-sm font-medium tabular-nums transition-colors ${
                    p === page
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-900/20"
                      : "text-slate-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-gray-800"
                  }`}
                >
                  {p}
                </button>
              ),
            )}
          </div>
          <button type="button" className={NAV_BTN} onClick={() => go(page + 1)} disabled={busy || page === pages} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" className={`${NAV_BTN} hidden sm:flex`} onClick={() => go(pages)} disabled={busy || page === pages} aria-label="Last page">
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </nav>
  );
};

export default Pagination;
