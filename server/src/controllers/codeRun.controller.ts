import { Request, Response } from "express";
import { z } from "zod";
import { getCodeRunner } from "../services/coderunner";
import { JudgeUnavailableError, QuotaExceededError, RunnerRejectedError, UnsupportedLanguageError, Judge0Service } from "../services/Judge0Service";
import { isWebLanguage } from "../utils/codeLanguages";
import { filesToSend, languageOfPath, pickLanguage, rankEntries, runCandidates } from "../tmcode/practical/run";
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
export const practiceRun = async (req: Request, res: Response) => {
  const parsed = runSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return fail(res, 400, "VALIDATION_ERROR", "Invalid run request.", { issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  }
  const body = parsed.data;
  const bytes = body.files.reduce((n, f) => n + Buffer.byteLength(f.content, "utf8"), 0);
  if (bytes > MAX_BYTES) return fail(res, 413, "TOO_LARGE", "The files are too large to run (1 MB at most).");
  for (const f of body.files) {
    if (f.path.startsWith("/") || f.path.split("/").some((s) => s === ".." || s === "")) {
      return fail(res, 400, "VALIDATION_ERROR", `Invalid file path: ${f.path}`);
    }
  }
  if (body.language && isWebLanguage(body.language)) {
    return fail(res, 422, "USE_PREVIEW", "Web pages run in the Preview, not here.");
  }

  const runner = getCodeRunner();
  const meta = body.files.map((f) => ({ path: f.path, size: Buffer.byteLength(f.content, "utf8") }));
  const candidates = runCandidates(meta);
  const language = pickLanguage(candidates, body.language ?? null, body.language ?? null);
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
    const result = await runner.run({
      language,
      entry,
      files,
      interactive: true,
      tests: body.tests.map((t) => ({ id: t.id, input: t.input, expected_output: t.expected_output ?? undefined })),
    });
    return res.json({
      success: true,
      data: { engine: result.engine, language, entry, files_sent: files.map((f) => f.path), compile: result.compile, tests: result.tests },
    });
  } catch (e) {
    if (e instanceof QuotaExceededError) return fail(res, 503, "QUOTA_EXCEEDED", "The code runner has reached its limit for now. Try again later.");
    if (e instanceof RunnerRejectedError) return fail(res, 502, "RUNNER_REJECTED", e.message);
    if (e instanceof JudgeUnavailableError) return fail(res, 503, "JUDGE_UNAVAILABLE", "The code runner is busy or offline. Try again in a moment.");
    if (e instanceof UnsupportedLanguageError) return fail(res, 422, "UNSUPPORTED_LANGUAGE", `${language} can't be run here yet.`);
    console.error("Practice run failed:", e);
    return fail(res, 500, "RUN_FAILED", "The code couldn't be run because of a problem on Task Mentor. Try again.");
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
