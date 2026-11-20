/**
 * Backfill for TVET schools: map every unmapped quiz, assignment and manual
 * assessment of a term to FA (formative). Runs from the compiled build, so it
 * works on the server after the deploy prunes dev dependencies:
 *
 *   node dist/reportCards/mapFormativeCli.js --term "Term 1" --year "2026 - 2027" --term-id 5          (dry run)
 *   node dist/reportCards/mapFormativeCli.js --term "Term 1" --year "2026 - 2027" --term-id 5 --apply
 *
 * --term / --year are the names report cards are keyed on; --term-id is the
 * MIS academic_term_id quizzes and assignments carry (without it, only ones
 * with no term are included). Refuses unless the school uses the TVET builder
 * (--force overrides). Adds mappings only; work already mapped keeps its category.
 */
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const term = arg("term");
  const year = arg("year");
  const termIdRaw = arg("term-id");
  const termId = termIdRaw != null ? Number(termIdRaw) : null;
  const apply = flag("apply");
  if (!term || !year || (termIdRaw != null && !Number.isInteger(termId))) {
    console.error('Usage: node dist/reportCards/mapFormativeCli.js --term "Term 1" --year "2026 - 2027" [--term-id 5] [--apply] [--force]');
    process.exit(2);
  }
  const { sequelize } = await import("../config/database");
  const models = await import("../models");
  // The same models the server registers (src/index.ts), so associations resolve.
  const m: any = models;
  sequelize.addModels([
    m.User, m.Assignment, m.Submission, m.Quiz, m.QuizQuestion, m.QuizAttempt, m.QuizSubmission,
    m.ProctoringSession, m.ProctoringEvent, m.ProctoringSettings, m.BloomsTaxonomyLevel, m.QuestionBank,
    m.ReportCard, m.ReportCardAttribute, m.ReportCardAssessment, m.SubjectAssessmentMapping,
    m.ManualAssessment, m.ManualAssessmentScore, m.DatabaseQueryLog, m.Role, m.Permission, m.RolePermission,
    ...m.TMCODE_MODELS, ...m.PROJECT_MODELS, ...m.REPORT_CARD_WORKFLOW_MODELS,
  ]);
  m.setupAssociations();
  const { primaryTenantCtx, runWithTenant } = await import("../vendor/nga-tenancy");
  const { getReportCardScheme } = await import("../services/tenantSettings");
  const { mapUnmappedToFormative } = await import("../services/formativeAutoMap");
  // Tenant 1 (DB_NAME): a CLI has no request to carry a tenant.
  try {
    await runWithTenant(primaryTenantCtx(), () => run());
  } finally {
    await sequelize.close();
  }

  async function run() {
    const scheme = await getReportCardScheme();
    if (scheme.builder !== "tvet" && !flag("force")) {
      console.error(`[map-formative] the school uses the "${scheme.builder}" builder, not TVET: nothing done (use --force to map anyway).`);
      process.exit(1);
    }
    const r = await mapUnmappedToFormative({ term: term!, academicYear: year!, termId, dryRun: !apply });
    console.log(
      `[map-formative] ${term} ${year}${termId != null ? ` (term id ${termId})` : ""}: ${r.scanned} assessments, ${r.already_mapped} already mapped, ` +
        `${apply ? "mapped" : "would map"} ${r.mapped} to FA (quizzes ${r.by_kind.quiz}, assignments ${r.by_kind.assignment}, manual ${r.by_kind.manual}) ` +
        `in ${r.subjects} subjects${apply ? `; ${r.cards_updated} draft cards updated` : ". Dry run: add --apply to write."}`,
    );
  }
}

main().catch((e) => {
  console.error("[map-formative] failed:", e?.message ?? e);
  process.exit(1);
});
