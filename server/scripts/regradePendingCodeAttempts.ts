/**
 * TM-FIX-6: re-grade code answers that were left pending because the judge
 * was unavailable (quiz_attempts.grading_details.judge_unavailable). The
 * server also does this every CODE_REGRADE_INTERVAL_MIN minutes; this script
 * is for running it by hand after an outage.
 *
 * Dry run by default (counts only):
 *   cd server && npx ts-node --transpile-only scripts/regradePendingCodeAttempts.ts
 * Re-grade (calls the judge, updates attempts and finished submissions):
 *   cd server && npx ts-node --transpile-only scripts/regradePendingCodeAttempts.ts --apply [--limit=200]
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { sequelize } from "../src/config/database";
import * as models from "../src/models";
import { setupAssociations } from "../src/models";
import { Judge0Service } from "../src/services/Judge0Service";
import { regradePendingCodeAttempts } from "../src/services/codeRegrade.service";

const APPLY = process.argv.includes("--apply");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) || 50 : 50;

async function main() {
  // Same model set as the server (associations need all of them).
  sequelize.addModels([
    models.User,
    models.Assignment,
    models.Submission,
    models.Quiz,
    models.QuizQuestion,
    models.QuizAttempt,
    models.QuizSubmission,
    models.ProctoringSession,
    models.ProctoringEvent,
    models.ProctoringSettings,
    models.BloomsTaxonomyLevel,
    models.QuestionBank,
    models.ReportCard,
    models.ReportCardAttribute,
    models.ReportCardAssessment,
    models.SubjectAssessmentMapping,
    models.ManualAssessment,
    models.ManualAssessmentScore,
    models.DatabaseQueryLog,
    models.Role,
    models.Permission,
    models.RolePermission,
    ...models.TMCODE_MODELS,
  ] as any);
  setupAssociations();

  console.log(`Mode: ${APPLY ? "APPLY (re-grading)" : "dry run (no writes)"}`);
  if (APPLY) await Judge0Service.loadLanguages();
  const report = await regradePendingCodeAttempts({ limit: LIMIT, dryRun: !APPLY });
  console.log(JSON.stringify(report, null, 2));
  if (!APPLY && report.found) console.log("Re-run with --apply to re-grade.");
  await sequelize.close();
}

main().catch(async (e) => {
  console.error(e);
  await sequelize.close();
  process.exit(1);
});
