require("dotenv").config();
const { sequelize } = require("../dist/config/database");

async function fixCharset() {
  try {
    await sequelize.authenticate();
    console.log("Database connected.");

    const dbName = process.env.DB_NAME;
    console.log(`Fixing charset for database: ${dbName}`);

    // 1. Alter database
    await sequelize.query(
      `ALTER DATABASE \`${dbName}\` CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;`,
    );
    console.log(`Database ${dbName} altered to utf8mb4.`);

    // 2. Get all tables
    const [tables] = await sequelize.query(`SHOW TABLES;`);
    const tableKey = Object.keys(tables[0])[0];

    for (const row of tables) {
      const tableName = row[tableKey];
      console.log(`Converting table: ${tableName}`);

      // 3. Alter table
      await sequelize.query(
        `ALTER TABLE \`${tableName}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
      );
    }

    console.log("Successfully converted all tables to utf8mb4_unicode_ci.");
  } catch (error) {
    console.error("Fix failed:", error.message);
  } finally {
    await sequelize.close();
  }
}

fixCharset();
