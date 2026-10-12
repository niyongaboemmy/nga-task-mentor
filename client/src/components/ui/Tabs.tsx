import React from "react";
import { NavLink, useSearchParams } from "react-router-dom";

/**
 * Tabs (CODE_RUNNER_PLAN.md §6.1). Two kinds, same look:
 *  - `UrlTabs`: the open tab lives in the URL (`?tab=`), so links and a
 *    refresh keep it;
 *  - `RouteTabs`: each tab is its own route (e.g. Code › Projects / Starters).
 */

export interface TabDef {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
}

const tabClass = (active: boolean) =>
  `inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
    active
      ? "border-primary text-primary dark:border-blue-400 dark:text-blue-300"
      : "border-transparent text-text-secondary-light hover:text-text-primary-light dark:text-text-secondary-dark dark:hover:text-text-primary-dark"
  }`;

const Count: React.FC<{ n?: number }> = ({ n }) =>
  n == null ? null : (
    <span className="rounded-full bg-gray-100 px-1.5 text-[11px] font-semibold text-text-secondary-light dark:bg-white/10 dark:text-text-secondary-dark">{n}</span>
  );

export const UrlTabs: React.FC<{
  tabs: TabDef[];
  param?: string;
  /** Tab when the URL has none. */
  defaultTab?: string;
  children: (active: string) => React.ReactNode;
  label: string;
}> = ({ tabs, param = "tab", defaultTab, children, label }) => {
  const [search, setSearch] = useSearchParams();
  const fromUrl = search.get(param);
  const active = tabs.some((t) => t.id === fromUrl) ? fromUrl! : (defaultTab ?? tabs[0]?.id ?? "");
  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-white/10" role="tablist" aria-label={label}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() =>
              setSearch(
                (prev) => {
                  const next = new URLSearchParams(prev);
                  next.set(param, t.id);
                  return next;
                },
                { replace: true },
              )
            }
            className={tabClass(active === t.id)}
          >
            {t.icon}
            {t.label}
            <Count n={t.count} />
          </button>
        ))}
      </div>
      <div className="pt-4" role="tabpanel">
        {children(active)}
      </div>
    </div>
  );
};

export const RouteTabs: React.FC<{ tabs: (TabDef & { to: string; end?: boolean })[]; label: string }> = ({ tabs, label }) => (
  <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-white/10" aria-label={label}>
    {tabs.map((t) => (
      <NavLink key={t.id} to={t.to} end={t.end} className={({ isActive }) => tabClass(isActive)}>
        {t.icon}
        {t.label}
        <Count n={t.count} />
      </NavLink>
    ))}
  </nav>
);

export default UrlTabs;
