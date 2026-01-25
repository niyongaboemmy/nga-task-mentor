import React from "react";
import { motion } from "framer-motion";
import HomeNavbar from "../HomeNavbar";

const Login: React.FC = () => {
  // SSO Configuration
  // SSO Configuration
  const SSO_CLIENT_ID = import.meta.env.VITE_SSO_CLIENT_ID || "taskmentor_app";
  const MIS_LOGIN_URL =
    import.meta.env.VITE_MIS_LOGIN_URL || "https://nga.ac.rw/mis/login";

  const handleSSOLogin = () => {
    const redirectUri = window.location.origin + "/taskmentor/sso/callback";
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
          className="w-full max-w-md"
        >
          <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-800 overflow-hidden">
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
                <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-600 dark:from-blue-400 dark:to-blue-400">
                  Welcome to TaskMentor
                </h2>
                <p className="mt-3 text-gray-600 dark:text-gray-400">
                  Student Practical Work Management System
                </p>
              </div>

              {/* SSO Login Button */}
              <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
                  <div className="flex items-start space-x-3">
                    <svg
                      className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Sign in with your <strong>NGA Central MIS</strong> account
                      to access TaskMentor.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSSOLogin}
                  className="w-full flex items-center justify-center space-x-3 py-4 px-6 border border-transparent text-base font-semibold rounded-full text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-500/30 shadow-lg shadow-blue-500/30 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <img
                    src="/taskmentor/nga-logo.png"
                    alt="NGA"
                    className="h-6 w-6 object-contain"
                  />
                  <span>Sign in with NGA MIS</span>
                  <svg
                    className="h-5 w-5 ml-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="bg-gray-50/80 dark:bg-gray-800/50 p-4 md:p-6 text-center border-t border-gray-100 dark:border-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Don't have an account or need password help? Visit{" "}
                <a
                  href="https://nga-central-mis.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  NGA Central MIS
                </a>
                .
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
