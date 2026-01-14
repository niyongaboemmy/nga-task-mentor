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

// User login - forwards to NGA Central MIS
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Please provide an email and password" });
    }

    // Forward login request to NGA Central MIS
    const misResponse = await axios.post(
      "https://nga-central-mis.vercel.app/auth/login",
      {
        username: email,
        password: password,
      }
    );

    const { data } = misResponse.data;

    // Return the MIS response to frontend
    res.status(200).json({
      success: true,
      tempToken: data.tempToken,
      requiresOTP: data.requiresOTP,
    });
  } catch (error: any) {
    console.error("Login error:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message || "Server error during login";
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
    const misResponse = await axios.post(
      "https://nga-central-mis.vercel.app/auth/verify-otp",
      {
        otp,
      },
      {
        headers: {
          Authorization: `Bearer ${tempToken}`,
        },
      }
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
    } = data;

    // Function to map MIS roles to local roles
    const mapMisRoleToLocal = (
      misRoles: any[]
    ): "student" | "instructor" | "admin" => {
      if (!misRoles || !Array.isArray(misRoles)) {
        return "student"; // Default if roles not available
      }

      // Check for admin role (PROGRAM_MANAGER and other admin roles)
      if (
        misRoles.some(
          (role) =>
            role.role_id === 12 ||
            role.role_id === 1 ||
            role.role_id === 2 ||
            role.role_id === 3
        )
      ) {
        return "admin";
      }
      // Check for teacher roles (TEACHER or CLASS_TEACHER)
      if (misRoles.some((role) => role.role_id === 4 || role.role_id === 11)) {
        return "instructor";
      }
      // Check for student role
      if (misRoles.some((role) => role.role_id === 6)) {
        return "student";
      }
      // Default to student if no matching role
      return "student";
    };

    const mappedRole = mapMisRoleToLocal(roles);

    // Sync user with local database
    let localUser = await User.findOne({
      where: { mis_user_id: misUser.user_id },
    });

    if (!localUser) {
      // Create new user if doesn't exist
      localUser = await User.create({
        first_name: misProfile.first_name,
        last_name: misProfile.last_name,
        email: misUser.email,
        password: "MIS_AUTH", // Placeholder password since auth is handled by MIS
        role: mappedRole,
        mis_user_id: misUser.user_id,
      });
    } else {
      // Update existing user info
      localUser.first_name = misProfile.first_name;
      localUser.last_name = misProfile.last_name;
      localUser.email = misUser.email;
      localUser.role = mappedRole;
      await localUser.save();
    }

    // Generate local JWT token
    const localToken = localUser.getSignedJwtToken();

    // Return both local and MIS tokens, and complete user profile
    res.status(200).json({
      success: true,
      token: localToken,
      misToken: token, // MIS token for MIS API calls
      user: {
        id: localUser.id,
        first_name: localUser.first_name,
        last_name: localUser.last_name,
        email: localUser.email,
        role: localUser.role,
        mis_user_id: localUser.mis_user_id,
      },
      profile: misProfile,
      permissions,
      assignedPrograms,
      assignedGrades,
      forcePasswordChange,
    });
  } catch (error: any) {
    console.error(
      "OTP verification error:",
      error.response?.data || error.message
    );
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message || "Server error during OTP verification";
    res.status(status).json({ message });
  }
};

// Refresh token
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as {
      id: number;
    };
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    // Generate new access token
    const newToken = user.getSignedJwtToken();

    res.status(200).json({
      success: true,
      token: newToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(401).json({ message: "Invalid refresh token" });
  }
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
    // Verify local token
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res
        .status(401)
        .json({ message: "Not authorized to access this route" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        id: number;
        role: string;
      };
      const user = await User.findByPk(decoded.id, {
        attributes: { exclude: ["password"] },
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get MIS token from custom header
      const misTokenHeader = req.headers["x-mis-token"] as string;
      if (!misTokenHeader || !misTokenHeader.startsWith("Bearer ")) {
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

      const misToken = misTokenHeader.split(" ")[1];

      try {
        // Call MIS /users/me to get complete user profile
        const misResponse = await axios.get(
          "https://nga-central-mis.vercel.app/users/me",
          {
            headers: {
              Authorization: `Bearer ${misToken}`,
            },
          }
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
            },
            profile: misData.profile,
            roles: misData.roles,
            permissions: misData.permissions,
            assignedPrograms: misData.assignedPrograms,
            assignedGrades: misData.assignedGrades,
            forcePasswordChange: misData.forcePasswordChange,
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
    } catch (tokenError) {
      console.error("Token verification error:", tokenError);
      return res.status(401).json({ message: "Invalid token" });
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
          user.profile_image
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
      user.profile_image
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

// Update profile details
export const updateProfileDetails = async (req: Request, res: Response) => {
  try {
    const { first_name, last_name, email } = req.body;
    const userId = (req as any).user.id;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update user fields
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

// Update password
export const updatePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = (req as any).user.id;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Generate new token
    const token = user.getSignedJwtToken();

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
