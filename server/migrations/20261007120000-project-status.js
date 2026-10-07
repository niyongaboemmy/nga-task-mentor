"use strict";

// Project status lifecycle: draft -> submitted -> graded, and removed (soft
// delete, restorable). The status is stored so lists can filter and sort on
// it, and kept in sync with the project's assignment links and submissions by
// tmcode/projects/status.ts (syncProjectStatus) on every write path.
//  - projects.status ENUM('draft','submitted','graded','removed') DEFAULT 'draft'
//  - projects.status_changed_at, projects.status_changed_by
// Backfill: graded when a linked assignment submission of the owner is graded,
// submitted when any link is submitted, else draft. Idempotent.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable("projects");
    if (!cols.status) {
      await queryInterface.addColumn("projects", "status", {
        type: Sequelize.ENUM("draft", "submitted", "graded", "removed"),
        allowNull: false,
        defaultValue: "draft",
      });
    }
    if (!cols.status_changed_at) {
      await queryInterface.addColumn("projects", "status_changed_at", { type: Sequelize.DATE, allowNull: true });
    }
    if (!cols.status_changed_by) {
      await queryInterface.addColumn("projects", "status_changed_by", { type: Sequelize.INTEGER, allowNull: true });
    }
    const indexes = (await queryInterface.showIndex("projects")).map((ix) => ix.name);
    if (!indexes.includes("projects_status")) {
      await queryInterface.addIndex("projects", ["status"], { name: "projects_status" });
    }

    await queryInterface.sequelize.query(`
      UPDATE projects p SET p.status = 'submitted'
      WHERE p.status = 'draft' AND EXISTS (
        SELECT 1 FROM project_activity_links l WHERE l.project_id = p.id AND l.status = 'submitted'
      )`);
    await queryInterface.sequelize.query(`
      UPDATE projects p SET p.status = 'graded'
      WHERE p.status IN ('draft','submitted') AND EXISTS (
        SELECT 1 FROM project_activity_links l
        JOIN submissions s ON s.assignment_id = l.activity_id AND s.student_id = p.owner_id
        WHERE l.project_id = p.id AND l.activity_type = 'assignment' AND s.status = 'graded'
      )`);
  },

  async down(queryInterface) {
    const indexes = (await queryInterface.showIndex("projects")).map((ix) => ix.name);
    if (indexes.includes("projects_status")) await queryInterface.removeIndex("projects", "projects_status");
    const cols = await queryInterface.describeTable("projects");
    for (const c of ["status_changed_by", "status_changed_at", "status"]) {
      if (cols[c]) await queryInterface.removeColumn("projects", c);
    }
  },
};
