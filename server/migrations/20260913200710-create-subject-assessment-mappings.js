"use strict";

// The canonical, subject-wide assessment→category mapping (see
// SubjectAssessmentMapping.model.ts). Saving a mapping here fans out to every
// enrolled student's report_card_assessments row (reportCard.controller.ts::
// saveSubjectMapping) — this table itself is never read by the grading/PDF
// pipeline, only by the builder UI to know what a subject's current mapping
// looks like without picking an arbitrary student's card to inspect.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("subject_assessment_mappings", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      subject_id: {
        // References an external subjects registry; no DB-level FK constraint
        // (same convention as report_card_assessments.subject_id).
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      term: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      academic_year: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      assessment_type: {
        type: Sequelize.ENUM("quiz", "assignment", "manual"),
        allowNull: false,
      },
      assessment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      category: {
        type: Sequelize.ENUM("CW", "HW", "MD", "EOT"),
        allowNull: false,
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });

    await queryInterface.addIndex("subject_assessment_mappings", [
      "subject_id",
      "term",
      "academic_year",
    ]);

    // One category per (subject, term, year, assessment) — the same
    // assessment can't be mapped into two categories at once for a subject.
    await queryInterface.addIndex("subject_assessment_mappings", [
      "subject_id",
      "term",
      "academic_year",
      "assessment_type",
      "assessment_id",
    ], {
      unique: true,
      name: "subject_assessment_mappings_unique_assessment",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("subject_assessment_mappings");
  },
};
