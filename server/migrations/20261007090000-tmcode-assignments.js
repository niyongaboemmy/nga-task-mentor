"use strict";

// TMCode practicals (ASSIGNMENTS_PLAN.md "Data model"): an assignment can be a
// TMCode practical or case study with starter files, and each student works
// in their own workspace project.
//  - assignments: tmcode_kind (NULL = not a TMCode assignment),
//    tmcode_language, tmcode_starter_project_id, tmcode_starter_revision_id
//    (NULL = the starter's head at start time), tmcode_instructions.
//  - projects: assignment_id (the student's workspace for that assignment,
//    unique per owner + assignment; MySQL lets NULLs repeat) and
//    share_presence (live status sent to teachers; on by default).
// The Assignment model doesn't map the tmcode_* columns (AssignmentTmcode in
// models/Project.model.ts does), so code deployed before this runs keeps
// working. Idempotent: existing columns and indexes are left alone.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const assignments = await queryInterface.describeTable("assignments");
    const addA = async (name, spec) => {
      if (!assignments[name]) await queryInterface.addColumn("assignments", name, spec);
    };
    await addA("tmcode_kind", { type: Sequelize.ENUM("practical", "case_study"), allowNull: true });
    await addA("tmcode_language", { type: Sequelize.STRING(40), allowNull: true });
    await addA("tmcode_starter_project_id", { type: Sequelize.INTEGER, allowNull: true });
    await addA("tmcode_starter_revision_id", { type: Sequelize.INTEGER, allowNull: true });
    await addA("tmcode_instructions", { type: Sequelize.TEXT, allowNull: true });

    const projects = await queryInterface.describeTable("projects");
    if (!projects.assignment_id) {
      await queryInterface.addColumn("projects", "assignment_id", { type: Sequelize.INTEGER, allowNull: true });
    }
    if (!projects.share_presence) {
      await queryInterface.addColumn("projects", "share_presence", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }

    const indexes = (await queryInterface.showIndex("projects")).map((ix) => ix.name);
    if (!indexes.includes("projects_owner_assignment")) {
      await queryInterface.addIndex("projects", ["owner_id", "assignment_id"], {
        unique: true,
        name: "projects_owner_assignment",
      });
    }
    if (!indexes.includes("projects_assignment")) {
      await queryInterface.addIndex("projects", ["assignment_id"], { name: "projects_assignment" });
    }
  },

  async down(queryInterface) {
    const indexes = (await queryInterface.showIndex("projects")).map((ix) => ix.name);
    if (indexes.includes("projects_owner_assignment")) {
      await queryInterface.removeIndex("projects", "projects_owner_assignment");
    }
    if (indexes.includes("projects_assignment")) await queryInterface.removeIndex("projects", "projects_assignment");
    const projects = await queryInterface.describeTable("projects");
    if (projects.share_presence) await queryInterface.removeColumn("projects", "share_presence");
    if (projects.assignment_id) await queryInterface.removeColumn("projects", "assignment_id");

    const assignments = await queryInterface.describeTable("assignments");
    for (const col of [
      "tmcode_instructions",
      "tmcode_starter_revision_id",
      "tmcode_starter_project_id",
      "tmcode_language",
      "tmcode_kind",
    ]) {
      if (assignments[col]) await queryInterface.removeColumn("assignments", col);
    }
  },
};
