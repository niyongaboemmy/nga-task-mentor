"use strict";

// Marks status of an assignment: "counted" (default) or "part_of" -- its
// marks belong to another assessment (e.g. Section C of an exam recorded as
// one mark out of 100), so dashboards, rankings, reports and report cards
// leave them out. Students still see the mark on the assignment.
//  - assignments.marks_scope ENUM('counted','part_of') NOT NULL DEFAULT 'counted'
//  - assignments.part_of_title VARCHAR(255) NULL (what it is part of)
// Idempotent.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable("assignments");
    if (!cols.marks_scope) {
      await queryInterface.addColumn("assignments", "marks_scope", {
        type: Sequelize.ENUM("counted", "part_of"),
        allowNull: false,
        defaultValue: "counted",
      });
    }
    if (!cols.part_of_title) {
      await queryInterface.addColumn("assignments", "part_of_title", { type: Sequelize.STRING(255), allowNull: true });
    }
  },

  async down(queryInterface) {
    const cols = await queryInterface.describeTable("assignments");
    for (const c of ["part_of_title", "marks_scope"]) {
      if (cols[c]) await queryInterface.removeColumn("assignments", c);
    }
  },
};
