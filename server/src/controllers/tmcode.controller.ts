import crypto from "crypto";
import zlib from "zlib";
import { Request, Response } from "express";
import { z } from "zod";
import { Op } from "sequelize";
import { sequelize } from "../config/database";
import {
  Quiz,
  QuizAttempt,
  QuizQuestion,
  QuizSubmission,
  TmcodeDevice,
  TmcodeFlag,
  TmcodeLaunchTicket,
  TmcodeSession,
  TmcodeSnapshot,
  TmcodeTelemetry,
} from "../models";
import { tmcodeError } from "../middleware/tmcodeAuth";
import { hasValidSebConfigKey, lockdownRequirement } from "../utils/lockdown";
import { startOrResumeAttempt } from "../utils/quizAttemptStart";
import { resultVisibility } from "../utils/quizStudentView";
import { SUBMIT_GRACE_SECONDS } from "../utils/quizTiming";
import { handleMisError } from "../utils/misUtils";
import { PROFILES } from "../tmcode/profiles";
import { tmcodeSettingsFor } from "../tmcode/policy";
import { signTmcodeToken } from "../tmcode/token";
import { chainHmac, filesHash, journalKey, sameHex } from "../tmcode/journal";
import {
  answerFromFiles,
  attemptDeadline,
  buildTask,
  codeQuestionsOf,
  gzipFiles,
  profileForQuestion,
  questionData,
  toolchainsOf,
  tokenExpiry,
  TMCODE_QUESTION_TYPES,
  languageForProfile,
} from "../tmcode/exam";
import { getCodeRunner } from "../services/coderunner";
import { JudgeUnavailableError, UnsupportedLanguageError } from "../services/Judge0Service";
import { enqueueGrading, hasPendingRuns } from "../services/tmcodeGrading.service";
import { getQuestionBankInclude } from "../utils/quizUtils";

/**
 * TMCode ↔ Task Mentor (nga-tmcode/docs/PROTOCOL.md v1). Errors use the
 * protocol's `{error_code, message}` shape, not Task Mentor's usual one.
 */

const TICKET_TTL_MS = 120_000;
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const sessionOf = (req: Request): TmcodeSession => (req as any).tmcodeSession;

/** The API origin TMCode should talk to (it only accepts allow-listed ones). */
export function apiOrigin(req: Request): string {
  const configured = process.env.TMCODE_API_ORIGIN?.replace(/\/+$/, "");
  if (configured) return configured;
  const first = (v: unknown) => (Array.isArray(v) ? v[0] : (v as string | undefined))?.split(",")[0]?.trim();
  const proto = first(req.headers["x-forwarded-proto"]) || req.protocol;
  const host = first(req.headers["x-forwarded-host"]) || req.headers.host;
  return `${proto}://${host}`;
}

const validation = (res: Response, error: z.ZodError) =>
  tmcodeError(res, 400, "VALIDATION_ERROR", "Invalid request body.", {
    errors: error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
  });

const filesSchema = z
  .array(z.object({ path: z.string().min(1).max(260), content: z.string() }))
  .max(300);

// ─── POST /launch ──────────────────────────────────────────────────────────

