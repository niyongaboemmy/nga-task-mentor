import * as dotenv from "dotenv";
dotenv.config();
import { sequelize } from "./config/database";

async function run() {
  try {
    await sequelize.authenticate();
    console.log("Connected to DB.");
    await sequelize.query(
      "ALTER TABLE question_bank ADD COLUMN time_limit_seconds INTEGER DEFAULT 60;",
    );
    console.log("Column added successfully!");
  } catch (e: any) {
    if (e.message.includes("Duplicate column name")) {
      console.log("Column already exists.");
    } else {
      console.error(e);
    }
  } finally {
    process.exit(0);
  }
}
run();
