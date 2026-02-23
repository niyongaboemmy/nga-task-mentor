require("dotenv").config();
const { sequelize } = require("./dist/config/database");

async function verifyRawUnicode() {
  try {
    await sequelize.authenticate();
    console.log("Database connected.");

    const title = "Raw Unicode Test " + Date.now();
    const description = "Testing symbols: ○ ● □ ■ △ ▲";

    // Assumes course_id 1 and created_by 1 exist for a simple raw test
    // If not, this might fail, but we can at least test the string handling
    await sequelize.query(
      `INSERT INTO assignments (title, description, due_date, max_score, submission_type, course_id, created_by, status) 
       VALUES (?, ?, NOW(), 100, 'text', 1, 1, 'draft')`,
      { replacements: [title, description] },
    );

    console.log("Raw SQL insert successful with Unicode symbols!");

    const [results] = await sequelize.query(
      `SELECT * FROM assignments WHERE title = ?`,
      { replacements: [title] },
    );

    console.log("Retrieved from DB:", results[0].description);

    await sequelize.query(`DELETE FROM assignments WHERE title = ?`, {
      replacements: [title],
    });
    console.log("Cleanup successful.");
  } catch (error) {
    console.error("Raw verification failed:", error.message);
    if (error.sqlMessage) console.error("SQL Error:", error.sqlMessage);
  } finally {
    await sequelize.close();
  }
}

verifyRawUnicode();
