"use strict";

/**
 * Report card workflow (docs/REPORTS_AND_REPORT_CARD_REVIEW.md §6):
 *   draft -> reviewed -> approved -> published, with an audit trail and a
 *   frozen snapshot per approval.
 *
 * 1. report_cards.student_id is the student's MIS id (the subject-mapping
 *    fan-out writes MIS ids), so the old FK to users.id is dropped. Legacy
 *    cards keyed on a linked local users.id are re-keyed to the MIS id.
 * 2. Duplicate (student_id, term, academic_year) cards are merged into one
 *    (the most complete card keeps its id; other subjects' mappings,
 *    attributes, comment and attendance move over), then a unique key stops
 *    new ones.
 * 3. status ENUM(draft,saved,approved) -> ENUM(draft,reviewed,approved,published):
 *    saved ("marked complete", never reviewed) -> draft; approved (which was
 *    already visible to students) -> published. Published cards get their
 *    snapshot on first read (reportCardSnapshot.service.ts, lazy backfill).
 * 4. New columns on report_cards; new tables report_card_snapshots,
 *    report_card_transitions, report_cycles, report_cycle_subject_signoffs.
 * 5. manual_assessment_scores.status ENUM(scored,absent,exempt) and
 *    report_card_assessments.mark_status ENUM(auto,absent,exempt): absent
 *    counts as 0, exempt is left out of the category average.
 * 6. REPORT_CARDS_REVIEW permission, granted to the admin role.
 *
 * Idempotent: every step checks what is already there.
 */

const STATUS_FINAL = ["draft", "reviewed", "approved", "published"];
const STATUS_RANK = { draft: 0, saved: 0, reviewed: 1, approved: 2, published: 3 };

async function tableExists(qi, name) {
  const tables = await qi.showAllTables();
  return tables.map((t) => (typeof t === "string" ? t : t.tableName)).includes(name);
}

