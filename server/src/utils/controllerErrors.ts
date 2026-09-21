import { Response } from "express";
import {
  ValidationError,
  UniqueConstraintError,
  ForeignKeyConstraintError,
  DatabaseError,
} from "sequelize";

export interface FieldError {
  field: string;
  message: string;
}

/**
 * Translate an error thrown inside a controller into a meaningful HTTP
 * response instead of a blanket 500 "Server error".
 *
 *  - Sequelize model validation (min/max/len/notEmpty…) → 400 + field errors
 *  - Unique constraint                                   → 409
 *  - Foreign key constraint                              → 400
 *  - MySQL data errors (bad ENUM value, data too long…)  → 400
 *  - Axios/upstream (MIS) errors                         → upstream status (502 if none)
 *  - Anything else                                       → 500, but with the
 *    real message outside production and always an `errorId` that is also
 *    written to the server log so support can correlate reports.
 */
export const sendControllerError = (
  res: Response,
  error: any,
  context: string,
) => {
  const errorId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  // UniqueConstraintError extends ValidationError — check it first.
  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({
      success: false,
      message: "A record with the same unique value already exists",
      errors: error.errors.map((e) => ({
        field: e.path || "unknown",
        message: e.message,
      })),
    });
  }

  if (error instanceof ValidationError) {
    const errors: FieldError[] = error.errors.map((e) => ({
      field: e.path || "unknown",
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      message: `Validation failed: ${errors.map((e) => e.message).join("; ")}`,
      errors,
    });
  }

  if (error instanceof ForeignKeyConstraintError) {
    return res.status(400).json({
      success: false,
      message: `Referenced record does not exist (${
        Array.isArray(error.fields)
          ? error.fields.join(", ")
          : error.fields || error.index || "foreign key"
      })`,
    });
  }

  if (error instanceof DatabaseError) {
    const code = (error.original as any)?.code as string | undefined;
    const dataErrorCodes = new Set([
      "WARN_DATA_TRUNCATED", // bad ENUM value
      "ER_DATA_TOO_LONG",
      "ER_TRUNCATED_WRONG_VALUE",
      "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD",
      "ER_BAD_NULL_ERROR",
      "ER_WARN_DATA_OUT_OF_RANGE",
    ]);
    if (code && dataErrorCodes.has(code)) {
      console.error(`[${context}] database data error ${errorId}:`, error.message);
      return res.status(400).json({
        success: false,
        message: `Invalid data for one or more fields: ${(error.original as any)?.sqlMessage || error.message}`,
        errorId,
      });
    }
  }

  // Upstream HTTP (axios) error, e.g. the MIS API.
  if (error?.isAxiosError || error?.response?.status) {
    const status = error.response?.status;
    console.error(`[${context}] upstream error ${errorId}:`, status, error.message);
    return res.status(status && status >= 400 && status < 600 ? status : 502).json({
      success: false,
      message:
        error.response?.data?.message ||
        `Upstream service error while ${context}`,
      errorId,
    });
  }

  console.error(`[${context}] unexpected error ${errorId}:`, error);
  const isProd = process.env.NODE_ENV === "production";
  return res.status(500).json({
    success: false,
    message: isProd
      ? `Something went wrong while ${context}. Please try again or contact support with error ID ${errorId}.`
      : `${context}: ${error?.message || "Unknown error"}`,
    errorId,
    ...(isProd ? {} : { detail: error?.stack }),
  });
};
