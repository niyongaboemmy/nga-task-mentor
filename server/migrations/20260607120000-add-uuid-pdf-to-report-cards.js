"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("report_cards", "uuid", {
      type: Sequelize.UUID,
      allowNull: false,
      defaultValue: Sequelize.literal("(UUID())"),
      after: "id",
    });

    await queryInterface.addColumn("report_cards", "pdf_path", {
      type: Sequelize.STRING(500),
      allowNull: true,
      defaultValue: null,
      after: "uuid",
    });

    await queryInterface.addIndex("report_cards", ["uuid"], {
      unique: true,
      name: "report_cards_uuid_unique",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex("report_cards", "report_cards_uuid_unique");
    await queryInterface.removeColumn("report_cards", "pdf_path");
    await queryInterface.removeColumn("report_cards", "uuid");
  },
};
