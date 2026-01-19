import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Sequelize, Op } from "sequelize";
import { User } from "../models/User.model";
import fs from "fs";
import path from "path";
import { uploadProfilePicture } from "../middleware/upload";
import axios from "axios";
import { getMisToken } from "../utils/misUtils";

// User login - forwards to NGA Central MIS
// Security: Protected by rate limiter and input validation at route level (see routes/auth.routes.ts)
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Additional input validation is now handled by validation middleware
    // but we keep this check as a failsafe
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Please provide an email and password" });
    }

    // Forward login request to NGA Central MIS
    const misResponse = await axios.post(
      `${process.env.NGA_MIS_BASE_URL}/auth/login`,
      {
        username: email,
        password: password,
      },
      {
        // Enforce HTTPS for MIS calls in production (configure via ENV)
        httpsAgent:
          process.env.NODE_ENV === "production"
            ? new (require("https").Agent)({ rejectUnauthorized: true })
            : undefined,
      },
    );

    const { data } = misResponse.data;

    // Return the MIS response to frontend with tempToken in cookie if needed,
    // but usually tempToken is short lived. MIS returns it in body.
    // We can just return it in body as before.
    // Return the MIS response to frontend with tempToken in cookie if needed,
    // but usually tempToken is short lived. MIS returns it in body.
    // We can just return it in body as before.
    res.status(200).json({
      success: true,
      tempToken: data.tempToken,
      requiresOTP: data.requiresOTP,
    });
  } catch (error: any) {
    if (process.env.NODE_ENV === "development") {
      console.error("Login error:", error.response?.data || error.message);
    }
    const status = error.response?.status || 500;
    // Sanitize error message using validation middleware utility if available, otherwise generic
    const message =
      process.env.NODE_ENV === "production"
        ? "Authentication failed"
        : error.response?.data?.message || "Server error during login";
    res.status(status).json({ message });
  }
};

