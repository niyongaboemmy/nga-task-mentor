"use strict";

// Overall Ranking visibility becomes a permission instead of "anyone with
// COURSES_VIEW" (see RANKINGS in src/constants/permissions.ts):
//   RANKINGS_VIEW_OWN  a student's own position: top-bar chip, /ranking,
//                      a subject's Ranking tab, the dashboard Standing card
//   RANKINGS_VIEW_ALL  the named staff leaderboard and a student's class
//                      standing on their profile
//
// Grants keep today's behaviour: admin gets both, instructor the leaderboard,
// student their own position. A custom role that could already see the
// ranking gets the matching key: COURSES_VIEW_GRADES → VIEW_ALL,
// COURSES_VIEW_OWN_GRADES → VIEW_OWN. An admin can then switch either off per
// role from Roles & Permissions.
// Idempotent: safe on a database where the keys or the grants already exist.

const NEW_PERMISSIONS = [
  {
    key: "RANKINGS_VIEW_OWN",
    category: "RANKINGS",
    description:
      "See own class position: the top-bar standing chip, the Overall Ranking page, a subject's Ranking tab and the dashboard Standing card",
  },
  {
    key: "RANKINGS_VIEW_ALL",
    category: "RANKINGS",
    description:
      "See the named class leaderboard for the subjects in scope, and a student's class standing on their profile",
  },
];

const SYSTEM_ROLE_GRANTS = {
  admin: ["RANKINGS_VIEW_OWN", "RANKINGS_VIEW_ALL"],
  instructor: ["RANKINGS_VIEW_ALL"],
  student: ["RANKINGS_VIEW_OWN"],
};

// Custom roles: the permission that already let them see the matching view.
const CARRY_OVER = [
  { from: "COURSES_VIEW_GRADES", to: "RANKINGS_VIEW_ALL" },
  { from: "COURSES_VIEW_OWN_GRADES", to: "RANKINGS_VIEW_OWN" },
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

    // role_id -> keys to grant
    const wanted = new Map();
    const want = (roleId, key) => {
      const id = Number(roleId);
      if (!wanted.has(id)) wanted.set(id, new Set());
      wanted.get(id).add(key);
    };

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
      rows.forEach((r) => want(r.role_id, to));
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
