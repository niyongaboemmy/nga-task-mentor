"use strict";

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `UPDATE users u
       JOIN roles r ON r.name = u.role
       SET u.role_id = r.id
       WHERE u.role_id IS NULL`
    );
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`UPDATE users SET role_id = NULL`);
  },
};
