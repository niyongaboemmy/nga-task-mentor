import * as dotenv from "dotenv";
dotenv.config();
import { sequelize } from "../config/database";

interface MigrationStep {
  table: string;
  sql: string;
}

const steps: MigrationStep[] = [
  {
    table: "quizzes",
    sql: "ALTER TABLE quizzes ADD COLUMN academic_term_id INTEGER DEFAULT NULL;",
  },
  {
    table: "assignments",
    sql: "ALTER TABLE assignments ADD COLUMN academic_term_id INTEGER DEFAULT NULL;",
  },
  {
    table: "question_bank",
    sql: "ALTER TABLE question_bank ADD COLUMN academic_term_id INTEGER DEFAULT NULL;",
  },
  {
    table: "proctoring_sessions",
    sql: "ALTER TABLE proctoring_sessions ADD COLUMN academic_term_id INTEGER DEFAULT NULL;",
  },
];

async function run() {
  try {
    await sequelize.authenticate();
    console.log("Connected to DB.");

    for (const step of steps) {
      try {
        await sequelize.query(step.sql);
        console.log(`✅  academic_term_id added to ${step.table}`);
      } catch (e: any) {
        if (
          e.message.includes("Duplicate column name") ||
          e.message.includes("already exists")
        ) {
          console.log(`⚠️   academic_term_id already exists in ${step.table}, skipping.`);
        } else {
          console.error(`❌  Failed on ${step.table}:`, e.message);
          throw e;
        }
      }
    }

    console.log("\nMigration complete.");
  } catch (e) {
    console.error("Migration failed:", e);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

run();
