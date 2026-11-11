import crypto from "crypto";
import { User } from "../models/User.model";
import { Role } from "../models/Role.model";
import { ACTIVE, normalizeStatus } from "../utils/activeUsers";
import { currentTenantOrNull } from "../vendor/nga-tenancy";

/**
 * The local Task Mentor user for an MIS user, created or refreshed from MIS
 * data. Shared by the SSO callback (auth.controller ssoCallback) and the
 * TMCode sign-in exchange (POST /api/tmcode/auth/exchange) so both sign-ins
 * land on the same row with the same role rules:
 *
 *  - lookup by users.mis_user_id ONLY, inside the tenant database the
 *    request runs in. There is no e-mail fallback any more (TM-3): relinking
 *    a row found by e-mail could merge two people's accounts. When the MIS
 *    e-mail already belongs to another local row, the mismatch is logged and
 *    the new row gets a placeholder address instead;
 *  - name, email and the flat legacy role follow MIS every sign-in;
 *  - role_id follows the MIS role remap only while the user is on one of the
 *    system roles -- a manually assigned custom role is left alone;
 *  - mis_status (ACTIVE_USERS_CONTRACTS.md) follows the MIS account status
 *    when the payload carries one; otherwise ACTIVE, since MIS only lets an
 *    active account sign in (this also re-activates a row the sweep marked
 *    inactive once MIS re-enables the account).
 */

export type LocalRole = "student" | "instructor" | "admin";

export interface MisUserInfo {
  user_id: number;
  email: string;
  username?: string | null;
  /** MIS User.status when the payload carries it. */
  status?: string | null;
}

export interface MisProfileInfo {
  first_name?: string | null;
  last_name?: string | null;
}

/**
 * MIS role names and preset codes that map to a local system role (TM-4).
 * Roles are per tenant in the MIS, so their numeric ids mean nothing here:
 * the mapping uses the role name (SUPER_ADMIN, TEACHER, ...) and, when the
 * payload carries one, its preset/code (school_administrator, teaching_staff).
 */
const ADMIN_ROLE_CODES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "HEAD_TEACHER",
  "PROGRAM_MANAGER",
  "PROGRAMME_MANAGER",
  "PLATFORM_OWNER",
  "SCHOOL_ADMINISTRATOR",
  "PROGRAMME_COORDINATOR",
]);
const TEACHER_ROLE_CODES = new Set(["TEACHER", "CLASS_TEACHER", "TEACHING_STAFF", "SUBJECT_TEACHER"]);

export interface MisRoleInfo {
  role_id?: number;
  name?: string | null;
  code?: string | null;
  preset?: string | null;
  preset_key?: string | null;
}

const codeOf = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

/** MIS roles -> the local system role (admin wins, then teacher, else student). */
export function mapMisRoleToLocal(misRoles: MisRoleInfo[] | null | undefined): LocalRole {
  if (!misRoles || !Array.isArray(misRoles) || misRoles.length === 0) {
    return "student";
  }
  let bestRole: LocalRole = "student";
  for (const role of misRoles) {
    const codes = [role.name, role.code, role.preset, role.preset_key].map(codeOf).filter(Boolean);
    const name = String(role.name ?? "").toLowerCase();
    if (
      codes.some((c) => ADMIN_ROLE_CODES.has(c)) ||
      name.includes("admin") ||
      name.includes("super") ||
      name.includes("manager")
    ) {
      return "admin";
    }
    if (codes.some((c) => TEACHER_ROLE_CODES.has(c)) || name.includes("teacher") || name.includes("instructor")) {
      bestRole = "instructor";
    }
  }
  return bestRole;
}

/** A unique, valid address for a row whose MIS e-mail is taken locally. */
export const placeholderEmail = (misUserId: number, tid?: number) =>
  `mis-user-${tid ?? currentTenantOrNull()?.tid ?? 1}-${misUserId}@sso.invalid`;

async function isSystemRoleId(roleId: number): Promise<boolean> {
  const role = await Role.findByPk(roleId);
  return role?.is_system ?? false;
}

/** Throws when creating the row fails (the caller answers 500). */
export async function upsertMisUser(
  misUser: MisUserInfo,
  misProfile: MisProfileInfo | null,
  roles: MisRoleInfo[] | null | undefined,
): Promise<{ user: User; created: boolean; mappedRole: LocalRole }> {
  const mappedRole = mapMisRoleToLocal(roles);
  const misStatus = normalizeStatus(misUser.status) ?? ACTIVE;
  const mappedRoleRecord = await Role.findOne({ where: { name: mappedRole } });

  let localUser = await User.findOne({ where: { mis_user_id: misUser.user_id } });

  // Who already holds this e-mail locally (never relinked, only reported).
  const emailHolder =
    misUser.email && (!localUser || localUser.email !== misUser.email)
      ? await User.findOne({ where: { email: misUser.email } })
      : null;
  if (emailHolder) {
    console.warn(
      `[misUserSync] e-mail mismatch in tenant ${currentTenantOrNull()?.tid ?? 1}: MIS user ${misUser.user_id}'s ` +
        `e-mail belongs to local user ${emailHolder.id} (mis_user_id ${emailHolder.mis_user_id ?? "none"}); not linking`,
    );
  }

  if (!localUser) {
    const created = await User.create({
      first_name: misProfile?.first_name || misUser.username || misUser.email,
      last_name: misProfile?.last_name || "",
      email: emailHolder || !misUser.email ? placeholderEmail(misUser.user_id) : misUser.email,
      password: "SSO_USER_" + crypto.randomBytes(8).toString("hex"),
      role: mappedRole,
      role_id: mappedRoleRecord?.id ?? null,
      mis_user_id: misUser.user_id,
      mis_status: misStatus,
    } as any);
    return { user: created, created: true, mappedRole };
  }

  localUser.first_name = misProfile?.first_name || localUser.first_name;
  localUser.last_name = misProfile?.last_name || localUser.last_name;
  if (misUser.email && !emailHolder) localUser.email = misUser.email;
  localUser.role = mappedRole;
  localUser.mis_status = misStatus;
  if (!localUser.role_id || (await isSystemRoleId(localUser.role_id))) {
    localUser.role_id = mappedRoleRecord?.id ?? localUser.role_id;
  }
  await localUser.save();
  return { user: localUser, created: false, mappedRole };
}
