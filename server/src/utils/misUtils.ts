import { Request } from "express";

/**
 * Extract MIS token from request headers
 * @param req Express request object
 * @returns The MIS token string or empty string if not found
 */
export const getMisToken = (req: Request): string => {
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