// @desc    Ticket + deep link to open a quiz in TMCode (creates or resumes
//          the attempt with the web start rules).
// @route   POST /api/tmcode/launch
// @access  Private (TM JWT, TMCODE_USE + QUIZZES_ATTEMPT)
export const launch = async (req: Request, res: Response) => {
  const parsed = z.object({ quiz_id: z.coerce.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) return validation(res, parsed.error);
  const quizId = parsed.data.quiz_id;

  const quiz = await Quiz.findByPk(quizId);
  if (!quiz) return tmcodeError(res, 404, "QUIZ_NOT_FOUND", "Quiz not found.");
  if (!req.user.permissions?.has("QUIZZES_ATTEMPT")) {
    return tmcodeError(res, 403, "FORBIDDEN", "Only students can take quizzes in TMCode.");
  }
  const { delivery, policy } = await tmcodeSettingsFor(quiz.id);
  if (delivery === "web") {
    return tmcodeError(res, 409, "TMCODE_NOT_ENABLED", "This quiz isn't delivered in TMCode.");
  }
  // Safe Exam Browser (lockdown_browser or policy.require_seb).
  const lock = await lockdownRequirement(quiz.id);
  if ((lock.required || policy.require_seb) && !hasValidSebConfigKey(req, lock.configKey)) {
    return tmcodeError(res, 409, "LOCKDOWN_REQUIRED", "This quiz must be opened from Safe Exam Browser.");
  }

  const transaction = await sequelize.transaction();
  try {
    const started = await startOrResumeAttempt(req, quiz, transaction);
    if (started.kind === "expired") {
      await transaction.commit();
      return tmcodeError(res, 409, "ATTEMPT_TIME_EXPIRED", "Time ran out on this attempt; it was submitted with the answers saved.", {
        data: started.summary,
      });
    }
    if (started.kind === "refused") {
      await transaction.rollback();
      return tmcodeError(res, started.status, started.code, started.message);
    }
    const submission = started.submission;

    const ticket = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + TICKET_TTL_MS);
    await TmcodeLaunchTicket.create(
      {
        ticket_hash: sha256(ticket),
        submission_id: submission.id,
        user_id: req.user.id,
        quiz_id: quiz.id,
        expires_at: expiresAt,
      } as any,
      { transaction },
    );
    await transaction.commit();

    const api = encodeURIComponent(apiOrigin(req));
    return res.status(200).json({
      ticket,
      expires_at: expiresAt.toISOString(),
      deeplink: `tmcode://launch?t=${ticket}&api=${api}`,
    });
  } catch (error: any) {
    await transaction.rollback();
    if (error?.response?.status === 401) return handleMisError(error, res, "MIS session expired");
    console.error("TMCode launch error:", error);
    return tmcodeError(res, 500, "SERVER_ERROR", "Could not launch TMCode.");
  }
};

// ─── POST /sessions ────────────────────────────────────────────────────────

const redeemSchema = z.object({
  ticket: z.string().min(10),
  device: z.object({
    id: z.string().min(8).max(36),
    os: z.string().max(40).optional(),
    os_version: z.string().max(40).optional(),
    arch: z.string().max(16).optional(),
    app_version: z.string().max(20).optional(),
  }),
  env_report: z.any().optional(),
});

// @desc    Redeem a launch ticket → attempt-scoped session + token.
// @route   POST /api/tmcode/sessions
// @access  The ticket itself
export const redeemTicket = async (req: Request, res: Response) => {
  const parsed = redeemSchema.safeParse(req.body);
  if (!parsed.success) return validation(res, parsed.error);
  const { ticket, device, env_report } = parsed.data;

  const row = await TmcodeLaunchTicket.findByPk(sha256(ticket));
  if (!row || row.expires_at.getTime() < Date.now()) {
    return tmcodeError(res, 401, "TICKET_INVALID", "This launch link is invalid or has expired. Launch again from Task Mentor.");
  }
  // Single use, even under a race.
  const [used] = await TmcodeLaunchTicket.update(
    { used_at: new Date() } as any,
    { where: { ticket_hash: row.ticket_hash, used_at: null } },
  );
  if (!used) return tmcodeError(res, 409, "TICKET_USED", "This launch link was already used. Launch again from Task Mentor.");

  const submission = await QuizSubmission.findByPk(row.submission_id);
  const quiz = submission ? await Quiz.findByPk(submission.quiz_id) : null;
  if (!submission || !quiz) return tmcodeError(res, 401, "TICKET_INVALID", "The attempt no longer exists.");
  const deadline = attemptDeadline(submission, quiz);
  if (
    submission.status !== "in_progress" ||
    Date.now() > deadline.getTime() + SUBMIT_GRACE_SECONDS * 1000
  ) {
    return tmcodeError(res, 409, "ATTEMPT_TIME_EXPIRED", "This attempt is over.");
  }

  const { policy } = await tmcodeSettingsFor(quiz.id);
  const now = new Date();
  const sessionId = crypto.randomUUID();
  await sequelize.transaction(async (transaction) => {
    const existing = await TmcodeDevice.findByPk(device.id, { transaction });
    const deviceValues = {
      user_id: row.user_id,
      os: device.os ?? null,
      os_version: device.os_version ?? null,
      arch: device.arch ?? null,
      app_version: device.app_version ?? null,
      last_seen: now,
    };
    if (existing) await existing.update(deviceValues, { transaction });
    else await TmcodeDevice.create({ id: device.id, first_seen: now, ...deviceValues } as any, { transaction });

    // One live session per attempt: the newest wins.
    await TmcodeSession.update(
      { status: "superseded", ended_at: now } as any,
      { where: { submission_id: submission.id, status: "active" }, transaction },
    );
    await TmcodeSession.create(
      {
        id: sessionId,
        submission_id: submission.id,
        quiz_id: quiz.id,
        user_id: row.user_id,
        device_id: device.id,
        mode: policy.mode,
        status: "active",
        journal_nonce: crypto.randomBytes(32).toString("base64"),
        last_seq: 0,
        last_hmac: "",
        env_report: env_report ?? null,
        started_at: now,
        last_heartbeat: now,
      } as any,
      { transaction },
    );
  });

  const expiresAt = tokenExpiry(deadline, policy);
  return res.status(200).json({
    session_id: sessionId,
    token: signTmcodeToken(
      { sid: sessionId, sub: String(row.user_id), submission_id: submission.id },
      expiresAt,
    ),
    expires_at: expiresAt.toISOString(),
    submission_id: submission.id,
  });
};

