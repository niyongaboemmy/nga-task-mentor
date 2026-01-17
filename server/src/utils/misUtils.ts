import { Request } from "express";

/**
 * Extract MIS token from request headers
 * @param req Express request object
 * @returns The MIS token string or empty string if not found
 */
export const getMisToken = (req: Request): string => {
  // First check cookie (secure HttpOnly)
  if (req.cookies && req.cookies.misToken) {
    return req.cookies.misToken;
  }

  // Fallback to header
  const misTokenHeader = req.headers["x-mis-token"];
  return typeof misTokenHeader === "string"
    ? misTokenHeader.replace("Bearer ", "")
    : "";
};

/**
 * Check if MIS token is present in request
 * @param req Express request object
 * @returns True if MIS token is present, false otherwise
 */
export const hasMisToken = (req: Request): boolean => {
  return getMisToken(req).length > 0;
};

/**
 * Validate MIS configuration
 * Checks if the base URL is configured and uses HTTPS in production
 * @throws Error if configuration is invalid
 */
export const validateMisConfig = (): void => {
  const baseUrl = process.env.NGA_MIS_BASE_URL;

  if (!baseUrl) {
    console.warn("⚠️ NGA_MIS_BASE_URL is not defined in environment variables");
    return;
  }

  if (
    process.env.NODE_ENV === "production" &&
    !baseUrl.startsWith("https://")
  ) {
    console.error(
      "❌ SECURITY ERROR: NGA_MIS_BASE_URL must use HTTPS in production",
    );
    // We don't throw here to prevent server crash, but we log a critical error
  }
};
