"use strict";

// AI usage control (AI_USAGE_CONTROL_PLAN.md §3.4, §5.6): the teacher's
// per-item AI setting for students -- off (default), hints (Socratic hints
// only) or full (the whole assistant). Every existing quiz and assignment
// becomes "off". Idempotent: each column is added only when missing.

const TABLES = ["quizzes", "assignments"];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    for (const table of TABLES) {
      const columns = await queryInterface.describeTable(table);
      if (columns.ai_mode) continue;
      await queryInterface.addColumn(table, "ai_mode", {
        type: Sequelize.ENUM("off", "hints", "full"),
        allowNull: false,
        defaultValue: "off",
      });
    }
  },

  down: async (queryInterface) => {
    for (const table of TABLES) {
      const columns = await queryInterface.describeTable(table);
      if (columns.ai_mode) await queryInterface.removeColumn(table, "ai_mode");
    }
  },
};
