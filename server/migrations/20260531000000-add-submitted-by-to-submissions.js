"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("submissions", "submitted_by", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      references: { model: "users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    console.log("✅ Added submitted_by column to submissions table");
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("submissions", "submitted_by");
    console.log("✅ Removed submitted_by column from submissions table");
  },
};
