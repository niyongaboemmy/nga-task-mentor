import http from "http";
import zlib from "zlib";
import crypto from "crypto";
import request from "supertest";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import {
  Assignment,
  Project,
  ProjectActivityLink,
  ProjectBlob,
  ProjectEvent,
  ProjectMember,
  ProjectPresence,
  ProjectRevision,
  QuestionBank,
  Quiz,
  QuizAttempt,
  QuizQuestion,
  QuizSubmission,
  Submission,
  User,
} from "../models";
import * as scoped from "../utils/scopedSubjects";
import * as mis from "../utils/misUtils";
import { projectsBus } from "../tmcode/projects/bus";
import { Judge0Service } from "../services/Judge0Service";

/**
 * TMCode practicals beyond assignments, and grading them (dev DB, MIS stubbed):
 * a quiz practical question started from starter files, its submission
 * recorded as the quiz answer, the grading workspace roster and criteria
 * grades (quiz and assignment), and the sandboxed web preview.
 */

const COURSE_ID = 4249;
jest.setTimeout(30_000);

let app: http.Server;
let student: User;
let teacher: User;
const tok = (u: User) => `Bearer ${signTokenFor(u.id)}`;
const projectIds = new Set<number>();
const blobShas = new Set<string>();
const quizIds: number[] = [];
const bankIds: number[] = [];
const assignmentIds: number[] = [];
const programming = [{ id: COURSE_ID, name: "Web", code: null }];
const unique = (s: string) => `${s} ${Date.now()} ${crypto.randomBytes(3).toString("hex")}`;

const api = (u: User) => ({
  get: (p: string) => request(app).get(`/api/tmcode${p}`).set("Authorization", tok(u)),
  post: (p: string, b: object = {}) => request(app).post(`/api/tmcode${p}`).set("Authorization", tok(u)).send(b),
  put: (p: string, b: object = {}) => request(app).put(`/api/tmcode${p}`).set("Authorization", tok(u)).send(b),
});

async function save(u: User, projectId: number, base: number | null, files: Record<string, string>) {
  const entries = [];
  for (const [path, content] of Object.entries(files)) {
    const raw = Buffer.from(content);
    const sha = crypto.createHash("sha256").update(raw).digest("hex");
    blobShas.add(sha);
    await request(app)
      .put(`/api/tmcode/projects/${projectId}/blobs/${sha}`)
      .set("Authorization", tok(u))
      .set("Content-Type", "application/gzip")
      .send(zlib.gzipSync(raw));
    entries.push({ path, sha256: sha, size: raw.length });
  }
  const res = await api(u).post(`/projects/${projectId}/revisions`, { base_revision_id: base, message: "save", files: entries });
  expect(res.status).toBe(201);
  return res.body.revision;
}

const RUBRIC = [
  { criteria: "Layout matches the design", max_score: 4 },
  { criteria: "Styling", max_score: 3 },
  { criteria: "Responsive", max_score: 3 },
];

async function practicalQuiz(starterProjectId: number | null) {
  const quiz = await Quiz.create({
    title: unique("Practical quiz"),
    description: "tmcodePracticals.integration.spec.ts",
    course_id: COURSE_ID,
    created_by: teacher.id,
    status: "published",
    type: "Quiz",
    enable_automatic_grading: true,
    require_manual_grading: false,
  } as any);
  quizIds.push(quiz.id);
  const bank = await QuestionBank.create({
    course_id: COURSE_ID,
    question_type: "tmcode_practical",
    question_text: "<p>Build the landing page</p>",
    question_data: { kind: "practical", language: "web", instructions: "Use flexbox", starter_project_id: starterProjectId, starter_revision_id: null, rubric: RUBRIC } as any,
    created_by: teacher.id,
  } as any);
  bankIds.push(bank.id);
  const tf = await QuestionBank.create({
    course_id: COURSE_ID,
    question_type: "true_false",
    question_text: "HTML is a language",
    question_data: {} as any,
    correct_answer: { answer: true } as any,
    created_by: teacher.id,
  } as any);
  bankIds.push(tf.id);
  const qq = await QuizQuestion.create({ quiz_id: quiz.id, question_id: bank.id, points: 10, order: 1 } as any);
  const qTf = await QuizQuestion.create({ quiz_id: quiz.id, question_id: tf.id, points: 2, order: 2 } as any);
  return { quiz, qq, qTf };
}

