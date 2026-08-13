import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** @deprecated Prefer `permissions` — kept working for any lagging call
   * sites during migration, to be removed once every route uses permissions. */
  roles?: string[];
  /** OR semantics: route is accessible if the user holds ANY of these. */
  permissions?: string[];
}

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white dark:from-gray-950 dark:to-gray-950">
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-blue-900" />
        <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
      </div>
      <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">Loading…</p>
    </div>
  </div>
);

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  roles,
  permissions,
}) => {
  const { isAuthenticated, loading, user } = useAuth();
  const { can } = usePermissions();

  if (loading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (permissions && !can(permissions)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
