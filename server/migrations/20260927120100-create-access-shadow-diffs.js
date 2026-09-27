"use strict";

// Access control v2 shadow mode (ACCESS_V2_MODE=shadow): every disagreement
// between the legacy local-permission check and the v2 (MIS snapshot)
// decision is counted here -- one row per user/capability/route/outcome
// pair, with a hits counter, for leadership review before enforcement.
// Written by server/src/access/policy.ts; nothing reads it at runtime.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("access_shadow_diffs", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      user_id: { type: Sequelize.INTEGER, allowNull: false, comment: "local users.id" },
      mis_user_id: { type: Sequelize.INTEGER, allowNull: true },
      capability: { type: Sequelize.STRING(120), allowNull: false },
      route: { type: Sequelize.STRING(190), allowNull: false },
      legacy_allowed: { type: Sequelize.BOOLEAN, allowNull: false },
      v2_allowed: { type: Sequelize.BOOLEAN, allowNull: false },
      v2_depth: { type: Sequelize.STRING(16), allowNull: true },
      sample_target: { type: Sequelize.STRING(500), allowNull: true },
      hits: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      first_seen: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      last_seen: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
    await queryInterface.addIndex(
      "access_shadow_diffs",
      ["user_id", "capability", "route", "legacy_allowed", "v2_allowed"],
      { unique: true, name: "access_shadow_diffs_unique" },
    );
    await queryInterface.addIndex("access_shadow_diffs", ["last_seen"], {
      name: "access_shadow_diffs_last_seen",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("access_shadow_diffs");
  },
};
