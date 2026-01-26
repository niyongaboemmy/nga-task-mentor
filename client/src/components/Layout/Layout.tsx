import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getProfileImageUrl } from "../../utils/imageUrl";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "../ThemeToggle";
import { CheckCircle, AlertTriangle, LayoutGrid } from "lucide-react";
import Logo from "../Logo";
import SystemsMenu from "./SystemsMenu";
import type { System } from "../../types/user.types";

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logoutUser } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSystemsMenuOpen, setIsSystemsMenuOpen] = useState(false);
  const [isTimezoneCorrect, setIsTimezoneCorrect] = useState<boolean | null>(
    null,
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check timezone on component mount
  useEffect(() => {
    const checkTimezone = () => {
      try {
        const systemTime = new Date();
        const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Check if system timezone is Kigali (Africa/Kigali) or equivalent
        const kigaliTimezones = [
          "Africa/Kigali",
          "Africa/Nairobi", // Same timezone as Kigali (UTC+2)
          "Africa/Addis_Ababa",
          "Africa/Dar_es_Salaam",
          "Indian/Comoro",
          "Indian/Mayotte",
        ];

        const isKigaliTimezone = kigaliTimezones.some(
          (tz) =>
            systemTimezone === tz ||
            systemTimezone.includes("Kigali") ||
            systemTimezone.includes("Nairobi"),
        );

        // Also check if the time difference matches Kigali timezone (UTC+2)
        const kigaliOffset = 2 * 60; // UTC+2 in minutes
        const systemOffset = systemTime.getTimezoneOffset();

        // Kigali is UTC+2, so offset should be -120 minutes from UTC
        const isCorrectOffset = Math.abs(systemOffset - -kigaliOffset) <= 5; // 5 minute tolerance

        setIsTimezoneCorrect(isKigaliTimezone && isCorrectOffset);
      } catch (error) {
        console.error("Error checking timezone:", error);
        setIsTimezoneCorrect(false);
      }
    };

    checkTimezone();
  }, []);

  const navigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      current: location.pathname === "/dashboard",
    },
    {
      name: "Courses",
      href: "/courses",
      current: location.pathname.startsWith("/courses"),
    },
    ...(user?.role === "student"
      ? [
          {
            name: "📝 My Quizzes",
            href: "/my-quizzes",
            current: location.pathname === "/my-quizzes",
          },
        ]
      : []),
    ...(user?.role === "instructor" || user?.role === "admin"
      ? [
          {
            name: "Students",
            href: "/students",
            current: location.pathname.startsWith("/students"),
          },
        ]
      : []),
  ];

  const dropdownItems = [
    {
      name: "Assignments",
      href: "/assignments",
      current: location.pathname.startsWith("/assignments"),
    },
    {
      name: "Profile",
      href: "/profile",
      current: location.pathname === "/profile",
    },
  ];

  const handleDropdownToggle = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const closeAllMenus = () => {
    setIsMobileMenuOpen(false);
    setIsDropdownOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Navigation */}
      <nav
        className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-700/50 transition-all duration-300"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              {/* Systems Menu Toggle */}
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsSystemsMenuOpen(!isSystemsMenuOpen)}
                  className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200"
                  title="View Applications"
                >
                  <LayoutGrid className="w-5 h-5" />
                </motion.button>

                {/* Side Systems Menu - Absolute positioned relative to toggle */}
                <SystemsMenu
                  isOpen={isSystemsMenuOpen}
                  onClose={() => setIsSystemsMenuOpen(false)}
                  systems={((user?.systems as System[]) || []).filter(
                    (s) => s.client_id !== import.meta.env.VITE_SSO_CLIENT_ID,
                  )}
                />
              </div>

              {/* Logo with subtle scale animation */}
              <Link
                to="/dashboard"
                className="flex items-center space-x-3 group"
                aria-label="Dashboard"
              >
                <Logo size="medium" />
              </Link>
            </div>

            {/* Desktop Navigation with subtle hover effects */}
            <div className="hidden md:flex items-center space-x-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`${
                    item.current
                      ? "text-blue-600 bg-blue-50 dark:bg-gray-800 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-300 hover:text-blue-700 dark:hover:text-white hover:bg-blue-50 dark:hover:bg-gray-800"
                  } px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-200`}
                  aria-current={item.current ? "page" : undefined}
                >
                  <span className="relative">
                    {item.name}
                    {item.current && (
                      <span className="absolute -bottom-1 left-1/2 w-1 h-1 bg-primary rounded-full -translate-x-1/2"></span>
                    )}
                  </span>
                </Link>
              ))}

              {/* Dropdown with smooth animation */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={handleDropdownToggle}
                  className={`${
                    dropdownItems.some((item) => item.current)
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  } px-4 py-2 rounded-xl text-sm font-medium flex items-center space-x-1.5 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-[1.02] active:scale-95`}
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="true"
                  aria-label="More options"
                >
                  <span>More</span>
                  <motion.svg
                    animate={{ rotate: isDropdownOpen ? 180 : 0 }}
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </motion.svg>
                </button>

                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="absolute left-0 bg-white dark:bg-gray-800 rounded-xl shadow-lg py-1.5 mt-1.5 border border-gray-200 dark:border-gray-700 z-10 backdrop-blur-lg w-[200px]"
                      role="menu"
                      aria-orientation="vertical"
                      aria-labelledby="more-menu"
                    >
                      {dropdownItems.map((item) => (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={`${
                            item.current
                              ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                          } px-4 py-2.5 text-sm transition-all duration-150 flex items-center group`}
                          role="menuitem"
                          onClick={closeAllMenus}
                          aria-current={item.current ? "page" : undefined}
                        >
                          <motion.span
                            className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-3 opacity-0 group-hover:opacity-100"
                            whileHover={{ scale: 1.3 }}
                            transition={{
                              type: "spring",
                              stiffness: 400,
                              damping: 10,
                            }}
                          />
                          <span>{item.name}</span>
                          {item.current && (
                            <svg
                              className="w-3.5 h-3.5 ml-auto text-blue-500"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Theme Toggle, Timezone Indicator and User Section */}
            <div className="hidden md:flex items-center space-x-3">
              {/* Academic Info */}
              {user?.currentAcademicYear && user?.currentAcademicTerm && (
                <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium border border-gray-200 dark:border-gray-700/40 mr-2">
                  <span>{user.currentAcademicYear.name}</span>
                  <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                  <span>{user.currentAcademicTerm.name}</span>
                </div>
              )}

              <ThemeToggle />

              {/* Timezone Status Indicator */}
              {/* {isTimezoneCorrect !== null && (
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    isTimezoneCorrect
                      ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                      : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                  }`}
                  title={
                    isTimezoneCorrect
                      ? "Timezone is correct (Kigali)"
                      : "Timezone needs attention"
                  }
                >
                  {isTimezoneCorrect ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <AlertTriangle className="w-3 h-3" />
                  )}
                  <span className="hidden lg:inline">
                    {isTimezoneCorrect ? "CAT" : "TZ"}
                  </span>
                </div>
              )} */}

              <div className="flex items-center space-x-3 border-l border-gray-200 dark:border-gray-700 pl-4">
                <Link to="/profile">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative"
                  >
                    {user?.profile_image ? (
                      <img
                        src={getProfileImageUrl(user.profile_image) || ""}
                        alt={`${user.first_name} ${user.last_name}`}
                        className="w-9 h-9 rounded-xl object-cover border-2 border-gray-200 dark:border-gray-700 shadow-sm"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-200 overflow-hidden">
                        {user?.first_name?.[0] || "U"}
                        <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white dark:border-gray-900"></div>
                      </div>
                    )}
                  </motion.div>
                </Link>

                <motion.button
                  onClick={logoutUser}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 flex items-center"
                  aria-label="Sign out"
                >
                  <svg
                    className="w-4 h-4 mr-1.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="M16 17l5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                  Sign out
                </motion.button>
              </div>
            </div>

            {/* Mobile menu button with animation */}
            <div className="md:hidden">
              <motion.button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
                aria-label="Toggle menu"
              >
                {!isMobileMenuOpen ? (
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      d="M3 12h18M3 6h18M3 18h18"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      d="M18 6L6 18M6 6l12 12"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </motion.button>
            </div>
          </div>
        </div>

        {/* Mobile menu with smooth animation */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, overflow: "hidden" }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="md:hidden border-t border-gray-200 dark:border-gray-700"
            >
              <div className="px-2 pt-2 pb-4 space-y-1 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg">
                {[...navigation, ...dropdownItems].map((item, index) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      to={item.href}
                      className={`${
                        item.current
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                      } block px-4 py-3 rounded-xl text-sm font-medium transition-colors duration-150`}
                      onClick={closeAllMenus}
                    >
                      {item.name}
                    </Link>
                  </motion.div>
                ))}

                {/* Mobile Academic Info */}
                {user?.currentAcademicYear && user?.currentAcademicTerm && (
                  <div className="px-4 py-2">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700">
                      <span>{user.currentAcademicYear.name}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                      <span>{user.currentAcademicTerm.name}</span>
                    </div>
                  </div>
                )}

                {/* Mobile Timezone Status */}
                {isTimezoneCorrect !== null && (
                  <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm ${
                      isTimezoneCorrect
                        ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                        : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                    }`}
                  >
                    {isTimezoneCorrect ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                    <span>{isTimezoneCorrect ? "CAT Zone" : "TZ Check"}</span>
                  </div>
                )}

                <div className="pt-3 mt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="px-4 py-2.5 text-sm font-medium text-gray-800 dark:text-gray-200">
                    {user?.first_name} {user?.last_name}
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      logoutUser();
                      closeAllMenus();
                    }}
                    className="w-full text-left px-4 py-3 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white rounded-xl transition-colors duration-150 flex items-center"
                  >
                    <svg
                      className="w-4 h-4 mr-2.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <path d="M16 17l5-5-5-5" />
                      <path d="M21 12H9" />
                    </svg>
                    Sign out
                  </motion.button>
                </div>

                {/* Mobile Systems Toggle */}
                <div className="px-4 py-3">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setIsSystemsMenuOpen(true);
                      closeAllMenus();
                    }}
                    className="w-full flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-800/50"
                  >
                    <div className="flex items-center space-x-3">
                      <LayoutGrid className="w-5 h-5" />
                      <span className="font-semibold">View Applications</span>
                    </div>
                    <CheckCircle className="w-4 h-4 opacity-0" />{" "}
                    {/* Placeholder for alignment */}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main content with subtle animation */}
      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="max-w-7xl mx-auto py-3 md:py-4 px-4 sm:px-6 lg:px-8"
      >
        <div className="">{children}</div>
      </motion.main>
    </div>
  );
};

export default Layout;
