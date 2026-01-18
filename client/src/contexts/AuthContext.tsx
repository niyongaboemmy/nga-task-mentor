import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "../utils/axiosConfig";
import { useDispatch } from "react-redux";
import { loginSuccess, logout } from "../store/slices/authSlice";
import type {
  UserFullData,
  Role as CentralRole,
  UserResponse,
} from "../types/user.types";

// Local API axios instance
const apiAxios = axios.create({
  baseURL: "http://localhost:5001/api",
  timeout: 10000,
});

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
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (
    email: string,
    password: string,
    otp?: string,
  ) => Promise<{ needsOtp?: boolean } | void>;
  logoutUser: () => void;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  updateProfileImage: (imageUrl: string) => Promise<void>;
  removeProfileImage: () => Promise<void>;
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
  const [tempToken, setTempToken] = useState<string | null>(null);
  const dispatch = useDispatch();

  // Check auth on mount
  useEffect(() => {
    const initializeAuth = async () => {
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
            responseData.user?.last_name ||
            responseData.profile?.last_name ||
            "",
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
        };

        setUser(userData);
        dispatch(loginSuccess(response.data.data));

        const currentPath = window.location.pathname;
        if (currentPath === "/login") {
          window.location.href = "/dashboard";
        }
      } catch (error) {
        console.error(
          "❌ AuthContext: Auth check failed (Not authenticated)",
          error,
        );
        // No need to clear localStorage as we don't use it.
        // Cookies handle session directly.
      } finally {
        setIsAuthInitializing(false);
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (
    email: string,
    password: string,
    otp?: string,
  ): Promise<{ needsOtp?: boolean } | void> => {
    try {
      if (otp) {
        // Verify OTP via local backend
        console.log("Verifying OTP for:", email);
        const response = await apiAxios.post(
          "/auth/verify-otp",
          { otp },
          {
            headers: { Authorization: `Bearer ${tempToken}` },
          },
        );
        // Cookies are set by server automatically
        const data: UserFullData = response.data;
        const userData: User = {
          id: (data.user?.id || data.user?.user_id || "").toString(),
          first_name: data.user?.first_name || data.profile?.first_name || "",
          last_name: data.user?.last_name || data.profile?.last_name || "",
          email: data.user?.email || "",
          role: data.user?.role || "student",
          roles: (data.roles || []).map((r: CentralRole) => ({
            id: r.role_id,
            name: r.name,
          })),
          permissions: data.permissions || [],
          profile_image: data.user?.profile_image,
          department: undefined,
          user_type: data.profile?.user_type || data.user?.role,
          mis_user_id: data.user?.mis_user_id || data.user?.user_id,
          // Map new fields
          gender: data.profile?.gender,
          date_of_birth: data.profile?.date_of_birth,
          address: data.profile?.address,
          external_id: data.profile?.external_id,
          assigned_programs: data.assignedPrograms,
          assigned_grades: data.assignedGrades,
        };

        setUser(userData);
        dispatch(loginSuccess(userData));
        setTempToken(null);

        window.location.href = "/dashboard";
      } else {
        // Initial login via local backend
        console.log("Attempting login for:", email);
        const response = await apiAxios.post<{
          success: boolean;
          tempToken: string;
          requiresOTP: boolean;
        }>("/auth/login", {
          email,
          password,
        });
        const tempTokenValue = response.data.tempToken;

        setTempToken(tempTokenValue);
        return { needsOtp: response.data.requiresOTP };
      }
    } catch (error) {
      console.error("Login failed:", error);
      setTempToken(null);
      throw error;
    }
  };

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
    setUser(null);
    dispatch(logout());
    window.location.href = "/login";
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    logoutUser,
    updateProfile,
    updateProfileImage,
    removeProfileImage,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
