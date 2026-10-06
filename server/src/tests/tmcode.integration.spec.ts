import request from "supertest";
import axios from "axios";
import jwt from "jsonwebtoken";
import {
  buildTestApp,
  ensureModelsRegistered,
  findSeededUserByRole,
  signTokenFor,
} from "./testApp";
import { sequelize } from "../config/database";
import {
  ProctoringSettings,
  Quiz,
  QuizAttempt,
  QuizQuestion,
  QuizSubmission,
  QuestionBank,
  TmcodeFlag,
  TmcodeLaunchTicket,
  TmcodeRun,
  TmcodeSession,
  TmcodeSnapshot,
  TmcodeTelemetry,
} from "../models";
import { aiService } from "../services/ai/aiService";
import { chainHmac, filesHash, journalKey } from "../tmcode/journal";
import { processNextRun } from "../services/tmcodeGrading.service";
import { tmcodeServerRunLimiter } from "../routes/tmcode";

/**
 * TMCode ↔ Task Mentor (PROTOCOL.md) end to end against the dev DB:
 * launch → sessions → package → snapshots → submit → grading worker →
 * results. tm-judge is stubbed at axios; nothing reaches a real judge.
 */

const COURSE_ID = 4247;
const ENV = { ...process.env };

let app: ReturnType<typeof buildTestApp>;
let studentToken: string;
let studentId: number;
let adminId: number;
const quizIds: number[] = [];
const bankIds: number[] = [];

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const admin = await findSeededUserByRole("admin");
  const student = await findSeededUserByRole("student");
  adminId = admin.id;
  studentId = student.id;
  studentToken = signTokenFor(student.id);
  process.env.CODERUNNER_ENGINE = "tmjudge";
  process.env.TMJUDGE_URL = "http://judge.test:5010";
  process.env.JUDGE0_RETRY_BASE_MS = "1";
  process.env.JUDGE0_MAX_RETRIES = "1";
});

beforeEach(() => {
  jest.spyOn(aiService, "gradeCoding").mockRejectedValue(new Error("no AI in tests"));
  tmcodeServerRunLimiter.resetKey(`tmcode-run:${studentId}`);
});
afterEach(() => jest.restoreAllMocks());

afterAll(async () => {
  process.env = ENV;
  if (quizIds.length) {
    const sessions = await TmcodeSession.findAll({ where: { quiz_id: quizIds } });
    const sids = sessions.map((s) => s.id);
    const subs = (await QuizSubmission.findAll({ where: { quiz_id: quizIds } })).map((s) => s.id);
    if (sids.length) {
      await TmcodeSnapshot.destroy({ where: { session_id: sids } });
      await TmcodeTelemetry.destroy({ where: { session_id: sids } });
      await TmcodeFlag.destroy({ where: { session_id: sids } });
      await TmcodeSession.destroy({ where: { id: sids } });
    }
    if (subs.length) {
      await TmcodeRun.destroy({ where: { submission_id: subs } });
      await TmcodeLaunchTicket.destroy({ where: { submission_id: subs } });
    }
    await ProctoringSettings.destroy({ where: { quiz_id: quizIds } });
    await QuizAttempt.destroy({ where: { quiz_id: quizIds } });
    await QuizSubmission.destroy({ where: { quiz_id: quizIds } });
    await QuizQuestion.destroy({ where: { quiz_id: quizIds } });
    await Quiz.destroy({ where: { id: quizIds } });
  }
  if (bankIds.length) await QuestionBank.destroy({ where: { id: bankIds } });
  await sequelize.close();
});

