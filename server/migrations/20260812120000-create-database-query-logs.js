"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("database_query_logs", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      query_text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      statement_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      is_write: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      row_count: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      execution_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("success", "error"),
        allowNull: false,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      ip_address: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });

    await queryInterface.addIndex("database_query_logs", ["user_id"]);
    await queryInterface.addIndex("database_query_logs", ["created_at"]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("database_query_logs");
  },
};
