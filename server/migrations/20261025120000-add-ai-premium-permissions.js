"use strict";

// Premium AI and its admin page (GRADING_PREMIUM_CONTRACTS.md). Mirrors the
// AI_PREMIUM and AI_SETTINGS_MANAGE entries of src/constants/permissions.ts.
//   AI_PREMIUM          paid AI models from the school's keys -- seeded to NO role:
//                       the school grants it to a role (Roles & permissions) or to
//                       single users (Admin -> AI: premium & own keys).
//   AI_SETTINGS_MANAGE  that admin page -- granted to the admin system role.
// Idempotent: safe when the keys or a grant already exist.

const PERMISSIONS = [
  { key: "AI_PREMIUM", category: "AI", description: "Use premium (paid) AI models from the school's keys in TMCode", roles: [] },
  { key: "AI_SETTINGS_MANAGE", category: "AI", description: "Manage premium AI access and own API keys (Admin → AI: premium & own keys)", roles: ["admin"] },
];

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    const q = (sql, replacements = []) =>
      queryInterface.sequelize.query(sql, { replacements }).then(([rows]) => rows);

    for (const { roles, ...permission } of PERMISSIONS) {
      let [perm] = await q("SELECT id FROM permissions WHERE `key` = ? LIMIT 1", [permission.key]);
      if (!perm) {
        await queryInterface.bulkInsert("permissions", [{ ...permission, created_at: now, updated_at: now }]);
        [perm] = await q("SELECT id FROM permissions WHERE `key` = ? LIMIT 1", [permission.key]);
      }
      if (!perm) continue;
      for (const name of roles) {
        const [role] = await q("SELECT id FROM roles WHERE name = ? LIMIT 1", [name]);
        if (!role) continue;
        const has = await q("SELECT id FROM role_permissions WHERE role_id = ? AND permission_id = ? LIMIT 1", [role.id, perm.id]);
        if (has.length === 0) {
          await queryInterface.bulkInsert("role_permissions", [{ role_id: role.id, permission_id: perm.id, created_at: now }]);
        }
      }
    }
  },

  down: async (queryInterface) => {
    for (const { key } of PERMISSIONS) {
      await queryInterface.sequelize.query(
        "DELETE rp FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.`key` = ?",
        { replacements: [key] },
      );
      await queryInterface.bulkDelete("permissions", { key });
    }
  },
};