beforeAll(async () => {
  await ensureModelsRegistered();
  app = http.createServer(buildTestApp());
  await new Promise<void>((r) => app.listen(0, "127.0.0.1", () => r()));
  student = await findSeededUserByRole("student");
  teacher = await findSeededUserByRole("instructor");
  process.env.PROJECTS_MAX_PER_USER = "1000";
});

beforeEach(() => {
  jest.spyOn(scoped, "getScopedSubjects").mockImplementation(async (req: any) =>
    Number(req.user?.id) === student.id ? ({ scope: "enrolled", subjects: programming } as any) : ({ scope: "assigned", subjects: programming } as any),
  );
  jest.spyOn(mis, "getCurrentTermId").mockResolvedValue(null);
  jest.spyOn(mis, "fetchEnrolledStudents").mockResolvedValue([] as any);
});
afterEach(() => jest.restoreAllMocks());

afterAll(async () => {
  projectsBus.clear();
  const linked = await ProjectActivityLink.findAll({ where: { activity_type: "quiz", activity_id: quizIds.length ? quizIds : [0] } });
  linked.forEach((l) => projectIds.add(l.project_id));
  const ids = [...projectIds];
  if (ids.length) {
    const where = { project_id: ids };
    await ProjectEvent.destroy({ where });
    await ProjectActivityLink.destroy({ where });
    await ProjectPresence.destroy({ where });
    await ProjectMember.destroy({ where });
    await ProjectRevision.destroy({ where });
    await Project.destroy({ where: { id: ids } });
  }
  if (blobShas.size) await ProjectBlob.destroy({ where: { sha256: [...blobShas] } });
  if (quizIds.length) {
    await QuizAttempt.destroy({ where: { quiz_id: quizIds } });
    await QuizSubmission.destroy({ where: { quiz_id: quizIds } });
    await QuizQuestion.destroy({ where: { quiz_id: quizIds } });
    await Quiz.destroy({ where: { id: quizIds } });
  }
  if (bankIds.length) await QuestionBank.destroy({ where: { id: bankIds } });
  if (assignmentIds.length) {
    await Submission.destroy({ where: { assignment_id: assignmentIds } });
    await Assignment.destroy({ where: { id: assignmentIds } });
  }
  await new Promise((r) => app.close(r));
  await sequelize.close();
});

