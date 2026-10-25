"use strict";

// AI usage control (AI_USAGE_CONTROL_PLAN.md §3.4): the AI_USE permission --
// "may use AI tools outside a quiz or assignment" (question generator, rubric,
// marking drafts, TMCode AI...). Mirrors the AI_USE entry of
// src/constants/permissions.ts. Granted to the admin and instructor system
// roles, never to student. The school-wide AI policy (MIS) still comes first.
// Idempotent: safe when the key or a grant already exists.

const PERMISSION = {
  key: "AI_USE",
  category: "AI",
  description: "Use AI tools outside a quiz or assignment (generators, rubrics, marking drafts, TMCode AI)",
};
const ROLES = ["admin", "instructor"];

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    const q = (sql, replacements = []) =>
      queryInterface.sequelize.query(sql, { replacements }).then(([rows]) => rows);

    let [perm] = await q("SELECT id FROM permissions WHERE `key` = ? LIMIT 1", [PERMISSION.key]);
    if (!perm) {
      await queryInterface.bulkInsert("permissions", [{ ...PERMISSION, created_at: now, updated_at: now }]);
      [perm] = await q("SELECT id FROM permissions WHERE `key` = ? LIMIT 1", [PERMISSION.key]);
    }
    if (!perm) return;
    for (const name of ROLES) {
      const [role] = await q("SELECT id FROM roles WHERE name = ? LIMIT 1", [name]);
      if (!role) continue;
      const has = await q("SELECT id FROM role_permissions WHERE role_id = ? AND permission_id = ? LIMIT 1", [role.id, perm.id]);
      if (has.length === 0) {
        await queryInterface.bulkInsert("role_permissions", [{ role_id: role.id, permission_id: perm.id, created_at: now }]);
      }
    }
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      "DELETE rp FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.`key` = ?",
      { replacements: [PERMISSION.key] },
    );
    await queryInterface.bulkDelete("permissions", { key: PERMISSION.key });
  },
};
