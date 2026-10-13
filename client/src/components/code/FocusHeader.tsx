import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * The slim header of a full-screen (focus) page (CODE_RUNNER_PLAN.md §6.2):
 * back to the parent page, where you are, the status, and the actions.
 */
const FocusHeader: React.FC<{
  backTo: string;
  backLabel: string;
  title: React.ReactNode;
  status?: React.ReactNode;
  children?: React.ReactNode;
  onBack?: (e: React.MouseEvent) => void;
}> = ({ backTo, backLabel, title, status, children, onBack }) => (
  <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-900">
    <Link
      to={backTo}
      onClick={onBack}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-text-secondary-light hover:bg-gray-100 hover:text-text-primary-light dark:text-text-secondary-dark dark:hover:bg-white/10"
      aria-label={`Back to ${backLabel}`}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">{backLabel}</span>
    </Link>
    <span className="hidden h-5 w-px bg-gray-200 dark:bg-white/10 sm:block" aria-hidden="true" />
    <h1 className="min-w-0 truncate text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{title}</h1>
    {status && <div className="flex items-center gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">{status}</div>}
    <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
  </header>
);

export default FocusHeader;
