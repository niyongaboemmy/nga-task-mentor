import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import api from "../utils/axiosConfig";
import { useDispatch } from "react-redux";
import { useTheme } from "./ThemeContext";
import { loginSuccess, logout } from "../store/slices/authSlice";
import type {
  UserFullData,
  Role as CentralRole,
  UserResponse,
} from "../types/user.types";
import { switchAcademicPeriod as switchAcademicPeriodApi } from "../services/authService";
import { emitAcademicPeriodChanged } from "../utils/academicPeriodEvents";

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
  gender?: string;
  date_of_birth?: string | null;
  address?: string | null;
  external_id?: string | null;
  assigned_programs?: any[];
  assigned_grades?: any[];
  currentAcademicYear?: any;
  currentAcademicTerm?: any;
  systems?: any[];
  preferred_theme?: "light" | "dark";
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  sessionExpired: boolean;
  logoutUser: () => void;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  updateProfileImage: (imageUrl: string) => Promise<void>;
  removeProfileImage: () => Promise<void>;
  checkAuth: () => Promise<void>;
  loginWithSSOData: (callbackResponse: any) => void;
  /** Bumped every time the viewed academic year/term changes -- use as a
   * remount `key` on data-driven containers so they refetch automatically. */
  academicPeriodVersion: number;
  switchAcademicPeriod: (
    academicYearId: number,
    academicTermId: number,
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
  const [sessionExpired, setSessionExpired] = useState(false);
  const [academicPeriodVersion, setAcademicPeriodVersion] = useState(0);
  // useRef instead of useState so reads are always synchronous (no stale closure race)
  const isAuthInitializing = useRef(false);
  const dispatch = useDispatch();
  const { setTheme } = useTheme();

  const initializeAuth = useCallback(
    async (options?: { manual?: boolean }) => {
      if (isAuthInitializing.current) {
        return;
      }

      const currentPath = window.location.pathname;
      const baseUrl = import.meta.env.BASE_URL || "";
      const fullCallbackPath = (baseUrl + "/sso/callback").replace(/\/+/g, "/");
      const isAutomaticCheck = !options?.manual;

      // Skip automatic auth check on SSO callback page — Callback.tsx manages its own state
      if (
        isAutomaticCheck &&
        (currentPath.includes("callback") ||
          currentPath === fullCallbackPath)
      ) {
        console.log(
          "ℹ️ AuthContext: Skipping automatic auth check on SSO callback page",
        );
        setLoading(false);
        return;
      }

      isAuthInitializing.current = true;

      // Small delay to ensure cookies are properly committed after SSO callback
      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        console.log("🔍 Checking authentication status...");
        const response = await apiAxios.get("/auth/me");
        console.log("✅ Auth check successful, user data received");

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
          user_type:
            responseData.profile?.user_type || responseData.user?.role,
          mis_user_id:
            responseData.user?.mis_user_id || responseData.user?.user_id,
          preferred_theme: responseData.user?.preferred_theme,
          systems: responseData.systems,
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
        console.log("🎉 User authenticated successfully:", userData.email);

        if (userData.preferred_theme) {
          setTheme(userData.preferred_theme);
        }

        if ((responseData as any).misToken) {
          localStorage.setItem("misToken", (responseData as any).misToken);
        }

        const loginPath = (import.meta.env.BASE_URL + "/login").replace(
          /\/+/g,
          "/",
        );
        const dashboardPath = (
          import.meta.env.BASE_URL + "/dashboard"
        ).replace(/\/+/g, "/");

        if (
          currentPath === loginPath ||
          currentPath === "/login" ||
          currentPath.includes("callback") ||
          currentPath.includes("sso")
        ) {
          console.log(
            "🔄 AuthContext: Redirecting authenticated user to dashboard",
          );
          window.location.href = dashboardPath;
        }
      } catch (error: any) {
        if (error.response?.status === 401) {
          console.log("ℹ️ AuthContext: User not authenticated (guest)");

          const isSsoRelated =
            currentPath.includes("callback") ||
            currentPath.includes("sso") ||
            currentPath === "/login";

          if (!isSsoRelated) {
            // Had a token but it's no longer valid — session expired
            if (localStorage.getItem("tm_auth_token")) {
              setSessionExpired(true);
            }
            localStorage.removeItem("tm_auth_token");
            localStorage.removeItem("misToken");
          }
        } else {
          console.error("❌ AuthContext: Auth check failed", error);
        }
      } finally {
        isAuthInitializing.current = false;
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Stable reference — safe to put in useEffect dependency arrays
  const checkAuth = useCallback(async () => {
    console.log("🔄 Manually checking authentication status...");
    isAuthInitializing.current = false; // reset so initializeAuth proceeds
    await initializeAuth({ manual: true });
    console.log("✅ Authentication check completed");
  }, [initializeAuth]);

  /**
   * Set auth state directly from SSO callback response data.
   * Avoids an extra /auth/me → MIS /users/me round-trip after SSO.
   */
  const loginWithSSOData = useCallback(
    (callbackResponse: any) => {
      const {
        user: localUser,
        profile: misProfile,
        roles,
        permissions,
        assignedPrograms,
        assignedGrades,
        currentAcademicYear,
        currentAcademicTerms,
        systems,
        misToken,
      } = callbackResponse;

      const preferred_theme =
        localUser?.preferred_theme ||
        callbackResponse.preferred_theme ||
        null;

      const userData: User = {
        id: (localUser?.id || "").toString(),
        first_name:
          localUser?.first_name || misProfile?.first_name || "",
        last_name:
          localUser?.last_name || misProfile?.last_name || "",
        email: localUser?.email || "",
        role: localUser?.role || "student",
        roles: (roles || []).map((r: any) => ({
          id: r.role_id ?? r.id,
          name: r.name,
        })),
        permissions: permissions || [],
        profile_image: localUser?.profile_image,
        user_type: misProfile?.user_type || localUser?.role,
        mis_user_id: localUser?.mis_user_id,
        preferred_theme: preferred_theme,
        systems: systems || [],
        gender: misProfile?.gender,
        date_of_birth: misProfile?.date_of_birth,
        address: misProfile?.address,
        external_id: misProfile?.external_id,
        assigned_programs: assignedPrograms || [],
        assigned_grades: assignedGrades || [],
        currentAcademicYear: currentAcademicYear || null,
        currentAcademicTerm:
          (currentAcademicTerms || []).find(
            (t: any) => t.is_current === 1,
          ) || (currentAcademicTerms || [])[0] || null,
      };

      setUser(userData);
      dispatch(loginSuccess(userData));
      setSessionExpired(false);
      setLoading(false);

      if (preferred_theme) {
        setTheme(preferred_theme as "light" | "dark");
      }

      if (misToken) {
        localStorage.setItem("misToken", misToken);
      }

      console.log("🎉 SSO user state set directly:", userData.email);
    },
    [dispatch, setTheme],
  );

  const updateProfile = async (userData: Partial<User>) => {
    try {
      const response = await apiAxios.put("/auth/updatedetails", userData);
      const responseData = response.data.data;
      const updatedUser = {
        ...user!,
        id: responseData.id.toString(),
        first_name: responseData.first_name,
        last_name: responseData.last_name,
        email: responseData.email,
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
      if (user) {
        dispatch(loginSuccess({ ...user, profile_image: undefined }));
      }
    } catch (error) {
      console.error("Profile image removal failed:", error);
      throw error;
    }
  };

  const switchAcademicPeriod = async (
    academicYearId: number,
    academicTermId: number,
  ) => {
    const result = await switchAcademicPeriodApi(academicYearId, academicTermId);

    localStorage.setItem("tm_auth_token", result.token);

    setUser((prevUser) => {
      if (!prevUser) return prevUser;
      const updated = {
        ...prevUser,
        currentAcademicYear: result.academicYear,
        currentAcademicTerm: result.academicTerm,
      };
      dispatch(loginSuccess(updated));
      return updated;
    });

    // Bumping this remounts anything keyed off it (see Layout's main
    // container), which is the simplest reliable way to make every page's
    // data-fetching effects re-run against the newly selected term without
    // having to individually wire each page up to this context.
    setAcademicPeriodVersion((v) => v + 1);

    // Remounting only resets state *inside* that subtree -- caches that live
    // in providers mounted above Layout (CourseCacheContext,
    // SchemeOfWorkContext) or in module scope (Assignments' list cache) need
    // an explicit signal instead.
    emitAcademicPeriodChanged();
  };

  const logoutUser = async () => {
    console.log("Logging out user...");
    try {
      await apiAxios.post("/auth/logout");
    } catch (err) {
      console.error("Logout failed", err);
    }
    localStorage.removeItem("tm_auth_token");
    localStorage.removeItem("misToken");
    // Clear any lingering SSO session keys so a fresh login always works
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("sso_code_processed_")) sessionStorage.removeItem(key);
    }
    setUser(null);
    setSessionExpired(false);
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
    sessionExpired,
    logoutUser,
    updateProfile,
    updateProfileImage,
    removeProfileImage,
    checkAuth,
    loginWithSSOData,
    academicPeriodVersion,
    switchAcademicPeriod,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};
