import { Request } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";

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

/**
 * Fetch the current academic term ID from MIS or local token
 * @param req Express request object
 * @returns The current academic term ID or null if not found
 */
export const getCurrentTermId = async (
  req: Request,
): Promise<number | null> => {
  // 1. Check if termId is already in the decoded local user
  if ((req as any).user && (req as any).user.termId) {
    return (req as any).user.termId;
  }

  // 2. Decode MIS token to find term ID
  const token = getMisToken(req);
  if (token) {
    try {
      const decoded: any = jwt.decode(token);
      if (decoded && decoded.currentAcademicTerms) {
        console.log("🔓 Decoded MIS Token Payload (Partial):", {
          currentAcademicTerms: decoded.currentAcademicTerms,
        });

        const terms = decoded.currentAcademicTerms;
        if (terms && Array.isArray(terms)) {
          if (terms.length === 0) {
            return 4; // When no terms avaialable return term 4
          }
          const activeTerm = terms.find(
            (t: any) =>
              Number(t.is_current) === 1 ||
              Number(t.status) === 1 ||
              t.status === "ACTIVE",
          );
          if (activeTerm) {
            console.log(
              "✅ Found Active Term in MIS Token:",
              activeTerm.academic_term_id,
            );
            return activeTerm.academic_term_id;
          }
          if (terms.length > 0) {
            console.log(
              "⚠️ No active term explicitly marked, using first term from MIS Token:",
              terms[0].academic_term_id,
            );
            return terms[0].academic_term_id;
          }
        }
      }
    } catch (err) {
      console.error("Error decoding MIS token:", err);
    }
  }

  // 3. Fallback to MIS API (only if decoding failed or no info found)
  console.log("⚠️ Term ID not found in MIS token, fetching from MIS API...");

  try {
    if (!token) return null;

    // Only fetch necessary fields if possible to reduce payload, but /users/me is standard
    const response = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/users/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        // Enforce HTTPS in production
        httpsAgent:
          process.env.NODE_ENV === "production"
            ? new (require("https").Agent)({ rejectUnauthorized: true })
            : undefined,
      },
    );

    const terms = response.data.data.currentAcademicTerms;
    // Find the term that is marked as current (is_current === 1)
    if (terms && Array.isArray(terms)) {
      const activeTerm = terms.find(
        (t: any) =>
          t.is_current === 1 || t.status === 1 || t.status === "ACTIVE",
      );
      if (activeTerm) return activeTerm.academic_term_id;
      if (terms.length > 0) return terms[0].academic_term_id; // Fallback to first if none strictly match status
    }

    return null;
  } catch (error) {
    console.error("Error fetching current term:", error);
    return null;
  }
};
