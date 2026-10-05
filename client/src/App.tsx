import { Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AuthGuard from "./components/Auth/AuthGuard";
import ProtectedRoute from "./components/Auth/ProtectedRoute";
import Layout from "./components/Layout/Layout";
import Login from "./components/Auth/Login";
import Callback from "./components/Auth/Callback";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import { appRoutes } from "./routes/routeConfig";
import { lazyPage } from "./routes/lazyPage";
import { useTheme } from "./contexts/ThemeContext";
import { ActivityRouterTracker } from "./vendor/nga-activity/react";
import GpuWarmupIndicator from "./components/Proctoring/GpuWarmupIndicator";

// Public TMCode download page (no sign-in needed).
const TmcodeDownloadPage = lazyPage(() => import("./pages/TmcodeDownloadPage"));

/** While a page's code downloads (first visit only). Inside the layout, so the menus stay. */
function PageLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600 dark:border-blue-900/40 dark:border-t-blue-500" />
    </div>
  );
}

function AppContent() {
  const { theme } = useTheme();

  return (
    <ErrorBoundary>
      <Router basename={import.meta.env.BASE_URL}>
        {/* Usage analytics: one page view per route change, public and protected routes alike. */}
        <ActivityRouterTracker />
        <div className="min-h-screen bg-gray-100 dark:bg-black text-text-primary-light dark:text-text-primary-dark">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<AuthGuard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/sso/callback" element={<Callback />} />
            <Route
              path="/tmcode"
              element={
                <Suspense fallback={<PageLoading />}>
                  <TmcodeDownloadPage />
                </Suspense>
              }
            />

            {/* Protected routes — driven by routeConfig.tsx, the single
                source of truth also consumed by the sidebar to build its
                permission-filtered menu (see components/Layout/Sidebar.tsx). */}
            {appRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <ProtectedRoute permissions={route.permissions}>
                    {route.noLayout ? (
                      <Suspense fallback={<PageLoading />}>{route.element}</Suspense>
                    ) : (
                      <Layout fullWidth={route.fullWidth} noPadding={route.noPadding}>
                        <Suspense fallback={<PageLoading />}>{route.element}</Suspense>
                      </Layout>
                    )}
                  </ProtectedRoute>
                }
              />
            ))}

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          {/* While the first camera detection prepares the graphics card. */}
          <GpuWarmupIndicator />
          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme={theme}
          />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

function App() {
  return <AppContent />;
}

export default App;
