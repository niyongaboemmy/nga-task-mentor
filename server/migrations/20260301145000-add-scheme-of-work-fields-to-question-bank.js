"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add scheme_of_work_entry_id column to question_bank table
    await queryInterface.addColumn("question_bank", "scheme_of_work_entry_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
    });

    // Add scheme_of_work_entry_title column to question_bank table
    await queryInterface.addColumn(
      "question_bank",
      "scheme_of_work_entry_title",
      {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      },
    );

    console.log(
      "✅ Added scheme_of_work_entry_id and scheme_of_work_entry_title columns to question_bank table",
    );
  },

  async down(queryInterface, Sequelize) {
    // Remove scheme_of_work_entry_id column from question_bank table
    await queryInterface.removeColumn(
      "question_bank",
      "scheme_of_work_entry_id",
    );

    // Remove scheme_of_work_entry_title column from question_bank table
    await queryInterface.removeColumn(
      "question_bank",
      "scheme_of_work_entry_title",
    );

    console.log(
      "✅ Removed scheme_of_work_entry_id and scheme_of_work_entry_title columns from question_bank table",
    );
  },
};
