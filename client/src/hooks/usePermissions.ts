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

  return { can, canAll, permissions: permissionSet, roleName: user?.roleName ?? null };
}