// OTP Verification - forwards to NGA Central MIS
export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { otp } = req.body;
    const tempToken = req.headers.authorization?.replace("Bearer ", "");

    if (!otp || !tempToken) {
      return res
        .status(400)
        .json({ message: "OTP and temp token are required" });
    }

    // Forward OTP verification to NGA Central MIS
    const misResponse = await axios.post<{
      success: boolean;
      message: string;
      data: {
        token: string;
        user: {
          user_id: number;
          username: string;
          email: string;
          phone_number: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        profile: {
          profile_id: number;
          user_id: number;
          first_name: string;
          last_name: string;
          gender: string;
          date_of_birth: string | null;
          address: string | null;
          user_type: string;
          external_id: string | null;
        };
        permissions: string[];
        assignedPrograms: any[];
        assignedGrades: any[];
        roles: {
          role_id: number;
          name: string;
          description: string;
        }[];
        forcePasswordChange: boolean;
        currentAcademicYear: any;
        currentAcademicTerms: any[];
      };
    }>(
      `${process.env.NGA_MIS_BASE_URL}/auth/verify-otp`,
      {
        otp,
      },
      {
        headers: {
          Authorization: tempToken, // Pass tempToken directly without Bearer prefix
        },
        // Enforce HTTPS in production
        httpsAgent:
          process.env.NODE_ENV === "production"
            ? new (require("https").Agent)({ rejectUnauthorized: true })
            : undefined,
      },
    );

    const { data } = misResponse.data;
    const {
      token,
      user: misUser,
      profile: misProfile,
      permissions,
      assignedPrograms,
      assignedGrades,
      forcePasswordChange,
      roles,
      currentAcademicYear,
      currentAcademicTerms,
    } = data;

    console.log({ dataToTest: data.roles });

    // Function to map MIS roles to local roles
    const mapMisRoleToLocal = (
      misRoles: {
        role_id: number;
        name: string;
        description: string;
      }[],
    ): "student" | "instructor" | "admin" => {
      console.log("🔍 Mapping MIS roles:", JSON.stringify(misRoles, null, 2));

      if (!misRoles || !Array.isArray(misRoles) || misRoles.length === 0) {
        console.log("❌ No roles provided, defaulting to student");
        return "student";
      }

      // Check each role individually
      for (const role of misRoles) {
        console.log(
          `🔍 Checking role: id=${role.role_id}, name="${role.name}"`,
        );

        // Admin check
        if (
          role.role_id === 1 || // SUPER_ADMIN
          role.role_id === 2 ||
          role.role_id === 3 ||
          role.role_id === 12 || // PROGRAM_MANAGER
          (role.name &&
            (role.name.toLowerCase().includes("admin") ||
              role.name.toLowerCase().includes("super") ||
              role.name.toLowerCase().includes("manager")))
        ) {
          console.log("✅ Mapped to admin role");
          return "admin";
        }

        // Instructor check
        if (
          role.role_id === 4 || // TEACHER
          role.role_id === 11 || // CLASS_TEACHER
          (role.name &&
            (role.name.toLowerCase().includes("teacher") ||
              role.name.toLowerCase().includes("instructor")))
        ) {
          console.log("✅ Mapped to instructor role");
          return "instructor";
        }

        // Student check
        if (
          role.role_id === 6 || // STUDENT
          (role.name && role.name.toLowerCase().includes("student"))
        ) {
          console.log("✅ Mapped to student role");
          return "student";
        }
      }

      console.log("❌ No matching role found, defaulting to student");
      return "student";
    };

    const mappedRole = mapMisRoleToLocal(roles);
    console.log("🎯 Final mapped role:", mappedRole);

    // Sync user with local database
    let localUser = await User.findOne({
      where: { mis_user_id: misUser.user_id },
    });

    if (!localUser) {
      // Create new user if doesn't exist
      console.log("👤 Creating new user with role:", mappedRole);
      localUser = await User.create({
        first_name: misProfile.first_name,
        last_name: misProfile.last_name,
        email: misUser.email,
        password: "MIS_AUTH", // Placeholder password since auth is handled by MIS
        role: mappedRole,
        mis_user_id: misUser.user_id,
      });
      console.log("✅ Created user with role:", localUser.role);
    } else {
      // Update existing user info
      console.log(
        "🔄 Updating existing user. Current role:",
        localUser.role,
        "New role:",
        mappedRole,
      );
      localUser.first_name = misProfile.first_name;
      localUser.last_name = misProfile.last_name;
      localUser.email = misUser.email;
      localUser.role = mappedRole;
      await localUser.save();
      console.log("✅ Updated user role to:", localUser.role);
    }

    // Find active term ID
    let activeTermId: number | undefined;
    if (currentAcademicTerms && Array.isArray(currentAcademicTerms)) {
      const activeTerm = currentAcademicTerms.find(
        (t: any) =>
          t.is_current === 1 || t.status === 1 || t.status === "ACTIVE",
      );
      if (activeTerm) activeTermId = activeTerm.academic_term_id;
      else if (currentAcademicTerms.length > 0)
        activeTermId = currentAcademicTerms[0].academic_term_id;
    }

    // Generate local JWT token
    console.log("🎟️ Generating token with Active Term ID:", activeTermId);
    const localToken = localUser.getSignedJwtToken(activeTermId);

    // Set cookies
    const cookieOptions = {
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
    };

    res.cookie("token", localToken, cookieOptions);
    res.cookie("misToken", token, cookieOptions);

    // Return user data (no tokens in body needed really, but keeping for compatibility if needed)
    res.status(200).json({
      success: true,
      token: localToken, // Optional: remove if full cookie auth
      misToken: token, // Optional: remove if full cookie auth
      user: {
        id: localUser.id,
        first_name: localUser.first_name,
        last_name: localUser.last_name,
        email: localUser.email,
        role: localUser.role,
        mis_user_id: localUser.mis_user_id,
        profile_image: localUser.profile_image,
      },
      profile: misProfile,
      roles, // Include the raw roles from NGA MIS
      permissions,
      assignedPrograms,
      assignedGrades,
      forcePasswordChange,
      currentAcademicYear,
      currentAcademicTerms,
    });
  } catch (error: any) {
    console.error(
      "OTP verification error:",
      error.response?.data || error.message,
    );
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message || "Server error during OTP verification";
    res.status(status).json({ message });
  }
};

