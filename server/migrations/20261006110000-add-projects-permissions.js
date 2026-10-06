"use strict";

// TMCode Projects (PROJECTS_PLAN.md §3 "Permissions"). Mirrors the PROJECTS
// entries of src/constants/permissions.ts. Grants:
//   every role  PROJECTS_USE (own projects, sync, links)
//   admin       + PROJECTS_VIEW_ALL, PROJECTS_MONITOR
//   instructor  + PROJECTS_MONITOR
// Custom roles that can grade (QUIZZES_GRADE / SUBMISSIONS_GRADE) also get
// PROJECTS_MONITOR (scoped to their courses at request time).
// Idempotent: safe on a database where the keys or the grants already exist.

const NEW_PERMISSIONS = [
  { key: "PROJECTS_USE", category: "PROJECTS", description: "Keep coding projects in Task Mentor, sync them with TMCode and link them to activities" },
  { key: "PROJECTS_VIEW_ALL", category: "PROJECTS", description: "See every project (read-only)" },
  { key: "PROJECTS_MONITOR", category: "PROJECTS", description: "Live project monitor and projects linked to activities in scope" },
];

const SYSTEM_ROLE_GRANTS = {
  admin: ["PROJECTS_USE", "PROJECTS_VIEW_ALL", "PROJECTS_MONITOR"],
  instructor: ["PROJECTS_USE", "PROJECTS_MONITOR"],
  student: ["PROJECTS_USE"],
};

const CARRY_OVER = [
  { from: "QUIZZES_GRADE", to: ["PROJECTS_MONITOR"] },
  { from: "SUBMISSIONS_GRADE", to: ["PROJECTS_MONITOR"] },
];

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    const q = (sql, replacements = []) =>
      queryInterface.sequelize.query(sql, { replacements }).then(([rows]) => rows);

    for (const perm of NEW_PERMISSIONS) {
      const existing = await q("SELECT id FROM permissions WHERE `key` = ? LIMIT 1", [perm.key]);
      if (existing.length === 0) {
        await queryInterface.bulkInsert("permissions", [{ ...perm, created_at: now, updated_at: now }]);
      }
    }

    const permIds = {};
    for (const row of await q(
      "SELECT id, `key` FROM permissions WHERE `key` IN (?)",
      [NEW_PERMISSIONS.map((p) => p.key)],
    )) {
      permIds[row.key] = Number(row.id);
    }

    const wanted = new Map();
    const want = (roleId, key) => {
      const id = Number(roleId);
      if (!wanted.has(id)) wanted.set(id, new Set());
      wanted.get(id).add(key);
    };

    // "All users": every existing role, system or custom.
    for (const r of await q("SELECT id FROM roles")) want(r.id, "PROJECTS_USE");
    for (const [name, keys] of Object.entries(SYSTEM_ROLE_GRANTS)) {
      const rows = await q("SELECT id FROM roles WHERE name = ? LIMIT 1", [name]);
      if (rows[0]) keys.forEach((k) => want(rows[0].id, k));
    }
    for (const { from, to } of CARRY_OVER) {
      const rows = await q(
        `SELECT DISTINCT rp.role_id FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
         JOIN roles r ON r.id = rp.role_id
         WHERE p.\`key\` = ? AND r.name NOT IN (?)`,
        [from, Object.keys(SYSTEM_ROLE_GRANTS)],
      );
      rows.forEach((r) => to.forEach((k) => want(r.role_id, k)));
    }

    const inserts = [];
    for (const [roleId, keys] of wanted) {
      for (const key of keys) {
        const permissionId = permIds[key];
        if (!permissionId) continue;
        const has = await q(
          "SELECT id FROM role_permissions WHERE role_id = ? AND permission_id = ? LIMIT 1",
          [roleId, permissionId],
        );
        if (has.length === 0) inserts.push({ role_id: roleId, permission_id: permissionId, created_at: now });
      }
    }
    if (inserts.length > 0) await queryInterface.bulkInsert("role_permissions", inserts);
  },

  down: async (queryInterface) => {
    const keys = NEW_PERMISSIONS.map((p) => p.key);
    await queryInterface.sequelize.query(
      `DELETE rp FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE p.\`key\` IN (?)`,
      { replacements: [keys] },
    );
    await queryInterface.bulkDelete("permissions", { key: keys });
  },
};
