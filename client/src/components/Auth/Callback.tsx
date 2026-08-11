import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../utils/axiosConfig";

type Stage = "processing" | "retrying" | "success" | "error";

const DASHBOARD_PATH = (import.meta.env.BASE_URL + "/dashboard").replace(
  /\/+/g,
  "/",
);
const LOGIN_PATH = (import.meta.env.BASE_URL + "/login").replace(/\/+/g, "/");

const Callback: React.FC = () => {
  const [stage, setStage] = useState<Stage>("processing");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorKind, setErrorKind] = useState<
    "expired" | "network" | "server" | "missing" | "credentials"
  >("server");
  const [retryCount, setRetryCount] = useState(0);
  const [welcomeName, setWelcomeName] = useState<string>("");
  const navigate = useNavigate();
  const { loginWithSSOData, isAuthenticated } = useAuth();
  const maxRetries = 2;

  // Capture code from URL before React clears it
  const initialCode = useRef(new URLSearchParams(window.location.search).get("code"));

  useEffect(() => {
    // Already authenticated (e.g. user navigated back to this URL) → go to dashboard silently
    if (isAuthenticated) {
      navigate(DASHBOARD_PATH, { replace: true });
      return;
    }

    const code = initialCode.current;

    if (!code) {
      setErrorKind("missing");
      setErrorMessage(
        "No authorization code was found. This link may have already been used or has expired.",
      );
      setStage("error");
      return;
    }

    // sessionStorage guard — persists across React Strict Mode remounts (unlike useRef)
    const sessionKey = `sso_code_processed_${code}`;
    if (sessionStorage.getItem(sessionKey)) {
      console.log("⚠️ SSO code already processed, skipping duplicate execution");
      // First execution is still running (or succeeded) — stay in processing state
      return;
    }
    sessionStorage.setItem(sessionKey, "1");

    // Remove code from URL immediately so back-button / refresh can't replay it
    window.history.replaceState({}, document.title, window.location.pathname);

    let cancelled = false;

    const exchange = async (attempt: number = 1): Promise<void> => {
      try {
        console.log(`🔐 SSO: exchanging code (attempt ${attempt})`);
        const response = await api.post("/auth/sso/callback", { code });

        if (cancelled) return;

        if (response.data.success && response.data.token) {
          // Persist tokens for header-based auth fallback
          localStorage.setItem("tm_auth_token", response.data.token);
          if (response.data.misToken) {
            localStorage.setItem("misToken", response.data.misToken);
          }

          // Build welcome name from response data
          const name =
            response.data.user?.first_name ||
            response.data.profile?.first_name ||
            "";
          setWelcomeName(name);

          // Update auth state directly — no extra /auth/me round-trip
          loginWithSSOData(response.data);

          setStage("success");

          // Brief success screen, then navigate
          setTimeout(() => {
            if (!cancelled) navigate(DASHBOARD_PATH, { replace: true });
          }, 1200);
        } else {
          const msg = response.data.message || "Authentication failed";
          const isExpired =
            msg.toLowerCase().includes("expir") ||
            msg.toLowerCase().includes("used") ||
            (msg.toLowerCase().includes("invalid") && msg.toLowerCase().includes("code"));
          const isCredentials = msg.toLowerCase().includes("credential") || msg.toLowerCase().includes("client");
          setErrorKind(isExpired ? "expired" : isCredentials ? "credentials" : "server");
          setErrorMessage(msg);
          setStage("error");
          sessionStorage.removeItem(sessionKey);
        }
      } catch (err: any) {
        if (cancelled) return;

        const isTimeout =
          err.code === "ECONNABORTED" || err.message?.includes("timeout");
        const isNetwork =
          err.code === "ENOTFOUND" || err.code === "ECONNREFUSED";
        const serverMsg = err.response?.data?.message;
        const isExpiredCode =
          serverMsg &&
          (serverMsg.toLowerCase().includes("expir") ||
            serverMsg.toLowerCase().includes("used") ||
            (serverMsg.toLowerCase().includes("invalid") && serverMsg.toLowerCase().includes("code")));
        const isCredentialError =
          serverMsg &&
          (serverMsg.toLowerCase().includes("credential") || serverMsg.toLowerCase().includes("client"));

        const canRetry = (isTimeout || isNetwork) && attempt <= maxRetries;

        if (canRetry) {
          const delay = Math.pow(2, attempt) * 1000;
          setRetryCount(attempt);
          setStage("retrying");
          console.log(`🔄 Retrying in ${delay}ms (attempt ${attempt})`);
          await new Promise((r) => setTimeout(r, delay));
          if (!cancelled) {
            setStage("processing");
            await exchange(attempt + 1);
          }
          return;
        }

        let message = "Failed to complete sign-in. Please try again.";
        let kind: typeof errorKind = "server";

        if (isExpiredCode) {
          kind = "expired";
          message = serverMsg;
        } else if (isCredentialError) {
          kind = "credentials";
          message = serverMsg;
        } else if (isTimeout) {
          kind = "network";
          message =
            "The authentication server took too long to respond. Please try again.";
        } else if (isNetwork) {
          kind = "network";
          message =
            "Could not reach the authentication service. Check your connection and try again.";
        } else if (serverMsg) {
          message = serverMsg;
        }

        setErrorKind(kind);
        setErrorMessage(message);
        setStage("error");
      }
    };

    exchange();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-blue-50 to-white dark:from-gray-950 dark:via-gray-950 dark:to-gray-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full"
      >
        <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-800 overflow-hidden p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img
              src="/nga-logo.png"
              alt="NGA Logo"
              className="h-16 w-auto object-contain drop-shadow"
            />
          </div>

          <AnimatePresence mode="wait">
            {/* Processing */}
            {(stage === "processing" || stage === "retrying") && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center space-y-4"
              >
                {/* Animated ring */}
                <div className="flex justify-center">
                  <div className="relative h-16 w-16">
                    <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-blue-900" />
                    <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {stage === "retrying"
                      ? `Retrying… (${retryCount}/${maxRetries})`
                      : "Completing your sign-in"}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {stage === "retrying"
                      ? "Connection issue detected — retrying automatically."
                      : "Establishing your secure session with NGA MIS…"}
                  </p>
                </div>

                {/* Step indicators */}
                <div className="flex items-center justify-center gap-2 pt-2">
                  {["Verifying code", "Loading profile", "Redirecting"].map(
                    (label, i) => (
                      <React.Fragment key={label}>
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                              i === 0
                                ? "bg-blue-600 animate-pulse"
                                : "bg-gray-200 dark:bg-gray-700"
                            }`}
                          />
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            {label}
                          </span>
                        </div>
                        {i < 2 && (
                          <div className="h-px w-6 bg-gray-200 dark:bg-gray-700 mb-3" />
                        )}
                      </React.Fragment>
                    ),
                  )}
                </div>
              </motion.div>
            )}

            {/* Success */}
            {stage === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center space-y-3"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="flex justify-center"
                >
                  <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                    <svg
                      className="h-8 w-8 text-green-600 dark:text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </motion.div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {welcomeName ? `Welcome, ${welcomeName}!` : "Signed in successfully!"}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Taking you to your dashboard…
                </p>
                <div className="pt-1">
                  <div className="h-1 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-green-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 1.1, ease: "easeInOut" }}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Error */}
            {stage === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="space-y-4"
              >
                <div className="flex justify-center">
                  <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                    <svg
                      className="h-8 w-8 text-red-600 dark:text-red-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                      />
                    </svg>
                  </div>
                </div>

                <div className="text-center">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                    {errorKind === "expired"
                      ? "Sign-in link expired"
                      : errorKind === "missing"
                        ? "No sign-in code found"
                        : errorKind === "network"
                          ? "Connection problem"
                          : errorKind === "credentials"
                            ? "Authentication configuration error"
                            : "Sign-in failed"}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {errorMessage}
                  </p>
                </div>

                {/* Context-appropriate hint */}
                {errorKind === "expired" && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl p-3 text-sm text-amber-700 dark:text-amber-300">
                    Sign-in codes are single-use and expire after 5 minutes. Please start the sign-in process again.
                  </div>
                )}
                {errorKind === "credentials" && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl p-3 text-sm text-red-700 dark:text-red-300">
                    The application SSO credentials are misconfigured. Please contact your system administrator.
                  </div>
                )}
                {errorKind === "network" && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-3 text-sm text-blue-700 dark:text-blue-300">
                    This may be a temporary issue. Check your internet connection, then try signing in again.
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    onClick={() => navigate(LOGIN_PATH, { replace: true })}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-2xl font-medium transition-all duration-150 shadow-sm shadow-blue-500/20"
                  >
                    Sign in again
                  </button>
                  {errorKind === "network" && (
                    <button
                      onClick={() => window.location.reload()}
                      className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl font-medium transition-all duration-150"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer branding */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-4">
          Secured by NGA Central MIS · Single Sign-On
        </p>
      </motion.div>
    </div>
  );
};

export default Callback;
