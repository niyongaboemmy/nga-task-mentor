/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add time_limit_seconds column to quiz_questions table
    await queryInterface.addColumn("quiz_questions", "time_limit_seconds", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: "Time limit for this specific question in seconds",
    });

    // Add index for performance
    await queryInterface.addIndex("quiz_questions", ["time_limit_seconds"], {
      name: "idx_quiz_questions_time_limit_seconds",
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove index
    await queryInterface.removeIndex(
      "quiz_questions",
      "idx_quiz_questions_time_limit_seconds"
    );

    // Remove column
    await queryInterface.removeColumn("quiz_questions", "time_limit_seconds");
  },
};
