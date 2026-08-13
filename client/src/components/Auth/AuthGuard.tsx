import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import HomePage from "../HomePage";

const AuthGuard: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white dark:from-gray-950 dark:to-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-blue-900" />
            <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
            Loading…
          </p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    const dashboardPath = (import.meta.env.BASE_URL + "/dashboard").replace(
      /\/+/g,
      "/",
    );
    return <Navigate to={dashboardPath} replace />;
  }

  return <HomePage />;
};

export default AuthGuard;
