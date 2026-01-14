import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "../utils/axiosConfig";
import { useDispatch } from "react-redux";
import { loginSuccess, logout } from "../store/slices/authSlice";

// Local API axios instance
const apiAxios = axios.create({
  baseURL: "http://localhost:5001/api",
  timeout: 10000,
});

// MIS API axios instance for profile operations
const misAxios = axios.create({
  baseURL: "https://nga-central-mis.vercel.app",
  timeout: 10000,
});

interface Role {
  role_id: number;
  name: string;
  description: string;
  status: string;
  permissions: Array<{
    perm_id: number;
    name: string;
    description: string;
    status: string;
  }>;
}

export interface UserProfileResponse {
  success: boolean;
  message: string;
  data: UserProfileData;
}

export interface UserProfileData {
  user: {
    user_id: number;
    username: string;
    email: string;
    phone_number: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
  profile: {
    profile_id: number;
    user_id: number;
    first_name: string;
    last_name: string;
    gender: string;
    date_of_birth: null | string;
    address: null | string;
    user_type: string;
    external_id: null | string;
  };
  roles: Role[];
  permissions: string[];
  assignedPrograms: any[];
  assignedGrades: any[];
  forcePasswordChange: boolean;
}

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
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (
    email: string,
    password: string,
    otp?: string
  ) => Promise<{ needsOtp?: boolean } | void>;
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
  const [tempToken, setTempToken] = useState<string | null>(null);
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
            const misToken = localStorage.getItem("misToken");
            axios.defaults.headers.common[
              "Authorization"
            ] = `Bearer ${cleanToken}`;
            apiAxios.defaults.headers.common[
              "Authorization"
            ] = `Bearer ${cleanToken}`;
            if (misToken) {
              misAxios.defaults.headers.common[
                "Authorization"
              ] = `Bearer ${misToken}`;
            }

            console.log(
              "🔄 AuthContext: Making auth check request to local /auth/me"
            );
            const storedMisToken = localStorage.getItem("misToken");
            const headers: any = {};
            if (storedMisToken) {
              headers["X-MIS-Token"] = `Bearer ${storedMisToken}`;
            }
            const response = await apiAxios.get("/auth/me", {
              headers,
            });
            console.log(
              "✅ AuthContext: Auth check successful:",
              response.data
            );

            const responseData = response.data.data;
            const userData = {
              id: responseData.user.id.toString(),
              first_name: responseData.profile.first_name,
              last_name: responseData.profile.last_name,
              email: responseData.user.email,
              role: responseData.profile.user_type,
              roles: responseData.roles.map((r: Role, i: number) => ({
                id: r.role_id,
                name: r.name,
              })),
              permissions: responseData.permissions,
              profile_image: undefined,
              department: undefined,
              user_type: responseData.profile.user_type,
            };

            setUser(userData);
            dispatch(loginSuccess(response.data.data));

            const currentPath = window.location.pathname;
            if (currentPath === "/login") {
              window.location.href = "/dashboard";
            }
          } catch (error) {
            console.error("❌ AuthContext: Auth check failed:", error);
            localStorage.removeItem("token");
            delete axios.defaults.headers.common["Authorization"];
            delete apiAxios.defaults.headers.common["Authorization"];
            delete misAxios.defaults.headers.common["Authorization"];
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

  const login = async (
    email: string,
    password: string,
    otp?: string
  ): Promise<{ needsOtp?: boolean } | void> => {
    try {
      if (otp) {
        // Verify OTP via local backend
        console.log("Verifying OTP for:", email);
        const response = await apiAxios.post<{
          success: boolean;
          token: string;
          misToken: string;
          user: {
            id: number;
            first_name: string;
            last_name: string;
            email: string;
            role: string;
            mis_user_id: number;
          };
          profile: any;
          permissions: string[];
          assignedPrograms: any[];
          assignedGrades: any[];
          forcePasswordChange: boolean;
        }>(
          "/auth/verify-otp",
          { otp },
          {
            headers: { Authorization: `Bearer ${tempToken}` },
          }
        );
        const token = response.data.token;
        const misToken = response.data.misToken;
        const userData = {
          id: response.data.user.id.toString(),
          first_name: response.data.user.first_name,
          last_name: response.data.user.last_name,
          email: response.data.user.email,
          role: response.data.user.role,
          roles: [],
          permissions: response.data.permissions,
          profile_image: undefined,
          department: undefined,
          user_type: response.data.user.role,
        };

        localStorage.setItem("token", token);
        localStorage.setItem("misToken", misToken);
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        apiAxios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        misAxios.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${misToken}`;

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
      const response = await misAxios.put("/users/me/profile", userData);
      const responseData = response.data.data;
      const updatedUser = {
        id: responseData.user.user_id.toString(),
        first_name: responseData.profile.first_name,
        last_name: responseData.profile.last_name,
        email: responseData.user.email,
        role: responseData.profile.user_type,
        roles: responseData.roles.map((r: Role, i: number) => ({
          id: r.role_id,
          name: r.name,
        })),
        permissions: responseData.permissions,
        profile_image: undefined,
        department: undefined,
        user_type: responseData.profile.user_type,
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
      const response = await misAxios.post("/auth/change-password", {
        currentPassword,
        newPassword,
        confirmPassword: newPassword,
      });
      const token = response.data.token;
      const responseData = response.data;
      const userData = {
        id: responseData.user.user_id.toString(),
        first_name: responseData.profile.first_name,
        last_name: responseData.profile.last_name,
        email: responseData.user.email,
        role: responseData.profile.user_type,
        roles: [],
        permissions: responseData.permissions,
        profile_image: undefined,
        department: undefined,
        user_type: responseData.profile.user_type,
      };

      // Since password change returns new MIS token, we need to get new local token
      // For now, we'll use the existing local token since user data hasn't changed
      localStorage.setItem("misToken", token);
      misAxios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      // Local token remains the same since local user data is unchanged

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
    localStorage.removeItem("misToken");
    delete axios.defaults.headers.common["Authorization"];
    delete apiAxios.defaults.headers.common["Authorization"];
    delete misAxios.defaults.headers.common["Authorization"];
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
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
