import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Logo from "../Logo";
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
            <h3 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
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
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isCurrent
                      ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-700 dark:hover:text-blue-300"
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
    <div className="shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
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
      {/* Desktop persistent sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 h-screen sticky top-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-r border-gray-200/50 dark:border-gray-700/50 transition-all duration-300 ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <div
          className={`flex items-center h-16 shrink-0 border-b border-gray-200/50 dark:border-gray-700/50 ${
            collapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          {!collapsed && (
            <Link to="/dashboard" aria-label="Dashboard">
              <Logo size="medium" />
            </Link>
          )}
          <button
            onClick={toggleCollapsed}
            className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        <SidebarContent collapsed={collapsed} />
      </aside>

      {/* Mobile/tablet overlay drawer */}
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
              className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] flex flex-col bg-white dark:bg-gray-900 shadow-2xl lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              <div className="flex items-center justify-between h-16 px-4 shrink-0 border-b border-gray-200 dark:border-gray-700">
                <Link to="/dashboard" onClick={onCloseMobile} aria-label="Dashboard">
                  <Logo size="medium" />
                </Link>
                <button
                  onClick={onCloseMobile}
                  className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
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
