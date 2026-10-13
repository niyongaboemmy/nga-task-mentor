import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  /** Omit for the current page (the last crumb). */
  to?: string;
}

/** Where this page sits: parent links, then the current page. */
export const Breadcrumb: React.FC<{ items: Crumb[]; className?: string }> = ({ items, className = "" }) => (
  <nav aria-label="Breadcrumb" className={className}>
    <ol className="flex flex-wrap items-center gap-1 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
      {items.map((c, i) => (
        <li key={`${c.label}-${i}`} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />}
          {c.to ? (
            <Link to={c.to} className="hover:text-primary hover:underline">
              {c.label}
            </Link>
          ) : (
            <span aria-current="page">{c.label}</span>
          )}
        </li>
      ))}
    </ol>
  </nav>
);

export default Breadcrumb;