// ─── GET /sessions/:sid/package ────────────────────────────────────────────

// @desc    The exam package (PROTOCOL.md §2). Never contains hidden tests,
//          reference solutions or web-check specs.
// @route   GET /api/tmcode/sessions/:sid/package
export const getPackage = async (req: Request, res: Response) => {
  const session = sessionOf(req);
  if (session.status !== "active") {
    return tmcodeError(res, 409, "SESSION_SUPERSEDED", "This session was replaced by a newer launch.");
  }
  const submission = await QuizSubmission.findByPk(session.submission_id);
  const quiz = await Quiz.findByPk(session.quiz_id);
  if (!submission || !quiz) return tmcodeError(res, 404, "NOT_FOUND", "Attempt not found.");
  const { policy, min_app_version } = await tmcodeSettingsFor(quiz.id);

  const questions = await codeQuestionsOf(quiz.id);
  const unsupported = questions.filter((q) => !profileForQuestion(q));
  if (unsupported.length) {
    return tmcodeError(res, 409, "UNSUPPORTED_PROFILE", "Some questions use a language TMCode doesn't support yet.", {
      question_ids: unsupported.map((q) => q.id),
    });
  }
  const tasks = [];
  const used = new Map<string, (typeof PROFILES)[number]>();
  for (const q of questions) {
    const profile = profileForQuestion(q)!;
    used.set(profile.id, profile);
    tasks.push(await buildTask(q, submission.id, profile));
  }
  const profiles = [...used.values()];
  return res.status(200).json({
    submission_id: submission.id,
    quiz: { id: quiz.id, title: quiz.title, type: String(quiz.type) },
    deadline: attemptDeadline(submission, quiz).toISOString(),
    server_time: new Date().toISOString(),
    policy,
    // Oldest TMCode that may take this exam (tmcode_policy.min_app_version, else TMCODE_MIN_APP_VERSION); null: any.
    min_app_version,
    journal_nonce: session.journal_nonce,
    profiles,
    toolchains: toolchainsOf(profiles),
    tasks,
    live: null,
  });
};

// ─── POST /sessions/:sid/snapshots ─────────────────────────────────────────

const snapshotSchema = z.object({
  seq: z.number().int().positive(),
  question_id: z.number().int().positive(),
  kind: z.enum(["auto", "run", "final", "offline_final"]),
  client_ts: z.string().min(1).max(40),
  files: filesSchema,
  files_hash: z.string().regex(/^[0-9a-f]{64}$/i),
  hmac: z.string().regex(/^[0-9a-f]{64}$/i),
});

async function raiseFlag(session: TmcodeSession, rule: string, evidence: object, questionId?: number) {
  await TmcodeFlag.create({
    session_id: session.id,
    submission_id: session.submission_id,
    question_id: questionId ?? null,
    rule,
    severity: "high",
    evidence,
    at: new Date(),
  } as any).catch((e) => console.error("[tmcode] flag:", e?.message));
}

