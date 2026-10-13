import { Request, Response } from "express";
import { getCodeRunner, judge0Configured, TmJudgeRunner } from "../services/coderunner";
import { runStats } from "../services/coderunner/stats";
import { Judge0Service } from "../services/Judge0Service";

/**
 * Admin → Code runner: which engine runs code, whether it's healthy, which
 * languages work where, and how recent runs went. Read-only.
 */

const tmJudge = new TmJudgeRunner();

const LABELS = new Map(Judge0Service.supportedLanguages().map((l) => [l.key, l.label]));

// @desc    Code runner status for admins
// @route   GET /api/code-runner/status
// @access  Private (CODE_RUNNER_ADMIN)
export const codeRunnerStatus = async (_req: Request, res: Response) => {
  const runner = getCodeRunner();
  const engine = process.env.CODERUNNER_ENGINE === "tmjudge" ? "tmjudge" : "judge0";
  const judge0 = judge0Configured();
  const tm = engine === "tmjudge" || process.env.TMJUDGE_TOKEN ? await tmJudge.health() : null;

  // Every language any engine can run, with the engine that runs it here.
  const keys = [...new Set([...runner.languages(), ...Judge0Service.supportedLanguages().map((l) => l.key)])];
  const toolchains: Record<string, string | null> = tm?.data?.languages ?? {};
  const languages = keys.map((key) => {
    const runsOn = runner.engineFor(key);
    return {
      key,
      label: LABELS.get(key) ?? key,
      engine: runsOn,
      available: runsOn !== null,
    };
  });

  res.json({
    success: true,
    data: {
      engine,
      engines: {
        tmjudge: {
          configured: !!process.env.TMJUDGE_TOKEN,
          url: process.env.TMJUDGE_URL || "http://127.0.0.1:5010",
          reachable: tm ? tm.ok : null,
          error: tm && !tm.ok ? `${tm.status ?? ""} ${tm.error ?? ""}`.trim() : null,
          sandbox: tm?.data?.sandbox ?? null,
          queue: tm?.data?.queue ?? null,
          toolchains,
          // What it can do: run, projects, sessions, pty, containers, previews, databases…
          features: Array.isArray(tm?.data?.features) ? tm!.data.features : [],
          preview_origin: process.env.JUDGE_PREVIEW_BASE || null,
          preview_secret_set: (process.env.JUDGE_PREVIEW_SECRET ?? "").length >= 32,
        },
        judge0: {
          configured: judge0,
          role: engine === "judge0" ? "primary" : judge0 ? "fallback" : "off",
          quota: Judge0Service.quotaStatus(),
        },
      },
      languages,
      runs: runStats(),
      checked_at: new Date().toISOString(),
    },
  });
};
