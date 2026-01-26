import api from "../utils/axiosConfig";

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
