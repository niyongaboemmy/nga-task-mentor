"use strict";

// Adds two permission keys that were introduced after the original seed
// migration (20260812174502) had already been authored/applied:
// QUIZZES_MANAGE_ANY and QUESTION_BANK_MANAGE_ANY (both admin-only ownership
// overrides — see server/src/middleware/auth.ts / question.controller.ts /
// questionBank.controller.ts). Granted only to the admin role, matching
// src/constants/permissions.ts's DEFAULT_ROLE_PERMISSIONS.

const NEW_PERMISSIONS = [
  {
    key: "QUIZZES_MANAGE_ANY",
    category: "QUIZZES",
    description:
      "Edit/delete any quiz regardless of ownership (bypasses the owning-instructor check)",
  },
  {
    key: "QUESTION_BANK_MANAGE_ANY",
    category: "QUESTION_BANK",
    description: "Edit/delete any question bank entry regardless of ownership",
  },
];

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();

    await queryInterface.bulkInsert(
      "permissions",
      NEW_PERMISSIONS.map((p) => ({
        key: p.key,
        category: p.category,
        description: p.description,
        created_at: now,
        updated_at: now,
      })),
    );

    const [adminRoleRows] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'admin' LIMIT 1",
    );
    const adminRoleId = adminRoleRows[0]?.id;
    if (!adminRoleId) return;

    const [permissionRows] = await queryInterface.sequelize.query(
      `SELECT id, \`key\` FROM permissions WHERE \`key\` IN (${NEW_PERMISSIONS.map(
        (p) => `'${p.key}'`,
      ).join(", ")})`,
    );

    await queryInterface.bulkInsert(
      "role_permissions",
      permissionRows.map((p) => ({
        role_id: adminRoleId,
        permission_id: p.id,
        created_at: now,
      })),
    );
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `DELETE rp FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE p.\`key\` IN (${NEW_PERMISSIONS.map((p) => `'${p.key}'`).join(", ")})`,
    );
    await queryInterface.bulkDelete("permissions", {
      key: NEW_PERMISSIONS.map((p) => p.key),
    });
  },
};
