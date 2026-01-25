import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../utils/axiosConfig";
import { useDispatch } from "react-redux";
import { loginSuccess, logout } from "../store/slices/authSlice";
import type {
  UserFullData,
  Role as CentralRole,
  UserResponse,
} from "../types/user.types";

// Use the pre-configured api instance
const apiAxios = api;

export type UserProfileData = UserFullData;
export type UserProfileResponse = UserResponse;

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  roles: Array<{ id: number; name: string }>;
  permissions: string[];
  profile_image?: string;
  department?: string;
  user_type?: string;
  mis_user_id?: number;
  // New fields
  gender?: string;
  date_of_birth?: string | null;
  address?: string | null;
  external_id?: string | null;
  assigned_programs?: any[];
  assigned_grades?: any[];
  currentAcademicYear?: any;
  currentAcademicTerm?: any;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  logoutUser: () => void;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  updateProfileImage: (imageUrl: string) => Promise<void>;
  removeProfileImage: () => Promise<void>;
  checkAuth: () => Promise<void>;
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

  // Move initializeAuth to be accessible by other methods
  const initializeAuth = async () => {
    // ... logic remains same ...
    // Prevent multiple simultaneous auth checks
    if (isAuthInitializing) {
      return;
    }

    setIsAuthInitializing(true);

    try {
      console.log(
        "🔄 AuthContext: Making auth check request to local /auth/me",
      );

      // Cookies are automatically sent withCredentials: true
      const response = await apiAxios.get("/auth/me");

      console.log("✅ AuthContext: Auth check successful:", response.data);

      const responseData: UserFullData = response.data.data;
      const userData: User = {
        id: (
          responseData.user?.id ||
          responseData.user?.user_id ||
          ""
        ).toString(),
        first_name:
          responseData.user?.first_name ||
          responseData.profile?.first_name ||
          "",
        last_name:
          responseData.user?.last_name || responseData.profile?.last_name || "",
        email: responseData.user?.email || "",
        role: responseData.user?.role || "student",
        roles: (responseData.roles || []).map((r: CentralRole) => ({
          id: r.role_id,
          name: r.name,
        })),
        permissions: responseData.permissions || [],
        profile_image: responseData.user?.profile_image,
        department: undefined,
        user_type: responseData.profile?.user_type || responseData.user?.role,
        mis_user_id:
          responseData.user?.mis_user_id || responseData.user?.user_id,
        // Map new fields
        gender: responseData.profile?.gender,
        date_of_birth: responseData.profile?.date_of_birth,
        address: responseData.profile?.address,
        external_id: responseData.profile?.external_id,
        assigned_programs: responseData.assignedPrograms,
        assigned_grades: responseData.assignedGrades,
        currentAcademicYear: (responseData as any).currentAcademicYear,
        currentAcademicTerm:
          (responseData as any).currentAcademicTerms?.find(
            (t: any) => t.is_current === 1,
          ) || (responseData as any).currentAcademicTerms?.[0],
      };

      setUser(userData);
      dispatch(loginSuccess(userData));

      // Persist misToken if returned
      if ((responseData as any).misToken) {
        localStorage.setItem("misToken", (responseData as any).misToken);
      }

      const currentPath = window.location.pathname;
      const loginPath = (import.meta.env.BASE_URL + "/login").replace(
        /\/+/g,
        "/",
      );
      const dashboardPath = (import.meta.env.BASE_URL + "/dashboard").replace(
        /\/+/g,
        "/",
      );
      if (currentPath === loginPath || currentPath === "/login") {
        window.location.href = dashboardPath;
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log("ℹ️ AuthContext: User not authenticated (guest)");
      } else {
        console.error("❌ AuthContext: Auth check failed", error);
      }
    } finally {
      setIsAuthInitializing(false);
      setLoading(false);
    }
  };

  // Check auth on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  const checkAuth = async () => {
    setIsAuthInitializing(false); // Reset to ensure it runs
    await initializeAuth();
  };

  // Login is now handled via SSO redirect in Login.tsx and Callback.tsx

  const updateProfile = async (userData: Partial<User>) => {
    try {
      console.log("Updating profile for user:", userData);
      // Use local proxy instead of direct MIS call
      const response = await apiAxios.put("/auth/updatedetails", userData);
      const responseData = response.data.data;

      // Update local state with returned data
      const updatedUser = {
        ...user!, // preserve existing fields
        id: responseData.id.toString(),
        first_name: responseData.first_name,
        last_name: responseData.last_name,
        email: responseData.email,
        // Update other fields as returned by profile update response
      };

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
        prevUser ? { ...prevUser, profile_image: imageUrl } : null,
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
        prevUser ? { ...prevUser, profile_image: undefined } : null,
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

  const logoutUser = async () => {
    console.log("Logging out user...");
    try {
      await apiAxios.post("/auth/logout");
    } catch (err) {
      console.error("Logout failed", err);
    }
    localStorage.removeItem("nga_auth_token");
    localStorage.removeItem("misToken");
    setUser(null);
    dispatch(logout());
    window.location.href = (import.meta.env.BASE_URL + "/login").replace(
      /\/+/g,
      "/",
    );
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    loading,
    logoutUser,
    updateProfile,
    updateProfileImage,
    removeProfileImage,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
