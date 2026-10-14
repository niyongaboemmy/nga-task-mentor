import { Request, Response } from "express";
import { z } from "zod";
import { getCodeRunner } from "../services/coderunner";
import { JudgeUnavailableError, QuotaExceededError, RunnerRejectedError, UnsupportedLanguageError, Judge0Service } from "../services/Judge0Service";
import { isWebLanguage } from "../utils/codeLanguages";
import { filesToSend, isIgnoredPath, languageOfPath, pickLanguage, rankEntries, runCandidates } from "../tmcode/practical/run";
import { hasManifest } from "../services/coderunner/tmJudgeRunner";
import { detectProject } from "../services/coderunner/projectKind";
import { judgeHas, judgeRunsLanguage, judgeTestsLanguage } from "../services/coderunner/judgeInfo";
import type { RunResult } from "../services/coderunner";
import { catalogLanguages, catalogVersion, getStarter, listStarters, starterSummary } from "../services/runtimeCatalog";

/**
 * Practice runs (CODE_RUNNER_PLAN.md §17): the Playground and the browser
 * project editor run the files on screen, saved or not. Nothing is graded or
 * stored; quizzes keep their own run route (attempt rules, hidden tests).
 */

const MAX_FILES = 100;
const MAX_BYTES = 1024 * 1024;

const runSchema = z.object({
  language: z.string().max(40).optional().nullable(),
  kind: z.string().max(60).optional().nullable(),
  entry: z.string().max(500).optional().nullable(),
  files: z
    .array(z.object({ path: z.string().min(1).max(500), content: z.string() }))
    .min(1)
    .max(MAX_FILES),
  tests: z
    .array(
      z.object({
        id: z.string().max(40),
        input: z.string().max(64 * 1024).default(""),
        expected_output: z.string().max(64 * 1024).optional().nullable(),
      }),
    )
    .min(1)
    .max(10),
});

const LABEL = new Map(Judge0Service.supportedLanguages().map((l) => [l.key, l.label]));

