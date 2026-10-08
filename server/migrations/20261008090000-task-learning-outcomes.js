"use strict";

// Learning outcomes on quizzes and assignments (competency map, MIS migration 116).
// A teacher tags a task with performance criteria from the subject's MIS
// curriculum; graded results are pushed to MIS (services/competencyEvidence.ts).
//  - task_criteria: one row per task × criterion, with the criterion's number,
//    outcome and text copied from MIS so the tags show without a round trip.
// Idempotent.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) => (typeof t === "string" ? t : t.tableName));
    if (!tables.includes("task_criteria")) {
      await queryInterface.createTable("task_criteria", {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        task_type: { type: Sequelize.ENUM("quiz", "assignment"), allowNull: false },
        task_id: { type: Sequelize.INTEGER, allowNull: false },
        subject_id: { type: Sequelize.INTEGER, allowNull: false },
        criteria_id: { type: Sequelize.INTEGER, allowNull: false },
        competency_id: { type: Sequelize.INTEGER, allowNull: false },
        element_number: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        outcome_title: { type: Sequelize.STRING(255), allowNull: false, defaultValue: "" },
        criteria_number: { type: Sequelize.STRING(20), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: false },
        created_by: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      });
    }
    const indexes = (await queryInterface.showIndex("task_criteria")).map((ix) => ix.name);
    if (!indexes.includes("task_criteria_unique")) {
      await queryInterface.addIndex("task_criteria", ["task_type", "task_id", "criteria_id"], { name: "task_criteria_unique", unique: true });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("task_criteria");
  },
};