// Refresh token
export const refreshToken = async (req: Request, res: Response) => {
  // Logic simplified: just rely on cookies.
  // If we need a dedicated refresh flow, we would check a long-lived refresh cookie.
  // For now, assume session cookie logic.
  // If client specifically calls this, we might want to extend cookie life?

  // Implementation of actual refresh token with rotation is complex.
  // For now, we can just validate the existing token and issue a new one if valid.
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
      termId?: number;
    };
    const user = await User.findByPk(decoded.id);
    if (!user) return res.status(401).json({ message: "Invalid token" });

    // Preserve termId from previous token
    console.log("🔄 Refreshing token, preserving Term ID:", decoded.termId);
    const newToken = user.getSignedJwtToken(decoded.termId);

    const cookieOptions = {
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };

    res.cookie("token", newToken, cookieOptions);

    res.status(200).json({ success: true, token: newToken });
  } catch (error) {
    res.status(401).json({ message: "Invalid refresh token" });
  }
};

// Logout
export const logout = async (req: Request, res: Response) => {
  res.cookie("token", "none", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.cookie("misToken", "none", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    data: {},
  });
};

// Forgot password
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "No user found with that email" });
    }

    // Generate reset token
    const resetToken = user.getResetPasswordToken();
    await user.save();

    // TODO: Send email with reset token
    console.log("Reset token:", resetToken);

    res.status(200).json({ success: true, data: "Email sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error during password reset" });
  }
};

// Reset password
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { resetToken, newPassword } = req.body;

    // Get hashed token
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const user = await User.findOne({
      where: {
        reset_password_token: resetPasswordToken,
        reset_password_expire: { [Op.gt]: Date.now() },
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Set new password
    user.password = newPassword;
    user.reset_password_token = null;
    user.reset_password_expire = null;
    await user.save();

    res
      .status(200)
      .json({ success: true, data: "Password updated successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Server error during password reset" });
  }
};

// Get current user - embeds MIS /users/me data
export const getMe = async (req: Request, res: Response) => {
  try {
    // User is attached by protect middleware
    // We need to fetch full user to ensure we have all fields including mis_user_id
    const startUser = (req as any).user;

    if (!startUser) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const user = await User.findByPk(startUser.id, {
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get MIS token (checks cookie then header)
    const misToken = getMisToken(req);

    if (!misToken) {
      // Fallback: return local data if no MIS token
      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role,
            mis_user_id: user.mis_user_id,
            profile_image: user.profile_image,
          },
          profile: null,
          roles: [],
          permissions: [],
          assignedPrograms: [],
          assignedGrades: [],
          forcePasswordChange: false,
        },
      });
    }

    try {
      // Call MIS /users/me to get complete user profile
      const misResponse = await axios.get(
        `${process.env.NGA_MIS_BASE_URL}/users/me`,
        {
          headers: {
            Authorization: `Bearer ${misToken}`,
          },
          // Enforce HTTPS in production
          httpsAgent:
            process.env.NODE_ENV === "production"
              ? new (require("https").Agent)({ rejectUnauthorized: true })
              : undefined,
        },
      );

      const misData = misResponse.data.data;

      // Return combined local and MIS data
      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role,
            mis_user_id: user.mis_user_id,
            profile_image: user.profile_image,
          },
          profile: misData.profile,
          roles: misData.roles,
          permissions: misData.permissions,
          assignedPrograms: misData.assignedPrograms,
          assignedGrades: misData.assignedGrades,
          forcePasswordChange: misData.forcePasswordChange,
          currentAcademicYear: misData.currentAcademicYear,
          currentAcademicTerms: misData.currentAcademicTerms,
        },
      });
    } catch (misError) {
      console.error("MIS API error:", misError);
      // Fallback to local data if MIS call fails
      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role,
            mis_user_id: user.mis_user_id,
            profile_image: user.profile_image,
          },
          profile: null,
          roles: [],
          permissions: [],
          assignedPrograms: [],
          assignedGrades: [],
          forcePasswordChange: false,
        },
      });
    }
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Upload profile picture
export const uploadProfileImage = async (req: Request, res: Response) => {
  try {
    // Use multer middleware to handle file upload
    uploadProfilePicture.single("profileImage")(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || "File upload failed",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select an image file",
        });
      }

      const userId = (req as any).user.id;
      const user = await User.findByPk(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Delete old profile image if it exists
      if (user.profile_image) {
        const oldImagePath = path.join(
          process.cwd(),
          "uploads",
          "profile-pictures",
          user.profile_image,
        );
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // Update user profile image filename
      user.profile_image = req.file.filename;
      await user.save();

      res.status(200).json({
        success: true,
        data: {
          profile_image: req.file.filename,
        },
        message: "Profile picture uploaded successfully",
      });
    });
  } catch (error) {
    console.error("Profile picture upload error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during profile picture upload",
    });
  }
};

