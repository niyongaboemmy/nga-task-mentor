/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add mis_user_id column
    await queryInterface.addColumn("users", "mis_user_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      unique: true,
      comment: "MIS system user ID",
    });

    // Add index for performance
    await queryInterface.addIndex("users", ["mis_user_id"], {
      name: "idx_users_mis_user_id",
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove index
    await queryInterface.removeIndex("users", "idx_users_mis_user_id");

    // Remove mis_user_id column
    await queryInterface.removeColumn("users", "mis_user_id");
  },
};
