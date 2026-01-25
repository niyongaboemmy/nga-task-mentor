import axios from "axios";
import type { AxiosRequestConfig, AxiosResponse } from "axios";

// Configure axios base URL for backend API
const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";
const API_BASE_URL = BASE.endsWith("/api") ? BASE : `${BASE}/api`;

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

// Create a dedicated instance
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 10000,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Inject token from localStorage for all requests
    // Only if an Authorization header is not already explicitly provided (like for OTP)
    const token = localStorage.getItem("token");
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const misToken = localStorage.getItem("misToken");
    if (misToken) {
      config.headers["x-mis-token"] = misToken;
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
          }`,
        );
        return pendingRequests.get(requestKey)!.promise;
      }

      // Create new promise for this request
      const promise = api(config);
      pendingRequests.set(requestKey, {
        promise,
        timestamp: Date.now(),
      });

      // Clean up after request completes
      promise.finally(() => {
        pendingRequests.delete(requestKey);
      });

      return promise;
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
      console.warn("Session expired or unauthorized. Redirecting to login.");
      // Cookies will be cleared by server or expire. Relogin needed.
      const loginPath = (import.meta.env.BASE_URL + "/login").replace(
        /\/+/g,
        "/",
      );
      if (!window.location.pathname.includes(loginPath)) {
        window.location.href = loginPath;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
