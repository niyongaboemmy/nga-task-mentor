import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "../utils/axiosConfig";
import { useDispatch } from "react-redux";
import { loginSuccess, logout } from "../store/slices/authSlice";

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "student" | "instructor" | "admin";
  profile_image?: string;
  department?: string;
}

interface RegisterData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role?: "student" | "instructor" | "admin";
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logoutUser: () => void;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  updateProfileImage: (imageUrl: string) => Promise<void>;
  removeProfileImage: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthInitializing, setIsAuthInitializing] = useState(false);
  const dispatch = useDispatch();

  // Set up axios defaults and check auth on mount
  useEffect(() => {
    const initializeAuth = async () => {
      // Prevent multiple simultaneous auth checks
      if (isAuthInitializing) {
        console.log(
          "🔄 AuthContext: Auth already initializing, skipping duplicate call"
        );
        return;
      }

      console.log("🔄 AuthContext: Starting auth initialization");
      setIsAuthInitializing(true);

      try {
        const token = localStorage.getItem("token");
        console.log(
          "🔄 AuthContext: Initializing auth, token from localStorage:",
          token
        );

        if (token && token.trim()) {
          try {
            const cleanToken = token.trim();
            axios.defaults.headers.common[
              "Authorization"
            ] = `Bearer ${cleanToken}`;

            console.log(
              "🔄 AuthContext: Making auth check request to /api/auth/me"
            );
            const response = await axios.get("/api/auth/me");
            console.log(
              "✅ AuthContext: Auth check successful:",
              response.data
            );

            setUser(response.data.data);
            dispatch(loginSuccess(response.data.data));

            const currentPath = window.location.pathname;
            if (currentPath === "/login" || currentPath === "/register") {
              window.location.href = "/dashboard";
            }
          } catch (error) {
            console.error("❌ AuthContext: Auth check failed:", error);
            localStorage.removeItem("token");
            delete axios.defaults.headers.common["Authorization"];
          }
        } else {
          console.log("🔄 AuthContext: No token found, user not authenticated");
        }
      } finally {
        setIsAuthInitializing(false);
        setLoading(false);
        console.log("🔄 AuthContext: Auth initialization complete");
      }
    };

    initializeAuth();
  }, []); // Removed dispatch dependency since it's stable

  const login = async (email: string, password: string) => {
    try {
      console.log("Attempting login for:", email);
      const response = await axios.post("/api/auth/login", { email, password });
      const token = response.data.token;
      const userData = response.data.data;

      localStorage.setItem("token", token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      setUser(userData);
      dispatch(loginSuccess(userData));

      window.location.href = "/dashboard";
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      console.log("Attempting registration for:", userData.email);
      const response = await axios.post("/api/auth/register", userData);
      const token = response.data.token;
      const newUser = response.data.data;

      localStorage.setItem("token", token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      setUser(newUser);
      dispatch(loginSuccess(newUser));

      window.location.href = "/dashboard";
    } catch (error) {
      console.error("Registration failed:", error);
      throw error;
    }
  };

  const updateProfile = async (userData: Partial<User>) => {
    try {
      console.log("Updating profile for user:", userData);
      const response = await axios.put("/api/auth/updatedetails", userData);
      const updatedUser = response.data.data;

      setUser(updatedUser);
      dispatch(loginSuccess(updatedUser));
    } catch (error) {
      console.error("Profile update failed:", error);
      throw error;
    }
  };

  const updateProfileImage = async (imageUrl: string) => {
    try {
      setUser((prevUser) =>
        prevUser ? { ...prevUser, profile_image: imageUrl } : null
      );
      // Also update in Redux store
      if (user) {
        dispatch(loginSuccess({ ...user, profile_image: imageUrl }));
      }
    } catch (error) {
      console.error("Profile image update failed:", error);
      throw error;
    }
  };

  const removeProfileImage = async () => {
    try {
      setUser((prevUser) =>
        prevUser ? { ...prevUser, profile_image: undefined } : null
      );
      // Also update in Redux store
      if (user) {
        dispatch(loginSuccess({ ...user, profile_image: undefined }));
      }
    } catch (error) {
      console.error("Profile image removal failed:", error);
      throw error;
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ) => {
    try {
      console.log("Changing password for user");
      const response = await axios.put("/api/auth/updatepassword", {
        currentPassword,
        newPassword,
      });
      const token = response.data.token;
      const userData = response.data.data;

      localStorage.setItem("token", token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      setUser(userData);
      dispatch(loginSuccess(userData));
    } catch (error) {
      console.error("Password change failed:", error);
      throw error;
    }
  };

  const logoutUser = () => {
    console.log("Logging out user...");
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    setUser(null);
    dispatch(logout());
    window.location.href = "/login";
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    register,
    logoutUser,
    updateProfile,
    updateProfileImage,
    removeProfileImage,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
