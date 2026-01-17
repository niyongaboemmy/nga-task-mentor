import { Router } from "express";
import {
  login,
  register,
  refreshToken,
  forgotPassword,
  resetPassword,
  getMe,
  uploadProfileImage,
  deleteProfileImage,
  updateProfileDetails,
  updatePassword,
} from "../controllers/auth.controller";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validations/auth.validation";
import { validate } from "../middleware/validate";
import { protect } from "../middleware/auth";
import { handleMulterError } from "../middleware/upload";

const router = Router();

// Authentication routes
router.get("/me", protect, getMe);
router.post("/login", validate(loginSchema), login);
router.post("/register", validate(registerSchema), register);
router.post("/refresh-token", refreshToken);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

// Profile management routes
router.put("/updatedetails", protect, updateProfileDetails);
router.put("/updatepassword", protect, updatePassword);
router.post("/upload-profile-image", protect, handleMulterError, uploadProfileImage);
router.delete("/delete-profile-image", protect, deleteProfileImage);

export default router;
