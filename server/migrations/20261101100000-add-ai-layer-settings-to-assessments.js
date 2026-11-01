"use strict";

// AI layers (nga-tmcode reports/TMCode vibe coding proposal 2026.md §8): the
// teacher's knobs inside the Learning layer (ai_help: help strength, pseudo-code,
// tiny syntax examples, question allowance) and, for Industrial, whether students
// may use their own AI tools (ai_own_tools: Industrial · Open). NULL ai_help means
// the school's defaults. Idempotent: each column is added only when missing.

const TABLES = ["quizzes", "assignments"];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    for (const table of TABLES) {
      const columns = await queryInterface.describeTable(table);
      if (!columns.ai_help) await queryInterface.addColumn(table, "ai_help", { type: Sequelize.JSON, allowNull: true, defaultValue: null });
      if (!columns.ai_own_tools) await queryInterface.addColumn(table, "ai_own_tools", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
    }
  },

  down: async (queryInterface) => {
    for (const table of TABLES) {
      const columns = await queryInterface.describeTable(table);
      if (columns.ai_own_tools) await queryInterface.removeColumn(table, "ai_own_tools");
      if (columns.ai_help) await queryInterface.removeColumn(table, "ai_help");
    }
  },
};
