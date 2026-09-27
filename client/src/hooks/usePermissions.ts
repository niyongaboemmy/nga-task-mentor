import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";

/**
 * Local RBAC permission-gating hook. Sourced from `user.localPermissions`
 * (this app's own roles/permissions catalog — see AuthContext.tsx) which is
 * deliberately distinct from `user.permissions`, the external NGA Central
 * MIS's own permission catalog used only for MIS-linked UI.
 */
export function usePermissions() {
  const { user } = useAuth();

  const permissionSet = useMemo(
    () => new Set(user?.localPermissions ?? []),
    [user?.localPermissions],
  );

  /** OR semantics: true if the user holds ANY of the given permission keys. */
  const can = (permission: string | string[]): boolean => {
    if (Array.isArray(permission)) {
      return permission.some((p) => permissionSet.has(p));
    }
    return permissionSet.has(permission);
  };

  /** AND semantics: true only if the user holds ALL of the given permission keys. */
  const canAll = (permissions: string[]): boolean =>
    permissions.every((p) => permissionSet.has(p));

  /**
   * Creator-or-super-admin rule for quizzes/assignments: true when the caller
   * holds `manageAnyKey` (QUIZZES_MANAGE_ANY / ASSIGNMENTS_MANAGE_ANY, admin
   * only) or created the item. Mirrors server `utils/ownership.ts`; prefer the
   * server's `can_manage` flag when a response carries one.
   */
  const canManageOwned = (
    createdBy: number | string | null | undefined,
    manageAnyKey: "QUIZZES_MANAGE_ANY" | "ASSIGNMENTS_MANAGE_ANY",
  ): boolean => {
    if (permissionSet.has(manageAnyKey)) return true;
    if (createdBy === null || createdBy === undefined || !user?.id) return false;
    return String(createdBy) === String(user.id);
  };

  return {
    can,
    canAll,
    canManageOwned,
    permissions: permissionSet,
    roleName: user?.roleName ?? null,
  };
}
