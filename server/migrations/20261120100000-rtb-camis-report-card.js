"use strict";

// RTB / CAMIS report card format:
//  - report_card_assessments.category and subject_assessment_mappings.category
//    gain 'IA' (integrated, Term 3), 'FA' (formative) and 'CA' (comprehensive) for the TVET builder;
//  - report_cards.behaviour_mark DECIMAL(5,2) NULL (behaviour out of 40).
// Idempotent. Production: run migrations/sql/20261120-rtb-camis-report-card.sql.

const CATS = ["CW", "HW", "MD", "EOT", "IA", "FA", "CA"];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const table of ["report_card_assessments", "subject_assessment_mappings"]) {
      await queryInterface.changeColumn(table, "category", { type: Sequelize.ENUM(...CATS), allowNull: false });
    }
    const cols = await queryInterface.describeTable("report_cards");
    if (!cols.behaviour_mark) {
      await queryInterface.addColumn("report_cards", "behaviour_mark", { type: Sequelize.DECIMAL(5, 2), allowNull: true });
    }
  },

  async down(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable("report_cards");
    if (cols.behaviour_mark) await queryInterface.removeColumn("report_cards", "behaviour_mark");
    for (const table of ["report_card_assessments", "subject_assessment_mappings"]) {
      await queryInterface.sequelize.query(`DELETE FROM ${table} WHERE category IN ('IA','FA','CA')`);
      await queryInterface.changeColumn(table, "category", { type: Sequelize.ENUM("CW", "HW", "MD", "EOT"), allowNull: false });
    }
  },
};
