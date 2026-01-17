import { z } from "zod";
import { Request, Response, NextFunction } from "express";

// Validation schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email format").min(1, "Email is required"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password is too long"),
});

export const otpSchema = z.object({
  otp: z
    .string()
    .regex(/^\d{6}$/, "OTP must be exactly 6 digits")
    .length(6, "OTP must be exactly 6 digits"),
});

export const createUserSchema = z.object({
  email: z.string().email("Invalid email format").min(1, "Email is required"),
  first_name: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name is too long")
    .regex(/^[a-zA-Z\s'-]+$/, "First name contains invalid characters"),
  last_name: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name is too long")
    .regex(/^[a-zA-Z\s'-]+$/, "Last name contains invalid characters"),
  roleIds: z.array(z.number().int().positive()).optional().default([]),
});

export const updateUserSchema = z.object({
  first_name: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name is too long")
    .regex(/^[a-zA-Z\s'-]+$/, "First name contains invalid characters")
    .optional(),
  last_name: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name is too long")
    .regex(/^[a-zA-Z\s'-]+$/, "Last name contains invalid characters")
    .optional(),
  email: z.string().email("Invalid email format").optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(100, "Password is too long")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      ),
    confirmPassword: z.string().min(1, "Password confirmation is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// Validation middleware factory
export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Explicitly cast to any to handle TS unknown type in catch block
        const zodError = error as any;
        const errors = zodError.errors.map((err: any) => ({
          field: err.path ? err.path.join(".") : "unknown",
          message: err.message,
        }));
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors,
        });
      }
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
      });
    }
  };
};

// Sanitize error messages to prevent information disclosure
export const sanitizeError = (error: any): string => {
  // Don't expose internal error details in production
  if (process.env.NODE_ENV === "production") {
    // Return generic error messages
    if (error.response?.status === 400) {
      return error.response?.data?.message || "Invalid request";
    }
    if (error.response?.status === 401) {
      return "Authentication failed";
    }
    if (error.response?.status === 403) {
      return "Access denied";
    }
    if (error.response?.status === 404) {
      return "Resource not found";
    }
    if (error.response?.status === 409) {
      return "Resource already exists";
    }
    return "An error occurred while processing your request";
  }

  // In development, return more detailed errors
  return error.response?.data?.message || error.message || "Server error";
};
