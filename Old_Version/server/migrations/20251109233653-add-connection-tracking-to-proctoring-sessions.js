"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add is_connected column
    await queryInterface.addColumn("proctoring_sessions", "is_connected", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment:
        "Tracks if the student is currently connected to the proctoring session",
    });

    // Add last_connection_time column
    await queryInterface.addColumn(
      "proctoring_sessions",
      "last_connection_time",
      {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Timestamp of the student's last connection to the session",
      }
    );

    // Set default values for existing records
    await queryInterface.sequelize.query(`
      UPDATE proctoring_sessions
      SET is_connected = CASE
        WHEN status = 'active' THEN true
        ELSE false
      END,
      last_connection_time = CASE
        WHEN status = 'active' THEN start_time
        ELSE NULL
      END
    `);
  },

  async down(queryInterface, Sequelize) {
    // Remove the columns
    await queryInterface.removeColumn("proctoring_sessions", "is_connected");
    await queryInterface.removeColumn(
      "proctoring_sessions",
      "last_connection_time"
    );
  },
};
