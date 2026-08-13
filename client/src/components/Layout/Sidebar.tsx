import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import AcademicPeriodSwitcher from "./AcademicPeriodSwitcher";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { appRoutes, type NavItemConfig } from "../../routes/routeConfig";

const GROUP_ORDER: NavItemConfig["group"][] = ["General", "Teaching", "Admin"];
const COLLAPSE_STORAGE_KEY = "tm_sidebar_collapsed";

interface NavEntry {
  path: string;
  navItem: NavItemConfig;
}

function useVisibleNavGroups() {
  const { can } = usePermissions();

  return useMemo(() => {
    const entries: NavEntry[] = appRoutes
      .filter((r) => r.navItem && (!r.permissions || can(r.permissions)))
      .map((r) => ({ path: r.path, navItem: r.navItem! }));

    const grouped = new Map<NavItemConfig["group"], NavEntry[]>();
    for (const entry of entries) {
      const list = grouped.get(entry.navItem.group) ?? [];
      list.push(entry);
      grouped.set(entry.navItem.group, list);
    }
    return GROUP_ORDER.map((group) => ({ group, items: grouped.get(group) ?? [] })).filter(
      (g) => g.items.length > 0,
    );
  }, [can]);
}

interface SidebarContentProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({ collapsed, onNavigate }) => {
  const location = useLocation();
  const groups = useVisibleNavGroups();

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Sidebar navigation">
      {groups.map(({ group, items }) => (
        <div key={group}>
          {!collapsed && (
            <h3 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary-light/70 dark:text-text-secondary-dark/70">
              {group}
            </h3>
          )}
          <div className="space-y-1">
            {items.map(({ path, navItem }) => {
              const Icon = navItem.icon;
              const isCurrent =
                path === "/dashboard"
                  ? location.pathname === path
                  : location.pathname.startsWith(path.split(":")[0]);
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={onNavigate}
                  title={collapsed ? navItem.label : undefined}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                    isCurrent
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium"
                      : "font-light text-text-secondary-light dark:text-text-secondary-dark/70 hover:bg-surface-light dark:hover:bg-surface-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <motion.span whileHover={{ x: collapsed ? 0 : 2 }} className="flex items-center gap-3">
                    <Icon className="w-5 h-5 shrink-0" />
                    {!collapsed && <span>{navItem.label}</span>}
                  </motion.span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
};

const MobileAcademicPeriodFooter: React.FC = () => {
  const { user } = useAuth();
  if (!user?.currentAcademicYear || !user?.currentAcademicTerm) return null;
  return (
    <div className="shrink-0 px-4 py-3 border-t border-border-light dark:border-border-dark">
      <AcademicPeriodSwitcher variant="full" />
    </div>
  );
};

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* localStorage unavailable — collapse state just won't persist */
      }
      return next;
    });
  };

  return (
    <>
      {/* Desktop persistent sidebar — sits below the fixed top bar, matching
          MIS's Sidebar (no logo of its own; the top bar owns branding). */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 sticky top-16 z-40 bg-white dark:bg-gray-800/30 border-r border-border-light dark:border-gray-700/20 transition-all duration-300 ${
          collapsed ? "w-20" : "w-64"
        }`}
        style={{ height: "calc(100vh - 4rem)" }}
      >
        <div
          className={`flex items-center h-14 shrink-0 border-b border-border-light dark:border-gray-700/30 ${
            collapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          {!collapsed && (
            <span className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
              Menus
            </span>
          )}
          <button
            onClick={toggleCollapsed}
            className="p-2 rounded-lg text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        <SidebarContent collapsed={collapsed} />
        <div className="shrink-0 p-4 border-t border-border-light dark:border-gray-700/30">
          {!collapsed && (
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 text-center">
              TaskMentor v1.0
            </p>
          )}
        </div>
      </aside>

      {/* Mobile/tablet overlay drawer — starts below the fixed top bar so
          the logo/waffle menu stay visible above it, matching MIS. */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              onClick={onCloseMobile}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
              className="fixed top-16 left-0 z-50 w-72 max-w-[85vw] flex flex-col bg-white dark:bg-gray-800 shadow-2xl lg:hidden"
              style={{ height: "calc(100vh - 4rem)" }}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              <div className="flex items-center justify-between h-14 px-4 shrink-0 border-b border-border-light dark:border-gray-700/30">
                <span className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                  Menus
                </span>
                <button
                  onClick={onCloseMobile}
                  className="p-2 rounded-xl text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <SidebarContent collapsed={false} onNavigate={onCloseMobile} />
              <MobileAcademicPeriodFooter />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
