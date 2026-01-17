/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add is_public column
    await queryInterface.addColumn('quizzes', 'is_public', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether the quiz is publicly accessible'
    });

    // Update existing archived status to completed
    await queryInterface.sequelize.query(
      "UPDATE quizzes SET status = 'completed' WHERE status = 'archived'"
    );

    // Change ENUM to use completed instead of archived
    await queryInterface.changeColumn('quizzes', 'status', {
      type: Sequelize.ENUM('draft', 'published', 'completed'),
      allowNull: false,
      defaultValue: 'draft',
      comment: 'Quiz status: draft, published, or completed'
    });

    // Add indexes for performance
    await queryInterface.addIndex('quizzes', ['is_public'], {
      name: 'idx_quizzes_is_public'
    });

    await queryInterface.addIndex('quizzes', ['status', 'is_public'], {
      name: 'idx_quizzes_status_public'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex('quizzes', 'idx_quizzes_status_public');
    await queryInterface.removeIndex('quizzes', 'idx_quizzes_is_public');

    // Change ENUM back to use archived
    await queryInterface.changeColumn('quizzes', 'status', {
      type: Sequelize.ENUM('draft', 'published', 'archived'),
      allowNull: false,
      defaultValue: 'draft'
    });

    // Update completed status back to archived
    await queryInterface.sequelize.query(
      "UPDATE quizzes SET status = 'archived' WHERE status = 'completed'"
    );

    // Remove is_public column
    await queryInterface.removeColumn('quizzes', 'is_public');
  }
};
