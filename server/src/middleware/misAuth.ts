import { Request, Response, NextFunction } from "express";
import { getMisToken } from "../utils/misUtils";

/**
 * Middleware to ensure MIS token is present in request headers
 */
export const requireMisToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = getMisToken(req);

  if (!token) {
    return res.status(400).json({
      success: false,
      message: "MIS authentication required. Please log in again.",
    });
  }

  // Store token in request for later use
  (req as any).misToken = token;
  next();
};
