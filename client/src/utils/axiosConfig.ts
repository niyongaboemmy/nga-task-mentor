import axios, { isAxiosError } from "axios";
import type { AxiosResponse } from "axios";

export { isAxiosError };

// Configure axios base URL for backend API
const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";
const API_BASE_URL = BASE.endsWith("/api") ? BASE : `${BASE}/api`;

// Create a dedicated instance
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 30000, // Increased to 30 seconds
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Inject token from localStorage for all requests
    // Only if an Authorization header is not already explicitly provided (like for OTP)
    const token = localStorage.getItem("tm_auth_token");
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const misToken = localStorage.getItem("misToken");
    if (misToken) {
      config.headers["x-mis-token"] = misToken;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    // Handle 401 Unauthorized errors (Token expired)
    if (error.response?.status === 401) {
      // Don't redirect if it's just the initial auth check
      if (
        error.config &&
        error.config.url &&
        error.config.url.includes("/auth/me")
      ) {
        return Promise.reject(error);
      }

      // Don't redirect during SSO flow
      const currentPath = window.location.pathname;
      const isSsoFlow =
        currentPath.includes("callback") ||
        currentPath.includes("sso") ||
        currentPath === "/login";

      if (!isSsoFlow) {
        console.warn("Session expired or unauthorized. Redirecting to login.");
        // Clear tokens to prevent redirect loops if the login page checks for existing items
        localStorage.removeItem("tm_auth_token");
        localStorage.removeItem("misToken");

        // Cookies will be cleared by server or expire. Relogin needed.
        const loginPath = (import.meta.env.BASE_URL + "/login").replace(
          /\/+/g,
          "/",
        );
        if (!window.location.pathname.includes(loginPath)) {
          window.location.href = loginPath;
        }
      } else {
        console.log("ℹ️ 401 error during SSO flow - not redirecting");
      }
    }

    return Promise.reject(error);
  },
);

export default api;
