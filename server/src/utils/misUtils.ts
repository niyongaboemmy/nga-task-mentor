import { Request, Response } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";

/**
 * Handle MIS API errors, including 401 Unauthorized by logging out the user
 * @param error The error object from axios
 * @param res Express response object
 * @param defaultMessage Optional default message for the error
 */
export const handleMisError = (
  error: any,
  res: Response,
  defaultMessage: string = "Error communicating with MIS API",
) => {
  if (error.response && error.response.status === 401) {
    console.error("🔒 MIS Token Invalid or Expired. Triggering logout.");

    // Clear the TaskMentor auth cookie
    res.cookie("tm_auth_token", "none", {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    // Clear the MIS token cookie
    res.cookie("misToken", "none", {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    return res.status(401).json({
      success: false,
      message: "Your MIS session has expired. Please login again.",
      logout: true,
    });
  }

  console.error(`${defaultMessage}:`, error.message);
  if (error.response) {
    console.error("MIS API error response:", error.response.data);
  }

  return res.status(error.response?.status || 500).json({
    success: false,
    message: error.response?.data?.message || defaultMessage,
    error: error.message,
  });
};

/**
 * Extract MIS token from request headers
 * @param req Express request object
 * @returns The MIS token string or empty string if not found
 */
export const getMisToken = (req: Request): string => {
  // First check cookie (secure HttpOnly)
  if (req.cookies && req.cookies.misToken) {
    console.log("🍪 Found MIS token in cookie");
    return req.cookies.misToken.replace(/^Bearer /i, "");
  }

  // Then check x-mis-token header
  let token = req.headers["x-mis-token"];
  if (token) {
    console.log("Header Found MIS token in x-mis-token header");
  }

  // Fallback to Authorization header if it looks like an MIS token
  if (!token && req.headers.authorization && req.headers["x-use-mis-auth"]) {
    console.log(
      "🛂 Using Authorization header as MIS token (x-use-mis-auth is set)",
    );
    token = req.headers.authorization;
  }

  if (typeof token === "string") {
    return token.replace(/^Bearer /i, "");
  }

  console.log("❓ No MIS token found in request");
  return "";
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
        if (terms && Array.isArray(terms) && terms.length > 0) {
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
          console.log(
            "⚠️ No active term explicitly marked, using first term from MIS Token:",
            terms[0].academic_term_id,
          );
          return terms[0].academic_term_id;
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

/**
 * Resolve the academic term a request should be scoped to.
 *
 * Centralizes what was previously ad-hoc per-controller `getCurrentTermId(req)`
 * calls, and additionally honors an explicit `?academicTermId=` override so
 * admin-facing "view a past academic year/term" screens can look at historical
 * data without changing the caller's session-wide current term (which lives on
 * the JWT via switchAcademicPeriod). Falls back to the current term when no
 * override is supplied.
 */
export const resolveAcademicTermId = async (
  req: Request,
): Promise<number | null> => {
  const override = (req.query.academicTermId ?? req.body?.academic_term_id) as
    | string
    | undefined;
  if (override !== undefined && override !== "") {
    const parsed = Number(override);
    if (!isNaN(parsed)) return parsed;
  }
  return getCurrentTermId(req);
};

/**
 * Fetch the current academic YEAR id from the local token, MIS token, or MIS
 * API, mirroring getCurrentTermId's 3-tier resolution exactly. Needed
 * separately from the term id because some MIS endpoints (e.g.
 * /academics/students/:id/enrolled-subjects) filter by academic_year_id, not
 * academic_term_id -- a term implies a year, but not vice versa.
 */
export const getCurrentAcademicYearId = async (
  req: Request,
): Promise<number | null> => {
  // 1. Local JWT claim, set by login/SSO/switchAcademicPeriod.
  if ((req as any).user && (req as any).user.academicYearId) {
    return (req as any).user.academicYearId;
  }

  // 2. Decode MIS token's currentAcademicYear.
  const token = getMisToken(req);
  if (token) {
    try {
      const decoded: any = jwt.decode(token);
      const yearId = decoded?.currentAcademicYear?.academic_year_id;
      if (yearId) return yearId;
    } catch (err) {
      console.error("Error decoding MIS token for academic year:", err);
    }
  }

  // 3. Live MIS API fallback.
  if (!token) return null;
  try {
    const response = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/users/me`,
      {
        headers: { Authorization: `Bearer ${token}` },
        httpsAgent:
          process.env.NODE_ENV === "production"
            ? new (require("https").Agent)({ rejectUnauthorized: true })
            : undefined,
      },
    );
    return response.data?.data?.currentAcademicYear?.academic_year_id ?? null;
  } catch (error) {
    console.error("Error fetching current academic year:", error);
    return null;
  }
};

/**
 * Resolve the academic year a request should be scoped to, honoring an
 * explicit `?academicYearId=` override the same way resolveAcademicTermId
 * does for terms.
 */
export const resolveAcademicYearId = async (
  req: Request,
): Promise<number | null> => {
  const override = (req.query.academicYearId ?? req.body?.academic_year_id) as
    | string
    | undefined;
  if (override !== undefined && override !== "") {
    const parsed = Number(override);
    if (!isNaN(parsed)) return parsed;
  }
  return getCurrentAcademicYearId(req);
};

/**
 * Resolve the human-readable "term"/"academic_year" name strings for the
 * requester's current academic period (e.g. "Term 1", "2023-2024"). These are
 * the free-text values Report Card / Manual Assessment records are keyed on
 * (see ReportCard.model.ts / ManualAssessment.model.ts), sourced from the same
 * `currentAcademicTerm.name` / `currentAcademicYear.name` the client already
 * uses to build those records (client/src/pages/ReportCardBuilderPage.tsx).
 * Returns nulls if unavailable — callers should treat that as "don't filter"
 * rather than fail, since MIS may be briefly unreachable.
 */
export const resolveCurrentAcademicPeriodNames = async (
  req: Request,
): Promise<{ term: string | null; academicYear: string | null }> => {
  const token = getMisToken(req);
  if (!token) return { term: null, academicYear: null };

  try {
    const response = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/users/me`,
      {
        headers: { Authorization: `Bearer ${token}` },
        httpsAgent:
          process.env.NODE_ENV === "production"
            ? new (require("https").Agent)({ rejectUnauthorized: true })
            : undefined,
      },
    );

    const terms = response.data?.data?.currentAcademicTerms;
    const year = response.data?.data?.currentAcademicYear;
    const activeTerm =
      Array.isArray(terms) && terms.length > 0
        ? terms.find(
            (t: any) =>
              t.is_current === 1 || t.status === 1 || t.status === "ACTIVE",
          ) ?? terms[0]
        : null;

    return {
      term: activeTerm?.name ?? null,
      academicYear: year?.name ?? null,
    };
  } catch (error) {
    console.error("Error resolving current academic period names:", error);
    return { term: null, academicYear: null };
  }
};