async function addColumnIfMissing(qi, table, column, spec) {
  const cols = await qi.describeTable(table);
  if (!cols[column]) await qi.addColumn(table, column, spec);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const qi = queryInterface;
    const sq = qi.sequelize;
    const q = (sql, replacements) => sq.query(sql, { replacements, type: Sequelize.QueryTypes.SELECT });
    const exec = (sql, replacements) => sq.query(sql, { replacements });

    // ── 1. Drop the FK to users.id ───────────────────────────────────────────
    const fks = await q(
      `SELECT CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report_cards'
          AND COLUMN_NAME = 'student_id' AND REFERENCED_TABLE_NAME = 'users'`,
    );
    for (const fk of fks) await exec(`ALTER TABLE report_cards DROP FOREIGN KEY \`${fk.name}\``);

    // Re-key legacy local-id cards: the id belongs to no one as a MIS id, and
    // the local user it names is linked to a MIS account.
    await exec(
      `UPDATE report_cards rc
         JOIN users u ON u.id = rc.student_id
          SET rc.student_id = u.mis_user_id
        WHERE u.mis_user_id IS NOT NULL
          AND u.mis_user_id <> rc.student_id
          AND NOT EXISTS (SELECT 1 FROM (SELECT mis_user_id FROM users WHERE mis_user_id IS NOT NULL) m
                           WHERE m.mis_user_id = rc.student_id)`,
    );

    // ── 2. Merge duplicates ──────────────────────────────────────────────────
    const dupes = await q(
      `SELECT student_id, term, academic_year FROM report_cards
        GROUP BY student_id, term, academic_year HAVING COUNT(*) > 1`,
    );
    for (const d of dupes) {
      const cards = await q(
        `SELECT rc.*,
                (SELECT COUNT(*) FROM report_card_assessments a WHERE a.report_card_id = rc.id) AS n_assess,
                (SELECT COUNT(*) FROM report_card_attributes t WHERE t.report_card_id = rc.id) AS n_attr
           FROM report_cards rc
          WHERE rc.student_id = ? AND rc.term = ? AND rc.academic_year = ?`,
        [d.student_id, d.term, d.academic_year],
      );
      cards.sort(
        (a, b) =>
          Number(b.n_assess) + Number(b.n_attr) - (Number(a.n_assess) + Number(a.n_attr)) ||
          new Date(b.updated_at) - new Date(a.updated_at),
      );
      const [keeper, ...losers] = cards;
      let status = keeper.status;
      for (const loser of losers) {
        if ((STATUS_RANK[loser.status] ?? 0) > (STATUS_RANK[status] ?? 0)) status = loser.status;
        // Subjects the keeper lacks move over with their rows.
        await exec(
          `UPDATE report_card_assessments SET report_card_id = ?
            WHERE report_card_id = ?
              AND subject_id NOT IN (SELECT s FROM (SELECT DISTINCT subject_id AS s FROM report_card_assessments
                                                     WHERE report_card_id = ?) k)`,
          [keeper.id, loser.id, keeper.id],
        );
        const keeperAttrs = await q(`SELECT COUNT(*) AS n FROM report_card_attributes WHERE report_card_id = ?`, [keeper.id]);
        if (Number(keeperAttrs[0].n) === 0) {
          await exec(`UPDATE report_card_attributes SET report_card_id = ? WHERE report_card_id = ?`, [keeper.id, loser.id]);
        }
        await exec(
          `UPDATE report_cards k JOIN report_cards l ON l.id = ?
              SET k.class_teacher_comment = COALESCE(NULLIF(k.class_teacher_comment, ''), l.class_teacher_comment),
                  k.attendance_present = IF(k.attendance_present + k.attendance_absent + k.attendance_late = 0, l.attendance_present, k.attendance_present),
                  k.attendance_absent  = IF(k.attendance_present + k.attendance_absent + k.attendance_late = 0, l.attendance_absent,  k.attendance_absent),
                  k.attendance_late    = IF(k.attendance_present + k.attendance_absent + k.attendance_late = 0, l.attendance_late,    k.attendance_late)
            WHERE k.id = ?`,
          [loser.id, keeper.id],
        );
        await exec(`DELETE FROM report_card_assessments WHERE report_card_id = ?`, [loser.id]);
        await exec(`DELETE FROM report_card_attributes WHERE report_card_id = ?`, [loser.id]);
        await exec(`DELETE FROM report_cards WHERE id = ?`, [loser.id]);
      }
      if (status !== keeper.status) await exec(`UPDATE report_cards SET status = ? WHERE id = ?`, [status, keeper.id]);
      console.log(
        `report-card-workflow: merged ${losers.length} duplicate card(s) into #${keeper.id} (student ${d.student_id}, ${d.term} ${d.academic_year})`,
      );
    }

    const indexes = await qi.showIndex("report_cards");
    if (!indexes.some((i) => i.name === "uq_report_card")) {
      await qi.addIndex("report_cards", ["student_id", "term", "academic_year"], { unique: true, name: "uq_report_card" });
    }

    // ── 3. Status enum ───────────────────────────────────────────────────────
    const cols = await qi.describeTable("report_cards");
    const type = String(cols.status.type);
    if (!type.includes("'published'") || type.includes("'saved'")) {
      await exec(
        `ALTER TABLE report_cards MODIFY status ENUM('draft','saved','reviewed','approved','published') NOT NULL DEFAULT 'draft'`,
      );
      await exec(`UPDATE report_cards SET status = 'draft' WHERE status = 'saved'`);
      await exec(`UPDATE report_cards SET status = 'published' WHERE status = 'approved'`);
      await exec(
        `ALTER TABLE report_cards MODIFY status ENUM(${STATUS_FINAL.map((s) => `'${s}'`).join(",")}) NOT NULL DEFAULT 'draft'`,
      );
    }

    // ── 4. Columns ───────────────────────────────────────────────────────────
    const INT_NULL = { type: Sequelize.INTEGER, allowNull: true };
    const DATE_NULL = { type: Sequelize.DATE, allowNull: true };
    await addColumnIfMissing(qi, "report_cards", "version", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    await addColumnIfMissing(qi, "report_cards", "class_group_id", INT_NULL);
    await addColumnIfMissing(qi, "report_cards", "class_name", { type: Sequelize.STRING(120), allowNull: true });
    await addColumnIfMissing(qi, "report_cards", "attendance_excused", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    await addColumnIfMissing(qi, "report_cards", "attendance_sick", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    await addColumnIfMissing(qi, "report_cards", "attendance_source", {
      type: Sequelize.ENUM("manual", "imported"),
      allowNull: false,
      defaultValue: "manual",
    });
    await addColumnIfMissing(qi, "report_cards", "head_teacher_comment", { type: Sequelize.TEXT, allowNull: true });
    await addColumnIfMissing(qi, "report_cards", "reviewed_by", INT_NULL);
    await addColumnIfMissing(qi, "report_cards", "reviewed_at", DATE_NULL);
    await addColumnIfMissing(qi, "report_cards", "approved_by", INT_NULL);
    await addColumnIfMissing(qi, "report_cards", "approved_at", DATE_NULL);
    await addColumnIfMissing(qi, "report_cards", "published_by", INT_NULL);
    await addColumnIfMissing(qi, "report_cards", "published_at", DATE_NULL);
    await addColumnIfMissing(qi, "report_cards", "publish_at", DATE_NULL);
    await addColumnIfMissing(qi, "report_cards", "returned_reason", { type: Sequelize.STRING(500), allowNull: true });

    // Published-before-this-migration cards: approved and published "then".
    await exec(
      `UPDATE report_cards SET version = 1, approved_at = COALESCE(approved_at, updated_at),
              published_at = COALESCE(published_at, updated_at)
        WHERE status = 'published' AND version = 0`,
    );
    const idx2 = await qi.showIndex("report_cards");
    if (!idx2.some((i) => i.name === "report_cards_cycle")) {
      await qi.addIndex("report_cards", ["class_group_id", "academic_year", "term", "status"], { name: "report_cards_cycle" });
    }
    if (!idx2.some((i) => i.name === "report_cards_publish_at")) {
      await qi.addIndex("report_cards", ["status", "publish_at"], { name: "report_cards_publish_at" });
    }

    // ── Snapshots ────────────────────────────────────────────────────────────
    if (!(await tableExists(qi, "report_card_snapshots"))) {
      await qi.createTable("report_card_snapshots", {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        report_card_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "report_cards", key: "id" },
          onDelete: "CASCADE",
        },
        version: { type: Sequelize.INTEGER, allowNull: false },
        payload: { type: Sequelize.JSON, allowNull: false },
        pdf_path: { type: Sequelize.STRING(500), allowNull: true },
        pdf_sha256: { type: Sequelize.STRING(64), allowNull: true },
        approved_by: { type: Sequelize.INTEGER, allowNull: true },
        approved_at: { type: Sequelize.DATE, allowNull: false },
        backfilled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        superseded_at: { type: Sequelize.DATE, allowNull: true },
        superseded_reason: { type: Sequelize.STRING(500), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
      await qi.addIndex("report_card_snapshots", ["report_card_id", "version"], { unique: true, name: "uq_snapshot_version" });
    }

    // ── Transitions (audit trail) ────────────────────────────────────────────
    if (!(await tableExists(qi, "report_card_transitions"))) {
      await qi.createTable("report_card_transitions", {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        report_card_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "report_cards", key: "id" },
          onDelete: "CASCADE",
        },
        action: { type: Sequelize.STRING(20), allowNull: false },
        from_status: { type: Sequelize.STRING(20), allowNull: false },
        to_status: { type: Sequelize.STRING(20), allowNull: false },
        version: { type: Sequelize.INTEGER, allowNull: true },
        actor_id: { type: Sequelize.INTEGER, allowNull: true },
        actor_name: { type: Sequelize.STRING(160), allowNull: true },
        reason: { type: Sequelize.STRING(500), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
      });
      await qi.addIndex("report_card_transitions", ["report_card_id", "created_at"], { name: "report_card_transitions_card" });
    }

    // ── Report cycles: class group x term ────────────────────────────────────
    if (!(await tableExists(qi, "report_cycles"))) {
      await qi.createTable("report_cycles", {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        class_group_id: { type: Sequelize.INTEGER, allowNull: false },
        class_name: { type: Sequelize.STRING(120), allowNull: true },
        term: { type: Sequelize.STRING(50), allowNull: false },
        academic_year: { type: Sequelize.STRING(20), allowNull: false },
        marks_due_at: { type: Sequelize.DATE, allowNull: true },
        review_due_at: { type: Sequelize.DATE, allowNull: true },
        publish_at: { type: Sequelize.DATE, allowNull: true },
        next_term_begins_on: { type: Sequelize.DATEONLY, allowNull: true },
        updated_by: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
      await qi.addIndex("report_cycles", ["class_group_id", "term", "academic_year"], { unique: true, name: "uq_report_cycle" });
    }

    if (!(await tableExists(qi, "report_cycle_subject_signoffs"))) {
      await qi.createTable("report_cycle_subject_signoffs", {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        cycle_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "report_cycles", key: "id" },
          onDelete: "CASCADE",
        },
        subject_id: { type: Sequelize.INTEGER, allowNull: false },
        status: { type: Sequelize.ENUM("open", "submitted"), allowNull: false, defaultValue: "open" },
        submitted_by: { type: Sequelize.INTEGER, allowNull: true },
        submitted_by_name: { type: Sequelize.STRING(160), allowNull: true },
        submitted_at: { type: Sequelize.DATE, allowNull: true },
        returned_reason: { type: Sequelize.STRING(500), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
      await qi.addIndex("report_cycle_subject_signoffs", ["cycle_id", "subject_id"], { unique: true, name: "uq_cycle_subject" });
    }

    // ── 5. Absent / exempt marks ─────────────────────────────────────────────
    await addColumnIfMissing(qi, "manual_assessment_scores", "status", {
      type: Sequelize.ENUM("scored", "absent", "exempt"),
      allowNull: false,
      defaultValue: "scored",
    });

    // A card-level resolution of a missing mark at subject sign-off, for any
    // assessment type: auto (use the recorded mark), absent (0), exempt (left out).
    await addColumnIfMissing(qi, "report_card_assessments", "mark_status", {
      type: Sequelize.ENUM("auto", "absent", "exempt"),
      allowNull: false,
      defaultValue: "auto",
    });

    // ── 6. REPORT_CARDS_REVIEW ───────────────────────────────────────────────
    if (await tableExists(qi, "permissions")) {
      const now = new Date();
      const existing = await q(`SELECT id FROM permissions WHERE \`key\` = 'REPORT_CARDS_REVIEW' LIMIT 1`).catch(() => null);
      if (existing && existing.length === 0) {
        await qi.bulkInsert("permissions", [
          {
            key: "REPORT_CARDS_REVIEW",
            category: "REPORT_CARDS",
            description: "Review report cards before approval (class teacher / Director of Studies)",
            created_at: now,
            updated_at: now,
          },
        ]).catch((e) => console.warn("report-card-workflow: REPORT_CARDS_REVIEW insert skipped:", e.message));
      }
      const [perm] = await q(`SELECT id FROM permissions WHERE \`key\` = 'REPORT_CARDS_REVIEW' LIMIT 1`).catch(() => []);
      const [admin] = await q(`SELECT id FROM roles WHERE name = 'admin' LIMIT 1`).catch(() => []);
      if (perm && admin) {
        const has = await q(`SELECT 1 FROM role_permissions WHERE role_id = ? AND permission_id = ?`, [admin.id, perm.id]);
        if (has.length === 0) {
          await qi.bulkInsert("role_permissions", [{ role_id: admin.id, permission_id: perm.id, created_at: now }]).catch((e) =>
            console.warn("report-card-workflow: admin grant skipped:", e.message),
          );
        }
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const qi = queryInterface;
    const sq = qi.sequelize;
    for (const t of ["report_cycle_subject_signoffs", "report_cycles", "report_card_transitions", "report_card_snapshots"]) {
      if (await tableExists(qi, t)) await qi.dropTable(t);
    }
    const cols = await qi.describeTable("report_cards");
    if (String(cols.status.type).includes("'published'")) {
      await sq.query(
        `ALTER TABLE report_cards MODIFY status ENUM('draft','saved','reviewed','approved','published') NOT NULL DEFAULT 'draft'`,
      );
      await sq.query(`UPDATE report_cards SET status = 'saved' WHERE status = 'reviewed'`);
      await sq.query(`UPDATE report_cards SET status = 'approved' WHERE status = 'published'`);
      await sq.query(`ALTER TABLE report_cards MODIFY status ENUM('draft','saved','approved') NOT NULL DEFAULT 'draft'`);
    }
    for (const c of [
      "version", "class_group_id", "class_name", "attendance_excused", "attendance_sick", "attendance_source",
      "head_teacher_comment", "reviewed_by", "reviewed_at", "approved_by", "approved_at", "published_by",
      "published_at", "publish_at", "returned_reason",
    ]) {
      if (cols[c]) await qi.removeColumn("report_cards", c);
    }
    const raCols = await qi.describeTable("report_card_assessments");
    if (raCols.mark_status) await qi.removeColumn("report_card_assessments", "mark_status");
    const msCols = await qi.describeTable("manual_assessment_scores");
    if (msCols.status) await qi.removeColumn("manual_assessment_scores", "status");
    // The unique key and the dropped FK stay: re-adding the FK would fail on MIS-keyed cards.
    await sq.query(`DELETE rp FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.\`key\` = 'REPORT_CARDS_REVIEW'`).catch(() => {});
    await sq.query(`DELETE FROM permissions WHERE \`key\` = 'REPORT_CARDS_REVIEW'`).catch(() => {});
  },
};
