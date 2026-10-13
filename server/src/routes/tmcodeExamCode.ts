import { NextFunction, Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { QuizQuestion, TmcodeSession } from "../models";
import { tmcodeAuth, tmcodeError } from "../middleware/tmcodeAuth";
import { codeCapabilitiesData, codeSessionEvents, codeSessionInput, startCodeSession, stopCodeSession } from "../controllers/codeSession.controller";
import { practiceUnitTests } from "../controllers/codeRun.controller";
import { getQuestionBankInclude } from "../utils/quizUtils";
import { languageForProfile, profileForQuestion, questionData } from "../tmcode/exam";

/**
 * /api/tmcode/sessions/:sid/code — the code runner inside a TMCode exam,
 * with the exam's session token (tmcodeAuth). Interactive runs and the
 * student's own unit tests; runs belong to the student who owns the exam
 * session. There is no plain run here: the exam has its own server-run.
 *
 * Route errors use the TMCode `{error_code, message}` shape; the shared
 * controllers answer like /api/code (`{success, code, message}`).
 */
const router = Router({ mergeParams: true });

/** Async handler errors → protocol-shaped 500. */
const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown> | unknown) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch((e) => {
      console.error("[tmcode exam code]", req.method, req.path, e);
      if (res.headersSent) return next(e);
      tmcodeError(res, 500, "SERVER_ERROR", "Something went wrong on Task Mentor.");
    });

const sessionOf = (req: Request): TmcodeSession => (req as any).tmcodeSession;

/**
 * Only the live session of the attempt may run code (a newer launch
 * supersedes it; a submitted attempt has ended). The controllers then see
 * the exam's student as req.user, so runs are owned by them.
 */
function activeExamSession(req: Request, res: Response, next: NextFunction) {
  const session = sessionOf(req);
  if (session.status !== "active") {
    return tmcodeError(res, 409, "SESSION_SUPERSEDED", "This session was replaced by a newer launch.");
  }
  req.user = { id: Number(session.user_id), permissions: new Set<string>(), tmcodeSessionId: session.id } as any;
  next();
}

/** Starts and unit-test runs: 10/min per exam session. */
export const examCodeLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.CODE_RUN_RATE_LIMIT_PER_MIN) || 10,
  keyGenerator: (req) => `tmcode-exam-code:${req.params.sid ?? req.ip}`,
  handler: (_req, res) => tmcodeError(res, 429, "RATE_LIMITED", "Too many code runs — wait a minute and try again."),
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(tmcodeAuth, activeExamSession);

// @desc    What the runner can do here (no web previews in an exam)
// @route   GET /api/tmcode/sessions/:sid/code/capabilities
router.get(
  "/capabilities",
  wrap(async (_req, res) => res.json({ success: true, data: { ...(await codeCapabilitiesData()), previews: false } })),
);

router.post("/sessions", examCodeLimiter, startCodeSession);
router.get("/sessions/:id/events", codeSessionEvents);
router.post("/sessions/:id/input", codeSessionInput);
router.delete("/sessions/:id", stopCodeSession);

const testSchema = z.object({
  question_id: z.number().int().positive(),
  files: z.array(z.any()).min(1),
  language: z.string().max(40).optional().nullable(),
  kind: z.string().max(60).optional().nullable(),
  test_filter: z.string().max(200).optional().nullable(),
});

// @desc    Run the student's own unit tests for an exam question. Never the
//          teacher's unit_test_files: those grade the answer after submit.
// @route   POST /api/tmcode/sessions/:sid/code/test   (rate-limited)
router.post(
  "/test",
  examCodeLimiter,
  wrap(async (req, res) => {
    const parsed = testSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return tmcodeError(res, 400, "VALIDATION_ERROR", "Invalid test request.", {
        issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
    }
    const question = await QuizQuestion.findByPk(parsed.data.question_id, { include: getQuestionBankInclude() });
    if (!question || question.quiz_id !== sessionOf(req).quiz_id) {
      return tmcodeError(res, 400, "QUESTION_NOT_IN_EXAM", "This question isn't a task of this exam.");
    }
    const profile = profileForQuestion(question);
    const language = parsed.data.language || questionData(question).language || (profile ? languageForProfile(profile.id) : null);
    // Exactly what the student sent; the controller validates the files.
    req.body = {
      files: parsed.data.files,
      language,
      kind: parsed.data.kind ?? null,
      test_filter: parsed.data.test_filter ?? null,
    };
    return practiceUnitTests(req, res);
  }),
);

export default router;
