import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Menu, LayoutGrid, LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { getProfileImageUrl } from "../../utils/imageUrl";
import { ThemeToggle } from "../ThemeToggle";
import SystemsMenu from "./SystemsMenu";
import AcademicPeriodSwitcher from "./AcademicPeriodSwitcher";
import { appRoutes } from "../../routes/routeConfig";
import type { System } from "../../types/user.types";

function useBreadcrumbLabel(): string {
  const location = useLocation();
  return useMemo(() => {
    // Prefer an exact/prefix match against a navItem-bearing route so the
    // breadcrumb always reads like the sidebar item the user is "inside".
    const match = appRoutes.find(
      (r) => r.navItem && location.pathname.startsWith(r.path.split(":")[0]),
    );
    if (match?.navItem) return match.navItem.label;
    if (location.pathname.startsWith("/profile")) return "Profile";
    return "";
  }, [location.pathname]);
}

interface TopBarProps {
  onOpenMobileMenu: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ onOpenMobileMenu }) => {
  const { user, logoutUser } = useAuth();
  const [isSystemsMenuOpen, setIsSystemsMenuOpen] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const breadcrumb = useBreadcrumbLabel();

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isUserMenuOpen]);

  return (
    <header
      className="sticky top-0 z-30 h-16 shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 bg-white/80 dark:bg-gray-800/50 backdrop-blur-md border-b border-border-light/50 dark:border-gray-800/50"
      role="banner"
    >
      <div className="flex items-center gap-3 min-w-0">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 rounded-xl text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </motion.button>
        {breadcrumb && (
          <h1 className="truncate text-sm sm:text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
            {breadcrumb}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3">
        {user?.currentAcademicYear && user?.currentAcademicTerm && (
          <div className="hidden md:block">
            <AcademicPeriodSwitcher />
          </div>
        )}

        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsSystemsMenuOpen((v) => !v)}
            className="p-2 rounded-xl text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200"
            title="View Applications"
          >
            <LayoutGrid className="w-5 h-5" />
          </motion.button>
          <SystemsMenu
            isOpen={isSystemsMenuOpen}
            onClose={() => setIsSystemsMenuOpen(false)}
            systems={((user?.systems as System[]) || []).filter(
              (s) => s.client_id !== import.meta.env.VITE_SSO_CLIENT_ID,
            )}
          />
        </div>

        <ThemeToggle />

        <div
          ref={userMenuRef}
          className="relative flex items-center gap-1.5 sm:gap-3 border-l border-border-light dark:border-gray-700/30 pl-2 sm:pl-4"
        >
          <motion.button
            onClick={() => setIsUserMenuOpen((v) => !v)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative"
            aria-label="Account menu"
            aria-expanded={isUserMenuOpen}
          >
            {user?.profile_image ? (
              <img
                src={getProfileImageUrl(user.profile_image) || ""}
                alt={`${user.first_name} ${user.last_name}`}
                className="w-9 h-9 rounded-full object-cover border-2 border-border-light dark:border-gray-700 shadow-sm"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-surface-light dark:bg-surface-dark/50 flex items-center justify-center overflow-hidden">
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-semibold flex items-center justify-center">
                  {user?.first_name?.[0] || "U"}
                </span>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white dark:border-gray-900" />
              </div>
            )}
          </motion.button>

          {isUserMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-900 rounded-3xl shadow-lg border border-border-light dark:border-gray-700/30 py-2 animate-fade-in z-40">
              <Link
                to="/profile"
                onClick={() => setIsUserMenuOpen(false)}
                className="px-4 py-2 text-sm text-text-primary-light dark:text-text-primary-dark hover:bg-surface-light dark:hover:bg-surface-dark flex items-center space-x-2"
              >
                <UserIcon className="w-4 h-4" />
                <span>Profile</span>
              </Link>
              <div className="my-1 border-t border-border-light dark:border-gray-700/30" />
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  logoutUser();
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-surface-light dark:hover:bg-surface-dark flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
