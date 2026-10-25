"use strict";

// Premium AI per user and the app's small settings (GRADING_PREMIUM_CONTRACTS.md):
//   ai_entitlements  user_id (users.id) -> premium on/off, daily limit, note, who granted it
//   app_settings     key -> JSON value (e.g. "ai.byok_allowed": true)
// Models: src/models/AiSettings.model.ts. Idempotent (startup sync may have made them).

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = (await queryInterface.showAllTables()).map((t) => (typeof t === "string" ? t : t.tableName));
    if (!tables.includes("ai_entitlements")) {
      await queryInterface.createTable("ai_entitlements", {
        user_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false },
        premium: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        daily_limit: { type: Sequelize.INTEGER, allowNull: true },
        note: { type: Sequelize.STRING(500), allowNull: true },
        granted_by: { type: Sequelize.INTEGER, allowNull: true },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      });
    }
    if (!tables.includes("app_settings")) {
      await queryInterface.createTable("app_settings", {
        key: { type: Sequelize.STRING(100), primaryKey: true, allowNull: false },
        value: { type: Sequelize.TEXT, allowNull: true },
        updated_by: { type: Sequelize.INTEGER, allowNull: true },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("ai_entitlements");
    await queryInterface.dropTable("app_settings");
  },
};
