"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First, add the column as nullable
    await queryInterface.addColumn("quiz_questions", "created_by", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    // Update existing records to use the quiz creator as the question creator
    await queryInterface.sequelize.query(`
      UPDATE quiz_questions qq
      INNER JOIN quizzes q ON qq.quiz_id = q.id
      SET qq.created_by = q.created_by
      WHERE qq.created_by IS NULL
    `);

    // Now make the column NOT NULL
    await queryInterface.changeColumn("quiz_questions", "created_by", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("quiz_questions", "created_by");
  },
};
