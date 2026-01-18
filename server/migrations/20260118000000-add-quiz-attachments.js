"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add attachments column to quizzes table
    await queryInterface.addColumn("quizzes", "attachments", {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
    });

    // Add attachments column to quiz_questions table
    await queryInterface.addColumn("quiz_questions", "attachments", {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
    });

    console.log(
      "✅ Added attachments columns to quizzes and quiz_questions tables",
    );
  },

  async down(queryInterface, Sequelize) {
    // Remove attachments column from quizzes table
    await queryInterface.removeColumn("quizzes", "attachments");

    // Remove attachments column from quiz_questions table
    await queryInterface.removeColumn("quiz_questions", "attachments");

    console.log(
      "✅ Removed attachments columns from quizzes and quiz_questions tables",
    );
  },
};