async function makeQuiz(delivery: "web" | "tmcode_optional" | "tmcode_required" = "tmcode_required") {
  const quiz = await Quiz.create({
    title: "TMCode spec",
    description: "tmcode.integration.spec.ts",
    course_id: COURSE_ID,
    created_by: adminId,
    status: "published",
    type: "Exam",
    time_limit: 60,
    show_results_immediately: true,
    enable_automatic_grading: true,
    require_manual_grading: false,
  } as any);
  quizIds.push(quiz.id);
  const bank = await QuestionBank.create({
    course_id: COURSE_ID,
    question_type: "coding",
    question_text: "<p>Add two numbers</p>",
    question_data: {
      language: "python",
      starter_code: "# read two ints\n",
      test_cases: [
        { id: "v1", name: "example", input: "1 2", expected_output: "3", is_hidden: false, points: 1 },
        { id: "h1", input: "HIDDEN-IN", expected_output: "HIDDEN-OUT", is_hidden: true, points: 3 },
      ],
    } as any,
    created_by: adminId,
  } as any);
  bankIds.push(bank.id);
  const question = await QuizQuestion.create({
    quiz_id: quiz.id,
    question_id: bank.id,
    points: 4,
    order: 1,
  } as any);
  await ProctoringSettings.create({ quiz_id: quiz.id, enabled: false, tmcode_delivery: delivery } as any);
  return { quiz, question };
}

const asStudent = (r: request.Test) => r.set("Authorization", `Bearer ${studentToken}`);
const launch = (quizId: number) =>
  asStudent(request(app).post("/api/tmcode/launch")).send({ quiz_id: quizId });
const redeem = (ticket: string, deviceId = "11111111-2222-4333-8444-555555555555") =>
  request(app)
    .post("/api/tmcode/sessions")
    .send({
      ticket,
      device: { id: deviceId, os: "mac", os_version: "15.1", arch: "aarch64", app_version: "0.1.0" },
      env_report: { toolchains: [{ tool: "python", version: "Python 3.12.7" }] },
    });

/** A TMCode client: keeps the chain like the desktop journal does. */
class Client {
  prev = "";
  seq = 0;
  constructor(
    public sid: string,
    public token: string,
    public nonce = "",
  ) {}
  call(method: "get" | "post", path: string) {
    return request(app)[method](`/api/tmcode/sessions/${this.sid}${path}`).set(
      "Authorization",
      `Bearer ${this.token}`,
    );
  }
  record(questionId: number, kind: string, files: { path: string; content: string }[], opts: { seq?: number; client_ts?: string } = {}) {
    const seq = opts.seq ?? this.seq + 1;
    const client_ts = opts.client_ts ?? new Date().toISOString();
    const files_hash = filesHash(files);
    const hmac = chainHmac(journalKey(this.nonce, this.sid), this.prev, {
      seq,
      question_id: questionId,
      kind,
      files_hash,
      client_ts,
    });
    return { seq, question_id: questionId, kind, client_ts, files, files_hash, hmac };
  }
  async snapshot(body: any) {
    const res = await this.call("post", "/snapshots").send(body);
    if (res.status === 200) {
      this.prev = body.hmac;
      this.seq = body.seq;
    }
    return res;
  }
}

async function open(quizId: number) {
  const l = await launch(quizId);
  expect(l.status).toBe(200);
  const r = await redeem(l.body.ticket);
  expect(r.status).toBe(200);
  const c = new Client(r.body.session_id, r.body.token);
  const pkg = await c.call("get", "/package");
  expect(pkg.status).toBe(200);
  c.nonce = pkg.body.journal_nonce;
  return { c, pkg: pkg.body, submissionId: r.body.submission_id as number, redeem: r.body };
}

const FILES = [{ path: "main.py", content: "a, b = map(int, input().split())\nprint(a + b)\n" }];

function stubJudge(passHidden = false) {
  return jest.spyOn(axios, "post").mockImplementation(async (url: string, body: any) => {
    expect(url).toBe("http://judge.test:5010/v1/run");
    return {
      data: {
        language: body.language,
        sandbox: "isolate",
        compile: null,
        tests: body.tests.map((t: any) => {
          const passed = t.input !== "HIDDEN-IN" || passHidden;
          return { id: t.id, verdict: passed ? "accepted" : "wrong-answer", passed, stdout: passed ? "3\n" : "x", stderr: "", exit_code: 0, time_ms: 9, memory_kb: 7000 };
        }),
      },
    } as any;
  });
}