// @desc    One journal record: verified (files_hash + HMAC chain), stored,
//          and copied onto the question's QuizAttempt (ungraded).
// @route   POST /api/tmcode/sessions/:sid/snapshots
export const postSnapshot = async (req: Request, res: Response) => {
  const parsed = snapshotSchema.safeParse(req.body);
  if (!parsed.success) return validation(res, parsed.error);
  const body = parsed.data;
  const session = sessionOf(req);

  // Idempotent per (sid, seq).
  const dup = await TmcodeSnapshot.findOne({ where: { session_id: session.id, seq: body.seq } });
  if (dup) {
    return sameHex(dup.hmac, body.hmac)
      ? res.status(200).json({ accepted_seq: dup.seq, server_ts: dup.server_ts.toISOString() })
      : tmcodeError(res, 409, "SEQ_CONFLICT", "A different record with this seq was already stored.");
  }
  if (session.status !== "active") {
    return tmcodeError(res, 409, "SESSION_SUPERSEDED", "This session was replaced by a newer launch.");
  }
  const expected = session.last_seq + 1;
  if (body.seq !== expected) {
    return tmcodeError(res, 409, "SEQ_GAP", `Expected seq ${expected}.`, { expected_seq: expected });
  }

  const question = await QuizQuestion.findByPk(body.question_id, { include: getQuestionBankInclude() });
  if (
    !question ||
    question.quiz_id !== session.quiz_id ||
    !TMCODE_QUESTION_TYPES.includes(question.questionBank?.question_type as string)
  ) {
    return tmcodeError(res, 400, "QUESTION_NOT_IN_EXAM", "This question isn't a task of this exam.");
  }

  // Tamper evidence: content hash, then the chain.
  const key = journalKey(session.journal_nonce, session.id);
  const computedFilesHash = filesHash(body.files);
  const computedHmac = chainHmac(key, session.last_hmac, {
    seq: body.seq,
    question_id: body.question_id,
    kind: body.kind,
    files_hash: body.files_hash.toLowerCase(),
    client_ts: body.client_ts,
  });
  if (!sameHex(computedFilesHash, body.files_hash) || !sameHex(computedHmac, body.hmac)) {
    await raiseFlag(
      session,
      "journal_tampered",
      {
        seq: body.seq,
        files_hash_ok: sameHex(computedFilesHash, body.files_hash),
        hmac_ok: sameHex(computedHmac, body.hmac),
      },
      body.question_id,
    );
    return tmcodeError(res, 409, "JOURNAL_TAMPERED", "This record doesn't match the session journal.");
  }

  // Deadline (PROTOCOL.md §3): after deadline + grace only a valid
  // offline_final written before the deadline, within the offline grace.
  const submission = await QuizSubmission.findByPk(session.submission_id);
  const quiz = await Quiz.findByPk(session.quiz_id);
  if (!submission || !quiz) return tmcodeError(res, 404, "NOT_FOUND", "Attempt not found.");
  const { policy } = await tmcodeSettingsFor(quiz.id);
  const deadline = attemptDeadline(submission, quiz).getTime();
  const now = Date.now();
  const late = now > deadline + SUBMIT_GRACE_SECONDS * 1000;
  const clientTs = new Date(body.client_ts).getTime();
  if (late || submission.status !== "in_progress") {
    const offlineOk =
      body.kind === "offline_final" &&
      Number.isFinite(clientTs) &&
      clientTs <= deadline &&
      now <= deadline + SUBMIT_GRACE_SECONDS * 1000 + policy.allow_offline_grace_minutes * 60_000;
    if (!offlineOk) {
      return tmcodeError(res, 409, "ATTEMPT_TIME_EXPIRED", "Time is up for this attempt.");
    }
  }

  const serverTs = new Date();
  let snapshot: TmcodeSnapshot;
  try {
    snapshot = await sequelize.transaction(async (transaction) => {
      // Advance the chain head only from where we verified it.
      const [moved] = await TmcodeSession.update(
        { last_seq: body.seq, last_hmac: body.hmac.toLowerCase(), current_question: body.question_id } as any,
        { where: { id: session.id, last_seq: session.last_seq, status: "active" }, transaction },
      );
      if (!moved) throw Object.assign(new Error("race"), { race: true });
      return TmcodeSnapshot.create(
        {
          session_id: session.id,
          submission_id: session.submission_id,
          question_id: body.question_id,
          seq: body.seq,
          kind: body.kind,
          files_hash: body.files_hash.toLowerCase(),
          files_gz: gzipFiles(body.files),
          client_ts: Number.isFinite(clientTs) ? new Date(clientTs) : serverTs,
          server_ts: serverTs,
          hmac: body.hmac.toLowerCase(),
        } as any,
        { transaction },
      );
    });
  } catch (e: any) {
    if (e?.race || e?.name === "SequelizeUniqueConstraintError") {
      return tmcodeError(res, 409, "SEQ_CONFLICT", "Another upload for this session got there first; retry.");
    }
    throw e;
  }

  // Web views show the latest code: the attempt's answer, not graded yet.
  const answer = answerFromFiles(body.files, profileForQuestion(question));
  if (submission.status === "in_progress") {
    await upsertUngradedAnswer(submission, question.id, answer, snapshot.seq);
  } else if (body.kind === "offline_final") {
    // Received after the attempt closed: grade this copy (plan §13.4).
    await upsertUngradedAnswer(submission, question.id, answer, snapshot.seq);
    await enqueueGrading(submission.id, [{ question_id: question.id, snapshot_id: snapshot.id }]);
    await raiseFlag(session, "offline_final_late", {
      seq: snapshot.seq,
      client_ts: body.client_ts,
      received_at: serverTs.toISOString(),
    }, question.id);
  }

  return res.status(200).json({ accepted_seq: snapshot.seq, server_ts: serverTs.toISOString() });
};

