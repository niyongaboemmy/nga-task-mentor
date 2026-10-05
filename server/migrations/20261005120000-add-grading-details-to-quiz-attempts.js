"use strict";

// Per-question grading details (TM-FIX-1 / defect D1). For coding and
// algorithmic questions this is the per-test-case result list
// ({testResults, passedTests, totalTests, ...}) that used to be thrown away
// after grading, so neither students nor teachers could see which tests
// passed. The full record is stored; quizStudentView strips hidden tests
// before anything reaches a student.
// Idempotent: skips the column when it already exists.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("quiz_attempts");
    if (!table.grading_details) {
      await queryInterface.addColumn("quiz_attempts", "grading_details", {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("quiz_attempts");
    if (table.grading_details) {
      await queryInterface.removeColumn("quiz_attempts", "grading_details");
    }
  },
};
