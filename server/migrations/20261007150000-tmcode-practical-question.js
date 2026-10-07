"use strict";

// TMCode practicals in quizzes: a "tmcode_practical" question type (graded by
// the teacher with criteria), answered with a TMCode project.
//  - question_bank.question_type gains 'tmcode_practical' (read from the live
//    column so this never drops a value added elsewhere).
//  - project_activity_links.question_id: for a quiz link, the quiz_questions id
//    of the practical question the project answers (NULL for other links).
// Idempotent.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [[col]] = await queryInterface.sequelize.query(
      "SELECT COLUMN_TYPE AS t, IS_NULLABLE AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'question_bank' AND COLUMN_NAME = 'question_type'",
    );
    if (col && !col.t.includes("'tmcode_practical'")) {
      const values = col.t.replace(/^enum\(/i, "").replace(/\)$/, "");
      await queryInterface.sequelize.query(
        `ALTER TABLE question_bank MODIFY COLUMN question_type ENUM(${values},'tmcode_practical') ${col.n === "NO" ? "NOT NULL" : "NULL"}`,
      );
    }

    const links = await queryInterface.describeTable("project_activity_links");
    if (!links.question_id) {
      await queryInterface.addColumn("project_activity_links", "question_id", { type: Sequelize.INTEGER, allowNull: true });
    }
    const indexes = (await queryInterface.showIndex("project_activity_links")).map((ix) => ix.name);
    if (!indexes.includes("project_links_activity_question")) {
      await queryInterface.addIndex("project_activity_links", ["activity_type", "activity_id", "question_id"], {
        name: "project_links_activity_question",
      });
    }
  },

  async down(queryInterface) {
    const indexes = (await queryInterface.showIndex("project_activity_links")).map((ix) => ix.name);
    if (indexes.includes("project_links_activity_question")) {
      await queryInterface.removeIndex("project_activity_links", "project_links_activity_question");
    }
    const links = await queryInterface.describeTable("project_activity_links");
    if (links.question_id) await queryInterface.removeColumn("project_activity_links", "question_id");
    // question_type keeps 'tmcode_practical' only if no row uses it.
    const [[used]] = await queryInterface.sequelize.query(
      "SELECT COUNT(*) AS c FROM question_bank WHERE question_type = 'tmcode_practical'",
    );
    if (Number(used.c) === 0) {
      const [[col]] = await queryInterface.sequelize.query(
        "SELECT COLUMN_TYPE AS t, IS_NULLABLE AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'question_bank' AND COLUMN_NAME = 'question_type'",
      );
      const values = col.t.replace(/^enum\(/i, "").replace(/\)$/, "").replace(/,'tmcode_practical'/, "");
      await queryInterface.sequelize.query(
        `ALTER TABLE question_bank MODIFY COLUMN question_type ENUM(${values}) ${col.n === "NO" ? "NOT NULL" : "NULL"}`,
      );
    }
  },
};
