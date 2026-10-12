import React from "react";
import { Breadcrumb, type Crumb } from "./Breadcrumb";

/**
 * The top of every app-shell page (CODE_RUNNER_PLAN.md §6.1): breadcrumb,
 * title, a short description or meta chips, and the actions — one primary
 * action at most, on the right.
 */
export const PageHeader: React.FC<{
  title: React.ReactNode;
  breadcrumb?: Crumb[];
  icon?: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, breadcrumb, icon, description, meta, actions, className = "" }) => (
  <header className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
    <div className="min-w-0">
      {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} className="mb-1" />}
      <h1 className="flex items-center gap-2 text-xl font-bold text-text-primary-light dark:text-text-primary-dark md:text-2xl">
        {icon}
        <span className="min-w-0 truncate">{title}</span>
      </h1>
      {description && <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">{description}</p>}
      {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>
);

export default PageHeader;