async function upsertUngradedAnswer(
  submission: QuizSubmission,
  questionId: number,
  answer: { code: string; language: string },
  seq: number,
) {
  const values = {
    submitted_answer: answer,
    grading_details: { ungraded: true, source: "tmcode", snapshot_seq: seq },
    is_correct: null as any,
    points_earned: 0,
    status: "completed" as const,
    completed_at: new Date(),
  };
  const attempt = await QuizAttempt.findOne({
    where: { submission_id: submission.id, question_id: questionId },
  });
  if (attempt) await attempt.update(values);
  else {
    await QuizAttempt.create({
      ...values,
      quiz_id: submission.quiz_id,
      question_id: questionId,
      student_id: submission.student_id,
      submission_id: submission.id,
      time_taken: 0,
      started_at: new Date(),
    } as any);
  }
}

// ─── POST /sessions/:sid/telemetry ─────────────────────────────────────────

const telemetrySchema = z.object({
  seq: z.number().int().positive(),
  events: z.array(z.object({ t: z.number().nonnegative(), type: z.string() }).passthrough()).max(5000),
});

// @desc    A telemetry batch, stored for Phase 4 (replay, flags).
// @route   POST /api/tmcode/sessions/:sid/telemetry
export const postTelemetry = async (req: Request, res: Response) => {
  const parsed = telemetrySchema.safeParse(req.body);
  if (!parsed.success) return validation(res, parsed.error);
  const session = sessionOf(req);
  const { seq, events } = parsed.data;
  const exists = await TmcodeTelemetry.findOne({ where: { session_id: session.id, seq } });
  if (exists) return res.status(200).json({ ok: true });
  try {
    await TmcodeTelemetry.create({
      session_id: session.id,
      seq,
      events: events.length,
      events_gz: zlib.gzipSync(Buffer.from(JSON.stringify(events), "utf8")),
      t_from: events.length ? Math.min(...events.map((e) => e.t)) : null,
      t_to: events.length ? Math.max(...events.map((e) => e.t)) : null,
      received_at: new Date(),
    } as any);
  } catch (e: any) {
    if (e?.name !== "SequelizeUniqueConstraintError") throw e;
  }
  return res.status(200).json({ ok: true });
};

// ─── POST /sessions/:sid/heartbeat ─────────────────────────────────────────

const heartbeatSchema = z.object({
  synced_seq: z.number().int().nonnegative().optional(),
  current_question: z.number().int().nullable().optional(),
  focus: z.enum(["in", "out"]).optional(),
});

// @desc    Liveness; returns the (possibly extended) deadline and the
//          session's status (superseded sessions learn it here).
// @route   POST /api/tmcode/sessions/:sid/heartbeat
export const heartbeat = async (req: Request, res: Response) => {
  const parsed = heartbeatSchema.safeParse(req.body ?? {});
  if (!parsed.success) return validation(res, parsed.error);
  const session = sessionOf(req);
  const submission = await QuizSubmission.findByPk(session.submission_id);
  const quiz = await Quiz.findByPk(session.quiz_id);
  if (session.status === "active") {
    await session.update({
      last_heartbeat: new Date(),
      current_question: parsed.data.current_question ?? session.current_question,
      focus: parsed.data.focus ?? session.focus,
    });
  }
  return res.status(200).json({
    server_time: new Date().toISOString(),
    deadline: attemptDeadline(submission, quiz).toISOString(),
    status: session.status,
    paused: false,
    message: null,
  });
};