describe("quiz practicals", () => {
  let quiz: Quiz;
  let qq: QuizQuestion;
  let qTf: QuizQuestion;
  let projectId: number;
  let linkId: number;
  let submissionId: number;

  it("starts from the teacher's starter files, linked to the question, idempotently", async () => {
    const starter = (await api(teacher).post("/projects", { name: unique("Starter") })).body.project;
    projectIds.add(starter.id);
    await save(teacher, starter.id, null, { "index.html": "<h1>Start here</h1>", "css/site.css": "h1{}" });
    ({ quiz, qq, qTf } = await practicalQuiz(starter.id));

    const first = await api(student).post(`/quizzes/${quiz.id}/questions/${qq.id}/start`);
    expect(first.status).toBe(201);
    projectId = first.body.project.id;
    projectIds.add(projectId);
    linkId = first.body.link_id;
    expect(first.body.project.head).toMatchObject({ number: 1 });
    const link = await ProjectActivityLink.findByPk(linkId);
    expect(link).toMatchObject({ activity_type: "quiz", activity_id: quiz.id, question_id: qq.id, status: "linked" });

    const again = await api(student).post(`/quizzes/${quiz.id}/questions/${qq.id}/start`);
    expect(again.status).toBe(200);
    expect(again.body.project.id).toBe(projectId);
  });

  it("lists the quiz's practical questions in the linkable activities (added field)", async () => {
    const res = await api(student).get("/activities/linkable");
    const q = res.body.activities.find((a: any) => a.type === "quiz" && a.id === quiz.id);
    expect(q).toMatchObject({ type: "quiz", id: quiz.id, title: quiz.title });
    expect(q.practical_questions).toEqual([{ question_id: qq.id, title: "Build the landing page", points: 10 }]);
  });

  it("refuses linking to a question that isn't a practical", async () => {
    const other = (await api(student).post("/projects", { name: unique("Other") })).body.project;
    projectIds.add(other.id);
    const res = await api(student).post(`/projects/${other.id}/links`, { activity_type: "quiz", activity_id: quiz.id, question_id: qTf.id });
    expect(res.status).toBe(422);
  });

  it("submitting from TMCode records the project as the open quiz answer, pending", async () => {
    const sub = await QuizSubmission.create({
      quiz_id: quiz.id, student_id: student.id, total_score: 0, max_score: 12, percentage: 0, status: "in_progress",
      grade_status: "pending", time_taken: 0, started_at: new Date(), passed: false, attempt_number: 1,
    } as any);
    submissionId = sub.id;
    const head = (await Project.findByPk(projectId))!.head_revision_id!;
    await save(student, projectId, head, {
      "index.html": '<h1>My page</h1><link rel=stylesheet href=css/site.css><script type="module" src="/js/app.js"></script>',
      "css/site.css": "h1{color:red}",
    });

    const res = await api(student).post(`/projects/${projectId}/links/${linkId}/submit`);
    expect(res.status).toBe(200);
    expect(res.body.project_status).toBe("submitted");
    const attempt = await QuizAttempt.findOne({ where: { submission_id: submissionId, question_id: qq.id } });
    expect(attempt!.submitted_answer).toMatchObject({ project_id: projectId, link_id: linkId, revision_number: 2 });
    expect((attempt!.grading_details as any).grade_status).toBe("pending");
  });

  it("shows the teacher the roster with the frozen revision and the criteria", async () => {
    // the student finished the quiz: true/false answered correctly, practical pending
    await QuizAttempt.create({ quiz_id: quiz.id, question_id: qTf.id, student_id: student.id, submission_id: submissionId,
      submitted_answer: { answer: true }, is_correct: true, points_earned: 2, status: "completed", started_at: new Date() } as any);
    await QuizSubmission.update({ status: "completed", total_score: 2, grade_status: "pending" } as any, { where: { id: submissionId } });

    const res = await api(teacher).get(`/grading/quiz/${quiz.id}?question_id=${qq.id}`);
    expect(res.status).toBe(200);
    expect(res.body.activity).toMatchObject({ type: "quiz", max_points: 10, can_grade: true });
    expect(res.body.activity.rubric).toHaveLength(3);
    const row = res.body.rows.find((r: any) => r.student.id === student.id);
    expect(row).toMatchObject({ state: "submitted", link: { status: "submitted", revision_number: 2 }, project: { id: projectId, status: "submitted" } });
    expect(res.body.counts.to_grade).toBeGreaterThanOrEqual(1);
    expect((await api(student).get(`/grading/quiz/${quiz.id}?question_id=${qq.id}`)).status).toBe(403);

    // TMCode's Grading view lists the quiz with its practical question; students can't list.
    const listed = await api(teacher).get("/grading");
    expect(listed.status).toBe(200);
    expect(listed.body.activities).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "quiz", id: quiz.id, course_name: "Web", questions: [expect.objectContaining({ question_id: qq.id, points: 10 })] })]),
    );
    expect((await api(student).get("/grading")).status).toBe(403);

    // No question picked: the quiz's first practical, with every practical listed to switch between.
    const first = await api(teacher).get(`/grading/quiz/${quiz.id}`);
    expect(first.status).toBe(200);
    expect(first.body.activity.question.id).toBe(qq.id);
    expect(first.body.activity.questions).toEqual([expect.objectContaining({ question_id: qq.id, points: 10 })]);
  });

  it("grades it with the criteria: the answer's points, the quiz total, the project", async () => {
    const tooHigh = await api(teacher).put(`/grading/quiz/${quiz.id}/students/${student.id}`, {
      question_id: qq.id,
      rubric_scores: [{ index: 0, score: 5 }],
    });
    expect(tooHigh.status).toBe(422);

    const res = await api(teacher).put(`/grading/quiz/${quiz.id}/students/${student.id}`, {
      question_id: qq.id,
      rubric_scores: [
        { index: 0, score: 4 },
        { index: 1, score: 2.5, comment: "Colours are off" },
        { index: 2, score: 1 },
      ],
      feedback: "Nice structure.",
    });
    expect(res.status).toBe(200);
    expect(res.body.score).toBe(7.5);
    const attempt = await QuizAttempt.findOne({ where: { submission_id: submissionId, question_id: qq.id } });
    expect(Number(attempt!.points_earned)).toBe(7.5);
    expect((attempt!.grading_details as any).manual).toMatchObject({ feedback: "Nice structure." });
    const sub = await QuizSubmission.findByPk(submissionId);
    expect(Number(sub!.total_score)).toBe(9.5);
    expect(Number(sub!.percentage)).toBeCloseTo(79.17, 1);
    expect(sub!.grade_status).toBe("graded");
    expect((await Project.findByPk(projectId))!.status).toBe("graded");

    const roster = await api(teacher).get(`/grading/quiz/${quiz.id}?question_id=${qq.id}`);
    const row = roster.body.rows.find((r: any) => r.student.id === student.id);
    expect(row).toMatchObject({ state: "graded", grade: { score: 7.5, feedback: "Nice structure." } });
    expect(row.grade.rubric_scores[1]).toMatchObject({ index: 1, score: 2.5, comment: "Colours are off" });
  });

  it("previews the submitted web project in a sandbox", async () => {
    const link = await ProjectActivityLink.findByPk(linkId);
    const res = await api(teacher).post(`/projects/${projectId}/preview`, { rev: link!.revision_id });
    expect(res.status).toBe(200);
    const url = new URL(res.body.url);
    expect(url.pathname).toMatch(/\/api\/tmcode\/preview\/[^/]+\/index\.html$/);

    const page = await request(app).get(url.pathname);
    expect(page.status).toBe(200);
    expect(page.headers["content-type"]).toMatch(/text\/html/);
    expect(page.headers["content-security-policy"]).toMatch(/^sandbox allow-scripts/);
    expect(page.headers["x-frame-options"]).toBeUndefined();
    expect(page.text).toContain("My page");
    // A root-relative link stays inside the preview, not at the API's root.
    expect(page.text).toContain(`src="${url.pathname.replace(/index\.html$/, "")}js/app.js"`);
    const css = await request(app).get(url.pathname.replace(/index\.html$/, "css/site.css"));
    expect(css.headers["content-type"]).toMatch(/text\/css/);
    expect(css.text).toBe("h1{color:red}");

    const bad = await request(app).get(url.pathname.replace(/preview\/[^/]+\//, "preview/forged.token/"));
    expect(bad.status).toBe(410);
    expect((await request(app).get(url.pathname.replace(/index\.html$/, "nope.js"))).status).toBe(404);
  });
});

