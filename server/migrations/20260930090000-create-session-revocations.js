"use strict";

/**
 * Single sign-out (nga_central_mis/docs/SINGLE_SIGN_OUT.md). The server also
 * creates this table on first use (src/services/sessionRevocation.ts), so a
 * deploy works before this migration runs; this keeps the schema history
 * complete.
 */
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `CREATE TABLE IF NOT EXISTS session_revocations (
         user_id INT NOT NULL PRIMARY KEY,
         revoked_at DATETIME(3) NOT NULL
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable("session_revocations");
  },
};
