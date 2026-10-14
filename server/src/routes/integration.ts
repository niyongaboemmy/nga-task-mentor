import { Router, Request, Response } from "express";
import { misBearerAuth } from "../middleware/misBearerAuth";
import { integrationLimiter, lessonCodeRunLimiter } from "../middleware/rateLimiter.middleware";
import { practiceRun } from "../controllers/codeRun.controller";
import { getCodeRunner } from "../services/coderunner";
import { Judge0Service } from "../services/Judge0Service";
import { catalogLanguages } from "../services/runtimeCatalog";
import { z } from "zod";
import { relaySse } from "../controllers/sse";
import { getSession, openEvents, sendInput, SessionError, sessionsReady, startSession, stopSession } from "../services/coderunner/sessions";
import { buildHomeSummary, emptySummary } from "../integration/homeSummary";
import { computeOverview } from "../controllers/instructorOverview.controller";
import { PASS_MARK } from "../services/instructorOverview.service";

/**
 * /api/integration/* -- server-to-server reads for the NGA Central MIS,
 * authenticated with the user's own MIS token (misBearerAuth), never a Task
 * Mentor session. Read-only.
 *
 * POST /api/integration/home-summary (GET with no body works too): what needs
 * the user in Task Mentor, for the MIS Home page. Body (all optional):
 * { date, tz, lenses: [{ key, type, class_group_ids }] } -- lenses only label
 * items; access comes from this app's own scoping helpers. `date`/`tz` are
 * accepted for the shared contract; Task Mentor's signals are relative to now.
 */
const router = Router();

