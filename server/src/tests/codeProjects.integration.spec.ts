import http from "http";
import request from "supertest";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import { codeRunLimiter } from "../middleware/rateLimiter.middleware";
import { refreshJudgeInfo, resetJudgeInfo } from "../services/coderunner/judgeInfo";
import { gradeUnitTestAnswer, willQueueCodeGrading } from "../utils/quizGrader";
import { stripAnswerFields } from "../utils/quizStudentView";
import { QuestionValidator } from "../utils/questionValidation";

/**
 * Catalog projects through Task Mentor (CODE_RUNNER_PLAN.md phase 3): with a
 * tm-judge that has "projects", languages beyond the six profiles and
 * projects with a build file go to its project API; unit tests run with
 * POST /api/code/test. A fake tm-judge records what it was sent.
 */

let app: ReturnType<typeof buildTestApp>;
let token: string;
let userId: number;
let judge: http.Server;
let features = ["run", "projects", "catalog", "detect", "sessions"];
let up = true;
const sent: any[] = [];
const ENV = { ...process.env };

const KINDS = [
  { id: "go/module", language: "go", label: "Go – module", actions: ["build", "run", "test"] },
  { id: "java/maven", language: "java", label: "Java – Maven project", actions: ["build", "run", "test"] },
  { id: "python/project", language: "python", label: "Python – project", actions: ["run", "test"] },
  { id: "ruby/single", language: "ruby", label: "Ruby – script", actions: ["run"] },
];

function fakeJudge() {
  return http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (!up) return res.writeHead(503).end();
      const send = (status: number, data: unknown) => res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(data));
      if (req.url === "/v1/health") return send(200, { ok: true, features });
      if (req.url === "/v1/catalog") return send(200, { version: "test", kinds: KINDS, unavailable: [] });
      if (req.url === "/v1/run") {
        const b = JSON.parse(body);
        sent.push(b);
        if (b.actions?.includes("test")) {
          return send(200, {
            kind: b.kind ?? "python/project",
            language: b.language,
            compile: null,
            tests: [],
            unit: {
              framework: "pytest",
              verdict: "failed",
              total: 2,
              passed: 1,
              failed: 1,
              skipped: 0,
              errors: 0,
              time_ms: 210,
              output: "",
              truncated: false,
              tests: [
                { id: "tests/test_cart.py::test_total", name: "test_total", group: "tests/test_cart.py", file: "tests/test_cart.py", line: 4, status: "passed", durationMs: 3, message: null, details: null },
                { id: "tests/test_cart.py::test_empty", name: "test_empty", group: "tests/test_cart.py", file: "tests/test_cart.py", line: 9, status: "failed", durationMs: 2, message: "assert 1 == 0", details: "E   assert 1 == 0" },
              ],
            },
          });
        }
        const project = !!b.kind || !b.language?.includes("-");
        return send(200, {
          ...(project ? { kind: b.kind ?? `${b.language}/detected` } : {}),
          compile: project ? { ok: true, output: "", time_ms: 900 } : null,
          tests: b.tests.map((t: any) => ({ id: t.id, verdict: "ok", passed: false, stdout: `ran ${b.language}\n`, stderr: "", exit_code: 0, time_ms: 5, memory_kb: 1000 })),
        });
      }
      res.writeHead(404).end();
    });
  });
}

beforeAll(async () => {
  await ensureModelsRegistered();
  app = buildTestApp();
  const student = await findSeededUserByRole("student");
  userId = student.id;
  token = signTokenFor(student.id);
  judge = fakeJudge();
  await new Promise<void>((r) => judge.listen(0, "127.0.0.1", () => r()));
  process.env.CODERUNNER_ENGINE = "tmjudge";
  process.env.TMJUDGE_URL = `http://127.0.0.1:${(judge.address() as any).port}`;
  process.env.TMJUDGE_TOKEN = "runner-secret-token-for-tests-0001";
  process.env.JUDGE0_MAX_RETRIES = "0";
  delete process.env.JUDGE0_API_KEY;
  delete process.env.JUDGE0_URL;
});
beforeEach(async () => {
  features = ["run", "projects", "catalog", "detect", "sessions"];
  up = true;
  sent.length = 0;
  resetJudgeInfo();
  await refreshJudgeInfo();
  codeRunLimiter.resetKey(`code-run:${userId}`);
});
afterAll(async () => {
  process.env = ENV;
  resetJudgeInfo();
  judge.close();
  await sequelize.close();
});

const post = (path: string, body: object) => request(app).post(path).set("Authorization", `Bearer ${token}`).send(body);
const one = [{ id: "own", input: "" }];

