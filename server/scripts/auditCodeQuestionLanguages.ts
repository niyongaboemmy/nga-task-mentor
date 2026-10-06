/**
 * TM-FIX-4 one-off audit (read-only): coding/algorithmic questions whose
 * `language` or `allowed_languages` the judge has no runtime for. Before the
 * fix these silently ran as Node.js; now their answers are left for manual
 * review, so teachers should correct the language.
 *
 *   cd server && npx ts-node --transpile-only scripts/auditCodeQuestionLanguages.ts
 *
 * Prints a table and a JSON summary. Writes nothing.
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { QueryTypes } from "sequelize";
import { sequelize } from "../src/config/database";
import { Judge0Service } from "../src/services/Judge0Service";
import { isWebLanguage } from "../src/utils/codeLanguages";

const parse = (v: any) => {
  let out = v;
  // question_data is sometimes stored double-encoded
  for (let i = 0; i < 2 && typeof out === "string"; i++) {
    try {
      out = JSON.parse(out);
    } catch {
      return {};
    }
  }
  return out || {};
};

async function main() {
  const rows = await sequelize.query<any>(
    `SELECT id, course_id, question_type, created_by, question_data
       FROM question_bank
      WHERE question_type IN ('coding', 'algorithmic')`,
    { type: QueryTypes.SELECT },
  );

  const problems: any[] = [];
  for (const r of rows) {
    const qd = parse(r.question_data);
    const okFor = (l: unknown) =>
      Judge0Service.normalizeLanguage(l) !== null ||
      (r.question_type === "coding" && isWebLanguage(l));
    const issues: string[] = [];
    if (!qd.language) {
      if (r.question_type === "coding") issues.push("no language");
      else issues.push("no language (students may pick any)");
    } else if (!okFor(qd.language)) {
      issues.push(`unsupported language "${qd.language}"`);
    }
    const allowed = Array.isArray(qd.allowed_languages) ? qd.allowed_languages : [];
    const bad = allowed.filter((l: unknown) => !okFor(l));
    if (bad.length) issues.push(`unsupported allowed_languages: ${bad.join(", ")}`);
    if (issues.length) {
      problems.push({
        question_bank_id: r.id,
        course_id: r.course_id,
        type: r.question_type,
        created_by: r.created_by,
        language: qd.language ?? null,
        issues: issues.join("; "),
      });
    }
  }

  console.log(
    `Checked ${rows.length} coding/algorithmic questions; ${problems.length} need attention.`,
  );
  if (problems.length) console.table(problems);
  console.log(JSON.stringify({ checked: rows.length, problems }, null, 2));
  await sequelize.close();
}

main().catch(async (e) => {
  console.error(e);
  await sequelize.close();
  process.exit(1);
});
