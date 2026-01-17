"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Make course_id nullable in assignments table
    await queryInterface.changeColumn("assignments", "course_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: null, // Remove foreign key constraint
    });

    // Make course_id nullable in quizzes table
    await queryInterface.changeColumn("quizzes", "course_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: null, // Remove foreign key constraint
    });

    // Drop user_courses table
    await queryInterface.dropTable("user_courses");

    // Drop courses table
    await queryInterface.dropTable("courses");
  },

  async down(queryInterface, Sequelize) {
    // Recreate courses table
    await queryInterface.createTable("courses", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      code: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
      },
      title: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      credits: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      max_students: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      instructor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Recreate user_courses table
    await queryInterface.createTable("user_courses", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      course_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      enrollment_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("enrolled", "completed", "dropped"),
        allowNull: false,
        defaultValue: "enrolled",
      },
      grade: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      completion_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Make course_id not nullable in assignments
    await queryInterface.changeColumn("assignments", "course_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    // Make course_id not nullable in quizzes
    await queryInterface.changeColumn("quizzes", "course_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },
};
