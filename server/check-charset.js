require("dotenv").config();
const { sequelize } = require("./dist/config/database");

async function checkCharset() {
  try {
    await sequelize.authenticate();
    console.log("Database connected.");

    const [results] = await sequelize.query(`
      SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'assignments'
      AND COLUMN_NAME = 'description';
    `);

    console.log("Charset info for assignments.description:");
    console.log(JSON.stringify(results, null, 2));

    const [dbResults] = await sequelize.query(`
      SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
      FROM information_schema.SCHEMATA
      WHERE SCHEMA_NAME = DATABASE();
    `);
    console.log("Database default charset info:");
    console.log(JSON.stringify(dbResults, null, 2));
  } catch (error) {
    console.error("Check failed:", error.message);
  } finally {
    await sequelize.close();
  }
}

checkCharset();