describe("launch and sessions (PROTOCOL.md §1)", () => {
  it("launch returns a single-use ticket and a deep link; web-delivery quizzes refuse", async () => {
    const { quiz } = await makeQuiz();
    const l = await launch(quiz.id);
    expect(l.status).toBe(200);
    expect(l.body.ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(l.body.deeplink).toMatch(
      new RegExp(`^tmcode://launch\\?t=${l.body.ticket}&api=http%3A%2F%2F127\\.0\\.0\\.1%3A\\d+$`),
    );
    expect(new Date(l.body.expires_at).getTime() - Date.now()).toBeLessThanOrEqual(120_000);
    // stored hashed only
    expect(await TmcodeLaunchTicket.count({ where: { ticket_hash: l.body.ticket } })).toBe(0);

    const web = await makeQuiz("web");
    const refused = await launch(web.quiz.id);
    expect(refused.status).toBe(409);
    expect(refused.body.error_code).toBe("TMCODE_NOT_ENABLED");
  });

  it("redeem: token claims and scope; ticket is single-use; bad ticket 401", async () => {
    const { quiz } = await makeQuiz();
    const l = await launch(quiz.id);
    const r = await redeem(l.body.ticket);
    expect(r.status).toBe(200);
    const claims: any = jwt.verify(r.body.token, `${process.env.JWT_SECRET}:tmcode`, { audience: "tmcode" });
    expect(claims).toMatchObject({ sid: r.body.session_id, sub: String(studentId), submission_id: r.body.submission_id });
    expect((await redeem(l.body.ticket)).body.error_code).toBe("TICKET_USED");
    const bad = await redeem("x".repeat(43));
    expect(bad.status).toBe(401);
    expect(bad.body.error_code).toBe("TICKET_INVALID");

    // A token only works on its own session.
    const other = await request(app)
      .get(`/api/tmcode/sessions/00000000-0000-4000-8000-000000000000/package`)
      .set("Authorization", `Bearer ${r.body.token}`);
    expect(other.status).toBe(403);
    expect(other.body.error_code).toBe("SESSION_SCOPE");
  });
});

describe("package (PROTOCOL.md §2)", () => {
  it("has the task, visible tests only, profiles and policy", async () => {
    const { quiz, question } = await makeQuiz();
    const { pkg } = await open(quiz.id);
    expect(JSON.stringify(pkg)).not.toContain("HIDDEN-");
    expect(pkg.quiz).toEqual({ id: quiz.id, title: "TMCode spec", type: "Exam" });
    expect(pkg.policy).toMatchObject({ mode: "monitored", paste: "internal_only", terminal: "off", allow_offline_grace_minutes: 10 });
    expect(Buffer.from(pkg.journal_nonce, "base64")).toHaveLength(32);
    expect(pkg.profiles.map((p: any) => p.id)).toEqual(["python-3"]);
    expect(pkg.toolchains).toEqual(["python"]);
    expect(pkg.live).toBeNull();
    expect(pkg.tasks).toHaveLength(1);
    expect(pkg.tasks[0]).toMatchObject({
      question_id: question.id,
      points: 4,
      profile_id: "python-3",
      files: [{ path: "main.py", content: "# read two ints\n", readonly: false }],
      visible_tests: [{ id: "v1", name: "example", input: "1 2", expected_output: "3", points: 1 }],
      hidden_test_count: 1,
      resume: null,
    });
  });
});

describe("snapshots, submit and grading (PROTOCOL.md §3–4)", () => {
  it("chain ok, idempotent, conflict, gap, tamper; web copy; submit; worker grades; results", async () => {
    const { quiz, question } = await makeQuiz();
    const { c, submissionId } = await open(quiz.id);

    const s1 = c.record(question.id, "auto", FILES);
    const ok = await c.snapshot(s1);
    expect(ok.status).toBe(200);
    expect(ok.body.accepted_seq).toBe(1);

    // same record again: 200; same seq, different hmac: SEQ_CONFLICT
    expect((await c.call("post", "/snapshots").send(s1)).status).toBe(200);
    const conflict = await c.call("post", "/snapshots").send({ ...s1, hmac: "0".repeat(64) });
    expect(conflict.body.error_code).toBe("SEQ_CONFLICT");

    const gap = await c.call("post", "/snapshots").send(c.record(question.id, "auto", FILES, { seq: 3 }));
    expect(gap.status).toBe(409);
    expect(gap.body).toMatchObject({ error_code: "SEQ_GAP", expected_seq: 2 });

    // content that doesn't match its hash → JOURNAL_TAMPERED + a flag
    const forged = { ...c.record(question.id, "auto", FILES), files: [{ path: "main.py", content: "print(3)" }] };
    const tampered = await c.call("post", "/snapshots").send(forged);
    expect(tampered.status).toBe(409);
    expect(tampered.body.error_code).toBe("JOURNAL_TAMPERED");
    expect(await TmcodeFlag.count({ where: { session_id: c.sid, rule: "journal_tampered" } })).toBe(1);
    // a record chained to the wrong predecessor is caught too
    const wrongPrev = c.record(question.id, "auto", FILES);
    const badChain = await c.call("post", "/snapshots").send({ ...wrongPrev, hmac: chainHmac(journalKey(c.nonce, c.sid), "nope", wrongPrev) });
    expect(badChain.body.error_code).toBe("JOURNAL_TAMPERED");

    // The web views see the latest code, ungraded.
    let attempt = await QuizAttempt.findOne({ where: { submission_id: submissionId, question_id: question.id } });
    expect(JSON.parse((attempt?.submitted_answer as any).code)[0]).toMatchObject({ name: "main.py", is_entry_point: true });
    expect(attempt?.grading_details).toMatchObject({ ungraded: true, source: "tmcode", snapshot_seq: 1 });

    // The web endpoints refuse code answers for a tmcode_required quiz.
    const web = await asStudent(
      request(app).post(`/api/quizzes/attempts/${submissionId}/questions/${question.id}/answer`),
    ).send({ answer_data: { code: "print(3)", language: "python" } });
    expect(web.status).toBe(409);
    expect(web.body.code).toBe("TMCODE_REQUIRED");

    expect((await c.call("post", "/telemetry").send({ seq: 1, events: [{ t: 5, type: "focus", state: "lost" }] })).body).toEqual({ ok: true });
    expect((await c.call("post", "/telemetry").send({ seq: 1, events: [] })).body).toEqual({ ok: true });
    const hb = await c.call("post", "/heartbeat").send({ synced_seq: 1, current_question: question.id, focus: "in" });
    expect(hb.body).toMatchObject({ status: "active", paused: false, message: null });

    const s2 = c.record(question.id, "final", FILES);
    expect((await c.snapshot(s2)).status).toBe(200);

    const missing = await c.call("post", "/submit").send({ final: [{ question_id: question.id, seq: 9 }] });
    expect(missing.body.error_code).toBe("SNAPSHOT_MISSING");

    const judge = stubJudge(false);
    const sub = await c.call("post", "/submit").send({ final: [{ question_id: question.id, seq: 2 }] });
    expect(sub.body).toEqual({ status: "grading" });
    expect(judge).not.toHaveBeenCalled(); // no judge call in the request
    expect((await c.call("get", "/results")).body).toEqual({ status: "grading" });
    expect((await c.call("post", "/submit").send({ final: [{ question_id: question.id, seq: 2 }] })).body).toEqual({ status: "grading" });

    while (await processNextRun());
    expect(judge).toHaveBeenCalledTimes(1);
    const body = judge.mock.calls[0][1] as any;
    expect(body.language).toBe("python-3");
    expect(body.tests.map((t: any) => t.id)).toEqual(["v1", "h1"]); // all tests, hidden included

    attempt = await QuizAttempt.findOne({ where: { submission_id: submissionId, question_id: question.id } });
    expect(Number(attempt?.points_earned)).toBe(1); // 1 of 4 test points
    expect((attempt?.grading_details as any).testResults).toHaveLength(2);
    const stored = await QuizSubmission.findByPk(submissionId);
    expect(stored?.status).toBe("completed");
    expect(Number(stored?.total_score)).toBe(1);
    expect(stored?.grade_status).toBe("auto_graded");
    expect((await TmcodeSession.findByPk(c.sid))?.status).toBe("ended");

    const results = await c.call("get", "/results");
    expect(results.body).toMatchObject({ status: "released", score: 1, max_score: 4 });
    expect(results.body.questions[0].tests).toEqual([
      { id: "v1", name: "example", hidden: false, passed: true },
      { id: "h1", name: "Test 2", hidden: true, passed: false },
    ]);
    expect(JSON.stringify(results.body)).not.toContain("HIDDEN-");
  });

  it("server-run: visible tests on the judge only", async () => {
    const { quiz, question } = await makeQuiz();
    const { c } = await open(quiz.id);
    const judge = stubJudge(true);
    const r = await c.call("post", "/server-run").send({ question_id: question.id, files: FILES });
    expect(r.status).toBe(200);
    expect(r.body.tests).toEqual([{ id: "v1", verdict: "accepted", passed: true, stdout: "3\n", stderr: "", time_ms: 9 }]);
    expect((judge.mock.calls[0][1] as any).tests).toHaveLength(1);
  });

  it("supersede: a newer launch replaces the older session", async () => {
    const { quiz, question } = await makeQuiz();
    const first = await open(quiz.id);
    const second = await open(quiz.id);
    expect(second.submissionId).toBe(first.submissionId);
    const hb = await first.c.call("post", "/heartbeat").send({});
    expect(hb.body.status).toBe("superseded");
    const up = await first.c.call("post", "/snapshots").send(first.c.record(question.id, "auto", FILES));
    expect(up.body.error_code).toBe("SESSION_SUPERSEDED");
    // the new session resumes from what was synced
    expect((await second.c.snapshot(second.c.record(question.id, "auto", FILES))).status).toBe(200);
    const third = await open(quiz.id);
    expect(third.pkg.tasks[0].resume).toMatchObject({ snapshot_seq: 1, files: FILES });
  });

  it("expired attempt: only a valid offline_final written before the deadline is accepted", async () => {
    const { quiz, question } = await makeQuiz();
    const { c, submissionId } = await open(quiz.id);
    const deadline = new Date(Date.now() - 5 * 60_000); // 5 min ago, inside the 10 min offline grace
    await QuizSubmission.update({ end_time: deadline } as any, { where: { id: submissionId } });

    const late = await c.call("post", "/snapshots").send(c.record(question.id, "auto", FILES));
    expect(late.body.error_code).toBe("ATTEMPT_TIME_EXPIRED");
    const afterDeadline = await c.call("post", "/snapshots").send(
      c.record(question.id, "offline_final", FILES, { client_ts: new Date(deadline.getTime() + 1000).toISOString() }),
    );
    expect(afterDeadline.body.error_code).toBe("ATTEMPT_TIME_EXPIRED");
    const offline = await c.snapshot(
      c.record(question.id, "offline_final", FILES, { client_ts: new Date(deadline.getTime() - 1000).toISOString() }),
    );
    expect(offline.status).toBe(200);

    // A redeem after the deadline is refused.
    await QuizSubmission.update({ end_time: new Date(Date.now() - 60 * 60_000) } as any, { where: { id: submissionId } });
    const t = await TmcodeLaunchTicket.create({
      ticket_hash: require("crypto").createHash("sha256").update("late-ticket-xxxxxxxxxxxx").digest("hex"),
      submission_id: submissionId,
      user_id: studentId,
      quiz_id: quiz.id,
      expires_at: new Date(Date.now() + 60_000),
    } as any);
    expect(t).toBeTruthy();
    expect((await redeem("late-ticket-xxxxxxxxxxxx")).body.error_code).toBe("ATTEMPT_TIME_EXPIRED");
  });
});
