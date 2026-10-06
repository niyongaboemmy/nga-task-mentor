"use strict";

// TMCode (desktop exam editor, plan §14 "Permissions"). Mirrors the TMCODE
// entries of src/constants/permissions.ts. Grants:
//   admin       all five
//   instructor  USE, CONSOLE_VIEW, CONSOLE_CONTROL, REVIEW_TELEMETRY
//   student     USE
// Custom roles that can attempt quizzes (QUIZZES_ATTEMPT) get TMCODE_USE, and
// ones that can grade (QUIZZES_GRADE) get the console/review keys.
// Idempotent: safe on a database where the keys or the grants already exist.

const NEW_PERMISSIONS = [
  { key: "TMCODE_USE", category: "TMCODE", description: "Open coding quizzes and practice in the TMCode desktop editor" },
  { key: "TMCODE_CONSOLE_VIEW", category: "TMCODE", description: "See the live TMCode exam console for quizzes in scope" },
  { key: "TMCODE_CONSOLE_CONTROL", category: "TMCODE", description: "Pause, extend, message, force-submit or end TMCode exam sessions" },
  { key: "TMCODE_REVIEW_TELEMETRY", category: "TMCODE", description: "Replay TMCode sessions and review integrity flags" },
  { key: "TMCODE_PROFILES_MANAGE", category: "TMCODE", description: "Manage TMCode language profiles" },
];

const STAFF = ["TMCODE_USE", "TMCODE_CONSOLE_VIEW", "TMCODE_CONSOLE_CONTROL", "TMCODE_REVIEW_TELEMETRY"];

const SYSTEM_ROLE_GRANTS = {
  admin: NEW_PERMISSIONS.map((p) => p.key),
  instructor: STAFF,
  student: ["TMCODE_USE"],
};

const CARRY_OVER = [
  { from: "QUIZZES_ATTEMPT", to: ["TMCODE_USE"] },
  { from: "QUIZZES_GRADE", to: STAFF },
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
