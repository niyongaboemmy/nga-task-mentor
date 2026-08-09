import api from "../utils/axiosConfig";
import type { AcademicYear, AcademicTerm } from "../types/user.types";

/**
 * Interface for SSO Authorization Result
 */
export interface SSOAuthResult {
  success: boolean;
  data?: {
    code: string;
    state?: string;
  };
  message?: string;
}

/**
 * Proxy function to authorize a system via MIS SSO.
 * This calls our backend which then proxies to MIS.
 */
export const authorizeSSO = async (
  clientId: string,
  redirectUri: string,
  responseType: string = "code",
  state?: string,
): Promise<{ code: string; state?: string } | null> => {
  try {
    const response = await api.get("/auth/sso/authorize", {
      params: {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: responseType,
        state: state,
      },
    });

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    return null;
  } catch (error) {
    console.error("SSO Authorization failed:", error);
    throw error;
  }
};

/**
 * Update user theme preference in MIS.
 */
export const updateThemePreference = async (
  theme: "light" | "dark",
): Promise<boolean> => {
  try {
    const response = await api.patch("/auth/theme", { theme });
    return response.data.success;
  } catch (error) {
    console.error("Failed to update theme preference:", error);
    return false;
  }
};

/**
 * Fetch all academic years from MIS (for the academic period switcher).
 */
export const getAcademicYears = async (): Promise<AcademicYear[]> => {
  const response = await api.get("/academics/years");
  return response.data?.data || [];
};

/**
 * Fetch academic terms from MIS, optionally scoped to one academic year.
 */
export const getAcademicTerms = async (
  academicYearId?: number,
): Promise<AcademicTerm[]> => {
  const response = await api.get("/academics/terms", {
    params: academicYearId ? { academic_year_id: academicYearId } : {},
  });
  return response.data?.data || [];
};

export interface SwitchAcademicPeriodResult {
  token: string;
  academicYear: AcademicYear;
  academicTerm: AcademicTerm;
}

/**
 * Switch the academic year/term the session is currently scoped to.
 * Re-issues the local auth token so every subsequent request across the app
 * transparently resolves to the newly selected term server-side.
 */
export const switchAcademicPeriod = async (
  academicYearId: number,
  academicTermId: number,
): Promise<SwitchAcademicPeriodResult> => {
  const response = await api.post("/auth/switch-academic-period", {
    academic_year_id: academicYearId,
    academic_term_id: academicTermId,
  });
  return response.data;
};
