"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("users", "role_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "roles", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addIndex("users", ["role_id"]);
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("users", "role_id");
  },
};
