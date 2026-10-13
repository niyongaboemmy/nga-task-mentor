import http from "http";
import express from "express";
import request from "supertest";
import { ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import {
  ProctoringSettings,
  Quiz,
  QuizAttempt,
  QuizQuestion,
  QuizSubmission,
  QuestionBank,
  TmcodeLaunchTicket,
  TmcodeSession,
  TmcodeSnapshot,
  TmcodeTelemetry,
  TmcodeFlag,
} from "../models";
import tmcodeRoutes from "../routes/tmcode";
import tmcodeCodeRoutes from "../routes/tmcodeCode";
import tmcodeExamCodeRoutes, { examCodeLimiter } from "../routes/tmcodeExamCode";
import { codeRunLimiter } from "../middleware/rateLimiter.middleware";
import { resetSessions } from "../services/coderunner/sessions";
import { refreshJudgeInfo, resetJudgeInfo } from "../services/coderunner/judgeInfo";
import { signTmcodeUserToken } from "../tmcode/userToken";

/**
 * TMCode's code runner: /api/tmcode/code (TMCode user token) and
 * /api/tmcode/sessions/:sid/code (exam session token), against a fake
 * tm-judge that records what it was sent, and the dev DB for users/quizzes.
 */

const COURSE_ID = 4247;
const ENV = { ...process.env };
const SECRET_UNIT = "TEACHER-UNIT-TEST-SECRET";

let app: express.Express;
let judge: http.Server;
let studentId: number;
let adminId: number;
let webToken: string;
let userToken: string;
let otherUserToken: string;
const sent: any[] = [];
const quizIds: number[] = [];
const bankIds: number[] = [];

const KINDS = [{ id: "python/project", language: "python", label: "Python – project", actions: ["run", "test"] }];

function fakeJudge() {
  let n = 0;
  return http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const send = (status: number, data: unknown) => res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(data));
      if (req.url === "/v1/health") return send(200, { ok: true, features: ["run", "projects", "catalog", "sessions"] });
      if (req.url === "/v1/catalog") return send(200, { version: "test", kinds: KINDS, unavailable: [] });
      if (req.url === "/v1/run") {
        const b = JSON.parse(body);
        sent.push(b);
        return send(200, {
          kind: "python/project",
          language: b.language,
          compile: null,
          tests: [],
          unit: { framework: "pytest", verdict: "passed", total: 1, passed: 1, failed: 0, skipped: 0, errors: 0, time_ms: 10, output: "", truncated: false, tests: [] },
        });
      }
      if (req.url === "/v1/sessions" && req.method === "POST") {
        sent.push({ session: JSON.parse(body) });
        return send(201, { id: `r${++n}` });
      }
      const m = req.url!.match(/^\/v1\/sessions\/([^/]+)(?:\/(\w+))?$/);
      if (m && m[2] === "events") {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        res.write(`event: stdout\ndata: ${JSON.stringify({ data: "hi\n" })}\n\n`);
        res.write(`event: exit\ndata: ${JSON.stringify({ code: 0, signal: null, verdict: "ok", time_ms: 1, memory_kb: 1 })}\n\n`);
        return res.end();
      }
      if (m) return res.writeHead(204).end();
      res.writeHead(404).end();
    });
  });
}

beforeAll(async () => {
  await ensureModelsRegistered();
  app = express();
  app.use("/api/tmcode/code", express.json({ limit: "2mb" }), tmcodeCodeRoutes);
  app.use("/api/tmcode/sessions/:sid/code", express.json({ limit: "2mb" }), tmcodeExamCodeRoutes);
  app.use("/api/tmcode", express.json({ limit: "8mb" }), tmcodeRoutes);
  const student = await findSeededUserByRole("student");
  const admin = await findSeededUserByRole("admin");
  const instructor = await findSeededUserByRole("instructor");
  studentId = student.id;
  adminId = admin.id;
  webToken = signTokenFor(student.id);
  userToken = signTmcodeUserToken(student.id, student.mis_user_id ?? null).token;
  otherUserToken = signTmcodeUserToken(instructor.id, instructor.mis_user_id ?? null).token;
  judge = fakeJudge();
  await new Promise<void>((r) => judge.listen(0, "127.0.0.1", () => r()));
  process.env.CODERUNNER_ENGINE = "tmjudge";
  process.env.TMJUDGE_URL = `http://127.0.0.1:${(judge.address() as any).port}`;
  process.env.TMJUDGE_TOKEN = "runner-secret-token-for-tests-0001";
});