// Delete profile picture
export const deleteProfileImage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.profile_image) {
      return res.status(400).json({
        success: false,
        message: "No profile picture to delete",
      });
    }

    // Delete file from filesystem
    const imagePath = path.join(
      process.cwd(),
      "uploads",
      "profile-pictures",
      user.profile_image,
    );
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Update user record
    user.profile_image = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile picture deleted successfully",
    });
  } catch (error) {
    console.error("Profile picture delete error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during profile picture deletion",
    });
  }
};

// Update profile details (Proxies to MIS)
export const updateProfileDetails = async (req: Request, res: Response) => {
  try {
    const { first_name, last_name, email } = req.body;
    const userId = (req as any).user.id;
    const misToken = getMisToken(req);

    // 1. Update in MIS first (Source of Truth)
    if (misToken) {
      try {
        await axios.put(
          `${process.env.NGA_MIS_BASE_URL}/users/me/profile`,
          { first_name, last_name, email }, // Adjust payload based on MIS API requirements
          {
            headers: { Authorization: `Bearer ${misToken}` },
            httpsAgent:
              process.env.NODE_ENV === "production"
                ? new (require("https").Agent)({ rejectUnauthorized: true })
                : undefined,
          },
        );
      } catch (misError) {
        console.error("MIS Profile Update Error:", misError);
        // If MIS fails, should we fail local? Yes, to keep sync.
        return res
          .status(500)
          .json({ message: "Failed to update profile in MIS" });
      }
    }

    // 2. Update local DB
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (first_name) user.first_name = first_name;
    if (last_name) user.last_name = last_name;
    if (email) user.email = email;

    await user.save();

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        profile_image: user.profile_image,
      },
    });
  } catch (error) {
    console.error("Update profile details error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during profile update",
    });
  }
};

// Update password (Proxies to MIS)
export const updatePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = (req as any).user.id;
    const misToken = getMisToken(req);

    // 1. Update in MIS
    let newMisToken = misToken;
    if (misToken) {
      try {
        const response = await axios.post(
          `${process.env.NGA_MIS_BASE_URL}/auth/change-password`,
          { currentPassword, newPassword, confirmPassword: newPassword },
          {
            headers: { Authorization: `Bearer ${misToken}` },
            httpsAgent:
              process.env.NODE_ENV === "production"
                ? new (require("https").Agent)({ rejectUnauthorized: true })
                : undefined,
          },
        );
        // MIS might return a new token? If so, we should update the cookie.
        if (response.data.token) {
          newMisToken = response.data.token;
        }
      } catch (misError) {
        console.error("MIS Password Update Error:", misError);
        return res
          .status(401)
          .json({ message: "Failed to update password in MIS" });
      }
    }

    // 2. Update local DB
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check current password (local check redundant if MIS passed, but good for safety)
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = newPassword;
    await user.save();

    // Generate new local token
    const token = user.getSignedJwtToken();

    // Update Cookies
    const cookieOptions = {
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
    };
    res.cookie("token", token, cookieOptions);
    if (newMisToken !== misToken) {
      res.cookie("misToken", newMisToken, cookieOptions);
    }

    res.status(200).json({
      success: true,
      token,
      data: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        profile_image: user.profile_image,
      },
    });
  } catch (error) {
    console.error("Update password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during password update",
    });
  }
};