// ─── POST /sessions/:sid/server-run ────────────────────────────────────────

// @desc    Visible tests on the judge (profiles without a local toolchain).
// @route   POST /api/tmcode/sessions/:sid/server-run   (rate-limited)
export const serverRun = async (req: Request, res: Response) => {
  const parsed = z.object({ question_id: z.number().int().positive(), files: filesSchema }).safeParse(req.body);
  if (!parsed.success) return validation(res, parsed.error);
  const session = sessionOf(req);
  if (session.status !== "active") {
    return tmcodeError(res, 409, "SESSION_SUPERSEDED", "This session was replaced by a newer launch.");
  }
  const question = await QuizQuestion.findByPk(parsed.data.question_id, { include: getQuestionBankInclude() });
  if (!question || question.quiz_id !== session.quiz_id) {
    return tmcodeError(res, 400, "QUESTION_NOT_IN_EXAM", "This question isn't a task of this exam.");
  }
  const profile = profileForQuestion(question);
  if (!profile) return tmcodeError(res, 409, "UNSUPPORTED_PROFILE", "No language profile for this question.");
  const tests = (questionData(question).test_cases ?? []).filter((tc: any) => !tc?.is_hidden);
  try {
    const run = await getCodeRunner().run({
      language: languageForProfile(profile.id),
      files: parsed.data.files,
      entry: profile.entry_point,
      interactive: true,
      tests: tests.map((tc: any, i: number) => ({
        id: String(tc.id ?? i + 1),
        input: String(tc.input ?? ""),
        expected_output: String(tc.expected_output ?? ""),
      })),
    });
    return res.status(200).json({
      tests: run.tests.map((t) => ({
        id: t.id,
        verdict: t.verdict,
        passed: t.passed,
        stdout: t.stdout ?? "",
        stderr: t.stderr ?? "",
        time_ms: t.time_ms ?? null,
      })),
    });
  } catch (e: any) {
    if (e instanceof JudgeUnavailableError) {
      return tmcodeError(res, 503, "JUDGE_UNAVAILABLE", "The code runner is busy or unavailable. Try again in a moment.");
    }
    if (e instanceof UnsupportedLanguageError) {
      return tmcodeError(res, 409, "UNSUPPORTED_PROFILE", "The judge can't run this language.");
    }
    throw e;
  }
};

// ─── POST /sessions/:sid/submit ────────────────────────────────────────────

// @desc    Seal the attempt: listed final snapshots become the answers, the
//          session ends and grading is queued (all tests, on the runner).
// @route   POST /api/tmcode/sessions/:sid/submit
export const submit = async (req: Request, res: Response) => {
  const parsed = z
    .object({ final: z.array(z.object({ question_id: z.number().int(), seq: z.number().int() })) })
    .safeParse(req.body);
  if (!parsed.success) return validation(res, parsed.error);
  const session = sessionOf(req);
  const submission = await QuizSubmission.findByPk(session.submission_id);
  if (!submission) return tmcodeError(res, 404, "NOT_FOUND", "Attempt not found.");

  // Already submitted from this session: same answer again.
  if (session.status === "ended" && submission.status !== "in_progress") {
    return res.status(200).json({ status: "grading" });
  }
  if (session.status !== "active") {
    return tmcodeError(res, 409, "SESSION_SUPERSEDED", "This session was replaced by a newer launch.");
  }
  if (submission.status !== "in_progress") {
    return tmcodeError(res, 409, "ATTEMPT_TIME_EXPIRED", "This attempt is already closed.");
  }

  const listed = parsed.data.final;
  const snaps = listed.length
    ? await TmcodeSnapshot.findAll({
        where: { session_id: session.id, seq: { [Op.in]: listed.map((f) => f.seq) } },
      })
    : [];
  const missing = listed.filter(
    (f) => !snaps.some((s) => s.seq === f.seq && s.question_id === f.question_id),
  );
  if (missing.length) {
    return tmcodeError(res, 409, "SNAPSHOT_MISSING", "Upload these snapshots before submitting.", {
      missing,
    });
  }

  // Every code task gets graded: the listed final, else the latest synced
  // snapshot of that question in this attempt.
  const questions = await codeQuestionsOf(session.quiz_id);
  const items: Array<{ question_id: number; snapshot_id: number }> = [];
  for (const q of questions) {
    const chosen =
      snaps.find((s) => s.question_id === q.id) ??
      (await TmcodeSnapshot.findOne({
        where: { submission_id: submission.id, question_id: q.id },
        order: [["server_ts", "DESC"], ["id", "DESC"]],
      }));
    if (chosen) items.push({ question_id: q.id, snapshot_id: chosen.id });
  }

  const now = new Date();
  const started = submission.started_at ? new Date(submission.started_at).getTime() : now.getTime();
  await sequelize.transaction(async (transaction) => {
    await submission.update(
      {
        status: "completed",
        completed_at: now,
        time_taken: Math.max(0, Math.floor((now.getTime() - started) / 1000)),
        grade_status: "pending",
      } as any,
      { transaction },
    );
    await session.update({ status: "ended", ended_at: now }, { transaction });
  });
  await enqueueGrading(submission.id, items);
  return res.status(200).json({ status: "grading" });
};