beforeEach(async () => {
  sent.length = 0;
  resetSessions();
  resetJudgeInfo();
  await refreshJudgeInfo();
  codeRunLimiter.resetKey(`code-run:${studentId}`);
});

afterAll(async () => {
  process.env = ENV;
  resetJudgeInfo();
  judge.close();
  if (quizIds.length) {
    const sids = (await TmcodeSession.findAll({ where: { quiz_id: quizIds } })).map((s) => s.id);
    const subs = (await QuizSubmission.findAll({ where: { quiz_id: quizIds } })).map((s) => s.id);
    if (sids.length) {
      await TmcodeSnapshot.destroy({ where: { session_id: sids } });
      await TmcodeTelemetry.destroy({ where: { session_id: sids } });
      await TmcodeFlag.destroy({ where: { session_id: sids } });
      await TmcodeSession.destroy({ where: { id: sids } });
    }
    if (subs.length) await TmcodeLaunchTicket.destroy({ where: { submission_id: subs } });
    await ProctoringSettings.destroy({ where: { quiz_id: quizIds } });
    await QuizAttempt.destroy({ where: { quiz_id: quizIds } });
    await QuizSubmission.destroy({ where: { quiz_id: quizIds } });
    await QuizQuestion.destroy({ where: { quiz_id: quizIds } });
    await Quiz.destroy({ where: { id: quizIds } });
  }
  if (bankIds.length) await QuestionBank.destroy({ where: { id: bankIds } });
  await sequelize.close();
});

const bearer = (t: string) => (r: request.Test) => r.set("Authorization", `Bearer ${t}`);
const FILES = [{ path: "main.py", content: "print(1)\n" }];
const STUDENT_TESTS = [...FILES, { path: "test_main.py", content: "def test_one(): assert 1 == 1\n" }];

function readSse(r: request.Test) {
  return r.buffer(true).parse((res, cb) => {
    let text = "";
    res.on("data", (c: Buffer) => (text += c.toString()));
    res.on("end", () => cb(null, text));
  });
}

async function makeQuiz(questionData: object) {
  const quiz = await Quiz.create({
    title: "TMCode code runner spec",
    description: "tmcodeCodeRunner.integration.spec.ts",
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
    question_text: "<p>Write total()</p>",
    question_data: questionData as any,
    created_by: adminId,
  } as any);
  bankIds.push(bank.id);
  const question = await QuizQuestion.create({ quiz_id: quiz.id, question_id: bank.id, points: 4, order: 1 } as any);
  await ProctoringSettings.create({ quiz_id: quiz.id, enabled: false, tmcode_delivery: "tmcode_required" } as any);
  return { quiz, question };
}

const UNIT_QD = {
  language: "python",
  check_with: "unit",
  starter_code: "def total(xs):\n    pass\n",
  test_cases: [],
  unit_test_files: [{ path: "tests/test_hidden.py", content: `# ${SECRET_UNIT}\n` }],
};

/** Launch and redeem an exam session for the seeded student. */
async function openExam(quizId: number) {
  const l = await bearer(webToken)(request(app).post("/api/tmcode/launch")).send({ quiz_id: quizId });
  expect(l.status).toBe(200);
  const r = await request(app)
    .post("/api/tmcode/sessions")
    .send({
      ticket: l.body.ticket,
      device: { id: "11111111-2222-4333-8444-555555555555", os: "mac", os_version: "15.1", arch: "aarch64", app_version: "0.1.0" },
      env_report: { toolchains: [] },
    });
  expect(r.status).toBe(200);
  const sid: string = r.body.session_id;
  const token: string = r.body.token;
  examCodeLimiter.resetKey(`tmcode-exam-code:${sid}`);
  return { sid, token, call: (method: "get" | "post" | "delete", path: string) => bearer(token)(request(app)[method](`/api/tmcode/sessions/${sid}/code${path}`)) };
}

