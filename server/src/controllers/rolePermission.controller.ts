import { Request, Response } from "express";
import { Op } from "sequelize";
import { Role, Permission, RolePermission, User } from "../models";
import { sequelize } from "../config/database";
import type {
  CreateRolePayload,
  UpdateRolePayload,
  AssignRolePayload,
} from "../validations/rolePermission.validation";

// ─── GET /api/roles-permissions/permissions ──────────────────────────────────
// Full permission catalog, grouped by category, for the checkbox UI.

export const getPermissionCatalog = async (_req: Request, res: Response) => {
  try {
    const permissions = await Permission.findAll({
      order: [
        ["category", "ASC"],
        ["key", "ASC"],
      ],
    });

    const grouped: Record<string, typeof permissions> = {};
    for (const perm of permissions) {
      if (!grouped[perm.category]) grouped[perm.category] = [];
      grouped[perm.category].push(perm);
    }

    res.status(200).json({ success: true, data: grouped });
  } catch (error) {
    console.error("getPermissionCatalog error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/roles-permissions/roles ────────────────────────────────────────
// List roles with permission counts and assigned-user counts.

export const listRoles = async (_req: Request, res: Response) => {
  try {
    const roles = await Role.findAll({
      include: [{ model: Permission, attributes: ["id"] }],
      order: [["name", "ASC"]],
    });

    const data = await Promise.all(
      roles.map(async (role) => {
        const userCount = await User.count({ where: { role_id: role.id } });
        return {
          id: role.id,
          name: role.name,
          description: role.description,
          is_system: role.is_system,
          permissionCount: role.permissions?.length ?? 0,
          userCount,
        };
      }),
    );

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("listRoles error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/roles-permissions/roles/:id ────────────────────────────────────

export const getRole = async (req: Request, res: Response) => {
  try {
    const role = await Role.findByPk(req.params.id, {
      include: [{ model: Permission }],
    });

    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        id: role.id,
        name: role.name,
        description: role.description,
        is_system: role.is_system,
        permissionKeys: (role.permissions ?? []).map((p) => p.key),
      },
    });
  } catch (error) {
    console.error("getRole error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── POST /api/roles-permissions/roles ───────────────────────────────────────

export const createRole = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const body = req.body as CreateRolePayload;

    const existing = await Role.findOne({ where: { name: body.name }, transaction });
    if (existing) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "A role with this name already exists",
      });
    }

    const role = await Role.create(
      {
        name: body.name,
        description: body.description ?? null,
        is_system: false,
      },
      { transaction },
    );

    if (body.permissionKeys.length > 0) {
      const permissions = await Permission.findAll({
        where: { key: body.permissionKeys },
        transaction,
      });
      await RolePermission.bulkCreate(
        permissions.map((p) => ({ role_id: role.id, permission_id: p.id })),
        { transaction },
      );
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Role created",
      data: { id: role.id, name: role.name, description: role.description, is_system: false },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("createRole error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── PUT /api/roles-permissions/roles/:id ────────────────────────────────────
// Full replace of the role's permission set, in a transaction.

export const updateRole = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const body = req.body as UpdateRolePayload;
    const role = await Role.findByPk(req.params.id, { transaction });

    if (!role) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    if (body.name && body.name !== role.name) {
      const existing = await Role.findOne({ where: { name: body.name }, transaction });
      if (existing) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: "A role with this name already exists",
        });
      }
      role.name = body.name;
    }

    if (body.description !== undefined) {
      role.description = body.description;
    }

    await role.save({ transaction });

    if (body.permissionKeys !== undefined) {
      // Guardrail: don't let the last role holding ROLES_PERMISSIONS_MANAGE
      // lose it, which would permanently lock everyone out of this module.
      const willHaveManage = body.permissionKeys.includes("ROLES_PERMISSIONS_MANAGE");
      const currentlyHasManage = await RolePermission.findOne({
        where: { role_id: role.id },
        include: [{ model: Permission, where: { key: "ROLES_PERMISSIONS_MANAGE" }, required: true }],
        transaction,
      });

      if (currentlyHasManage && !willHaveManage) {
        const otherRolesWithManage = await Role.count({
          where: { id: { [Op.ne]: role.id } },
          include: [
            {
              model: Permission,
              where: { key: "ROLES_PERMISSIONS_MANAGE" },
              required: true,
            },
          ],
          transaction,
        });

        if (otherRolesWithManage === 0) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message:
              "Cannot remove Manage Roles & Permissions from the only role that holds it — this would lock everyone out of role management.",
          });
        }
      }

      await RolePermission.destroy({ where: { role_id: role.id }, transaction });

      if (body.permissionKeys.length > 0) {
        const permissions = await Permission.findAll({
          where: { key: body.permissionKeys },
          transaction,
        });
        await RolePermission.bulkCreate(
          permissions.map((p) => ({ role_id: role.id, permission_id: p.id })),
          { transaction },
        );
      }
    }

    await transaction.commit();

    res.status(200).json({ success: true, message: "Role updated" });
  } catch (error) {
    await transaction.rollback();
    console.error("updateRole error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── DELETE /api/roles-permissions/roles/:id ─────────────────────────────────

export const deleteRole = async (req: Request, res: Response) => {
  try {
    const role = await Role.findByPk(req.params.id);

    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    if (role.is_system) {
      return res.status(400).json({
        success: false,
        message: "System roles (admin, instructor, student) cannot be deleted",
      });
    }

    const assignedUserCount = await User.count({ where: { role_id: role.id } });
    if (assignedUserCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete this role — ${assignedUserCount} user(s) are still assigned to it. Reassign them first.`,
      });
    }

    await role.destroy();

    res.status(200).json({ success: true, message: "Role deleted" });
  } catch (error) {
    console.error("deleteRole error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── PUT /api/roles-permissions/users/:userId/role ───────────────────────────

export const assignUserRole = async (req: Request, res: Response) => {
  try {
    const { roleId } = req.body as AssignRolePayload;
    const user = await User.findByPk(req.params.userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const role = await Role.findByPk(roleId);
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    // Guardrail: don't let the last user holding ROLES_PERMISSIONS_MANAGE be
    // reassigned away from it, which would permanently lock everyone out.
    const currentRole = user.role_id
      ? await Role.findByPk(user.role_id, {
          include: [{ model: Permission, where: { key: "ROLES_PERMISSIONS_MANAGE" }, required: false }],
        })
      : null;
    const userCurrentlyHasManage = (currentRole?.permissions ?? []).some(
      (p) => p.key === "ROLES_PERMISSIONS_MANAGE",
    );
    const newRolePermissions = await role.$get("permissions");
    const willHaveManage = (newRolePermissions ?? []).some(
      (p: any) => p.key === "ROLES_PERMISSIONS_MANAGE",
    );

    if (userCurrentlyHasManage && !willHaveManage) {
      const otherUsersWithManage = await User.count({
        where: { id: { [Op.ne]: user.id } },
        include: [
          {
            model: Role,
            required: true,
            include: [
              { model: Permission, where: { key: "ROLES_PERMISSIONS_MANAGE" }, required: true },
            ],
          },
        ],
      });

      if (otherUsersWithManage === 0) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot reassign the only user who holds Manage Roles & Permissions — this would lock everyone out of role management.",
        });
      }
    }

    // Keep the legacy `role` string column in sync where the new role's name
    // maps onto the deprecated 3-value enum; leave it as-is for custom roles
    // that have no legacy equivalent (deprecated field, no longer relied on
    // by the permission system).
    const legacyRoleNames = ["student", "instructor", "admin"];
    const updates: any = { role_id: role.id };
    if (legacyRoleNames.includes(role.name)) {
      updates.role = role.name;
    }

    await user.update(updates);

    res.status(200).json({ success: true, message: "Role assigned" });
  } catch (error) {
    console.error("assignUserRole error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
