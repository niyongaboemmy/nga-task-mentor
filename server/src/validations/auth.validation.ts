import { body } from "express-validator";

export const loginSchema = [
  body("email")
    .isEmail()
    .withMessage("Please include a valid email")
    .normalizeEmail(),
  body("password").exists().withMessage("Password is required"),
];

export const forgotPasswordSchema = [
  body("email")
    .isEmail()
    .withMessage("Please include a valid email")
    .normalizeEmail(),
];

export const resetPasswordSchema = [
  body("token").notEmpty().withMessage("Reset token is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
];
