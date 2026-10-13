import { Request, Response } from "express";
import { z } from "zod";
import { judgeHas, judgeInfo, refreshJudgeInfo } from "../services/coderunner/judgeInfo";
import { previewsAvailable } from "../services/coderunner/previews";
import { relaySse } from "./sse";
import { getSession, openEvents, sendInput, SessionError, sessionsReady, startSession, stopSession } from "../services/coderunner/sessions";

/**
 * Interactive runs (CODE_RUNNER_PLAN.md §16): start a program, stream its
 * output, send it input. Nothing is graded or stored.
 */

const fail = (res: Response, e: unknown) => {
  if (e instanceof SessionError) return res.status(e.status).json({ success: false, code: e.code, message: e.message });
  console.error("Code session error:", e);
  return res.status(500).json({ success: false, code: "SESSION_FAILED", message: "The interactive run failed because of a problem on Task Mentor." });
};

const startSchema = z.object({
  language: z.string().max(40).optional().nullable(),
  kind: z.string().max(60).optional().nullable(),
  entry: z.string().max(500).optional().nullable(),
  files: z.array(z.object({ path: z.string().min(1).max(500), content: z.string() })).min(1).max(100),
  pty: z.boolean().optional(),
});

// @desc    Whether this server can run programs interactively
// @route   GET /api/code/capabilities
export const codeCapabilities = async (_req: Request, res: Response) => {
  res.json({ success: true, data: await codeCapabilitiesData() });
};

/** What GET /api/code/capabilities answers (also used by TMCode's exam routes). */
export async function codeCapabilitiesData() {
  const interactive = await sessionsReady();
  await refreshJudgeInfoIfEmpty();
  const info = judgeInfo();
  const unitTestLanguages = info.features.has("projects")
    ? [...new Set([...info.kinds.values()].filter((k) => k.actions.includes("test")).map((k) => k.language))]
    : [];
  return {
    interactive,
    // A real terminal (colours, cursor, Ctrl+C reaching the program) when the runner has containers.
    pty: interactive && judgeHas("pty"),
    unit_tests: unitTestLanguages.length > 0,
    unit_test_languages: unitTestLanguages,
    previews: previewsAvailable(),
  };
}

const refreshJudgeInfoIfEmpty = async () => {
  if (process.env.CODERUNNER_ENGINE === "tmjudge" && !judgeInfo().at) await refreshJudgeInfo();
};

// @desc    Start an interactive run (one per person; a new one stops the old)
// @route   POST /api/code/sessions
export const startCodeSession = async (req: Request, res: Response) => {
  const parsed = startSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Invalid run request." });
  const bytes = parsed.data.files.reduce((n, f) => n + Buffer.byteLength(f.content, "utf8"), 0);
  if (bytes > 1024 * 1024) return res.status(413).json({ success: false, code: "TOO_LARGE", message: "The files are too large to run (1 MB at most)." });
  try {
    const s = await startSession(Number(req.user.id), parsed.data);
    return res.status(201).json({ success: true, data: { id: s.id } });
  } catch (e) {
    return fail(res, e);
  }
};

// @desc    The run's output as Server-Sent Events (stage, stdout, stderr, exit, error)
// @route   GET /api/code/sessions/:id/events
export const codeSessionEvents = async (req: Request, res: Response) => {
  let s: ReturnType<typeof getSession>;
  try {
    s = getSession(String(req.params.id), Number(req.user.id));
  } catch (e) {
    return fail(res, e);
  }
  try {
    // The browser left before the program ended: stop it.
    await relaySse(req, res, (signal) => openEvents(s, signal), () => void stopSession(s), () => (s.closed = true));
  } catch (e) {
    if (!res.headersSent) return fail(res, e);
  }
};

const inputSchema = z.object({
  data: z.string().max(64 * 1024).optional(),
  eof: z.boolean().optional(),
  signal: z.enum(["SIGINT", "SIGTERM"]).optional(),
});

// @desc    Send input (a line, end of input, or Ctrl+C) to the running program
// @route   POST /api/code/sessions/:id/input
export const codeSessionInput = async (req: Request, res: Response) => {
  const parsed = inputSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Invalid input." });
  try {
    await sendInput(getSession(String(req.params.id), Number(req.user.id)), parsed.data);
    return res.status(204).end();
  } catch (e) {
    return fail(res, e);
  }
};

// @desc    Stop the run
// @route   DELETE /api/code/sessions/:id
export const stopCodeSession = async (req: Request, res: Response) => {
  try {
    await stopSession(getSession(String(req.params.id), Number(req.user.id)));
    return res.status(204).end();
  } catch (e) {
    return fail(res, e);
  }
};
