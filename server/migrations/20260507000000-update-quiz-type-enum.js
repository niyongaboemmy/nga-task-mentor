'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query("UPDATE quizzes SET type = 'Quiz' WHERE type = 'practice';");
    await queryInterface.sequelize.query("UPDATE quizzes SET type = 'Assessment' WHERE type = 'graded';");
    await queryInterface.sequelize.query("UPDATE quizzes SET type = 'Exam' WHERE type = 'exam';");
    await queryInterface.sequelize.query(
      "ALTER TABLE quizzes MODIFY COLUMN type ENUM('Assessment','Homework','Quiz','Exam') NOT NULL DEFAULT 'Quiz';"
    );
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query("UPDATE quizzes SET type = 'practice' WHERE type = 'Quiz';");
    await queryInterface.sequelize.query("UPDATE quizzes SET type = 'graded' WHERE type = 'Assessment';");
    await queryInterface.sequelize.query("UPDATE quizzes SET type = 'exam' WHERE type = 'Exam';");
    await queryInterface.sequelize.query(
      "ALTER TABLE quizzes MODIFY COLUMN type ENUM('practice','graded','exam') NOT NULL DEFAULT 'practice';"
    );
  },
};
