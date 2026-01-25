import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { motion } from "framer-motion";
import api from "../../utils/axiosConfig";

const Callback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { checkAuth } = useAuth(); // Assuming there's a way to refresh auth state

  const callbackCalled = React.useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");

      if (!code) {
        setError("Authorization code is missing from URL");
        return;
      }

      if (callbackCalled.current) return;
      callbackCalled.current = true;

      try {
        // Send code to backend to exchange for token
        const response = await api.post("/auth/sso/callback", { code });

        if (response.data.success) {
          // Clear any stale local storage tokens to prevent conflicts
          localStorage.removeItem("nga_auth_token");

          // Re-validate auth state to update Context
          await checkAuth();
          navigate("/dashboard", { replace: true });
        } else {
          setError(response.data.message || "SSO authentication failed");
          callbackCalled.current = false; // Allow retry on failure
        }
      } catch (err: any) {
        console.error("SSO Callback Error:", err);
        setError(
          err.response?.data?.message ||
            "Failed to complete SSO authentication",
        );
        callbackCalled.current = false; // Allow retry on failure
      }
    };

    handleCallback();
  }, [searchParams, navigate, checkAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center space-y-6"
      >
        <div className="flex flex-col items-center">
          <img
            src="/taskmentor/nga-logo.png"
            alt="NGA Logo"
            className="h-20 w-auto mb-6"
          />

          {!error ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Completing your sign-in...
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                Please wait while we establish your secure session.
              </p>
            </>
          ) : (
            <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl border border-red-100 dark:border-red-800">
              <div className="text-red-600 dark:text-red-400 text-6xl mb-4">
                ⚠️
              </div>
              <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">
                Authentication Failed
              </h2>
              <p className="text-red-600/80 dark:text-red-400/80 mb-6">
                {error}
              </p>
              <button
                onClick={() => navigate("/login")}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
              >
                Return to Login
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Callback;
