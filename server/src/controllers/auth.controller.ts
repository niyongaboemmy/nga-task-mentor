import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import axios from "axios";
import { getMisToken, handleMisError } from "../utils/misUtils";
import { Sequelize, Op } from "sequelize";
import { User } from "../models/User.model";
import { Role } from "../models/Role.model";
import { Permission } from "../models/Permission.model";
import { uploadProfilePicture } from "../middleware/upload";
import fileServer from "../utils/fileServer";
import { generateUniqueFilename, sanitizeKeepExtension } from "../utils/uploadFilename";

// True if the given role_id points at one of the 3 seeded system roles
// (admin/instructor/student). Used to decide whether an SSO login is
// allowed to silently re-map a user's role_id from MIS data, vs. leaving a
// manually-assigned custom role alone.
async function isSystemRoleId(roleId: number): Promise<boolean> {
  const role = await Role.findByPk(roleId);
  return role?.is_system ?? false;
}

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

// Confirm (re-verify) the current admin's password before granting access to
// the Database Management tool. Local bcrypt hashes are placeholder values
// for MIS/SSO-provisioned users, so we can't reliably check the password
// locally -- instead we reuse the exact same MIS /auth/login call login()
// makes, since a 2xx there is MIS's own confirmation the password is correct
// (we just ignore the OTP/tempToken it also returns, since password-only
// confirmation is all this step-up needs).
export const confirmDbAccess = async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    const authUser = (req as any).user;

    if (!password) {
      return res.status(400).json({ message: "Please provide a password" });
    }

    if (!authUser?.email) {
      return res.status(401).json({ message: "Not authorized" });
    }

    try {
      await axios.post(
        `${process.env.NGA_MIS_BASE_URL}/auth/login`,
        {
          username: authUser.email,
          password,
        },
        {
          httpsAgent:
            process.env.NODE_ENV === "production"
              ? new (require("https").Agent)({ rejectUnauthorized: true })
              : undefined,
        },
      );
    } catch (misError: any) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "confirmDbAccess MIS error:",
          misError.response?.data || misError.message,
        );
      }
      return res.status(401).json({ message: "Incorrect password" });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "Server error" });
    }

    const dbAccessToken = jwt.sign(
      { id: authUser.id, dbAccess: true },
      process.env.JWT_SECRET,
      { expiresIn: 1200 },
    );

    res.status(200).json({ dbAccessToken, expiresIn: 1200 });
  } catch (error) {
    console.error("Confirm DB access error:", error);
    res.status(500).json({ message: "Server error during confirmation" });
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
    const { token, user: misUser } = data;

    // MIS's /auth/verify-otp intentionally omits assignedGrades and systems
    // (only /users/me returns them — see API_DOCS.md §"POST /auth/verify-otp").
    // Fetch the full profile the same way ssoCallback() does, so a direct
    // login gets complete data on the very first response instead of only
    // after the next session refresh (GET /auth/me → /users/me).
    let misProfile = data.profile;
    let permissions = data.permissions;
    let assignedPrograms = data.assignedPrograms;
    let assignedGrades: any[] = [];
    let roles = data.roles;
    let forcePasswordChange = data.forcePasswordChange;
    let currentAcademicYear = data.currentAcademicYear;
    let currentAcademicTerms = data.currentAcademicTerms;
    let systems: any[] = [];

    try {
      const profileResponse = await axios.get(
        `${process.env.NGA_MIS_BASE_URL}/users/me`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000,
          httpsAgent:
            process.env.NODE_ENV === "production"
              ? new (require("https").Agent)({ rejectUnauthorized: true })
              : undefined,
        },
      );
      const profileData = profileResponse.data.data;
      misProfile = profileData.profile;
      roles = profileData.roles || [];
      permissions = profileData.permissions || permissions;
      assignedPrograms = profileData.assignedPrograms || [];
      assignedGrades = profileData.assignedGrades || [];
      currentAcademicYear = profileData.currentAcademicYear;
      currentAcademicTerms = profileData.currentAcademicTerms || [];
      forcePasswordChange = profileData.forcePasswordChange;
      systems = profileData.systems || [];
    } catch (profileError) {
      console.warn(
        "⚠️ Could not fetch full profile after OTP verification, using verify-otp payload",
      );
    }

    console.log({ dataToTest: roles });

    // Function to map MIS roles to local roles
    const mapMisRoleToLocal = (
      misRoles: {
        role_id: number;
        name: string;
        description: string;
      }[],
    ): "student" | "instructor" | "admin" => {
      if (!misRoles || !Array.isArray(misRoles) || misRoles.length === 0) {
        return "student";
      }

      let bestRole: "student" | "instructor" | "admin" = "student";

      for (const role of misRoles) {
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
          return "admin"; // Admin is highest, can return immediately
        }

        // Instructor check
        if (
          role.role_id === 4 || // TEACHER
          role.role_id === 11 || // CLASS_TEACHER
          (role.name &&
            (role.name.toLowerCase().includes("teacher") ||
              role.name.toLowerCase().includes("instructor")))
        ) {
          bestRole = "instructor";
        }
      }

      return bestRole;
    };

    const mappedRole = mapMisRoleToLocal(roles);
    console.log("🎯 Final mapped role:", mappedRole);

    // Keep the local RBAC role_id in sync with the deprecated `role` string
    // whenever we (re)map it from MIS — otherwise a brand-new user would get
    // role_id: null (zero permissions) and an existing user whose MIS role
    // changes would silently lose permission parity with their new role.
    const mappedRoleRecord = await Role.findOne({ where: { name: mappedRole } });

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
        role_id: mappedRoleRecord?.id ?? null,
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
      // Only follow the MIS-driven remap if the user's role_id currently
      // points at one of the 3 system roles (or is unset) — an admin who
      // manually assigned a custom local role should not be silently
      // overwritten back to a system role on the user's next login.
      if (!localUser.role_id || (await isSystemRoleId(localUser.role_id))) {
        localUser.role_id = mappedRoleRecord?.id ?? localUser.role_id;
      }
      await localUser.save();
      console.log("✅ Updated user role to:", localUser.role);
    }

    const effectiveRole = localUser.role_id
      ? await Role.findByPk(localUser.role_id, { include: [Permission] })
      : null;
    const roleId = localUser.role_id ?? null;
    const roleName = effectiveRole?.name ?? null;
    const localPermissions = (effectiveRole?.permissions ?? []).map((p) => p.key);

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
    const activeYearId: number | undefined =
      currentAcademicYear?.academic_year_id;

    // Generate local JWT token
    console.log("🎟️ Generating token with Active Term ID:", activeTermId);
    const localToken = localUser.getSignedJwtToken(activeTermId, activeYearId);

    // Set cookies
    const cookieOptions = {
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
    };

    res.cookie("tm_auth_token", localToken, cookieOptions);
    res.cookie("misToken", token, cookieOptions);

    res.status(200).json({
      success: true,
      token: localToken,
      misToken: token,
      user: {
        id: localUser.id,
        first_name: localUser.first_name,
        last_name: localUser.last_name,
        email: localUser.email,
        role: localUser.role,
        roleId,
        roleName,
        localPermissions,
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
      systems,
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

// SSO Callback - Exchanges authorization code for MIS token and establishes local session
// Follows OAuth2-style Authorization Code Flow as per SSO_CLIENT_INTEGRATION.md
export const ssoCallback = async (req: Request, res: Response) => {
  const maxRetries = 2;

  const exchangeTokenWithRetry = async (
    code: string,
    attempt: number = 1,
  ): Promise<any> => {
    try {
      console.log(
        `🔐 SSO Callback: Exchanging authorization code for token... (Attempt ${attempt})`,
      );

      // Debug: Verify credentials are loaded
      console.log("🔍 SSO Config Check:");
      console.log("  - MIS Base URL:", process.env.NGA_MIS_BASE_URL);
      console.log("  - Client ID:", process.env.SSO_CLIENT_ID);
      console.log(
        "  - Client Secret:",
        process.env.SSO_CLIENT_SECRET
          ? `${process.env.SSO_CLIENT_SECRET.substring(0, 10)}...`
          : "NOT SET",
      );
      console.log(
        "  - Code received:",
        code ? `${code.substring(0, 10)}...` : "NOT SET",
      );

      // Exchange authorization code for MIS token
      // Endpoint: POST /sso/token as per SSO_CLIENT_INTEGRATION.md
      const misResponse = await axios.post<{
        success: boolean;
        data?: {
          token: string;
          user: {
            user_id: number;
            username: string;
            email: string;
          };
          permissions: string[];
          systems?: any[];
        };
        message?: string;
      }>(
        `${process.env.NGA_MIS_BASE_URL}/sso/token`,
        {
          code,
          client_id: process.env.SSO_CLIENT_ID,
          client_secret: process.env.SSO_CLIENT_SECRET,
        },
        {
          timeout: 60000, // Increased to 60 seconds for MIS API calls
          httpsAgent:
            process.env.NODE_ENV === "production"
              ? new (require("https").Agent)({ rejectUnauthorized: true })
              : undefined,
        },
      );

      return misResponse;
    } catch (error: any) {
      console.error(
        `❌ SSO Token exchange failed (Attempt ${attempt}):`,
        error.response?.data || error.message,
      );

      // Retry on timeout or network errors
      if (
        (error.code === "ECONNABORTED" ||
          error.code === "ENOTFOUND" ||
          error.code === "ECONNREFUSED" ||
          error.message?.includes("timeout")) &&
        attempt < maxRetries
      ) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s exponential backoff
        console.log(`🔄 Retrying token exchange in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return exchangeTokenWithRetry(code, attempt + 1);
      }

      throw error;
    }
  };

  try {
    const { code } = req.body;

    if (!code) {
      return res
        .status(400)
        .json({ success: false, message: "Authorization code is required" });
    }

    // Use retry logic for token exchange
    const misResponse = await exchangeTokenWithRetry(code);

    // Check if MIS returned an error
    if (!misResponse.data.success || !misResponse.data.data) {
      console.error(
        "❌ MIS SSO token exchange failed:",
        misResponse.data.message || "Unknown error - no data returned",
      );
      return res.status(400).json({
        success: false,
        message: misResponse.data.message || "Failed to authenticate with MIS",
      });
    }

    let {
      token: misToken,
      user: misUser,
      permissions,
      systems,
    } = misResponse.data.data;

    console.log("✅ SSO Token exchange successful for user:", misUser.username);
    console.log("📝 MIS User data:", JSON.stringify(misUser));
    console.log("📝 MIS User ID:", misUser.user_id);

    // Fetch full user profile from MIS to get roles and profile data
    let misProfile: any = null;
    let roles: any[] = [];
    let assignedPrograms: any[] = [];
    let assignedGrades: any[] = [];
    let currentAcademicYear: any = null;
    let currentAcademicTerms: any[] = [];
    let preferred_theme: string | null = null;

    try {
      const profileResponse = await axios.get(
        `${process.env.NGA_MIS_BASE_URL}/users/me`,
        {
          headers: { Authorization: `Bearer ${misToken}` },
          timeout: 60000, // Increased to 60 seconds for MIS API calls
        },
      );
      const profileData = profileResponse.data.data;
      misProfile = profileData.profile;
      roles = profileData.roles || [];
      assignedPrograms = profileData.assignedPrograms || [];
      assignedGrades = profileData.assignedGrades || [];
      currentAcademicYear = profileData.currentAcademicYear;
      currentAcademicTerms = profileData.currentAcademicTerms || [];
      preferred_theme = profileData.user?.preferred_theme || null;
      if (profileData.systems) {
        systems = profileData.systems;
      }
    } catch (profileError) {
      console.warn("⚠️ Could not fetch full profile, using basic data");
    }

    // Map MIS roles to local roles (reusing existing logic)
    const mapMisRoleToLocal = (
      misRoles: { role_id: number; name: string }[],
    ): "student" | "instructor" | "admin" => {
      if (!misRoles || !Array.isArray(misRoles) || misRoles.length === 0) {
        return "student";
      }
      let bestRole: "student" | "instructor" | "admin" = "student";
      for (const role of misRoles) {
        if (
          role.role_id === 1 ||
          role.role_id === 2 ||
          role.role_id === 3 ||
          role.role_id === 12 ||
          (role.name &&
            (role.name.toLowerCase().includes("admin") ||
              role.name.toLowerCase().includes("super") ||
              role.name.toLowerCase().includes("manager")))
        ) {
          return "admin";
        }
        if (
          role.role_id === 4 ||
          role.role_id === 11 ||
          (role.name &&
            (role.name.toLowerCase().includes("teacher") ||
              role.name.toLowerCase().includes("instructor")))
        ) {
          bestRole = "instructor";
        }
      }
      return bestRole;
    };

    const mappedRole = mapMisRoleToLocal(roles);
    const mappedRoleRecord = await Role.findOne({ where: { name: mappedRole } });

    // Sync user with local database
    console.log("🔍 Looking up user by MIS user_id:", misUser.user_id);
    let localUser = await User.findOne({
      where: { mis_user_id: misUser.user_id },
    });

    // If not found by mis_user_id, try finding by email as fallback
    if (!localUser) {
      console.log(
        "🔍 User not found by mis_user_id, trying email:",
        misUser.email,
      );
      localUser = await User.findOne({
        where: { email: misUser.email },
      });

      if (localUser) {
        console.log(
          "🔍 Found user by email, updating mis_user_id:",
          localUser.id,
        );
        // Update the mis_user_id for future lookups
        localUser.mis_user_id = misUser.user_id;
        await localUser.save();
      }
    }

    console.log(
      "🔍 Database lookup result:",
      localUser
        ? `Found user ID: ${localUser.id}`
        : "User not found in database - will create new user",
    );

    if (!localUser) {
      // Create local account if it doesn't exist
      console.log("👤 Creating new local user for MIS user:", misUser.user_id);
      console.log("📝 User details:");
      console.log("  - Email:", misUser.email);
      console.log(
        "  - Name:",
        `${misProfile?.first_name || misUser.username} ${misProfile?.last_name || ""}`,
      );
      console.log("  - Role:", mappedRole);

      try {
        localUser = await User.create({
          first_name: misProfile?.first_name || misUser.username,
          last_name: misProfile?.last_name || "",
          email: misUser.email,
          password: "SSO_USER_" + crypto.randomBytes(8).toString("hex"),
          role: mappedRole,
          role_id: mappedRoleRecord?.id ?? null,
          mis_user_id: misUser.user_id,
        });

        console.log("✅ New user created successfully with ID:", localUser.id);
      } catch (createError: any) {
        console.error("❌ Error creating user:", createError);
        return res.status(500).json({
          success: false,
          message: "Failed to create user account: " + createError.message,
        });
      }
    } else {
      // Update existing user info
      console.log("🔄 Updating existing local user:", localUser.id);
      console.log("📝 Update details:");
      console.log(
        "  - Previous name:",
        `${localUser.first_name} ${localUser.last_name}`,
      );
      console.log(
        "  - New name:",
        `${misProfile?.first_name || localUser.first_name} ${misProfile?.last_name || localUser.last_name}`,
      );
      console.log("  - Previous role:", localUser.role);
      console.log("  - New role:", mappedRole);

      localUser.first_name = misProfile?.first_name || localUser.first_name;
      localUser.last_name = misProfile?.last_name || localUser.last_name;
      localUser.email = misUser.email;
      localUser.role = mappedRole;
      // See verifyOtp() for why this only follows the MIS remap when the
      // user isn't currently on a manually-assigned custom role.
      if (!localUser.role_id || (await isSystemRoleId(localUser.role_id))) {
        localUser.role_id = mappedRoleRecord?.id ?? localUser.role_id;
      }
      await localUser.save();

      console.log("✅ User updated successfully");
    }

    const effectiveRole = localUser.role_id
      ? await Role.findByPk(localUser.role_id, { include: [Permission] })
      : null;
    const roleId = localUser.role_id ?? null;
    const roleName = effectiveRole?.name ?? null;
    const localPermissions = (effectiveRole?.permissions ?? []).map((p) => p.key);

    // Find active term ID for token
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
    const activeYearId: number | undefined =
      currentAcademicYear?.academic_year_id;

    // Generate local JWT token
    const token = localUser.getSignedJwtToken(activeTermId, activeYearId);

    // Set cookies
    const cookieOptions = {
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
    };

    res.cookie("tm_auth_token", token, cookieOptions);
    res.cookie("misToken", misToken, cookieOptions);

    console.log("✅ SSO Login successful for:", localUser.email);

    return res.status(200).json({
      success: true,
      token,
      misToken,
      user: {
        id: localUser.id,
        first_name: localUser.first_name,
        last_name: localUser.last_name,
        email: localUser.email,
        role: localUser.role,
        roleId,
        roleName,
        localPermissions,
        mis_user_id: localUser.mis_user_id,
        profile_image: localUser.profile_image,
        preferred_theme: preferred_theme,
      },
      profile: misProfile,
      roles,
      permissions: permissions || [],
      assignedPrograms,
      assignedGrades,
      currentAcademicYear,
      currentAcademicTerms,
      systems: systems || [],
    });
  } catch (error: any) {
    console.error(
      "❌ SSO Callback error:",
      error.response?.data || error.message,
    );

    // Check for timeout errors
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      console.error(
        "⏱️ MIS API timeout - the MIS server is taking too long to respond",
      );
      return res.status(504).json({
        success: false,
        message:
          "Unable to connect to the authentication server. Please try again later.",
      });
    }

    // Check for network errors
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      console.error("🌐 MIS API network error - cannot reach the server");
      return res.status(503).json({
        success: false,
        message:
          "Authentication service is temporarily unavailable. Please try again later.",
      });
    }

    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message || "Failed to exchange SSO code for token";
    return res.status(status).json({ success: false, message });
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
    const token = req.cookies.tm_auth_token;
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
      termId?: number;
      academicYearId?: number;
    };
    const user = await User.findByPk(decoded.id);
    if (!user) return res.status(401).json({ message: "Invalid token" });

    // Preserve termId/academicYearId from previous token
    console.log("🔄 Refreshing token, preserving Term ID:", decoded.termId);
    const newToken = user.getSignedJwtToken(decoded.termId, decoded.academicYearId);

    const cookieOptions = {
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };

    res.cookie("tm_auth_token", newToken, cookieOptions);

    res.status(200).json({ success: true, token: newToken });
  } catch (error) {
    res.status(401).json({ message: "Invalid refresh token" });
  }
};

// Switch the academic year/term the user is currently viewing.
//
// The local JWT's `termId` claim is what every MIS-backed controller
// resolves via getCurrentTermId(req) as its first, highest-priority source
// (see server/src/utils/misUtils.ts) -- so re-issuing this token with a new
// termId is enough to make every existing endpoint (courses, assignments,
// quizzes, scheme-of-work, question bank, etc.) transparently scope to the
// newly selected term, with no per-endpoint changes required.
export const switchAcademicPeriod = async (req: Request, res: Response) => {
  try {
    const { academic_year_id, academic_term_id } = req.body;

    const yearId = parseInt(academic_year_id, 10);
    const termId = parseInt(academic_term_id, 10);

    if (isNaN(yearId) || isNaN(termId)) {
      return res.status(400).json({
        success: false,
        message: "academic_year_id and academic_term_id are required",
      });
    }

    const misToken = getMisToken(req);
    if (!misToken) {
      return res
        .status(401)
        .json({ success: false, message: "MIS session expired" });
    }

    // Validate the requested year/term actually exist and belong together,
    // rather than trusting client-supplied ids outright.
    const [yearsResponse, termsResponse] = await Promise.all([
      axios.get(`${process.env.NGA_MIS_BASE_URL}/academics/years`, {
        headers: { Authorization: `Bearer ${misToken}` },
      }),
      axios.get(`${process.env.NGA_MIS_BASE_URL}/academics/terms`, {
        headers: { Authorization: `Bearer ${misToken}` },
        params: { academic_year_id: yearId },
      }),
    ]);

    const academicYear = (yearsResponse.data?.data || []).find(
      (y: any) => y.academic_year_id === yearId,
    );
    const academicTerm = (termsResponse.data?.data || []).find(
      (t: any) => t.academic_term_id === termId,
    );

    if (!academicYear || !academicTerm) {
      return res.status(400).json({
        success: false,
        message: "Unknown academic year/term combination",
      });
    }

    const localUser = await User.findByPk((req as any).user.id);
    if (!localUser) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    const newToken = localUser.getSignedJwtToken(termId, yearId);

    const cookieOptions = {
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
    };
    res.cookie("tm_auth_token", newToken, cookieOptions);

    res.status(200).json({
      success: true,
      token: newToken,
      academicYear,
      academicTerm,
    });
  } catch (error: any) {
    return handleMisError(
      error,
      res,
      "Error switching academic year/term",
    );
  }
};

// Polled periodically by the frontend (see AuthContext) so a logout on the
// MIS ends this app's session too. This app's own tm_auth_token is
// self-contained and stays valid for its own life (up to JWT_EXPIRE,
// default 30d) regardless of what happens to the MIS session it was built
// from -- misToken is otherwise only read back out incidentally, by routes
// that already happen to call MIS for data. Deliberately fails CLOSED
// (401) on an MIS rejection: a stale MIS session should end this one.
export const verifyMisSession = async (req: Request, res: Response) => {
  const misToken = getMisToken(req);
  if (!misToken) {
    return res
      .status(401)
      .json({ success: false, message: "No MIS session on this token." });
  }

  try {
    const response = await axios.get(`${process.env.NGA_MIS_BASE_URL}/auth/verify`, {
      headers: { Authorization: `Bearer ${misToken}` },
    });
    return res.status(200).json({ success: true, data: response.data });
  } catch (error: any) {
    if (error.response?.status === 401) {
      return res
        .status(401)
        .json({ success: false, message: "MIS session has ended." });
    }
    // MIS unreachable is not the same as "logged out" -- don't force-logout
    // everyone over a network blip. The next successful poll settles it.
    console.error("MIS session verify error:", error.message);
    return res.status(200).json({ success: true });
  }
};

// Logout
export const logout = async (req: Request, res: Response) => {
  res.cookie("tm_auth_token", "none", {
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
      include: [{ model: Role, include: [Permission] }],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Local RBAC role/permissions — distinct from the MIS's own `roles`/
    // `permissions` fields below, which are that external system's catalog
    // and are passed straight through unchanged for MIS-linked UI.
    const roleId = user.role_id ?? null;
    const roleName = user.roleRecord?.name ?? null;
    const localPermissions = (user.roleRecord?.permissions ?? []).map((p) => p.key);

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
            roleId,
            roleName,
            localPermissions,
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
          timeout: 10000, // 10-second hard cap — don't hold up the session check
          httpsAgent:
            process.env.NODE_ENV === "production"
              ? new (require("https").Agent)({ rejectUnauthorized: true })
              : undefined,
        },
      );

      const misData = misResponse.data.data;

      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role,
            roleId,
            roleName,
            localPermissions,
            mis_user_id: user.mis_user_id,
            profile_image: user.profile_image,
            preferred_theme: misData.user?.preferred_theme || null,
          },
          profile: misData.profile,
          roles: misData.roles,
          permissions: misData.permissions,
          assignedPrograms: misData.assignedPrograms,
          assignedGrades: misData.assignedGrades,
          forcePasswordChange: misData.forcePasswordChange,
          currentAcademicYear: misData.currentAcademicYear,
          currentAcademicTerms: misData.currentAcademicTerms,
          systems: misData.systems,
          misToken: misToken,
        },
      });
    } catch (misError: any) {
      // MIS is slow or down — return local data so the session stays alive.
      // The frontend can still function with partial data.
      console.warn(
        "⚠️ MIS /users/me unavailable, falling back to local user data:",
        misError.message,
      );
      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role,
            roleId,
            roleName,
            localPermissions,
            mis_user_id: user.mis_user_id,
            profile_image: user.profile_image,
            preferred_theme: null,
          },
          profile: null,
          roles: [],
          permissions: [],
          assignedPrograms: [],
          assignedGrades: [],
          forcePasswordChange: false,
          misDataUnavailable: true,
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

      const filename = generateUniqueFilename(
        `profile-${userId}`,
        req.file.originalname,
        sanitizeKeepExtension,
      );

      try {
        await fileServer.uploadFile(
          req.file.buffer,
          `profile-pictures/${filename}`,
        );
      } catch (uploadErr) {
        console.error("Profile picture upload to file-server failed:", uploadErr);
        return res.status(502).json({
          success: false,
          message: "Failed to store profile picture",
        });
      }

      // Delete old profile image if it exists (best-effort, don't fail the
      // request if the old file is already gone)
      if (user.profile_image) {
        fileServer
          .deleteFile(`profile-pictures/${user.profile_image}`)
          .catch((err) =>
            console.error("Failed to delete old profile picture:", err),
          );
      }

      // Update user profile image filename
      user.profile_image = filename;
      await user.save();

      res.status(200).json({
        success: true,
        data: {
          profile_image: filename,
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

    await fileServer.deleteFile(`profile-pictures/${user.profile_image}`);

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

    // Generate new local token, preserving the caller's current term/year
    // selection (getSignedJwtToken() with no args would silently drop it).
    const token = user.getSignedJwtToken(
      (req as any).user.termId,
      (req as any).user.academicYearId,
    );

    // Update Cookies
    const cookieOptions = {
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
    };
    res.cookie("tm_auth_token", token, cookieOptions);
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
// Proxy SSO Authorization request to MIS
export const proxySsoAuthorize = async (req: Request, res: Response) => {
  try {
    const { client_id, redirect_uri } = req.query;
    const misToken = getMisToken(req);

    if (!misToken) {
      return res
        .status(401)
        .json({ success: false, message: "MIS session expired" });
    }

    // Call MIS authorize endpoint
    const response = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/sso/authorize`,
      {
        params: { client_id, redirect_uri },
        headers: { Authorization: `Bearer ${misToken}` },
        httpsAgent:
          process.env.NODE_ENV === "production"
            ? new (require("https").Agent)({ rejectUnauthorized: true })
            : undefined,
      },
    );

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error(
      "❌ SSO Authorization Proxy Error:",
      error.response?.data || error.message,
    );
    const status = error.response?.status || 500;
    return res
      .status(status)
      .json(error.response?.data || { message: "Internal server error" });
  }
};

// Update User Theme Preference in MIS
export const updateTheme = async (req: Request, res: Response) => {
  try {
    const { theme } = req.body;
    const misToken = getMisToken(req);

    if (!theme || !["light", "dark"].includes(theme)) {
      return res.status(400).json({ success: false, message: "Invalid theme" });
    }

    if (!misToken) {
      return res
        .status(401)
        .json({ success: false, message: "MIS session expired" });
    }

    // Proxy request to MIS
    const response = await axios.patch(
      `${process.env.NGA_MIS_BASE_URL}/users/me/theme`,
      { theme },
      {
        headers: { Authorization: `Bearer ${misToken}` },
        httpsAgent:
          process.env.NODE_ENV === "production"
            ? new (require("https").Agent)({ rejectUnauthorized: true })
            : undefined,
      },
    );

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error(
      "❌ Update Theme Proxy Error:",
      error.response?.data || error.message,
    );
    const status = error.response?.status || 500;
    return res
      .status(status)
      .json(error.response?.data || { message: "Internal server error" });
  }
};
