"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // ── report_cards ───────────────────────────────────────────────────────────
    await queryInterface.createTable("report_cards", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      term: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      academic_year: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      class_teacher_comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      attendance_present: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      attendance_absent: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      attendance_late: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addIndex("report_cards", ["student_id"]);
    await queryInterface.addIndex("report_cards", ["academic_year", "term"]);

    // ── report_card_attributes ─────────────────────────────────────────────────
    await queryInterface.createTable("report_card_attributes", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      report_card_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "report_cards", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      attribute_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      rating: {
        type: Sequelize.ENUM("Excellent", "Very good", "Good"),
        allowNull: false,
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

    await queryInterface.addIndex("report_card_attributes", ["report_card_id"]);

    // ── report_card_assessments ────────────────────────────────────────────────
    await queryInterface.createTable("report_card_assessments", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      report_card_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "report_cards", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      subject_id: {
        // References an external subjects registry; no DB-level FK constraint.
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      assessment_type: {
        type: Sequelize.ENUM("quiz", "assignment"),
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

    await queryInterface.addIndex("report_card_assessments", ["report_card_id"]);
    await queryInterface.addIndex("report_card_assessments", ["subject_id"]);
    await queryInterface.addIndex("report_card_assessments", [
      "assessment_type",
      "assessment_id",
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("report_card_assessments");
    await queryInterface.dropTable("report_card_attributes");
    await queryInterface.dropTable("report_cards");
  },
};
