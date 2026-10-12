import { Request, Response } from "express";
import { z } from "zod";
import { judgeInfo, refreshJudgeInfo } from "../services/coderunner/judgeInfo";
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
});

// @desc    Whether this server can run programs interactively
// @route   GET /api/code/capabilities
export const codeCapabilities = async (_req: Request, res: Response) => {
  const interactive = await sessionsReady();
  await refreshJudgeInfoIfEmpty();
  const info = judgeInfo();
  const unitTestLanguages = info.features.has("projects")
    ? [...new Set([...info.kinds.values()].filter((k) => k.actions.includes("test")).map((k) => k.language))]
    : [];
  res.json({ success: true, data: { interactive, unit_tests: unitTestLanguages.length > 0, unit_test_languages: unitTestLanguages } });
};

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
  let s;
  try {
    s = getSession(String(req.params.id), Number(req.user.id));
  } catch (e) {
    return fail(res, e);
  }
  const abort = new AbortController();
  let finished = false;
  req.on("close", () => {
    abort.abort();
    // The browser left before the program ended: stop it.
    if (!finished) void stopSession(s!);
  });
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await openEvents(s, abort.signal);
  } catch (e) {
    return fail(res, e);
  }
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    finished = true;
    s.closed = true;
  } catch {
    // aborted: the browser left
  } finally {
    res.end();
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
