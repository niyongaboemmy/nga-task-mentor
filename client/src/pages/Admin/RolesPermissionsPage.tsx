import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Plus, ShieldCheck, Trash2, Save, ChevronDown, ChevronRight } from "lucide-react";
import {
  RolePermissionApiService,
  type PermissionCatalog,
  type RoleSummary,
} from "../../services/rolePermissionApi";
import { usePermissions } from "../../hooks/usePermissions";
import { Button } from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";

const cardClass =
  "rounded-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border border-gray-200/50 dark:border-gray-700/50 shadow-sm";

const RolesPermissionsPage: React.FC = () => {
  const { can } = usePermissions();
  const canManage = can("ROLES_PERMISSIONS_MANAGE");

  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalog>({});
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<Set<string>>(new Set());
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");

  const loadRoles = async () => {
    const res = await RolePermissionApiService.listRoles();
    setRoles(res.data);
    return res.data;
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [catalogRes, roleList] = await Promise.all([
          RolePermissionApiService.getPermissionCatalog(),
          loadRoles(),
        ]);
        setCatalog(catalogRes.data);
        setExpandedCategories(new Set(Object.keys(catalogRes.data)));
        if (roleList.length > 0) {
          setSelectedRoleId(roleList[0].id);
        }
      } catch (err) {
        console.error("Failed to load roles & permissions:", err);
        toast.error("Failed to load roles & permissions");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (selectedRoleId === null) return;
    (async () => {
      try {
        const res = await RolePermissionApiService.getRole(selectedRoleId);
        setRoleName(res.data.name);
        setRoleDescription(res.data.description ?? "");
        setSelectedPermissionKeys(new Set(res.data.permissionKeys));
      } catch (err) {
        console.error("Failed to load role detail:", err);
        toast.error("Failed to load role detail");
      }
    })();
  }, [selectedRoleId]);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );

  const togglePermission = (key: string) => {
    setSelectedPermissionKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedRoleId) return;
    try {
      setSaving(true);
      await RolePermissionApiService.updateRole(selectedRoleId, {
        name: roleName,
        description: roleDescription || null,
        permissionKeys: Array.from(selectedPermissionKeys),
      });
      toast.success("Role updated");
      await loadRoles();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update role");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      toast.error("Role name is required");
      return;
    }
    try {
      const res = await RolePermissionApiService.createRole({
        name: newRoleName.trim(),
        permissionKeys: [],
      });
      toast.success("Role created");
      setShowCreateModal(false);
      setNewRoleName("");
      await loadRoles();
      setSelectedRoleId(res.data.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create role");
    }
  };

  const handleDeleteRole = async (role: RoleSummary) => {
    if (role.is_system) return;
    if (
      !window.confirm(
        `Delete role "${role.name}"? This cannot be undone. ${role.userCount > 0 ? `${role.userCount} user(s) are still assigned — deletion will be blocked.` : ""}`,
      )
    ) {
      return;
    }
    try {
      await RolePermissionApiService.deleteRole(role.id);
      toast.success("Role deleted");
      const updated = await loadRoles();
      if (selectedRoleId === role.id) {
        setSelectedRoleId(updated[0]?.id ?? null);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete role");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-blue-900" />
          <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark">
              Roles &amp; Permissions
            </h1>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
              Create custom roles and control exactly what each one can do.
            </p>
          </div>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreateModal(true)} icon={<Plus className="w-4 h-4" />}>
            New Role
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Role list */}
        <div className={`${cardClass} p-3 h-fit`}>
          <ul className="space-y-1">
            {roles.map((role) => (
              <li key={role.id}>
                <button
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors flex items-center justify-between group ${
                    selectedRoleId === role.id
                      ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                      : "text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="truncate font-medium capitalize">{role.name}</span>
                    {role.is_system && (
                      <span className="shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark/70">
                        System
                      </span>
                    )}
                  </span>
                  {!role.is_system && canManage && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRole(role);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-600 transition-all"
                      aria-label={`Delete ${role.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
                <p className="px-3 text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
                  {role.permissionCount} permission{role.permissionCount === 1 ? "" : "s"} ·{" "}
                  {role.userCount} user{role.userCount === 1 ? "" : "s"}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Role detail / permission checklist */}
        {selectedRole && (
          <div className={`${cardClass} p-5`}>
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark/70 mb-1">
                  Role name
                </label>
                <input
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  disabled={selectedRole.is_system || !canManage}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm disabled:opacity-60"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark/70 mb-1">
                  Description
                </label>
                <input
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  disabled={!canManage}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm disabled:opacity-60"
                />
              </div>
              {canManage && (
                <Button onClick={handleSave} loading={saving} icon={<Save className="w-4 h-4" />}>
                  Save
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {Object.entries(catalog).map(([category, permissions]) => {
                const expanded = expandedCategories.has(category);
                const checkedCount = permissions.filter((p) =>
                  selectedPermissionKeys.has(p.key),
                ).length;
                return (
                  <div
                    key={category}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                  >
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                        {expanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        {category.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
                        {checkedCount}/{permissions.length}
                      </span>
                    </button>
                    {expanded && (
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {permissions.map((perm) => (
                          <label
                            key={perm.key}
                            className="flex items-start gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPermissionKeys.has(perm.key)}
                              onChange={() => togglePermission(perm.key)}
                              disabled={!canManage}
                              className="mt-1 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                            />
                            <span>
                              <span className="block font-medium text-text-primary-light dark:text-text-primary-dark">
                                {perm.key}
                              </span>
                              {perm.description && (
                                <span className="block text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
                                  {perm.description}
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create a new role"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark/70 mb-1">
              Role name
            </label>
            <input
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              placeholder="e.g. Senior Instructor"
            />
          </div>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
            You can assign permissions to it after creating it.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRole}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RolesPermissionsPage;
