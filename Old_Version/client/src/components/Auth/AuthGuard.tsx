import React, { useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import HomePage from "../HomePage";

const AuthGuard: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    // Show loading state while checking authentication
    if (loading) {
      return;
    }

    // If user is authenticated, redirect to dashboard
    if (isAuthenticated) {
      window.location.href = "/dashboard";
      return;
    }
  }, [isAuthenticated, loading]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show homepage if not authenticated
  return <HomePage />;
};

export default AuthGuard;
