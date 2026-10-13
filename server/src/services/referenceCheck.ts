import { QuizQuestion } from "../models";
import { getQuestionBankInclude } from "../utils/quizUtils";
import { answerFiles, getCodeRunner } from "./coderunner";
import { questionRunLimits } from "../utils/runLimits";
import { isWebLanguage } from "../utils/codeLanguages";

/**
 * Before a quiz is published (CODE_RUNNER_PLAN.md §7.3): every coding
 * question that has a reference solution must pass all its own tests, so a
 * broken question never reaches students. Questions without a reference
 * solution, unit-test questions and web questions aren't checked here. When
 * the runner can't be reached the check is skipped (and said so), never a
 * reason to keep a teacher from publishing.
 */

export interface ReferenceFailure {
  question_id: number;
  order: number | null;
  title: string;
  failed_tests: { id: string; input: string; expected: string; got: string | null }[];
  error?: string;
}

const parse = (v: unknown) => {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};
const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

export async function checkReferenceSolutions(quizId: number): Promise<{ failures: ReferenceFailure[]; checked: number; unchecked: number }> {
  const questions = await QuizQuestion.findAll({ where: { quiz_id: quizId }, include: getQuestionBankInclude(), order: [["order", "ASC"]] });
  const runner = getCodeRunner();
  const failures: ReferenceFailure[] = [];
  let checked = 0;
  let unchecked = 0;
  for (const q of questions) {
    const type = (q.questionBank?.question_type ?? (q as any).question_type ?? "").toLowerCase();
    if (type !== "coding" && type !== "algorithmic") continue;
    const data: any = parse(q.questionBank?.question_data);
    const solution = typeof data?.reference_solution === "string" ? data.reference_solution : "";
    const tests: any[] = Array.isArray(data?.test_cases) ? data.test_cases : [];
    if (!solution.trim() || data?.check_with === "unit" || !tests.length) continue;
    const language = String(data.language ?? "");
    if (!language || isWebLanguage(language) || !runner.supportsLanguage(language)) {
      unchecked++;
      continue;
    }
    const { files, entry } = answerFiles(solution, language);
    try {
      const run = await runner.run({
        language,
        files,
        entry,
        tests: tests.map((t, i) => ({ id: String(t.id ?? i + 1), input: t.input ?? "", expected_output: t.expected_output ?? "" })),
        limits: questionRunLimits(data),
        // The teacher is waiting on Publish: the engine's quick path.
        interactive: true,
      });
      checked++;
      const failed = tests
        .map((t, i) => ({ t, r: run.tests[i] }))
        .filter(({ r }) => !r?.passed)
        .map(({ t, r }) => ({ id: String(t.id), input: String(t.input ?? ""), expected: String(t.expected_output ?? ""), got: r?.stdout ?? r?.stderr ?? null }));
      if (failed.length) {
        failures.push({
          question_id: q.id,
          order: (q as any).order ?? null,
          title: plain(q.questionBank?.question_text ?? ""),
          failed_tests: failed,
          ...(run.compile && !run.compile.ok ? { error: "The reference solution doesn't compile." } : {}),
        });
      }
    } catch {
      // Runner down or refusing: don't block publishing on our own trouble.
      unchecked++;
    }
  }
  return { failures, checked, unchecked };
}