describe("/api/tmcode/code (TMCode user token)", () => {
  it("reaches the code controllers with a TMCode user token", async () => {
    const caps = await bearer(userToken)(request(app).get("/api/tmcode/code/capabilities"));
    expect(caps.status).toBe(200);
    expect(caps.body).toMatchObject({ success: true, data: { interactive: true, unit_tests: true, unit_test_languages: ["python"] } });

    const test = await bearer(userToken)(request(app).post("/api/tmcode/code/test")).send({ language: "python", files: STUDENT_TESTS });
    expect(test.status).toBe(200);
    expect(test.body.data.unit).toMatchObject({ verdict: "passed", total: 1 });
    expect(sent[0]).toMatchObject({ language: "python", actions: ["build", "test"], tests: [] });

    const run = await bearer(userToken)(request(app).post("/api/tmcode/code/run")).send({ language: "python", files: FILES, tests: [{ id: "1", input: "" }] });
    expect(run.status).toBe(200);
    expect(run.body.success).toBe(true);
  });

  it("runs an interactive session owned by the token's user", async () => {
    const start = await bearer(userToken)(request(app).post("/api/tmcode/code/sessions")).send({ language: "python", files: FILES });
    expect(start.status).toBe(201);
    const id = start.body.data.id;

    // Another user can't see or drive it.
    const other = await bearer(otherUserToken)(request(app).post(`/api/tmcode/code/sessions/${id}/input`)).send({ data: "x\n" });
    expect(other.status).toBe(404);
    expect(other.body).toMatchObject({ success: false, code: "SESSION_NOT_FOUND" });

    const events = await readSse(bearer(userToken)(request(app).get(`/api/tmcode/code/sessions/${id}/events`)));
    expect(events.headers["content-type"]).toMatch(/text\/event-stream/);
    expect(events.body).toContain('event: stdout\ndata: {"data":"hi\\n"}');
    expect(events.body).toContain("event: exit");

    const input = await bearer(userToken)(request(app).post(`/api/tmcode/code/sessions/${id}/input`)).send({ data: "x\n" });
    expect([204, 409]).toContain(input.status); // 409 SESSION_ENDED once the stream has ended
    const stop = await bearer(userToken)(request(app).delete(`/api/tmcode/code/sessions/${id}`));
    expect(stop.status).toBe(204);
  });

  it("accepts a web JWT like the rest of the TMCode user API, and refuses missing or exam tokens", async () => {
    const web = await bearer(webToken)(request(app).get("/api/tmcode/code/capabilities"));
    expect(web.status).toBe(200);

    const none = await request(app).get("/api/tmcode/code/capabilities");
    expect(none.status).toBe(401);
    expect(none.body).toMatchObject({ error_code: "TOKEN_MISSING" });

    const { quiz } = await makeQuiz(UNIT_QD);
    const exam = await openExam(quiz.id);
    const wrong = await bearer(exam.token)(request(app).post("/api/tmcode/code/sessions")).send({ language: "python", files: FILES });
    expect(wrong.status).toBe(401);
    expect(wrong.body).toMatchObject({ error_code: "TOKEN_INVALID" });
  });
});

