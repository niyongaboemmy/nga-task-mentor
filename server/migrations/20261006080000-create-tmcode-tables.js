"use strict";

// TMCode Phase 3 (plan §14, PROTOCOL.md): desktop exam sessions, launch
// tickets, the tamper-evident snapshot journal, telemetry, integrity flags and
// the grading queue; plus the TMCode delivery settings on proctoring_settings.
//
// Differences from plan §14, on purpose:
//  - snapshots/telemetry are stored in the row as gzip'd JSON (LONGBLOB)
//    instead of a file-server blob path;
//  - journal_nonce is stored base64 (VARCHAR) and the session keeps the head
//    of its chain (last_seq, last_hmac) so an upload is verified without
//    re-reading the journal;
//  - tmcode_runs references the question and submission directly.
// tmcode_profiles / tmcode_similarity are not created yet (profiles ship as
// data in src/tmcode/profiles.ts; similarity is Phase 5).
// Idempotent: existing tables/columns are left alone.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) =>
      typeof t === "string" ? t : t.tableName,
    );
    const create = async (name, columns, indexes = []) => {
      if (tables.includes(name)) return;
      await queryInterface.createTable(name, columns, {
        charset: "utf8mb4",
        collate: "utf8mb4_unicode_ci",
      });
      for (const ix of indexes) await queryInterface.addIndex(name, ix.fields, ix.options || {});
    };
    const now = { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") };

    await create(
      "tmcode_devices",
      {
        id: { type: Sequelize.CHAR(36), primaryKey: true },
        user_id: { type: Sequelize.INTEGER, allowNull: false },
        os: { type: Sequelize.STRING(40) },
        os_version: { type: Sequelize.STRING(40) },
        arch: { type: Sequelize.STRING(16) },
        app_version: { type: Sequelize.STRING(20) },
        first_seen: { type: Sequelize.DATE },
        last_seen: { type: Sequelize.DATE },
      },
      [{ fields: ["user_id"] }],
    );

    await create(
      "tmcode_launch_tickets",
      {
        ticket_hash: { type: Sequelize.CHAR(64), primaryKey: true },
        submission_id: { type: Sequelize.INTEGER, allowNull: false },
        user_id: { type: Sequelize.INTEGER, allowNull: false },
        quiz_id: { type: Sequelize.INTEGER, allowNull: false },
        expires_at: { type: Sequelize.DATE, allowNull: false },
        used_at: { type: Sequelize.DATE, allowNull: true },
        created_at: now,
      },
      [{ fields: ["submission_id"] }],
    );

    await create(
      "tmcode_sessions",
      {
        id: { type: Sequelize.CHAR(36), primaryKey: true },
        submission_id: { type: Sequelize.INTEGER, allowNull: false },
        quiz_id: { type: Sequelize.INTEGER, allowNull: false },
        user_id: { type: Sequelize.INTEGER, allowNull: false },
        device_id: { type: Sequelize.CHAR(36), allowNull: false },
        mode: { type: Sequelize.ENUM("practice", "monitored", "secure"), allowNull: false },
        status: {
          type: Sequelize.ENUM("active", "superseded", "revoked", "ended"),
          allowNull: false,
          defaultValue: "active",
        },
        journal_nonce: { type: Sequelize.STRING(64), allowNull: false },
        last_seq: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        last_hmac: { type: Sequelize.CHAR(64), allowNull: false, defaultValue: "" },
        env_report: { type: Sequelize.JSON, allowNull: true },
        seb_verified: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        current_question: { type: Sequelize.INTEGER, allowNull: true },
        focus: { type: Sequelize.STRING(8), allowNull: true },
        started_at: { type: Sequelize.DATE, allowNull: false },
        last_heartbeat: { type: Sequelize.DATE, allowNull: true },
        ended_at: { type: Sequelize.DATE, allowNull: true },
      },
      [{ fields: ["submission_id"] }, { fields: ["user_id"] }],
    );

    await create(
      "tmcode_snapshots",
      {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        session_id: { type: Sequelize.CHAR(36), allowNull: false },
        submission_id: { type: Sequelize.INTEGER, allowNull: false },
        question_id: { type: Sequelize.INTEGER, allowNull: false },
        seq: { type: Sequelize.INTEGER, allowNull: false },
        kind: { type: Sequelize.ENUM("auto", "run", "final", "offline_final"), allowNull: false },
        files_hash: { type: Sequelize.CHAR(64), allowNull: false },
        files_gz: { type: Sequelize.BLOB("long"), allowNull: false },
        client_ts: { type: Sequelize.DATE(3), allowNull: false },
        server_ts: { type: Sequelize.DATE(3), allowNull: false },
        hmac: { type: Sequelize.CHAR(64), allowNull: false },
      },
      [
        { fields: ["session_id", "seq"], options: { unique: true, name: "tmcode_snapshots_session_seq" } },
        { fields: ["submission_id", "question_id"] },
      ],
    );

    await create(
      "tmcode_telemetry",
      {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        session_id: { type: Sequelize.CHAR(36), allowNull: false },
        seq: { type: Sequelize.INTEGER, allowNull: false },
        events: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        events_gz: { type: Sequelize.BLOB("long"), allowNull: false },
        t_from: { type: Sequelize.BIGINT, allowNull: true },
        t_to: { type: Sequelize.BIGINT, allowNull: true },
        received_at: { type: Sequelize.DATE(3), allowNull: false },
      },
      [{ fields: ["session_id", "seq"], options: { unique: true, name: "tmcode_telemetry_session_seq" } }],
    );

    await create(
      "tmcode_flags",
      {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        session_id: { type: Sequelize.CHAR(36), allowNull: false },
        submission_id: { type: Sequelize.INTEGER, allowNull: false },
        question_id: { type: Sequelize.INTEGER, allowNull: true },
        rule: { type: Sequelize.STRING(40), allowNull: false },
        severity: { type: Sequelize.ENUM("info", "warn", "high"), allowNull: false },
        evidence: { type: Sequelize.JSON, allowNull: true },
        at: { type: Sequelize.DATE(3), allowNull: false },
        reviewed_by: { type: Sequelize.INTEGER, allowNull: true },
        review_note: { type: Sequelize.TEXT, allowNull: true },
      },
      [{ fields: ["submission_id"] }],
    );

    await create(
      "tmcode_runs",
      {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        submission_id: { type: Sequelize.INTEGER, allowNull: false },
        question_id: { type: Sequelize.INTEGER, allowNull: false },
        snapshot_id: { type: Sequelize.BIGINT, allowNull: false },
        purpose: {
          type: Sequelize.ENUM("grade", "regrade", "validate_reference", "server_run"),
          allowNull: false,
        },
        engine: { type: Sequelize.STRING(20), allowNull: true },
        status: {
          type: Sequelize.ENUM("queued", "running", "done", "error"),
          allowNull: false,
          defaultValue: "queued",
        },
        attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        results: { type: Sequelize.JSON, allowNull: true },
        score: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
        max_score: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
        error: { type: Sequelize.TEXT, allowNull: true },
        queued_at: { type: Sequelize.DATE(3), allowNull: false },
        started_at: { type: Sequelize.DATE(3), allowNull: true },
        finished_at: { type: Sequelize.DATE(3), allowNull: true },
      },
      [{ fields: ["status", "queued_at"] }, { fields: ["submission_id"] }],
    );

    const ps = await queryInterface.describeTable("proctoring_settings");
    if (!ps.tmcode_delivery) {
      await queryInterface.addColumn("proctoring_settings", "tmcode_delivery", {
        type: Sequelize.ENUM("web", "tmcode_optional", "tmcode_required"),
        allowNull: false,
        defaultValue: "web",
      });
    }
    if (!ps.tmcode_policy) {
      await queryInterface.addColumn("proctoring_settings", "tmcode_policy", {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const ps = await queryInterface.describeTable("proctoring_settings");
    if (ps.tmcode_policy) await queryInterface.removeColumn("proctoring_settings", "tmcode_policy");
    if (ps.tmcode_delivery) await queryInterface.removeColumn("proctoring_settings", "tmcode_delivery");
    for (const t of [
      "tmcode_runs",
      "tmcode_flags",
      "tmcode_telemetry",
      "tmcode_snapshots",
      "tmcode_sessions",
      "tmcode_launch_tickets",
      "tmcode_devices",
    ]) {
      await queryInterface.dropTable(t);
    }
  },
};
