import React, { useRef, useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, LayoutGrid, ExternalLink, ArrowRight } from "lucide-react";
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
          className="absolute left-0 mt-3 w-[400px] md:w-[550px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/20 dark:border-slate-700/50 overflow-hidden z-[100]"
        >
          {/* Header Section */}
          <div className="p-6 pb-0">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-600 rounded-2xl shadow-blue-600/20">
                  <LayoutGrid className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight mb-1">
                    Apps
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    NGA Central MIS Ecosystem
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all duration-200 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative group mb-6">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Search for apps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
          </div>

          {/* Grid Section */}
          <div className="px-6 pb-6 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
            <div className="grid grid-cols-4 gap-0">
              {/* Static MIS Redirect - Always visible unless searching specifically for something else */}
              {(!searchQuery ||
                "back to mis".includes(searchQuery.toLowerCase())) && (
                <motion.button
                  key="mis-back"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() =>
                    window.open("https://nga.ac.rw/mis/", "_blank")
                  }
                  className="group relative flex flex-col items-center p-3 pt-6 rounded-[1.5rem] hover:bg-orange-50 dark:hover:bg-orange-600/10 transition-all duration-300 text-center"
                >
                  <div className="relative mb-3">
                    <div className="w-16 h-16 rounded-[1.25rem] bg-white dark:bg-slate-800 shadow-[0_8px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)] group-hover:shadow-[0_12px_30px_rgba(249,115,22,0.15)] dark:group-hover:shadow-[0_12px_30px_rgba(249,115,22,0.2)] group-hover:-translate-y-1 group-hover:scale-105 flex items-center justify-center border border-slate-100 dark:border-slate-700/50 group-hover:border-orange-200 dark:group-hover:border-orange-500/30 transition-all duration-300 overflow-hidden">
                      <LayoutGrid className="w-8 h-8 text-orange-500 opacity-80" />
                    </div>
                    <div className="absolute -top-1 -right-1 bg-orange-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg">
                      <ArrowRight className="w-2.5 h-2.5" />
                    </div>
                  </div>
                  <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300 group-hover:text-orange-600 dark:group-hover:text-orange-400 truncate w-full px-1">
                    Back to MIS
                  </span>
                  <div className="mt-1 flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-[10px] text-orange-500/80 font-bold uppercase tracking-wider">
                      Exit App
                    </span>
                    <ExternalLink className="w-2.5 h-2.5 text-orange-500/80" />
                  </div>
                </motion.button>
              )}

              {filteredSystems.map((system, idx) => (
                <motion.button
                  key={system.system_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => handleSystemClick(system)}
                  className="group relative flex flex-col items-center p-3 pt-6 rounded-[1.5rem] hover:bg-blue-50 dark:hover:bg-blue-600/10 transition-all duration-300 text-center"
                >
                  <div className="relative mb-3">
                    <div className="w-16 h-16 rounded-[1.25rem] bg-white dark:bg-slate-800 shadow-[0_8px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)] group-hover:shadow-[0_12px_30px_rgba(37,99,235,0.15)] dark:group-hover:shadow-[0_12px_30px_rgba(37,99,235,0.2)] group-hover:-translate-y-1 group-hover:scale-105 flex items-center justify-center border border-slate-100 dark:border-slate-700/50 group-hover:border-blue-200 dark:group-hover:border-blue-500/30 transition-all duration-300 overflow-hidden">
                      {system.icon_url ? (
                        <img
                          src={system.icon_url}
                          alt={system.name}
                          className="w-10 h-10 object-contain rounded-xl"
                        />
                      ) : (
                        <LayoutGrid className="w-8 h-8 text-blue-500 opacity-80" />
                      )}
                    </div>
                    {/* Hover Arrow Indicator */}
                    <div className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg">
                      <ArrowRight className="w-2.5 h-2.5" />
                    </div>
                  </div>
                  <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate w-full px-1">
                    {system.name}
                  </span>
                  <div className="mt-1 flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-[10px] text-blue-500/80 font-bold uppercase tracking-wider">
                      Open
                    </span>
                    <ExternalLink className="w-2.5 h-2.5 text-blue-500/80" />
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Empty state only if NO items are visible (not even the static one) */}
            {filteredSystems.length === 0 &&
              searchQuery &&
              !"back to mis".includes(searchQuery.toLowerCase()) && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
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
