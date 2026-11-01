"use strict";

// AI drafts from the NGA connector (people's own Claude / ChatGPT; EXTERNAL_AI_CONTRACT.md §2):
// questions for the bank, rubrics, marking feedback. Drafts only -- the teacher confirms each
// one in Task Mentor. Model: src/models/AiDraft.model.ts. Idempotent (startup sync may have made it).

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = (await queryInterface.showAllTables()).map((t) => (typeof t === "string" ? t : t.tableName));
    if (!tables.includes("ai_drafts")) {
      await queryInterface.createTable("ai_drafts", {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        user_id: { type: Sequelize.INTEGER, allowNull: false },
        kind: { type: Sequelize.ENUM("questions", "rubric", "feedback"), allowNull: false },
        course_id: { type: Sequelize.INTEGER, allowNull: true },
        assignment_id: { type: Sequelize.INTEGER, allowNull: true },
        submission_id: { type: Sequelize.INTEGER, allowNull: true },
        title: { type: Sequelize.STRING(255), allowNull: false, defaultValue: "" },
        payload: { type: Sequelize.JSON, allowNull: false },
        status: { type: Sequelize.ENUM("draft", "applied", "discarded"), allowNull: false, defaultValue: "draft" },
        source: { type: Sequelize.STRING(32), allowNull: false, defaultValue: "connector" },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      });
    }
    const existing = new Set((await queryInterface.showIndex("ai_drafts")).map((i) => i.name));
    const add = async (fields) => {
      const name = `ai_drafts_${fields.join("_")}`;
      if (!existing.has(name)) await queryInterface.addIndex("ai_drafts", fields, { name });
    };
    await add(["user_id", "status"]);
    await add(["submission_id"]);
    await add(["assignment_id"]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("ai_drafts");
  },
};
