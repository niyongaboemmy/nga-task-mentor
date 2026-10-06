import crypto from "crypto";
import { User } from "../models/User.model";
import { Role } from "../models/Role.model";

/**
 * The local Task Mentor user for an MIS user, created or refreshed from MIS
 * data. Shared by the SSO callback (auth.controller ssoCallback) and the
 * TMCode sign-in exchange (POST /api/tmcode/auth/exchange) so both sign-ins
 * land on the same row with the same role rules:
 *
 *  - lookup by users.mis_user_id, then by email (and the MIS id is recorded
 *    on the row found by email);
 *  - name, email and the flat legacy role follow MIS every sign-in;
 *  - role_id follows the MIS role remap only while the user is on one of the
 *    system roles -- a manually assigned custom role is left alone.
 */

export type LocalRole = "student" | "instructor" | "admin";

export interface MisUserInfo {
  user_id: number;
  email: string;
  username?: string | null;
}

export interface MisProfileInfo {
  first_name?: string | null;
  last_name?: string | null;
}

/** MIS roles -> the local system role (admin wins, then teacher, else student). */
export function mapMisRoleToLocal(misRoles: { role_id: number; name: string }[] | null | undefined): LocalRole {
  if (!misRoles || !Array.isArray(misRoles) || misRoles.length === 0) {
    return "student";
  }
  let bestRole: LocalRole = "student";
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
}

async function isSystemRoleId(roleId: number): Promise<boolean> {
  const role = await Role.findByPk(roleId);
  return role?.is_system ?? false;
}

/** Throws when creating the row fails (the caller answers 500). */
export async function upsertMisUser(
  misUser: MisUserInfo,
  misProfile: MisProfileInfo | null,
  roles: { role_id: number; name: string }[] | null | undefined,
): Promise<{ user: User; created: boolean; mappedRole: LocalRole }> {
  const mappedRole = mapMisRoleToLocal(roles);
  const mappedRoleRecord = await Role.findOne({ where: { name: mappedRole } });

  let localUser = await User.findOne({ where: { mis_user_id: misUser.user_id } });

  // Not linked yet: an account made by email before SSO (or by a roster import).
  if (!localUser && misUser.email) {
    localUser = await User.findOne({ where: { email: misUser.email } });
    if (localUser) {
      localUser.mis_user_id = misUser.user_id;
      await localUser.save();
    }
  }

  if (!localUser) {
    const created = await User.create({
      first_name: misProfile?.first_name || misUser.username || misUser.email,
      last_name: misProfile?.last_name || "",
      email: misUser.email,
      password: "SSO_USER_" + crypto.randomBytes(8).toString("hex"),
      role: mappedRole,
      role_id: mappedRoleRecord?.id ?? null,
      mis_user_id: misUser.user_id,
    } as any);
    return { user: created, created: true, mappedRole };
  }

  localUser.first_name = misProfile?.first_name || localUser.first_name;
  localUser.last_name = misProfile?.last_name || localUser.last_name;
  if (misUser.email) localUser.email = misUser.email;
  localUser.role = mappedRole;
  if (!localUser.role_id || (await isSystemRoleId(localUser.role_id))) {
    localUser.role_id = mappedRoleRecord?.id ?? localUser.role_id;
  }
  await localUser.save();
  return { user: localUser, created: false, mappedRole };
}
