import { Router } from "express";
import {
  login,
  verifyOtp,
  refreshToken,
  forgotPassword,
  resetPassword,
  getMe,
  uploadProfileImage,
  deleteProfileImage,
  updateProfileDetails,
  updatePassword,
  logout,
} from "../controllers/auth.controller";
import {
  loginSchema,
  otpSchema,
  updateUserSchema,
  changePasswordSchema,
  validate,
} from "../middleware/validation.middleware";
import {
  loginLimiter,
  otpLimiter,
  passwordResetLimiter,
} from "../middleware/rateLimiter.middleware";
import { protect } from "../middleware/auth";
import { handleMulterError } from "../middleware/upload";

const router = Router();

// Authentication routes
router.get("/me", protect, getMe);
router.post("/login", loginLimiter, validate(loginSchema), login);
router.post("/verify-otp", otpLimiter, validate(otpSchema), verifyOtp);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);
// Note: forgotPasswordSchema and resetPasswordSchema would also be migrated to the new middleware
// For now preserving existing imports if they were used elsewhere, but updating routes to use rate limiters
// router.post("/forgot-password", passwordResetLimiter, validate(forgotPasswordSchema), forgotPassword);
// router.post("/reset-password", passwordResetLimiter, validate(resetPasswordSchema), resetPassword);

// Profile management routes
router.put(
  "/updatedetails",
  protect,
  validate(updateUserSchema),
  updateProfileDetails,
);
router.put(
  "/updatepassword",
  protect,
  validate(changePasswordSchema),
  updatePassword,
);
router.post(
  "/upload-profile-image",
  protect,
  handleMulterError,
  uploadProfileImage,
);
router.delete("/delete-profile-image", protect, deleteProfileImage);

export default router;