describe("assignment practical grading", () => {
  it("grades with criteria into the submission (rubric map, notes in the feedback)", async () => {
    const a = await Assignment.create({
      title: unique("Landing page"),
      description: "<p>Build it</p>",
      due_date: new Date(Date.now() + 86_400_000),
      max_score: 10,
      submission_type: "project",
      course_id: COURSE_ID,
      created_by: teacher.id,
      status: "published",
      rubric: RUBRIC,
    } as any);
    assignmentIds.push(a.id);
    const p = (await api(student).post("/projects", { name: unique("LP"), assignment_id: a.id })).body.project;
    projectIds.add(p.id);
    await save(student, p.id, null, { "index.html": "<p>hi</p>" });
    expect((await api(student).post(`/projects/${p.id}/submit`)).status).toBe(200);

    const roster = await api(teacher).get(`/grading/assignment/${a.id}`);
    expect(roster.body.activity.rubric).toHaveLength(3);
    // The brief for the Details tab.
    expect(roster.body.activity.brief).toMatchObject({ description: "<p>Build it</p>", submission_type: "project", attachments: [] });
    expect(roster.body.rows.find((r: any) => r.student.id === student.id).state).toBe("submitted");

    const res = await api(teacher).put(`/grading/assignment/${a.id}/students/${student.id}`, {
      rubric_scores: [{ index: 0, score: 3 }, { index: 1, score: 3, comment: "Clean CSS" }, { index: 2, score: 2 }],
      feedback: "Good work",
    });
    expect(res.status).toBe(200);
    const sub = await Submission.findOne({ where: { assignment_id: a.id, student_id: student.id } });
    expect(sub).toMatchObject({ status: "graded", grade: "8/10" });
    expect(sub!.rubric_scores).toEqual({ 0: 3, 1: 3, 2: 2 });
    expect(sub!.feedback).toContain("Good work");
    expect(sub!.feedback).toContain("• Styling: Clean CSS");
    expect((await Project.findByPk(p.id))!.status).toBe("graded");
  });
});

