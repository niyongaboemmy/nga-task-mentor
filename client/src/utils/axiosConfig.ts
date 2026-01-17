import axios from "axios";
import type { AxiosRequestConfig, AxiosResponse } from "axios";

// Configure axios base URL for backend API
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";
axios.defaults.baseURL = API_BASE_URL;
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
    params
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
    if (
      config.baseURL?.includes("localhost:5001") ||
      config.baseURL?.includes("/api")
    ) {
      const misToken = localStorage.getItem("misToken");
      if (misToken) {
        config.headers["x-mis-token"] = `Bearer ${misToken}`;
      }
    }

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
          }`
        );
        console.log(`🔄 Pending requests count: ${pendingRequests.size}`);
        return pendingRequests.get(requestKey)!.promise;
      }

      // Create new promise for this request
      console.log(
        `🚀 Making new GET request: ${config.method?.toUpperCase()} ${
          config.url
        }`
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
          `🧹 Cleaned up request: ${config.method?.toUpperCase()} ${config.url}`
        );
      });

      return promise;
    }

    // For non-GET requests or when deduplication is disabled, make direct request
    if (config.method?.toLowerCase() === "get" && DEBUG_DISABLE_DEDUPLICATION) {
      console.log(
        `🚀 [DEBUG] Making GET request (deduplication disabled): ${config.method?.toUpperCase()} ${
          config.url
        }`
      );
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
axios.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(
      `✅ Response: ${response.config.method?.toUpperCase()} ${
        response.config.url
      } - ${response.status}`
    );
    console.log(`📦 Response data:`, response.data);
    return response;
  },
  (error) => {
    console.log(
      `❌ Response error: ${error.config?.method?.toUpperCase()} ${
        error.config?.url
      } - ${error.response?.status || "Network Error"}`
    );
    console.log(`❌ Error details:`, error);

    // Handle common error cases
    if (error.response?.status === 401) {
      // Only logout for auth endpoints, not for general API errors
      const isAuthEndpoint =
        error.config?.url?.includes("/auth/") ||
        error.config?.url?.includes("/login") ||
        error.config?.url?.includes("/verify-otp");

      if (isAuthEndpoint) {
        // Handle unauthorized access for auth endpoints
        localStorage.removeItem("token");
        localStorage.removeItem("misToken");
        delete axios.defaults.headers.common["Authorization"];
        window.location.href = "/login";
      }
      // For other 401s, let the component handle the error
    }
    return Promise.reject(error);
  }
);

export default axios;
