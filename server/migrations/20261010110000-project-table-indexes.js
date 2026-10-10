"use strict";

/**
 * The indexes the projects/TMCode tables were meant to have.
 *
 * In production the server's sequelize.sync() created these tables (from the
 * models, which declared no indexes) before migrations 20261006080000 and
 * 20261006100000 ran, and those migrations skip a table that already exists,
 * indexes included. Without project_presence's unique (project, user, device)
 * index, every TMCode heartbeat inserted a new row instead of updating one,
 * reads picked the oldest row ("Last open 1 h ago" while the student was
 * working) and every heartbeat was recorded as an "opened" event.
 *
 * This adds each missing index (matched by columns, so databases that have
 * them are untouched), after removing the bogus "opened" events and the
 * duplicate presence rows. A unique index whose columns hold duplicates is
 * skipped with a warning rather than failing the deploy.
 */

const WANTED = [
  ["projects", ["owner_id", "slug"], { unique: true, name: "projects_owner_slug" }],
  ["projects", ["last_activity_at"], { name: "projects_last_activity_at" }],
  ["project_members", ["project_id", "user_id"], { unique: true, name: "project_members_project_user" }],
  ["project_members", ["user_id", "status"], { name: "project_members_user_id_status" }],
  ["project_revisions", ["project_id", "number"], { unique: true, name: "project_revisions_project_number" }],
  ["project_presence", ["project_id", "user_id", "device_id"], { unique: true, name: "project_presence_project_user_device" }],
  ["project_presence", ["last_seen_at"], { name: "project_presence_last_seen_at" }],
  ["project_activity_links", ["activity_type", "activity_id"], { name: "project_activity_links_activity_type_activity_id" }],
  ["project_events", ["project_id", "id"], { name: "project_events_project_id_id" }],
  ["tmcode_devices", ["user_id"], { name: "tmcode_devices_user_id" }],
  ["tmcode_launch_tickets", ["submission_id"], { name: "tmcode_launch_tickets_submission_id" }],
  ["tmcode_sessions", ["submission_id"], { name: "tmcode_sessions_submission_id" }],
  ["tmcode_sessions", ["user_id"], { name: "tmcode_sessions_user_id" }],
  ["tmcode_snapshots", ["session_id", "seq"], { unique: true, name: "tmcode_snapshots_session_seq" }],
  ["tmcode_snapshots", ["submission_id", "question_id"], { name: "tmcode_snapshots_submission_id_question_id" }],
  ["tmcode_telemetry", ["session_id", "seq"], { unique: true, name: "tmcode_telemetry_session_seq" }],
  ["tmcode_flags", ["submission_id"], { name: "tmcode_flags_submission_id" }],
  ["tmcode_runs", ["status", "queued_at"], { name: "tmcode_runs_status_queued_at" }],
  ["tmcode_runs", ["submission_id"], { name: "tmcode_runs_submission_id" }],
];

/** Existing indexes of a table as { name, unique, columns[] }. */
async function indexesOf(queryInterface, table) {
  const [rows] = await queryInterface.sequelize.query(`SHOW INDEX FROM \`${table}\``);
  const byName = new Map();
  for (const r of rows) {
    const ix = byName.get(r.Key_name) ?? { name: r.Key_name, unique: Number(r.Non_unique) === 0, columns: [] };
    ix.columns[Number(r.Seq_in_index) - 1] = r.Column_name;
    byName.set(r.Key_name, ix);
  }
  return [...byName.values()];
}

module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;
    const tables = (await queryInterface.showAllTables()).map((t) => (typeof t === "string" ? t : t.tableName));

    if (tables.includes("project_presence")) {
      if (tables.includes("project_events")) {
        // An "opened" event right after a heartbeat from the same device was a
        // heartbeat misread as an open (the duplicate rows are that history).
        await q.query(`
          DELETE e FROM project_events e
           WHERE e.type = 'opened'
             AND EXISTS (
               SELECT 1 FROM project_presence pp
                WHERE pp.project_id = e.project_id
                  AND pp.user_id = e.user_id
                  AND pp.device_id = JSON_UNQUOTE(JSON_EXTRACT(e.data, '$.device_id'))
                  AND pp.last_seen_at < e.created_at
                  AND pp.last_seen_at >= DATE_SUB(e.created_at, INTERVAL 90 SECOND))`);
      }
      // Keep each device's newest row.
      await q.query(`
        DELETE p1 FROM project_presence p1
          JOIN project_presence p2
            ON p2.project_id = p1.project_id AND p2.user_id = p1.user_id AND p2.device_id = p1.device_id
           AND (p2.last_seen_at > p1.last_seen_at OR (p2.last_seen_at = p1.last_seen_at AND p2.id > p1.id))`);
    }

    for (const [table, columns, options] of WANTED) {
      if (!tables.includes(table)) continue;
      const described = await queryInterface.describeTable(table);
      if (!columns.every((c) => described[c])) continue;
      const existing = await indexesOf(queryInterface, table);
      const same = existing.find(
        (ix) => ix.columns.join(",") === columns.join(",") && (ix.unique || !options.unique),
      );
      if (same) continue;
      if (existing.some((ix) => ix.name === options.name)) continue;
      if (options.unique) {
        const cols = columns.map((c) => `\`${c}\``).join(", ");
        const [[{ n }]] = await q.query(
          `SELECT COUNT(*) AS n FROM (SELECT 1 FROM \`${table}\` GROUP BY ${cols} HAVING COUNT(*) > 1) d`,
        );
        if (Number(n) > 0) {
          console.warn(`[migration] ${table}(${columns.join(", ")}) has ${n} duplicate groups: unique index skipped`);
          continue;
        }
      }
      await queryInterface.addIndex(table, columns, options);
    }
  },

  // The indexes are what the schema always meant to have, and the removed
  // duplicate rows / events can't be restored: nothing to undo.
  async down() {},
};