describe("/api/tmcode/sessions/:sid/code (exam session token)", () => {
  it("reports capabilities without previews", async () => {
    const { quiz } = await makeQuiz(UNIT_QD);
    const exam = await openExam(quiz.id);
    const caps = await exam.call("get", "/capabilities");
    expect(caps.status).toBe(200);
    expect(caps.body).toMatchObject({ success: true, data: { interactive: true, unit_tests: true, previews: false } });
  });

  it("runs sessions owned by the exam's student", async () => {
    const { quiz } = await makeQuiz(UNIT_QD);
    const exam = await openExam(quiz.id);
    const start = await exam.call("post", "/sessions").send({ language: "python", files: FILES });
    expect(start.status).toBe(201);
    const id = start.body.data.id;
    // The same student signed in to TMCode can reach it; another user can't.
    expect((await bearer(otherUserToken)(request(app).delete(`/api/tmcode/code/sessions/${id}`))).status).toBe(404);
    const events = await readSse(exam.call("get", `/sessions/${id}/events`));
    expect(events.body).toContain("event: exit");
    expect((await exam.call("delete", `/sessions/${id}`)).status).toBe(204);
  });

  it("refuses another session's token and inactive sessions", async () => {
    const { quiz } = await makeQuiz(UNIT_QD);
    const exam = await openExam(quiz.id);
    const scope = await bearer(exam.token)(request(app).get(`/api/tmcode/sessions/00000000-0000-4000-8000-000000000000/code/capabilities`));
    expect(scope.status).toBe(403);
    expect(scope.body).toMatchObject({ error_code: "SESSION_SCOPE" });

    const user = await bearer(userToken)(request(app).get(`/api/tmcode/sessions/${exam.sid}/code/capabilities`));
    expect(user.status).toBe(401);
    expect(user.body.error_code).toBe("TOKEN_INVALID");

    await TmcodeSession.update({ status: "superseded" } as any, { where: { id: exam.sid } });
    const old = await exam.call("post", "/sessions").send({ language: "python", files: FILES });
    expect(old.status).toBe(409);
    expect(old.body).toMatchObject({ error_code: "SESSION_SUPERSEDED" });
    expect(sent).toHaveLength(0);
  });

  it("runs the student's own unit tests, never the teacher's", async () => {
    const { quiz, question } = await makeQuiz(UNIT_QD);
    const exam = await openExam(quiz.id);
    const res = await exam.call("post", "/test").send({ question_id: question.id, files: STUDENT_TESTS });
    expect(res.status).toBe(200);
    expect(res.body.data.unit).toMatchObject({ verdict: "passed" });
    expect(sent).toHaveLength(1);
    // The question's language by default, and exactly the student's files.
    expect(sent[0]).toMatchObject({ language: "python", actions: ["build", "test"], tests: [] });
    expect(sent[0].files.map((f: any) => f.path)).toEqual(["main.py", "test_main.py"]);
    expect(JSON.stringify(sent[0])).not.toContain(SECRET_UNIT);
    expect(JSON.stringify(res.body)).not.toContain(SECRET_UNIT);
  });

  it("refuses a question outside the exam", async () => {
    const { quiz } = await makeQuiz(UNIT_QD);
    const other = await makeQuiz(UNIT_QD);
    const exam = await openExam(quiz.id);
    const res = await exam.call("post", "/test").send({ question_id: other.question.id, files: STUDENT_TESTS });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error_code: "QUESTION_NOT_IN_EXAM", message: expect.any(String) });
    const bad = await exam.call("post", "/test").send({ files: STUDENT_TESTS });
    expect(bad.status).toBe(400);
    expect(bad.body.error_code).toBe("VALIDATION_ERROR");
    expect(sent).toHaveLength(0);
  });
});

describe("exam package check_with", () => {
  it("says how each task is checked and never ships unit_test_files", async () => {
    const unit = await makeQuiz(UNIT_QD);
    const exam = await openExam(unit.quiz.id);
    const pkg = await bearer(exam.token)(request(app).get(`/api/tmcode/sessions/${exam.sid}/package`));
    expect(pkg.status).toBe(200);
    expect(pkg.body.tasks[0].check_with).toBe("unit");
    expect(pkg.body.tasks[0]).not.toHaveProperty("unit_test_files");
    expect(JSON.stringify(pkg.body)).not.toContain(SECRET_UNIT);

    const io = await makeQuiz({ language: "python", starter_code: "", test_cases: [{ id: "v1", input: "1", expected_output: "1", is_hidden: false }] });
    const exam2 = await openExam(io.quiz.id);
    const pkg2 = await bearer(exam2.token)(request(app).get(`/api/tmcode/sessions/${exam2.sid}/package`));
    expect(pkg2.body.tasks[0].check_with).toBe("io");
  });
});
