"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add submitted_answer column
    await queryInterface.addColumn("quiz_attempts", "submitted_answer", {
      type: Sequelize.JSON,
      allowNull: true,
    });

    // Add correct_answer column
    await queryInterface.addColumn("quiz_attempts", "correct_answer", {
      type: Sequelize.JSON,
      allowNull: true,
    });

    // Populate existing records with normalized data from answer_data and question correct_answer
    await queryInterface.sequelize.query(`
      UPDATE quiz_attempts qa
      INNER JOIN quiz_questions qq ON qa.question_id = qq.id
      SET
        qa.submitted_answer = qa.answer_data,
        qa.correct_answer = qq.correct_answer
      WHERE qa.submitted_answer IS NULL OR qa.correct_answer IS NULL
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("quiz_attempts", "submitted_answer");
    await queryInterface.removeColumn("quiz_attempts", "correct_answer");
  },
};
