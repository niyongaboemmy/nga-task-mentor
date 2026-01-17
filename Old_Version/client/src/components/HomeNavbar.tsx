import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import Logo from "./Logo";

const HomeNavbar = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800/60 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <Logo size="medium" />
          </div>
          <div className="flex items-center space-x-1">
            <ThemeToggle />
            {isAuthenticated && user ? (
              <>
                <div className="flex items-center space-x-3 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-full">
                  <div className="flex items-center space-x-2">
                    {user.profile_image && (
                      <img
                        src={user.profile_image}
                        alt={`${user.first_name} ${user.last_name}`}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {user.first_name} {user.last_name}
                    </span>
                  </div>
                </div>
                <NavLink
                  to="/dashboard"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200"
                >
                  Dashboard
                </NavLink>
              </>
            ) : (
              <>
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${
                      isActive
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                    }`
                  }
                >
                  Home
                </NavLink>
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    `px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${
                      isActive
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                    }`
                  }
                >
                  Sign In
                </NavLink>
                <NavLink
                  to="/register"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200"
                >
                  Get Started
                </NavLink>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default HomeNavbar;
