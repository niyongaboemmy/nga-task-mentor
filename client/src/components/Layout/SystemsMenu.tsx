import React, { useRef, useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, LayoutGrid, ArrowRight } from "lucide-react";
import { authorizeSSO } from "../../services/authService";
import { toast } from "react-toastify";
import type { System } from "../../types/user.types";

interface SystemsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  systems: System[];
}

const SystemsMenu: React.FC<SystemsMenuProps> = ({
  isOpen,
  onClose,
  systems,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  // Reset search when menu opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  const filteredSystems = useMemo(() => {
    return systems
      .filter((s) => s.client_id !== import.meta.env.VITE_SSO_CLIENT_ID)
      .filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [systems, searchQuery]);

  // Derived from VITE_MIS_LOGIN_URL rather than a second env var — the
  // hardcoded https://nga.ac.rw/mis/ below was the pre-amashuri.com domain
  // and no longer resolves to the live MIS.
  const misHomeUrl = (
    import.meta.env.VITE_MIS_LOGIN_URL || "https://nga.ac.rw/mis/login"
  ).replace(/\/login\/?$/, "");

  const handleSystemClick = async (system: System) => {
    const callbacks = system.allowed_redirect_uris
      ? system.allowed_redirect_uris.split(",").map((s) => s.trim())
      : [];

    const currentOrigin = window.location.origin;
    const matchingCallback = callbacks.find((cb) =>
      cb.startsWith(currentOrigin),
    );
    const redirectUri = matchingCallback || callbacks[0] || system.home_url;

    if (!redirectUri) {
      toast.error("No callback or home URL configured for this system");
      return;
    }

    const newWindow = window.open("about:blank", "_blank");
    if (!newWindow) {
      toast.error("Popup blocked! Please allow popups for this site.");
      return;
    }

    if (!system.client_id) {
      newWindow.location.href = redirectUri;
      return;
    }

    const state = Math.random().toString(36).substring(2, 15);

    try {
      toast.info(`Authenticating with ${system.name}...`);
      const result = await authorizeSSO(
        system.client_id!,
        redirectUri,
        "code",
        state,
      );
      if (result && result.code) {
        const targetUrl = new URL(redirectUri);
        targetUrl.searchParams.append("code", result.code);
        if (result.state) {
          targetUrl.searchParams.append("state", result.state);
        }
        newWindow.location.href = targetUrl.toString();
      } else {
        newWindow.location.href = redirectUri;
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        newWindow.close();
        const loginUrl = new URL("/mis/login", window.location.origin);
        loginUrl.searchParams.set("client_id", system.client_id!);
        loginUrl.searchParams.set("redirect_uri", redirectUri);
        loginUrl.searchParams.set("response_type", "code");
        loginUrl.searchParams.set("state", state);
        window.location.href = loginUrl.toString();
        return;
      }
      toast.error(error.response?.data?.message || "SSO Authentication failed");
      newWindow.location.href = redirectUri;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95, y: -20, x: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20, x: -20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="absolute left-0 mt-2 w-[300px] sm:w-[360px] bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)] border border-white/20 dark:border-gray-700/50 overflow-hidden z-[100]"
        >
          {/* Header Section */}
          <div className="p-3.5 pb-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-sm shadow-blue-600/20">
                  <LayoutGrid className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark leading-tight">
                    Apps
                  </h3>
                  <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark/70 font-medium">
                    NGA Central MIS Ecosystem
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all duration-200 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative group mb-3">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Search for apps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs text-text-primary-light dark:text-text-primary-dark placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>

          {/* Grid Section */}
          <div className="px-3 pb-3 max-h-[360px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
            <div className="grid grid-cols-4 gap-1">
              {/* Static MIS Redirect - Always visible unless searching specifically for something else */}
              {(!searchQuery ||
                "back to mis".includes(searchQuery.toLowerCase())) && (
                <motion.button
                  key="mis-back"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => window.open(misHomeUrl, "_blank")}
                  className="group relative flex flex-col items-center p-1.5 pt-2 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-600/10 transition-all duration-200 text-center"
                >
                  <div className="relative mb-1.5">
                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-gray-800 shadow-[0_4px_10px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_14px_rgba(0,0,0,0.3)] group-hover:shadow-[0_6px_16px_rgba(249,115,22,0.18)] group-hover:scale-105 flex items-center justify-center border border-gray-100 dark:border-gray-700/50 group-hover:border-orange-200 dark:group-hover:border-orange-500/30 transition-all duration-200 overflow-hidden">
                      <LayoutGrid className="w-5 h-5 text-orange-500 opacity-80" />
                    </div>
                    <div className="absolute -top-1 -right-1 bg-orange-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow">
                      <ArrowRight className="w-2 h-2" />
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-text-secondary-light dark:text-text-secondary-dark group-hover:text-orange-600 dark:group-hover:text-orange-400 truncate w-full px-0.5">
                    Back to MIS
                  </span>
                </motion.button>
              )}

              {filteredSystems.map((system, idx) => (
                <motion.button
                  key={system.system_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => handleSystemClick(system)}
                  className="group relative flex flex-col items-center p-1.5 pt-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-600/10 transition-all duration-200 text-center"
                >
                  <div className="relative mb-1.5">
                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-gray-800 shadow-[0_4px_10px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_14px_rgba(0,0,0,0.3)] group-hover:shadow-[0_6px_16px_rgba(37,99,235,0.18)] group-hover:scale-105 flex items-center justify-center border border-gray-100 dark:border-gray-700/50 group-hover:border-blue-200 dark:group-hover:border-blue-500/30 transition-all duration-200 overflow-hidden">
                      {system.icon_url ? (
                        <img
                          src={system.icon_url}
                          alt={system.name}
                          className="w-6 h-6 object-contain rounded-md"
                        />
                      ) : (
                        <LayoutGrid className="w-5 h-5 text-blue-500 opacity-80" />
                      )}
                    </div>
                    {/* Hover Arrow Indicator */}
                    <div className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow">
                      <ArrowRight className="w-2 h-2" />
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-text-secondary-light dark:text-text-secondary-dark group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate w-full px-0.5">
                    {system.name}
                  </span>
                </motion.button>
              ))}
            </div>

            {/* Empty state only if NO items are visible (not even the static one) */}
            {filteredSystems.length === 0 &&
              searchQuery &&
              !"back to mis".includes(searchQuery.toLowerCase()) && (
                <div className="text-center py-8">
                  <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2.5">
                    <Search className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                  </div>
                  <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 font-medium">
                    No systems found matching "{searchQuery}"
                  </p>
                </div>
              )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SystemsMenu;