describe("running a submitted program (Run tab)", () => {
  it("finds the program, runs it with the teacher's inputs, and refuses what it can't run", async () => {
    delete process.env.CODERUNNER_ENGINE; // judge0: one file per run
    const a = await Assignment.create({
      title: unique("Sum"),
      description: "<p>Read two numbers, print the sum</p>",
      due_date: new Date(Date.now() + 86_400_000),
      max_score: 10,
      submission_type: "project",
      course_id: COURSE_ID,
      created_by: teacher.id,
      status: "published",
    } as any);
    assignmentIds.push(a.id);
    const p = (await api(student).post("/projects", { name: unique("Sum"), language: "c", assignment_id: a.id })).body.project;
    projectIds.add(p.id);
    await save(student, p.id, null, {
      "src/util.c": "int add(int a, int b) { return a + b; }",
      "src/app.c": "#include <stdio.h>\nint main(void) { int a, b; scanf(\"%d %d\", &a, &b); printf(\"%d\\n\", a + b); return 0; }",
      "tests/test_app.c": "int main(void) { return 0; }",
      "README.md": "# Sum",
    });
    expect((await api(student).post(`/projects/${p.id}/submit`)).status).toBe(200);
    const link = await ProjectActivityLink.findOne({ where: { project_id: p.id } });

    const targets = await api(teacher).get(`/projects/${p.id}/run-targets?rev=${link!.revision_id}`);
    expect(targets.status).toBe(200);
    expect(targets.body).toMatchObject({ language: "c", runnable: true, single_file: true, html_entry: null });
    expect(targets.body.entries[0]).toBe("src/app.c");
    expect(targets.body.entries[targets.body.entries.length - 1]).toBe("tests/test_app.c");

    const judge = jest.spyOn(Judge0Service, "runSingle").mockResolvedValue({
      stdout: "5\n",
      stderr: null,
      compile_output: null,
      message: null,
      time: "0.01",
      memory: 900,
      token: "t",
      status: { id: 3, description: "Accepted" },
    } as any);
    const run = await api(teacher).post(`/projects/${p.id}/run`, {
      rev: link!.revision_id,
      tests: [
        { id: "a", input: "2 3" },
        { id: "b", input: "2 3", expected_output: "6" },
      ],
    });
    expect(run.status).toBe(200);
    expect(run.body).toMatchObject({ language: "c", entry: "src/app.c", files_sent: ["src/app.c"] });
    expect(run.body.tests.map((t: any) => t.verdict)).toEqual(["ok", "wrong-answer"]);
    expect(run.body.tests[0].stdout).toBe("5\n");
    expect(judge).toHaveBeenCalledWith(expect.stringContaining("scanf"), "c", "2 3", expect.any(Number), expect.any(Number));

    // An entry that isn't a C file of the revision falls back to the detected one.
    const other = await api(teacher).post(`/projects/${p.id}/run`, { entry: "README.md", tests: [{ id: "a", input: "" }] });
    expect(other.body.entry).toBe("src/app.c");

    // A language with no files in the revision: the program's own language.
    const python = await api(teacher).post(`/projects/${p.id}/run`, { language: "python", tests: [{ id: "a", input: "" }] });
    expect(python.body.language).toBe("c");
    expect((await api(teacher).post(`/projects/${p.id}/run`, { tests: [] })).status).toBe(400);
  });
});

