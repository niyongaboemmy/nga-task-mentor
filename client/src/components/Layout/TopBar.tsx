import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Menu, LayoutGrid, LogOut } from "lucide-react";
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
  const breadcrumb = useBreadcrumbLabel();

  return (
    <header
      className="sticky top-0 z-30 h-16 shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-700/50"
      role="banner"
    >
      <div className="flex items-center gap-3 min-w-0">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </motion.button>
        {breadcrumb && (
          <h1 className="truncate text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100">
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
            className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200"
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

        <div className="flex items-center gap-1.5 sm:gap-3 border-l border-gray-200 dark:border-gray-700 pl-2 sm:pl-4">
          <Link to="/profile" aria-label="Profile">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="relative">
              {user?.profile_image ? (
                <img
                  src={getProfileImageUrl(user.profile_image) || ""}
                  alt={`${user.first_name} ${user.last_name}`}
                  className="w-9 h-9 rounded-xl object-cover border-2 border-gray-200 dark:border-gray-700 shadow-sm"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-200 overflow-hidden">
                  {user?.first_name?.[0] || "U"}
                  <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white dark:border-gray-900" />
                </div>
              )}
            </motion.div>
          </Link>

          <motion.button
            onClick={logoutUser}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-2 sm:px-3 sm:py-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 flex items-center"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Sign out</span>
          </motion.button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