describe("catalog projects", () => {
  it("says which languages have unit tests", async () => {
    const res = await request(app).get("/api/code/capabilities").set("Authorization", `Bearer ${token}`);
    expect(res.body.data.unit_tests).toBe(true);
    expect(res.body.data.unit_test_languages.sort()).toEqual(["go", "java", "python"]);
  });

  it("runs a language only the catalog knows (Go) through the project API", async () => {
    const res = await post("/api/code/run", { language: "go", files: [{ path: "main.go", content: "package main\nfunc main() {}\n" }], tests: one });
    expect(res.status).toBe(200);
    expect(sent[0]).toMatchObject({ language: "go", files: [{ path: "main.go" }] });
    expect(sent[0].actions).toBeUndefined();
    expect(res.body.data).toMatchObject({ kind: "go/detected", tests: [{ stdout: "ran go\n" }] });
  });

  it("sends a project with a build file whole (Maven), skipping ignored folders", async () => {
    const files = [
      { path: "pom.xml", content: "<project/>" },
      { path: "src/main/java/rw/App.java", content: "package rw; class App { public static void main(String[] a) {} }" },
      { path: "target/classes/rw/App.class", content: "x" },
    ];
    const res = await post("/api/code/run", { language: "java", files, tests: one });
    expect(res.status).toBe(200);
    expect(sent[0].language).toBe("java");
    expect(sent[0].files.map((f: any) => f.path)).toEqual(["pom.xml", "src/main/java/rw/App.java"]);
  });

  it("keeps a plain single-file program on its language profile", async () => {
    const res = await post("/api/code/run", { language: "python", files: [{ path: "main.py", content: "print(1)" }], tests: one });
    expect(res.status).toBe(200);
    expect(sent[0].language).toMatch(/^python-/);
    expect(sent[0].kind).toBeUndefined();
    expect(res.body.data.kind).toBeNull();
  });

  it("runs the unit tests and returns each result", async () => {
    const files = [
      { path: "src/shop/cart.py", content: "def total(x): return sum(x)" },
      { path: "tests/test_cart.py", content: "def test_total(): ..." },
    ];
    const res = await post("/api/code/test", { language: "python", files, test_filter: "tests/test_cart.py::test_empty" });
    expect(res.status).toBe(200);
    expect(sent[0]).toMatchObject({ language: "python", actions: ["build", "test"], tests: [], test_filter: "tests/test_cart.py::test_empty" });
    expect(res.body.data.unit).toMatchObject({ verdict: "failed", total: 2, passed: 1, failed: 1 });
    expect(res.body.data.unit.tests[1]).toMatchObject({ name: "test_empty", status: "failed", message: "assert 1 == 0" });
  });

  it("explains when a language has no unit tests, or the runner has none", async () => {
    const ruby = await post("/api/code/test", { language: "ruby", files: [{ path: "main.rb", content: "puts 1" }] });
    expect(ruby.status).toBe(422);
    expect(ruby.body.code).toBe("NO_UNIT_TESTS");

    features = ["run", "sessions"];
    resetJudgeInfo();
    await refreshJudgeInfo();
    const old = await post("/api/code/test", { language: "python", files: [{ path: "test_x.py", content: "" }] });
    expect(old.status).toBe(409);
    expect(old.body.code).toBe("UNIT_TESTS_UNAVAILABLE");
    // …and Go isn't offered any more by an older tm-judge.
    const go = await post("/api/code/run", { language: "go", files: [{ path: "main.go", content: "package main" }], tests: one });
    expect(go.status).toBe(422);
  });

  it("refuses unsafe test filters", async () => {
    const res = await post("/api/code/test", { language: "python", files: [{ path: "t.py", content: "" }], test_filter: "x; rm -rf /" });
    expect(res.status).toBe(400);
  });

  it("doesn't send projects to Judge0 when tm-judge is down", async () => {
    process.env.JUDGE0_URL = "http://127.0.0.1:9";
    up = false;
    const res = await post("/api/code/run", { language: "java", files: [{ path: "pom.xml", content: "" }, { path: "App.java", content: "class App{}" }], tests: one });
    delete process.env.JUDGE0_URL;
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("JUDGE_UNAVAILABLE");
  });

  describe("coding questions checked by unit tests", () => {
    const qd = {
      language: "python",
      check_with: "unit",
      test_cases: [],
      unit_test_files: [{ path: "tests/test_cart.py", content: "from main import total\ndef test_total(): assert total([1, 2]) == 3\n" }],
    };
    const question = { points: 10, questionBank: { question_type: "coding", question_data: qd, question_text: "Write total()" } } as any;

    it("runs the student's code with the teacher's tests and scores the share that pass", async () => {
      const r = await gradeUnitTestAnswer(question, qd, { code: "def total(x): return sum(x)\n", language: "python" });
      expect(sent[0]).toMatchObject({ language: "python", actions: ["build", "test"], tests: [] });
      expect(sent[0].files.map((f: any) => f.path).sort()).toEqual(["main.py", "tests/test_cart.py"]);
      expect(r.points_earned).toBe(5);
      expect(r.is_correct).toBe(false);
      expect(r.feedback).toBe("1/2 unit tests passed.");
      expect(r.detailed_feedback!.testResults[1]).toMatchObject({ passed: false, error: "assert 1 == 0", input: "tests/test_cart.py › test_empty" });
    });

    it("the teacher's test file wins over a student file of the same name", async () => {
      await gradeUnitTestAnswer(question, qd, { code: JSON.stringify([{ path: "main.py", content: "x" }, { path: "tests/test_cart.py", content: "def test_total(): pass" }]), language: "python" });
      expect(sent[0].files.find((f: any) => f.path === "tests/test_cart.py").content).toContain("assert total([1, 2]) == 3");
    });

    it("waits for review when the runner has no unit tests", async () => {
      features = ["run"];
      resetJudgeInfo();
      await refreshJudgeInfo();
      const r = await gradeUnitTestAnswer(question, qd, { code: "x", language: "python" });
      expect(r.detailed_feedback!.grade_status).toBe("pending");
      expect(sent).toHaveLength(0);
    });

    it("never shows students the teacher's tests, and validates them", () => {
      expect(stripAnswerFields(qd, "coding").unit_test_files).toBeUndefined();
      expect(willQueueCodeGrading(question, { code: "print(1)", language: "python" })).toBe(process.env.CODE_GRADING_INLINE !== "1");
      expect((QuestionValidator as any).validateCoding({ ...qd }).isValid).toBe(true);
      expect((QuestionValidator as any).validateCoding({ ...qd, unit_test_files: [] }).errors[0]).toMatch(/unit-test file/);
      expect((QuestionValidator as any).validateCoding({ ...qd, unit_test_files: [{ path: "../x.py", content: "" }] }).isValid).toBe(false);
    });
  });
});
