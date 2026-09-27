"use strict";

// Question Bank hub (/question-bank): a top-level menu with a cross-subject
// dashboard and a subject-scoped question list for the caller's OWN assigned
// subjects. Its key is granted to the instructor system role ONLY -- admin's
// "every key" default deliberately excludes it (TEACHER_ONLY_PERMISSIONS in
// src/constants/permissions.ts); a custom role can still be given it from
// Roles & Permissions.
// Idempotent: safe on a database where the key or the grant already exists.

const NEW_PERMISSION = {
  key: "QUESTION_BANK_HUB_VIEW",
  category: "QUESTION_BANK",
  description:
    "Open the Question Bank hub: cross-subject dashboard and list for the subjects you teach",
};

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE `key` = ? LIMIT 1",
      { replacements: [NEW_PERMISSION.key] },
    );
    if (existing.length === 0) {
      await queryInterface.bulkInsert("permissions", [
        { ...NEW_PERMISSION, created_at: now, updated_at: now },
      ]);
    }

    const [roleRows] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'instructor' LIMIT 1",
    );
    const instructorRoleId = roleRows[0]?.id;
    if (!instructorRoleId) return;

    const [missing] = await queryInterface.sequelize.query(
      `SELECT p.id FROM permissions p
       LEFT JOIN role_permissions rp ON rp.permission_id = p.id AND rp.role_id = ?
       WHERE p.\`key\` = ? AND rp.id IS NULL`,
      { replacements: [Number(instructorRoleId), NEW_PERMISSION.key] },
    );
    if (missing.length > 0) {
      await queryInterface.bulkInsert(
        "role_permissions",
        missing.map((p) => ({ role_id: instructorRoleId, permission_id: p.id, created_at: now })),
      );
    }
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `DELETE rp FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE p.\`key\` = ?`,
      { replacements: [NEW_PERMISSION.key] },
    );
    await queryInterface.bulkDelete("permissions", { key: NEW_PERMISSION.key });
  },
};
