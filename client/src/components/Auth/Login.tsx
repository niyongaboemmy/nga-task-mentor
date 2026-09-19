import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import HomeNavbar from "../HomeNavbar";
import { useAuth } from "../../contexts/AuthContext";
import axios from "axios";

const Login: React.FC = () => {
  const SSO_CLIENT_ID = import.meta.env.VITE_SSO_CLIENT_ID || "taskmentor_app";
  const MIS_LOGIN_URL =
    import.meta.env.VITE_MIS_LOGIN_URL || "https://nga.ac.rw/mis/login";
  // Same origin as the login URL above, just without the /login path — kept
  // derived (rather than a second hardcoded domain) so the two can't drift
  // out of sync the way the old hardcoded ngamis.isengesho.com link did.
  const MIS_HOME_URL = MIS_LOGIN_URL.replace(/\/login\/?$/, "");

  const { sessionExpired, loginWithSSOData } = useAuth();

  // ── DEV-ONLY state (Vite strips this block entirely in production builds) ──
  const [devLoading, setDevLoading] = useState<string | null>(null);
  const [devError, setDevError] = useState<string | null>(null);

  const handleDevLogin = async (role: "admin" | "instructor" | "student") => {
    if (!import.meta.env.DEV) return;
    setDevLoading(role);
    setDevError(null);
    try {
      const res = await axios.post(
        "/api/auth/dev-login",
        { role },
        { withCredentials: true },
      );
      loginWithSSOData(res.data);
    } catch (err: any) {
      setDevError(
        err.response?.data?.message ?? "Dev login failed — is ENABLE_DEV_LOGIN=true in server/.env?",
      );
    } finally {
      setDevLoading(null);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const handleSSOLogin = () => {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    const redirectUri = window.location.origin + base + "/sso/callback";
    window.location.href = `${MIS_LOGIN_URL}?client_id=${SSO_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-50 to-white dark:from-gray-950 dark:via-gray-950 dark:to-gray-950 flex flex-col">
      <HomeNavbar />

      <div className="flex-1 flex items-center justify-center p-2 sm:p-3 lg:p-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-3"
        >
          {/* Session-expired banner */}
          <AnimatePresence>
            {sessionExpired && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
              >
                <svg
                  className="h-4 w-4 mt-0.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>
                  Your session has expired. Please sign in again to continue.
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-gray-800 overflow-hidden">
            <div className="p-6 sm:p-8">
              {/* Header */}
              <div className="text-center mb-8">
                <motion.img
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  src="./nga-logo.png"
                  alt="NGA Logo"
                  className="h-24 mx-auto mb-4 object-contain drop-shadow-md"
                />
                <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-400 dark:to-blue-400">
                  Welcome to TaskMentor
                </h2>
                <p className="mt-2 text-text-secondary-light dark:text-text-secondary-dark text-sm">
                  Student Practical Work Management System
                </p>
              </div>

              {/* SSO info + button */}
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-2xl border border-blue-100 dark:border-blue-800 flex items-start gap-3">
                  <svg
                    className="h-4 w-4 text-blue-500 dark:text-blue-400 mt-0.5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Sign in with your <strong>NGA Central MIS</strong> account
                    to access TaskMentor.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSSOLogin}
                  className="w-full flex items-center justify-center gap-3 py-3 px-6 text-base font-semibold rounded-full text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-500/30 shadow-lg shadow-blue-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <img
                    src="/nga-logo.png"
                    alt="NGA"
                    className="h-5 w-5 object-contain"
                  />
                  <span>Sign in with NGA MIS</span>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* ── DEV-ONLY role picker — Vite removes this in production ── */}
            {import.meta.env.DEV && (
              <div className="border-t border-dashed border-amber-300 dark:border-amber-600 mx-6 pt-5 pb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-3 text-center">
                  🔧 Dev Login — local only
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(["admin", "instructor", "student"] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      disabled={devLoading !== null}
                      onClick={() => handleDevLogin(role)}
                      className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-800/30 transition-colors text-xs font-medium text-amber-800 dark:text-amber-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="text-lg">
                        {role === "admin" ? "🛡️" : role === "instructor" ? "👩‍🏫" : "🎓"}
                      </span>
                      <span className="capitalize">
                        {devLoading === role ? "..." : role}
                      </span>
                    </button>
                  ))}
                </div>
                {devError && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400 text-center">
                    {devError}
                  </p>
                )}
              </div>
            )}
            {/* ────────────────────────────────────────────────────────────── */}

            <div className="bg-gray-50/80 dark:bg-gray-800/50 px-6 py-4 text-center border-t border-gray-100 dark:border-gray-800">
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
                No account or need password help?{" "}
                <a
                  href={MIS_HOME_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Visit NGA Central MIS
                </a>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
