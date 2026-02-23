require("dotenv").config();
const { sequelize } = require("./dist/config/database");

async function checkAllCharsets() {
  try {
    await sequelize.authenticate();
    console.log("Database connected.");

    const [results] = await sequelize.query(`
      SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND CHARACTER_SET_NAME IS NOT NULL;
    `);

    console.log("Charset info for all columns:");
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error("Check failed:", error.message);
  } finally {
    await sequelize.close();
  }
}

checkAllCharsets();
