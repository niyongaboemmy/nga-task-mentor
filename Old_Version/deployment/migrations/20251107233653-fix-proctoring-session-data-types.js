"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Convert existing object data to JSON strings for browser_info and system_info
    await queryInterface.sequelize.query(`
      UPDATE proctoring_sessions
      SET browser_info = JSON_EXTRACT(browser_info, '$')
      WHERE JSON_TYPE(browser_info) = 'object'
    `);

    await queryInterface.sequelize.query(`
      UPDATE proctoring_sessions
      SET system_info = JSON_EXTRACT(system_info, '$')
      WHERE JSON_TYPE(system_info) = 'object'
    `);

    // Also update proctoring_events metadata that contains these fields
    await queryInterface.sequelize.query(`
      UPDATE proctoring_events
      SET metadata = JSON_SET(
        metadata,
        '$.browser_info',
        JSON_EXTRACT(JSON_EXTRACT(metadata, '$.browser_info'), '$')
      )
      WHERE JSON_TYPE(JSON_EXTRACT(metadata, '$.browser_info')) = 'object'
    `);

    await queryInterface.sequelize.query(`
      UPDATE proctoring_events
      SET metadata = JSON_SET(
        metadata,
        '$.system_info',
        JSON_EXTRACT(JSON_EXTRACT(metadata, '$.system_info'), '$')
      )
      WHERE JSON_TYPE(JSON_EXTRACT(metadata, '$.system_info')) = 'object'
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revert the changes - convert back to objects if needed
    // Note: This is a one-way migration as converting back to objects
    // would require parsing the JSON strings, which may not be safe
    console.log(
      "Note: This migration converts objects to JSON strings. Down migration does not revert data types."
    );
  },
};
