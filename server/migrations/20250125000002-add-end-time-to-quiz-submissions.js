/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add end_time column to quiz_submissions table
    await queryInterface.addColumn("quiz_submissions", "end_time", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "Calculated end time based on quiz duration",
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove end_time column
    await queryInterface.removeColumn("quiz_submissions", "end_time");
  },
};