describe("grading Run tab with tm-judge's project detection", () => {
  const ENV = { ...process.env };
  let judgeServer: http.Server;
  const sent: any[] = [];
  const DETECT: Record<string, any> = {
    react: { best: "js/vite", entry: "src/main.tsx", kinds: [{ kind: "js/vite", label: "JavaScript – Vite app (React, Vue, Svelte)", language: "javascript", entry: "src/main.tsx", available: true, actions: ["build", "test"] }] },
    make: { best: "c/make", entry: "src/main.c", kinds: [{ kind: "c/make", label: "C – Make project", language: "c", entry: "src/main.c", available: true, actions: ["build", "run", "test"] }] },
  };

  beforeAll(async () => {
    judgeServer = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const send = (code: number, data: unknown) => res.writeHead(code, { "Content-Type": "application/json" }).end(JSON.stringify(data));
        if (req.url === "/v1/health") return send(200, { ok: true, features: ["run", "projects", "catalog", "detect"] });
        if (req.url === "/v1/catalog") return send(200, { kinds: [{ id: "c/make", language: "c", label: "C – Make project", actions: ["build", "run", "test"] }, { id: "js/vite", language: "javascript", label: "Vite", actions: ["build", "test"] }] });
        const b = body ? JSON.parse(body) : {};
        sent.push({ url: req.url, body: b });
        if (req.url === "/v1/detect") return send(200, b.files.some((f: any) => f.path === "package.json") ? DETECT.react : DETECT.make);
        if (req.url === "/v1/run") {
          return send(200, { kind: b.kind, compile: { ok: true, output: "", time_ms: 300 }, tests: b.tests.map((t: any) => ({ id: t.id, verdict: t.expected_output ? "accepted" : "ok", passed: true, stdout: "5\n", stderr: "", exit_code: 0, time_ms: 4, memory_kb: 900 })) });
        }
        send(404, {});
      });
    });
    await new Promise<void>((r) => judgeServer.listen(0, "127.0.0.1", () => r()));
    process.env.CODERUNNER_ENGINE = "tmjudge";
    process.env.TMJUDGE_URL = `http://127.0.0.1:${(judgeServer.address() as any).port}`;
    process.env.TMJUDGE_TOKEN = "runner-secret-token-for-tests-0001";
    const { resetJudgeInfo, refreshJudgeInfo } = await import("../services/coderunner/judgeInfo");
    resetJudgeInfo();
    await refreshJudgeInfo();
  });
  afterAll(async () => {
    process.env = ENV;
    const { resetJudgeInfo } = await import("../services/coderunner/judgeInfo");
    resetJudgeInfo();
    judgeServer.close();
  });

  async function submitted(files: Record<string, string>, language: string) {
    const a = await Assignment.create({ title: unique("Project"), description: "<p>x</p>", due_date: new Date(Date.now() + 86_400_000), max_score: 10, submission_type: "project", course_id: COURSE_ID, created_by: teacher.id, status: "published" } as any);
    assignmentIds.push(a.id);
    const p = (await api(student).post("/projects", { name: unique("P"), language, assignment_id: a.id })).body.project;
    projectIds.add(p.id);
    await save(student, p.id, null, files);
    expect((await api(student).post(`/projects/${p.id}/submit`)).status).toBe(200);
    const link = await ProjectActivityLink.findOne({ where: { project_id: p.id } });
    return { id: p.id, rev: link!.revision_id };
  }

  it("a React app: described as a web app, and Run explains instead of failing", async () => {
    const p = await submitted({ "package.json": '{"dependencies":{"react":"18"}}', "vite.config.ts": "export default {}", "src/main.tsx": "console.log(1)", "index.html": "<div id=root></div>" }, "typescript");
    const targets = await api(teacher).get(`/projects/${p.id}/run-targets?rev=${p.rev}`);
    expect(targets.body.project).toMatchObject({ kind: "js/vite", runs: false, tests: true, web_app: true });
    sent.length = 0;
    const run = await api(teacher).post(`/projects/${p.id}/run`, { rev: p.rev, tests: [{ id: "a", input: "" }] });
    expect(run.status).toBe(422);
    expect(run.body.error_code).toBe("NOT_A_PROGRAM");
    expect(JSON.stringify(run.body)).toMatch(/Preview/);
    expect(sent.some((s) => s.url === "/v1/run")).toBe(false);
  });

  it("a C Make project: the whole project runs as its kind, from its own entry", async () => {
    const p = await submitted(
      {
        Makefile: "all:\n\tcc -o app src/main.c src/util.c",
        "src/main.c": "#include \"util.h\"\nint main(void){return 0;}",
        "src/util.c": "int add(int a,int b){return a+b;}",
        "src/util.h": "int add(int,int);",
        "build/old.o": "x",
      },
      "c",
    );
    const targets = await api(teacher).get(`/projects/${p.id}/run-targets?rev=${p.rev}`);
    expect(targets.body.project).toMatchObject({ kind: "c/make", label: "C – Make project", runs: true, entry: "src/main.c", chooses_entry: false });
    sent.length = 0;
    const run = await api(teacher).post(`/projects/${p.id}/run`, { rev: p.rev, tests: [{ id: "a", input: "2 3", expected_output: "5" }] });
    expect(run.status).toBe(200);
    expect(run.body).toMatchObject({ kind: "c/make", kind_label: "C – Make project", entry: "src/main.c" });
    const call = sent.find((s) => s.url === "/v1/run")!.body;
    expect(call).toMatchObject({ kind: "c/make", language: "c" });
    expect(call.files.map((f: any) => f.path).sort()).toEqual(["Makefile", "src/main.c", "src/util.c", "src/util.h"]);
    expect(run.body.tests[0].verdict).toBe("accepted");
  });
});
