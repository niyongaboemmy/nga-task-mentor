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

function AppContent() {
  return (
    <ErrorBoundary>
      <Router basename="/">
        <div className="min-h-screen bg-gray-100 dark:bg-black text-text-primary-light dark:text-text-primary-dark">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<AuthGuard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/sso/callback" element={<Callback />} />

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
                      route.element
                    ) : (
                      <Layout fullWidth={route.fullWidth}>{route.element}</Layout>
                    )}
                  </ProtectedRoute>
                }
              />
            ))}

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
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
            theme="light"
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
