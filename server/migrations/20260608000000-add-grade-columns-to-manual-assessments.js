"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable("manual_assessments");

    const addIfMissing = async (column, def) => {
      if (!tableDescription[column]) {
        await queryInterface.addColumn("manual_assessments", column, def);
      }
    };

    await addIfMissing("assessment_type", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });

    await addIfMissing("assessment_number", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await addIfMissing("assessment_date", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await addIfMissing("add_to_final_grade", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  async down(queryInterface) {
    for (const col of ["assessment_type", "assessment_number", "assessment_date", "add_to_final_grade"]) {
      try {
        await queryInterface.removeColumn("manual_assessments", col);
      } catch (_) {}
    }
  },
};