const homeSummary = async (req: Request, res: Response) => {
  try {
    if (!(req as any).misProvisioned || !req.user) {
      // The MIS user has never signed in to Task Mentor: nothing of theirs here.
      return res.status(200).json(emptySummary(false));
    }
    if ((req as any).accessUnavailable) {
      return res.status(503).json({
        success: false,
        code: "ACCESS_UNAVAILABLE",
        message: "Access check unavailable -- please try again shortly",
      });
    }
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const lenses = body.lenses;
    // Only the contract's fields are read. The shared scoping helpers honour
    // academic_term_id / academicTermId (and year) overrides from the body and
    // query (resolveAcademicTermId), which would let the caller pick another
    // term's subjects -- so neither reaches them: always the current period.
    req.body = {};
    req.query = {};
    res.status(200).json(await buildHomeSummary(req, { lenses }));
  } catch (error) {
    console.error("Home summary error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /api/integration/student-standing: how each student the caller teaches
 * is doing in Task Mentor (average, graded work, missing work, reasons), for
 * the MIS office-hours "Suggested students" list. Same scope and numbers as
 * the teacher dashboard (computeOverview); keyed by MIS user id so the MIS
 * needs no subject-id mapping. Read-only; the term is always the current one.
 */
const studentStanding = async (req: Request, res: Response) => {
  try {
    if (!(req as any).misProvisioned || !req.user) {
      return res.status(200).json({ success: true, data: { provisioned: false, pass_mark: PASS_MARK, students: [] } });
    }
    if ((req as any).accessUnavailable) {
      return res.status(503).json({ success: false, code: "ACCESS_UNAVAILABLE", message: "Access check unavailable -- please try again shortly" });
    }
    req.body = {};
    req.query = {};
    const { overview } = await computeOverview(req, { includeAllStudents: true });
    const all = overview.students.all ?? [...overview.students.at_risk, ...overview.students.top];
    const seen = new Set<number>();
    const students = all
      .filter((s) => s.mis_user_id != null && !seen.has(s.mis_user_id) && seen.add(s.mis_user_id))
      .map((s) => ({
        mis_user_id: s.mis_user_id as number,
        avg_score: s.avg_score,
        graded_count: s.graded_count,
        missing: s.missing,
        subjects: s.subjects,
        reasons: s.reasons,
        below_pass: s.avg_score != null && s.avg_score < PASS_MARK,
      }));
    res.status(200).json({ success: true, data: { provisioned: true, pass_mark: PASS_MARK, students } });
  } catch (error) {
    console.error("Student standing error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /api/integration/code/languages: the languages the code runner runs now,
 * for the MIS lesson Code Playground's language picker.
 *
 * POST /api/integration/code/run: one practice run for that playground -- the
 * same request, checks and answer as POST /api/code/run (practiceRun). Nothing
 * is graded or stored. Any verified MIS user may run code read in a lesson,
 * signed in to Task Mentor or not (students read notes in the MIS), so the
 * limit is per MIS user, not per local user.
 */
const codeLanguages = async (_req: Request, res: Response) => {
  const runner = getCodeRunner();
  const labels = new Map<string, string>(Judge0Service.supportedLanguages().map((l) => [l.key, l.label]));
  for (const l of catalogLanguages()) labels.set(l.key, l.label);
  res.status(200).json({
    success: true,
    data: {
      languages: runner.languages().map((key) => ({ key, label: labels.get(key) ?? key, engine: runner.engineFor(key) })),
      // Live runs (output as it comes, input while the program waits): see /code/sessions.
      interactive: await sessionsReady(),
    },
  });
};

/**
 * Interactive runs for the MIS Code Playground — the program runs live, its output
 * streams as Server-Sent Events, the student types input while it waits:
 *   POST   /code/sessions              {language?, entry?, files} → 201 {id}
 *   GET    /code/sessions/:id/events   text/event-stream (stage, stdout, stderr, exit, error)
 *   POST   /code/sessions/:id/input    {data?, eof?, signal?} → 204
 *   DELETE /code/sessions/:id          → 204
 * Owned by the MIS user (as a negative number, so it never matches a Task Mentor user id);
 * one live session per person, like /api/code/sessions.
 */
const ownerOf = (req: Request) => -Number((req as any).misUserId);
const sessionFail = (res: Response, e: unknown) => {
  if (e instanceof SessionError) return res.status(e.status).json({ success: false, code: e.code, message: e.message });
  console.error("Lesson code session error:", e);
  return res.status(500).json({ success: false, code: "SESSION_FAILED", message: "The live run failed because of a problem on Task Mentor." });
};
const sessionSchema = z.object({
  language: z.string().max(40).optional().nullable(),
  entry: z.string().max(500).optional().nullable(),
  files: z.array(z.object({ path: z.string().min(1).max(500), content: z.string() })).min(1).max(100),
});
const sessionInputSchema = z.object({
  data: z.string().max(64 * 1024).optional(),
  eof: z.boolean().optional(),
  signal: z.enum(["SIGINT", "SIGTERM"]).optional(),
});

const startLessonSession = async (req: Request, res: Response) => {
  const parsed = sessionSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Invalid run request." });
  const bytes = parsed.data.files.reduce((n, f) => n + Buffer.byteLength(f.content, "utf8"), 0);
  if (bytes > 1024 * 1024) return res.status(413).json({ success: false, code: "TOO_LARGE", message: "The files are too large to run (1 MB at most)." });
  if (parsed.data.files.some((f) => f.path.startsWith("/") || f.path.split("/").some((p) => p === ".." || p === ""))) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Invalid file path." });
  }
  try {
    const s = await startSession(ownerOf(req), parsed.data);
    return res.status(201).json({ success: true, data: { id: s.id } });
  } catch (e) {
    return sessionFail(res, e);
  }
};

const lessonSessionEvents = async (req: Request, res: Response) => {
  let s: ReturnType<typeof getSession>;
  try {
    s = getSession(String(req.params.id), ownerOf(req));
  } catch (e) {
    return sessionFail(res, e);
  }
  try {
    await relaySse(req, res, (signal) => openEvents(s, signal), () => void stopSession(s), () => (s.closed = true));
  } catch (e) {
    if (!res.headersSent) return sessionFail(res, e);
  }
};

const lessonSessionInput = async (req: Request, res: Response) => {
  const parsed = sessionInputSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Invalid input." });
  try {
    await sendInput(getSession(String(req.params.id), ownerOf(req)), parsed.data);
    return res.status(204).end();
  } catch (e) {
    return sessionFail(res, e);
  }
};

const stopLessonSession = async (req: Request, res: Response) => {
  try {
    await stopSession(getSession(String(req.params.id), ownerOf(req)));
    return res.status(204).end();
  } catch (e) {
    return sessionFail(res, e);
  }
};

router.get("/code/languages", misBearerAuth, integrationLimiter, codeLanguages);
router.post("/code/run", misBearerAuth, lessonCodeRunLimiter, practiceRun);
router.post("/code/sessions", misBearerAuth, lessonCodeRunLimiter, startLessonSession);
router.get("/code/sessions/:id/events", misBearerAuth, lessonSessionEvents);
router.post("/code/sessions/:id/input", misBearerAuth, lessonSessionInput);
router.delete("/code/sessions/:id", misBearerAuth, stopLessonSession);

router.post("/home-summary", misBearerAuth, integrationLimiter, homeSummary);
router.get("/student-standing", misBearerAuth, integrationLimiter, studentStanding);
router.get("/home-summary", misBearerAuth, integrationLimiter, homeSummary);

export default router;