/**
 * The protocol's per-test verdict from what the grader stored (coderunner
 * Verdict, e.g. "wrong-answer"); undefined when it isn't known.
 */
export function testVerdict(t: { passed?: unknown; verdict?: unknown }):
  | "passed"
  | "wrong_answer"
  | "time_limit"
  | "runtime_error"
  | "compile_error"
  | undefined {
  if (t.passed === true) return "passed";
  switch (String(t.verdict ?? "")) {
    case "accepted":
    case "ok":
      return "passed";
    case "wrong-answer":
      return "wrong_answer";
    case "time-limit":
      return "time_limit";
    case "runtime-error":
    case "memory-limit":
    case "output-limit":
      return "runtime_error";
    case "compile-error":
      return "compile_error";
    default:
      return undefined;
  }
}

// ─── GET /sessions/:sid/results ────────────────────────────────────────────

// @desc    Results once released by the quiz's visibility rules.
// @route   GET /api/tmcode/sessions/:sid/results
export const results = async (req: Request, res: Response) => {
  const session = sessionOf(req);
  const submission = await QuizSubmission.findByPk(session.submission_id);
  const quiz = await Quiz.findByPk(session.quiz_id);
  if (!submission || !quiz) return tmcodeError(res, 404, "NOT_FOUND", "Attempt not found.");
  if (submission.status === "in_progress" || (await hasPendingRuns(submission.id))) {
    return res.status(200).json({ status: "grading" });
  }
  const v = resultVisibility(quiz, submission);
  if (!v.released || !v.show_score) return res.status(200).json({ status: "hidden" });

  const questions = await codeQuestionsOf(quiz.id);
  const attempts = await QuizAttempt.findAll({ where: { submission_id: submission.id } });
  return res.status(200).json({
    status: "released",
    score: Number(submission.total_score) || 0,
    max_score: Number(submission.max_score) || 0,
    questions: questions.map((q) => {
      const a = attempts.find((x) => x.question_id === q.id);
      const d: any = a?.grading_details ?? {};
      const testCases: any[] = questionData(q).test_cases ?? [];
      return {
        question_id: q.id,
        points: Number(a?.points_earned) || 0,
        max_points: Number(q.points) || 0,
        // Hidden tests by name only, never their data (plan §12.3).
        tests: (Array.isArray(d.testResults) ? d.testResults : []).map((t: any, i: number) => ({
          id: String(t.testCaseId ?? i + 1),
          name: testCases.find((tc) => String(tc.id) === String(t.testCaseId))?.name ?? `Test ${i + 1}`,
          hidden: !!t.is_hidden,
          passed: t.passed === true,
          ...(testVerdict(t) ? { verdict: testVerdict(t) } : {}),
        })),
      };
    }),
  });
};

// ─── GET /profiles ─────────────────────────────────────────────────────────

// @desc    The language profiles (cacheable config).
// @route   GET /api/tmcode/profiles
export const getProfiles = (_req: Request, res: Response) => {
  res.set("Cache-Control", "public, max-age=300");
  // TMCode reads the Date header for its clock check (cross-origin from the webview).
  res.set("Access-Control-Expose-Headers", "Date");
  res.status(200).json({ profiles: PROFILES });
};

