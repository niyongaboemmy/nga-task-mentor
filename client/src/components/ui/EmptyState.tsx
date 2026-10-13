import React from "react";

/** Nothing to show yet — say why, and offer the next step. */
export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon, title, description, action, className = "" }) => (
  <div
    className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center dark:border-white/10 ${className}`}
    role="status"
  >
    {icon && <div className="mb-3 text-text-secondary-light dark:text-text-secondary-dark">{icon}</div>}
    <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{title}</p>
    {description && <p className="mt-1 max-w-md text-sm text-text-secondary-light dark:text-text-secondary-dark">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
