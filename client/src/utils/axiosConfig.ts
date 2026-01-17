import axios from "axios";
import type { AxiosRequestConfig, AxiosResponse } from "axios";

// Configure axios base URL for backend API
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.withCredentials = true; // Send cookies with requests
axios.defaults.timeout = 10000; // 10 second timeout

// Debug flag to disable deduplication for testing
const DEBUG_DISABLE_DEDUPLICATION = true;

// Request deduplication cache
interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

const pendingRequests = new Map<string, PendingRequest>();
const REQUEST_TIMEOUT = 2000; // 2 seconds

// Generate unique key for request
const generateRequestKey = (config: AxiosRequestConfig): string => {
  const { method, url, params, data } = config;
  return `${method?.toLowerCase()}-${url}-${JSON.stringify(
    params,
  )}-${JSON.stringify(data)}`;
};

// Clean up old requests from cache
const cleanupPendingRequests = (): void => {
  const now = Date.now();
  for (const [key, request] of pendingRequests.entries()) {
    if (now - request.timestamp > REQUEST_TIMEOUT) {
      pendingRequests.delete(key);
    }
  }
};

// Request interceptor
axios.interceptors.request.use(
  (config) => {
    // Add MIS token for local API requests
    // REFACTOR: Cookies are now used. Remove explicit header injection.

    // Clean up old requests periodically
    cleanupPendingRequests();

    // Only deduplicate GET requests to avoid issues with POST/PUT/DELETE
    if (
      config.method?.toLowerCase() === "get" &&
      !DEBUG_DISABLE_DEDUPLICATION
    ) {
      const requestKey = generateRequestKey(config);

      if (pendingRequests.has(requestKey)) {
        console.log(
          `🔄 Deduplicating GET request: ${config.method?.toUpperCase()} ${
            config.url
          }`,
        );
        console.log(`🔄 Pending requests count: ${pendingRequests.size}`);
        return pendingRequests.get(requestKey)!.promise;
      }

      // Create new promise for this request
      console.log(
        `🚀 Making new GET request: ${config.method?.toUpperCase()} ${
          config.url
        }`,
      );
      console.log(`🔄 Pending requests count: ${pendingRequests.size}`);

      const promise = axios(config);
      pendingRequests.set(requestKey, {
        promise,
        timestamp: Date.now(),
      });

      // Clean up after request completes
      promise.finally(() => {
        pendingRequests.delete(requestKey);
        console.log(
          `🧹 Cleaned up request: ${config.method?.toUpperCase()} ${config.url}`,
        );
      });

      return promise;
    }

    // For non-GET requests or when deduplication is disabled, make direct request
    if (config.method?.toLowerCase() === "get" && DEBUG_DISABLE_DEDUPLICATION) {
      console.log(
        `🚀 [DEBUG] Making GET request (deduplication disabled): ${config.method?.toUpperCase()} ${
          config.url
        }`,
      );
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor
axios.interceptors.response.use(
  (response: AxiosResponse) => {
    /* console.log(
      `✅ Response: ${response.config.method?.toUpperCase()} ${
        response.config.url
      } - ${response.status}`
    ); */
    return response;
  },
  async (error) => {
    /* console.log(
      `❌ Response error: ${error.config?.method?.toUpperCase()} ${
        error.config?.url
      } - ${error.response?.status || "Network Error"}`
    ); */

    // Handle 401 Unauthorized errors (Token expired)
    if (error.response?.status === 401) {
      console.warn("Session expired or unauthorized. Redirecting to login.");

      // Clear tokens and redirect to login
      // localStorage.removeItem("token");
      // localStorage.removeItem("misToken");
      // delete axios.defaults.headers.common["Authorization"];

      // Cookies will be cleared by server or expire. Relogin needed.
      // Prevent redirect loop if already on login page
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

export default axios;
