"use strict";

// Active users only (ACTIVE_USERS_CONTRACTS.md, "Task Mentor"): the MIS
// account status of each local user -- ACTIVE, INACTIVE, SUSPENDED, or
// REMOVED when MIS no longer returns the account. NULL = not synced yet and
// counts as active. Written on SSO sign-in and by the daily MIS status sweep
// (services/misStatusSweep.ts); read by utils/activeUsers.ts so rosters,
// pickers, rankings and counts leave inactive people out. Idempotent.

const INDEX = "users_mis_status_idx";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const columns = await queryInterface.describeTable("users");
    if (!columns.mis_status) {
      await queryInterface.addColumn("users", "mis_status", {
        type: Sequelize.STRING(16),
        allowNull: true,
        defaultValue: null,
      });
    }
    const indexes = await queryInterface.showIndex("users");
    if (!indexes.some((i) => i.name === INDEX)) {
      await queryInterface.addIndex("users", ["mis_status"], { name: INDEX });
    }
  },

  down: async (queryInterface) => {
    const indexes = await queryInterface.showIndex("users");
    if (indexes.some((i) => i.name === INDEX)) await queryInterface.removeIndex("users", INDEX);
    const columns = await queryInterface.describeTable("users");
    if (columns.mis_status) await queryInterface.removeColumn("users", "mis_status");
  },
};
