"use strict";

// Quiz soft delete: deleting a quiz keeps the row (and its questions,
// settings, submissions and proctoring data) for the record. The quiz gets
// status 'deleted' plus who/when, and the Quiz model's default scope
// (deleted_at IS NULL) hides it from every Sequelize read.
//  - quizzes.status ENUM gains 'deleted'
//  - quizzes.deleted_at DATETIME NULL (indexed), quizzes.deleted_by INT NULL
// Raw SQL that reads quizzes filters on q.deleted_at itself. Idempotent.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("quizzes", "status", {
      type: Sequelize.ENUM("draft", "published", "completed", "deleted"),
      allowNull: false,
      defaultValue: "draft",
    });
    const cols = await queryInterface.describeTable("quizzes");
    if (!cols.deleted_at) {
      await queryInterface.addColumn("quizzes", "deleted_at", { type: Sequelize.DATE, allowNull: true });
    }
    if (!cols.deleted_by) {
      await queryInterface.addColumn("quizzes", "deleted_by", { type: Sequelize.INTEGER, allowNull: true });
    }
    const indexes = (await queryInterface.showIndex("quizzes")).map((ix) => ix.name);
    if (!indexes.includes("quizzes_deleted_at")) {
      await queryInterface.addIndex("quizzes", ["deleted_at"], { name: "quizzes_deleted_at" });
    }
  },

  async down(queryInterface, Sequelize) {
    // Rolling back un-deletes: deleted quizzes come back as drafts.
    const indexes = (await queryInterface.showIndex("quizzes")).map((ix) => ix.name);
    if (indexes.includes("quizzes_deleted_at")) await queryInterface.removeIndex("quizzes", "quizzes_deleted_at");
    const cols = await queryInterface.describeTable("quizzes");
    for (const c of ["deleted_by", "deleted_at"]) {
      if (cols[c]) await queryInterface.removeColumn("quizzes", c);
    }
    await queryInterface.sequelize.query("UPDATE quizzes SET status = 'draft' WHERE status = 'deleted'");
    await queryInterface.changeColumn("quizzes", "status", {
      type: Sequelize.ENUM("draft", "published", "completed"),
      allowNull: false,
      defaultValue: "draft",
    });
  },
};
