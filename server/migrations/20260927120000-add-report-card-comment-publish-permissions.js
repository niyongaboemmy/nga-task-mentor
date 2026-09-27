"use strict";

// Access control v2, Phase 5: the report-card chain is split into
//   REPORT_CARDS_EDIT (marks) -> REPORT_CARDS_COMMENT (class teacher)
//   -> REPORT_CARDS_APPROVE -> REPORT_CARDS_PUBLISH
// (ACCESS_LEVELS_RBAC_IMPLEMENTATION_PLAN.md §10.2). The two new keys are
// added to the local catalog and granted to the admin system role ONLY, so
// legacy behaviour is unchanged (the legacy code paths never check them;
// admin already holds every key -- see DEFAULT_ROLE_PERMISSIONS).
// Idempotent: safe on a database where either key already exists.

const NEW_PERMISSIONS = [
  {
    key: "REPORT_CARDS_COMMENT",
    category: "REPORT_CARDS",
    description: "Write the class-teacher comment on report cards",
  },
  {
    key: "REPORT_CARDS_PUBLISH",
    category: "REPORT_CARDS",
    description: "Publish approved report cards to students and parents",
  },
];

const keyList = () => NEW_PERMISSIONS.map((p) => `'${p.key}'`).join(", ");

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      `SELECT \`key\` FROM permissions WHERE \`key\` IN (${keyList()})`,
    );
    const have = new Set(existing.map((r) => r.key));
    const toInsert = NEW_PERMISSIONS.filter((p) => !have.has(p.key));
    if (toInsert.length > 0) {
      await queryInterface.bulkInsert(
        "permissions",
        toInsert.map((p) => ({
          key: p.key,
          category: p.category,
          description: p.description,
          created_at: now,
          updated_at: now,
        })),
      );
    }

    const [adminRoleRows] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'admin' LIMIT 1",
    );
    const adminRoleId = adminRoleRows[0]?.id;
    if (!adminRoleId) return;

    const [missing] = await queryInterface.sequelize.query(
      `SELECT p.id FROM permissions p
       LEFT JOIN role_permissions rp ON rp.permission_id = p.id AND rp.role_id = ${Number(adminRoleId)}
       WHERE p.\`key\` IN (${keyList()}) AND rp.id IS NULL`,
    );
    if (missing.length > 0) {
      await queryInterface.bulkInsert(
        "role_permissions",
        missing.map((p) => ({ role_id: adminRoleId, permission_id: p.id, created_at: now })),
      );
    }
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `DELETE rp FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE p.\`key\` IN (${keyList()})`,
    );
    await queryInterface.bulkDelete("permissions", {
      key: NEW_PERMISSIONS.map((p) => p.key),
    });
  },
};
