"use strict";

// TMCode Projects (PROJECTS_PLAN.md §2): personal coding projects kept in Task
// Mentor and worked on in TMCode. Seven tables -- projects, project_members,
// project_revisions, project_blobs (content-addressed, gzip'd; large ones live
// on the file-server), project_presence, project_activity_links and
// project_events -- plus:
//  - projects.git_state (JSON) and projects.last_activity_at: the last git
//    status TMCode reported (POST /projects/:id/git) and a sort key for the
//    dashboard. Not in the plan's column list; the plan keeps git state only
//    in presence, which goes stale after 60 s.
//  - assignments.submission_type gains 'project' (a project-only assignment).
//  - submissions.project_ref (JSON, nullable): which project, link and frozen
//    revision / git commit an assignment submission points at. Written only
//    by the projects submit route; the Submission model doesn't map it, so
//    nothing else reads or writes it.
// Idempotent: existing tables/columns/enum values are left alone.

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
    const id = { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true };

    await create(
      "projects",
      {
        id,
        owner_id: { type: Sequelize.INTEGER, allowNull: false },
        name: { type: Sequelize.STRING(120), allowNull: false },
        slug: { type: Sequelize.STRING(140), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        language: { type: Sequelize.STRING(60), allowNull: true },
        kind: { type: Sequelize.ENUM("github", "tm"), allowNull: false, defaultValue: "tm" },
        visibility: { type: Sequelize.ENUM("private", "course"), allowNull: false, defaultValue: "private" },
        repo_url: { type: Sequelize.STRING(500), allowNull: true },
        repo_full_name: { type: Sequelize.STRING(200), allowNull: true },
        default_branch: { type: Sequelize.STRING(120), allowNull: true },
        head_revision_id: { type: Sequelize.INTEGER, allowNull: true },
        size_bytes: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
        file_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        git_state: { type: Sequelize.JSON, allowNull: true },
        last_activity_at: { type: Sequelize.DATE, allowNull: true },
        archived_at: { type: Sequelize.DATE, allowNull: true },
        created_at: now,
        updated_at: now,
      },
      [
        { fields: ["owner_id", "slug"], options: { unique: true, name: "projects_owner_slug" } },
        { fields: ["last_activity_at"] },
      ],
    );

    await create(
      "project_members",
      {
        id,
        project_id: { type: Sequelize.INTEGER, allowNull: false },
        user_id: { type: Sequelize.INTEGER, allowNull: false },
        role: { type: Sequelize.ENUM("owner", "collaborator", "viewer"), allowNull: false },
        github_username: { type: Sequelize.STRING(100), allowNull: true },
        invited_by: { type: Sequelize.INTEGER, allowNull: true },
        status: { type: Sequelize.ENUM("invited", "active", "removed"), allowNull: false, defaultValue: "active" },
        created_at: now,
        updated_at: now,
      },
      [
        { fields: ["project_id", "user_id"], options: { unique: true, name: "project_members_project_user" } },
        { fields: ["user_id", "status"] },
      ],
    );

    await create(
      "project_revisions",
      {
        id,
        project_id: { type: Sequelize.INTEGER, allowNull: false },
        number: { type: Sequelize.INTEGER, allowNull: false },
        parent_id: { type: Sequelize.INTEGER, allowNull: true },
        author_id: { type: Sequelize.INTEGER, allowNull: false },
        message: { type: Sequelize.STRING(500), allowNull: true },
        // gzip(JSON [{path, sha256, size}]), sorted by path
        manifest_gz: { type: Sequelize.BLOB("long"), allowNull: false },
        file_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        size_bytes: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
        source: { type: Sequelize.ENUM("save", "auto", "submit"), allowNull: false, defaultValue: "save" },
        git_commit: { type: Sequelize.STRING(64), allowNull: true },
        created_at: now,
      },
      [{ fields: ["project_id", "number"], options: { unique: true, name: "project_revisions_project_number" } }],
    );

    await create("project_blobs", {
      sha256: { type: Sequelize.CHAR(64), primaryKey: true },
      size: { type: Sequelize.INTEGER, allowNull: false },
      storage: { type: Sequelize.ENUM("db", "fs"), allowNull: false },
      data_gz: { type: Sequelize.BLOB("long"), allowNull: true },
      created_at: now,
    });

    await create(
      "project_presence",
      {
        id,
        project_id: { type: Sequelize.INTEGER, allowNull: false },
        user_id: { type: Sequelize.INTEGER, allowNull: false },
        device_id: { type: Sequelize.STRING(64), allowNull: false },
        app_version: { type: Sequelize.STRING(20), allowNull: true },
        state: { type: Sequelize.JSON, allowNull: true },
        last_seen_at: { type: Sequelize.DATE, allowNull: false },
      },
      [
        {
          fields: ["project_id", "user_id", "device_id"],
          options: { unique: true, name: "project_presence_project_user_device" },
        },
        { fields: ["last_seen_at"] },
      ],
    );

    await create(
      "project_activity_links",
      {
        id,
        project_id: { type: Sequelize.INTEGER, allowNull: false },
        activity_type: { type: Sequelize.ENUM("quiz", "assignment", "manual_assessment"), allowNull: false },
        activity_id: { type: Sequelize.INTEGER, allowNull: false },
        linked_by: { type: Sequelize.INTEGER, allowNull: false },
        revision_id: { type: Sequelize.INTEGER, allowNull: true },
        git_commit: { type: Sequelize.STRING(64), allowNull: true },
        status: { type: Sequelize.ENUM("linked", "submitted"), allowNull: false, defaultValue: "linked" },
        submitted_at: { type: Sequelize.DATE, allowNull: true },
        created_at: now,
        updated_at: now,
      },
      [
        {
          fields: ["project_id", "activity_type", "activity_id"],
          options: { unique: true, name: "project_links_project_activity" },
        },
        { fields: ["activity_type", "activity_id"] },
      ],
    );

    await create(
      "project_events",
      {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        project_id: { type: Sequelize.INTEGER, allowNull: false },
        user_id: { type: Sequelize.INTEGER, allowNull: true },
        type: { type: Sequelize.STRING(30), allowNull: false },
        data: { type: Sequelize.JSON, allowNull: true },
        created_at: now,
      },
      [{ fields: ["project_id", "id"] }],
    );

    // A project-only assignment (the submission is a linked project).
    const [[col]] = await queryInterface.sequelize.query(
      "SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignments' AND COLUMN_NAME = 'submission_type'",
    );
    if (col && !String(col.t).includes("'project'")) {
      await queryInterface.sequelize.query(
        "ALTER TABLE assignments MODIFY submission_type ENUM('file','text','both','project') NOT NULL DEFAULT 'both'",
      );
    }

    const subs = await queryInterface.describeTable("submissions");
    if (!subs.project_ref) {
      await queryInterface.addColumn("submissions", "project_ref", { type: Sequelize.JSON, allowNull: true });
    }
  },

  async down(queryInterface) {
    const subs = await queryInterface.describeTable("submissions");
    if (subs.project_ref) await queryInterface.removeColumn("submissions", "project_ref");
    await queryInterface.sequelize.query(
      "UPDATE assignments SET submission_type = 'both' WHERE submission_type = 'project'",
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE assignments MODIFY submission_type ENUM('file','text','both') NOT NULL DEFAULT 'both'",
    );
    for (const t of [
      "project_events",
      "project_activity_links",
      "project_presence",
      "project_blobs",
      "project_revisions",
      "project_members",
      "projects",
    ]) {
      await queryInterface.dropTable(t).catch(() => {});
    }
  },
};
