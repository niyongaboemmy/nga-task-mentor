"use strict";

// Admin → Code runner (CODE_RUNNER_PLAN.md phase 1). Mirrors the
// CODE_RUNNER_ADMIN entry of src/constants/permissions.ts. Grants it to the
// admin system role. Idempotent: safe when the key or the grant exists.

const PERMISSION = {
  key: "CODE_RUNNER_ADMIN",
  category: "PROJECTS",
  description: "See the code runner's health, languages and recent errors (Admin → Code runner)",
};

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
    const [admin] = await q("SELECT id FROM roles WHERE name = 'admin' LIMIT 1");
    if (!perm || !admin) return;
    const has = await q("SELECT id FROM role_permissions WHERE role_id = ? AND permission_id = ? LIMIT 1", [admin.id, perm.id]);
    if (has.length === 0) {
      await queryInterface.bulkInsert("role_permissions", [{ role_id: admin.id, permission_id: perm.id, created_at: now }]);
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