const fail = (res: Response, status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  res.status(status).json({ success: false, code, message, ...extra });

// @desc    Run files with the given inputs (practice: Playground, project editor)
// @route   POST /api/code/run
// @access  Private (PROJECTS_USE), rate-limited per user
/** Common checks of a run request; answers the error itself and returns null on failure. */
function checkFiles(res: Response, files: { path: string; content: string }[]) {
  const bytes = files.reduce((n, f) => n + Buffer.byteLength(f.content, "utf8"), 0);
  if (bytes > MAX_BYTES) return void fail(res, 413, "TOO_LARGE", "The files are too large to run (1 MB at most).");
  for (const f of files) {
    if (f.path.startsWith("/") || f.path.split("/").some((s) => s === ".." || s === "")) {
      return void fail(res, 400, "VALIDATION_ERROR", `Invalid file path: ${f.path}`);
    }
  }
  return true;
}

function runFailure(res: Response, e: unknown, language: string) {
  if (e instanceof QuotaExceededError) return fail(res, 503, "QUOTA_EXCEEDED", "The code runner has reached its limit for now. Try again later.");
  if (e instanceof RunnerRejectedError) return fail(res, 502, "RUNNER_REJECTED", e.message);
  if (e instanceof JudgeUnavailableError) return fail(res, 503, "JUDGE_UNAVAILABLE", "The code runner is busy or offline. Try again in a moment.");
  if (e instanceof UnsupportedLanguageError) return fail(res, 422, "UNSUPPORTED_LANGUAGE", `${LABEL.get(language) ?? language} can't be run here yet.`);
  console.error("Practice run failed:", e);
  return fail(res, 500, "RUN_FAILED", "The code couldn't be run because of a problem on Task Mentor. Try again.");
}

const resultData = (r: RunResult, language: string, entry: string | null, files: { path: string }[]) => ({
  engine: r.engine,
  language,
  entry,
  kind: r.kind ?? null,
  files_sent: files.map((f) => f.path),
  compile: r.compile,
  tests: r.tests,
  unit: r.unit ?? null,
  error: r.error ?? null,
});

// @desc    Run files with the given inputs (practice: Playground, project editor)
// @route   POST /api/code/run
// @access  Private (PROJECTS_USE), rate-limited per user
export const practiceRun = async (req: Request, res: Response) => {
  const parsed = runSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return fail(res, 400, "VALIDATION_ERROR", "Invalid run request.", { issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  }
  const body = parsed.data;
  if (!checkFiles(res, body.files)) return;
  if (body.language && isWebLanguage(body.language)) {
    return fail(res, 422, "USE_PREVIEW", "Web pages run in the Preview, not here.");
  }

  const runner = getCodeRunner();
  const tests = body.tests.map((t) => ({ id: t.id, input: t.input, expected_output: t.expected_output ?? undefined }));
  const meta = body.files.map((f) => ({ path: f.path, size: Buffer.byteLength(f.content, "utf8") }));
  const candidates = runCandidates(meta);
  const detected = pickLanguage(candidates, body.language ?? null, body.language ?? null);
  // A project with a build file, or a language only the catalog knows: tm-judge
  // detects the kind and entry, builds it, and runs the tests.
  const asked = body.language ?? detected;
  // The files may suggest another language than the one asked (an Arduino sketch with a helper
  // .cpp looks like C++): a language the runner's catalog runs is taken at its word.
  const project =
    !!asked && judgeHas("projects") && judgeRunsLanguage(asked) && (!!body.kind || hasManifest(body.files) || !detected || (!!body.language && detected !== body.language));
  if (project) {
    const files = body.files.filter((f) => !isIgnoredPath(f.path));
    // A web app (React, Vue, Angular…) has no program to run: say so plainly.
    const detected = body.kind ? null : await detectProject(files).catch(() => null);
    if (detected && (detected.webApp || !detected.actions.includes("run"))) {
      return fail(res, 422, "NOT_A_PROGRAM", `This is a ${detected.label}: it runs in a browser, not as a program with inputs.${detected.actions.includes("test") ? " Its unit tests can run." : ""}`, { kind: detected.kind });
    }
    try {
      const result = await runner.run({ language: asked!, kind: body.kind ?? undefined, entry: body.entry ?? undefined, files, interactive: true, tests });
      return res.json({ success: true, data: resultData(result, asked!, body.entry ?? null, files) });
    } catch (e) {
      return runFailure(res, e, asked!);
    }
  }

  const language = detected;
  if (!language) return fail(res, 422, "NOTHING_TO_RUN", "There's no program to run here (no source files found).");
  if (!runner.supportsLanguage(language)) {
    return fail(res, 422, "UNSUPPORTED_LANGUAGE", `${LABEL.get(language) ?? language} can't be run here yet.`, { supported: runner.languages() });
  }
  const sources = new Map(body.files.map((f) => [f.path, f.content]));
  const entry =
    body.entry && languageOfPath(body.entry) === language && sources.has(body.entry)
      ? body.entry
      : rankEntries(candidates, language, sources)[0];
  if (!entry) return fail(res, 422, "NOTHING_TO_RUN", "Pick the file to run.");

  const { paths } = filesToSend(meta, language, entry);
  const files = paths.map((p) => ({ path: p, content: sources.get(p) ?? "" }));
  try {
    const result = await runner.run({ language, entry, files, interactive: true, tests });
    return res.json({ success: true, data: resultData(result, language, entry, files) });
  } catch (e) {
    return runFailure(res, e, language);
  }
};

const testSchema = z.object({
  language: z.string().max(40).optional().nullable(),
  kind: z.string().max(60).optional().nullable(),
  test_filter: z
    .string()
    .max(200)
    .regex(/^[\w.*#:/$\-[\] ]*$/)
    .optional()
    .nullable(),
  files: z
    .array(z.object({ path: z.string().min(1).max(500), content: z.string() }))
    .min(1)
    .max(MAX_FILES),
});

// @desc    Run a project's unit tests (pytest, JUnit, node:test, go test, cargo…)
// @route   POST /api/code/test
// @access  Private (PROJECTS_USE), rate-limited per user
export const practiceUnitTests = async (req: Request, res: Response) => {
  const parsed = testSchema.safeParse(req.body ?? {});
  if (!parsed.success) return fail(res, 400, "VALIDATION_ERROR", "Invalid test request.");
  const body = parsed.data;
  if (!checkFiles(res, body.files)) return;
  if (!judgeHas("projects")) {
    return fail(res, 409, "UNIT_TESTS_UNAVAILABLE", "Unit tests can't run here yet: use the input/output tests.");
  }
  const meta = body.files.map((f) => ({ path: f.path, size: Buffer.byteLength(f.content, "utf8") }));
  const language = body.language ?? pickLanguage(runCandidates(meta), null, null);
  if (!language || !judgeTestsLanguage(language)) {
    return fail(res, 422, "NO_UNIT_TESTS", `${LABEL.get(language ?? "") ?? language ?? "This project"} has no unit tests the runner knows how to run.`);
  }
  const files = body.files.filter((f) => !isIgnoredPath(f.path));
  try {
    const result = await getCodeRunner().run({ language, kind: body.kind ?? undefined, files, tests: [], actions: ["test"], test_filter: body.test_filter ?? undefined });
    return res.json({ success: true, data: resultData(result, language, null, files) });
  } catch (e) {
    return runFailure(res, e, language);
  }
};

// @desc    Languages the runner runs now (for language pickers)
// @route   GET /api/code/languages
// @access  Private
export const runnableLanguages = async (_req: Request, res: Response) => {
  const runner = getCodeRunner();
  res.json({
    success: true,
    data: runner.languages().map((key) => ({ key, label: LABEL.get(key) ?? key, engine: runner.engineFor(key) })),
  });
};

// ─── Catalog and starters (CODE_RUNNER_PLAN.md §11, §14) ─────────────────────

// @desc    Languages, their project types, and whether they run here now
// @route   GET /api/code/catalog
// @access  Private
export const codeCatalog = async (_req: Request, res: Response) => {
  res.json({ success: true, data: { version: catalogVersion(), languages: catalogLanguages() } });
};

// @desc    Starter projects (summaries), filtered by language / purpose / level / q
// @route   GET /api/code/starters
// @access  Private
export const codeStarters = async (req: Request, res: Response) => {
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  res.json({
    success: true,
    data: listStarters({ language: str(req.query.language), purpose: str(req.query.purpose), level: str(req.query.level), q: str(req.query.q) }),
  });
};

// @desc    One starter with its files
// @route   GET /api/code/starters/:id
// @access  Private
export const codeStarter = async (req: Request, res: Response) => {
  const s = getStarter(String(req.params.id));
  if (!s) return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Starter not found." });
  res.json({ success: true, data: { ...starterSummary(s), files: s.files } });
};
