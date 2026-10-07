"use strict";

/**
 * Last-run bookkeeping for scheduled jobs (first user: the daily early-warning
 * push, src/services/earlyWarningPush.ts, job = 'early_warning_push'). The
 * server also creates this table on first use, so a deploy works before this
 * migration runs; this keeps the schema history complete. Times are epoch ms
 * (BIGINT) to stay clear of DATETIME time-zone conversions.
 */
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `CREATE TABLE IF NOT EXISTS scheduled_job_runs (
         job VARCHAR(64) NOT NULL PRIMARY KEY,
         last_success_at BIGINT NULL,
         last_run_at BIGINT NULL,
         last_summary VARCHAR(255) NULL
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable("scheduled_job_runs");
  },
};
