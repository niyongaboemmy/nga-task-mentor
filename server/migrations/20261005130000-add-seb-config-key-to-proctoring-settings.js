"use strict";

// TM-FIX-5 (defect D5): `lockdown_browser` was stored but never enforced.
// It now means "Safe Exam Browser required": starting an attempt or saving
// answers needs a valid X-SafeExamBrowser-ConfigKeyHash for this key (see
// src/utils/lockdown.ts). The key is the SEB Config Key of the quiz's .seb
// configuration (64 hex characters).
// Idempotent: skips the column when it already exists.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("proctoring_settings");
    if (!table.seb_config_key) {
      await queryInterface.addColumn("proctoring_settings", "seb_config_key", {
        type: Sequelize.STRING(128),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("proctoring_settings");
    if (table.seb_config_key) {
      await queryInterface.removeColumn("proctoring_settings", "seb_config_key");
    }
  },
};
