import http from "http";
import zlib from "zlib";
import crypto from "crypto";
import request from "supertest";
import { buildTestApp, ensureModelsRegistered, findSeededUserByRole, signTokenFor } from "./testApp";
import { sequelize } from "../config/database";
import {
  Assignment,
  AssignmentTmcode,
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
    // The student's own standing (S8): linked, no attempt open yet, no grade.
    expect(q.practical_questions).toEqual([{ question_id: qq.id, title: "Build the landing page", points: 10, state: "in_progress" }]);
    expect(q).toMatchObject({ start_date: null, attempt_open: false });
  });

  it("refuses linking to a question that isn't a practical", async () => {
    const other = (await api(student).post("/projects", { name: unique("Other") })).body.project;
    projectIds.add(other.id);
    const res = await api(student).post(`/projects/${other.id}/links`, { activity_type: "quiz", activity_id: quiz.id, question_id: qTf.id });
    expect(res.status).toBe(422);
  });

  it("refuses to submit while the quiz isn't open (409 QUIZ_NOT_OPEN) and hands nothing in", async () => {
    const res = await api(student).post(`/projects/${projectId}/links/${linkId}/submit`);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "QUIZ_NOT_OPEN", error_code: "QUIZ_NOT_OPEN", message: "Open the quiz in Task Mentor, then submit again." });
    expect((await ProjectActivityLink.findByPk(linkId))!.status).toBe("linked");
    expect((await Project.findByPk(projectId))!.status).toBe("draft");
    expect(await QuizAttempt.count({ where: { quiz_id: quiz.id, question_id: qq.id, student_id: student.id } })).toBe(0);
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

  it("lists every revision and the starter for the teacher; a draft grade stays hidden from the student", async () => {
    const roster = await api(teacher).get(`/grading/quiz/${quiz.id}?question_id=${qq.id}`);
    const row = roster.body.rows.find((r: any) => r.student.id === student.id);
    expect(row.starter_revision).toBe(1);
    expect(row.revisions.map((r: any) => r.revision)).toEqual([1, 2]);
    expect(row.revisions[1]).toEqual({ revision: 2, at: expect.any(String), id: row.link.revision_id });
    expect(row.grade).toMatchObject({ score: null, released: false, status: "ungraded", annotations: [], graded_by: null, graded_at: null });
    expect(typeof row.grade.version).toBe("string");

    // Linkable: handed in, no grade yet (S8).
    const linkable = await api(student).get("/activities/linkable");
    const q = linkable.body.activities.find((a: any) => a.type === "quiz" && a.id === quiz.id);
    expect(q.practical_questions[0]).toMatchObject({ state: "submitted" });
    expect(q.practical_questions[0].grade).toBeUndefined();

    const draft = await api(teacher).put(`/grading/quiz/${quiz.id}/students/${student.id}`, {
      question_id: qq.id,
      rubric_scores: [{ index: 0, score: 3 }, { index: 1, score: 1 }, { index: 2, score: 1 }],
      feedback: "Draft only",
      annotations: [{ path: "index.html", line: 1, text: "Use a heading level 1 only once" }],
      release: false,
      if_version: row.grade.version,
    });
    expect(draft.status).toBe(200);
    expect(draft.body).toMatchObject({ released: false, locks_student: false, grade: { status: "draft", released: false, score: 5 } });
    expect(draft.body.grade.version).not.toBe(row.grade.version);
    // Nothing the student reads changed: no points, still pending, project not graded.
    const attempt = await QuizAttempt.findOne({ where: { submission_id: submissionId, question_id: qq.id } });
    expect(Number(attempt!.points_earned)).toBe(0);
    expect((attempt!.grading_details as any).grade_status).toBe("pending");
    expect((attempt!.grading_details as any).manual).toBeUndefined();
    expect((await QuizSubmission.findByPk(submissionId))!.grade_status).toBe("pending");
    expect((await Project.findByPk(projectId))!.status).toBe("submitted");
    const { studentGradingDetails } = await import("../utils/quizStudentView");
    expect(JSON.stringify(studentGradingDetails(attempt!.grading_details, { includeHidden: true }))).not.toContain("Draft only");

    const drafted = (await api(teacher).get(`/grading/quiz/${quiz.id}?question_id=${qq.id}`)).body;
    const dRow = drafted.rows.find((r: any) => r.student.id === student.id);
    expect(dRow.state).toBe("submitted");
    expect(dRow.grade).toMatchObject({
      status: "draft",
      released: false,
      score: 5,
      released_score: null,
      feedback: "Draft only",
      annotations: [{ path: "index.html", line: 1, text: "Use a heading level 1 only once" }],
      graded_by: { id: teacher.id },
    });
    expect(drafted.counts.drafts).toBeGreaterThanOrEqual(1);

    // A save based on the old version is refused with the current grade.
    const stale = await api(teacher).put(`/grading/quiz/${quiz.id}/students/${student.id}`, {
      question_id: qq.id,
      rubric_scores: [{ index: 0, score: 4 }, { index: 1, score: 3 }, { index: 2, score: 3 }],
      if_version: row.grade.version,
    });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ code: "GRADE_CHANGED", error_code: "GRADE_CHANGED", grade: { status: "draft", score: 5 } });

    // TMCode deep link into grading (G9).
    const link = await api(teacher).get(`/grading/quiz/${quiz.id}/open-link?question_id=${qq.id}&student_id=${student.id}`);
    expect(link.status).toBe(200);
    expect(link.body.deeplink).toMatch(new RegExp(`^tmcode://grading\\?type=quiz&id=${quiz.id}&question=${qq.id}&student=${student.id}&api=http`));
    expect((await api(student).get(`/grading/quiz/${quiz.id}/open-link`)).status).toBe(403);

    // Quiz answers can't be returned for changes.
    const ret = await api(teacher).post(`/projects/${projectId}/return`, { message: "redo" });
    expect(ret.status).toBe(409);
    expect(ret.body).toMatchObject({ code: "RETURN_NOT_SUPPORTED", error_code: "RETURN_NOT_SUPPORTED" });
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
    // Saved without `annotations` (an older client): the draft's line comments are kept.
    expect(row).toMatchObject({ state: "graded", grade: { score: 7.5, feedback: "Nice structure.", released: true, status: "released" } });
    expect(row.grade.annotations).toEqual([{ path: "index.html", line: 1, text: "Use a heading level 1 only once" }]);
    expect(row.grade.rubric_scores[1]).toMatchObject({ index: 1, score: 2.5, comment: "Colours are off" });
    expect(row.grade.graded_by).toMatchObject({ id: teacher.id });
    expect(Date.parse(row.grade.graded_at)).toBeGreaterThan(Date.now() - 60_000);
    // The released grade replaced the draft.
    expect((attempt!.grading_details as any).draft).toBeUndefined();

    // Linkable: graded, with the released grade (the quiz's results are out).
    const linkable = await api(student).get("/activities/linkable");
    const q = linkable.body.activities.find((a: any) => a.type === "quiz" && a.id === quiz.id);
    expect(q.practical_questions[0]).toMatchObject({ state: "graded", grade: 7.5 });
    expect(q.attempt_open).toBe(false);
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

    // The roster gives the notes back as { index, score, comment }…
    const graded = (await api(teacher).get(`/grading/assignment/${a.id}`)).body.rows.find((r: any) => r.student.id === student.id);
    expect(graded.grade.rubric_scores).toEqual([
      { index: 0, score: 3, comment: null },
      { index: 1, score: 3, comment: "Clean CSS" },
      { index: 2, score: 2, comment: null },
    ]);
    // …so re-saving what it returned keeps them.
    const again = await api(teacher).put(`/grading/assignment/${a.id}/students/${student.id}`, {
      rubric_scores: graded.grade.rubric_scores.map((s: any) => (s.index === 2 ? { ...s, score: 3 } : s)),
      feedback: "Good work",
    });
    expect(again.status).toBe(200);
    const resaved = await Submission.findOne({ where: { assignment_id: a.id, student_id: student.id } });
    expect(resaved).toMatchObject({ grade: "9/10", rubric_scores: { 0: 3, 1: 3, 2: 3 } });
    expect(resaved!.feedback).toBe(`Good work\n\nCriteria notes:\n• ${RUBRIC[1].criteria}: Clean CSS`);

    // A client that sends no comments but keeps the notes in the feedback doesn't lose them either.
    const legacy = await api(teacher).put(`/grading/assignment/${a.id}/students/${student.id}`, {
      rubric_scores: [{ index: 0, score: 3 }, { index: 1, score: 3 }, { index: 2, score: 3 }],
      feedback: resaved!.feedback,
    });
    expect(legacy.status).toBe(200);
    expect((await Submission.findOne({ where: { assignment_id: a.id, student_id: student.id } }))!.feedback).toBe(resaved!.feedback);
  });

  it("drafts, releases (one or all), annotations, graded_by, versions and Allow resubmission", async () => {
    const a = await Assignment.create({
      title: unique("Portfolio"),
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
    await AssignmentTmcode.update({ tmcode_kind: "practical" }, { where: { id: a.id } });
    const p = (await api(student).post("/projects", { name: unique("PF"), assignment_id: a.id })).body.project;
    projectIds.add(p.id);
    await save(student, p.id, null, { "index.html": "<p>v1</p>" });

    // Nothing handed in: a draft has nowhere to live (no row is created for it).
    const early = await api(teacher).put(`/grading/assignment/${a.id}/students/${student.id}`, {
      rubric_scores: [{ index: 0, score: 1 }, { index: 1, score: 1 }, { index: 2, score: 1 }],
      release: false,
    });
    expect(early.status).toBe(409);
    expect(early.body.code).toBe("DRAFT_NEEDS_SUBMISSION");
    expect(await Submission.count({ where: { assignment_id: a.id, student_id: student.id } })).toBe(0);

    expect((await api(student).post(`/projects/${p.id}/submit`)).status).toBe(200);
    const before = (await api(teacher).get(`/grading/assignment/${a.id}`)).body.rows.find((r: any) => r.student.id === student.id);
    expect(before.grade).toMatchObject({ status: "ungraded", released: false });

    const draft = await api(teacher).put(`/grading/assignment/${a.id}/students/${student.id}`, {
      rubric_scores: [{ index: 0, score: 4 }, { index: 1, score: 2, comment: "Tidy the CSS" }, { index: 2, score: 2 }],
      feedback: "Almost there",
      annotations: [{ path: "index.html", line: 1, text: "Missing <main>" }],
      release: false,
      if_version: before.grade.version,
    });
    expect(draft.status).toBe(200);
    expect(draft.body).toMatchObject({ released: false, locks_student: false });
    // What students read is untouched.
    const sub = await Submission.findOne({ where: { assignment_id: a.id, student_id: student.id } });
    expect(sub).toMatchObject({ status: "submitted", grade: null, feedback: null });
    expect((await Project.findByPk(p.id))!.status).toBe("submitted");
    const mine = await api(student).get(`/assignments/${a.id}`);
    expect(mine.status).toBe(200);
    {
      expect(mine.body.assignment.my).toMatchObject({ grade: null, feedback: null, rubric_scores: null, annotations: [] });
    }

    const drafted = (await api(teacher).get(`/grading/assignment/${a.id}`)).body;
    const row = drafted.rows.find((r: any) => r.student.id === student.id);
    expect(row.state).toBe("submitted");
    expect(row.grade).toMatchObject({
      status: "draft",
      released: false,
      score: 8,
      annotations: [{ path: "index.html", line: 1, text: "Missing <main>" }],
      graded_by: { id: teacher.id },
    });
    expect(row.grade.feedback).toContain("• Styling: Tidy the CSS");
    expect(row.revisions.map((r: any) => r.revision)).toEqual([1]);
    expect(row.starter_revision).toBeNull();

    // Release all drafts.
    const rel = await api(teacher).post(`/grading/assignment/${a.id}/release`);
    expect(rel.status).toBe(200);
    expect(rel.body).toMatchObject({ released: 1, skipped: [] });
    const graded = await Submission.findOne({ where: { assignment_id: a.id, student_id: student.id } });
    expect(graded).toMatchObject({ status: "graded", grade: "8/10" });
    expect(graded!.feedback).toBe("Almost there\n\nCriteria notes:\n• Styling: Tidy the CSS");
    expect((await Project.findByPk(p.id))!.status).toBe("graded");
    const after = (await api(teacher).get(`/grading/assignment/${a.id}`)).body.rows.find((r: any) => r.student.id === student.id);
    expect(after).toMatchObject({ state: "graded", grade: { status: "released", released: true, score: 8, graded_by: { id: teacher.id } } });
    expect(after.grade.annotations).toEqual([{ path: "index.html", line: 1, text: "Missing <main>" }]);
    expect(Date.parse(after.grade.graded_at)).toBeGreaterThan(Date.now() - 60_000);
    const seen = await api(student).get(`/assignments/${a.id}`);
    expect(seen.status).toBe(200);
    {
      expect(seen.body.assignment.my).toMatchObject({ grade: 8, annotations: [{ path: "index.html", line: 1, text: "Missing <main>" }] });
    }

    // Graded work: Return needs allow_resubmission, which takes the grade back.
    const refused = await api(teacher).post(`/projects/${p.id}/return`, { message: "Fix the layout" });
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ code: "PROJECT_GRADED", allow_resubmission: true });
    const reopened = await api(teacher).post(`/projects/${p.id}/return`, { message: "Fix the layout", allow_resubmission: true });
    expect(reopened.status).toBe(200);
    expect(reopened.body.status).toBe("draft");
    expect(await Submission.findOne({ where: { assignment_id: a.id, student_id: student.id } })).toMatchObject({ status: "draft", grade: null, feedback: null });
    const head = (await Project.findByPk(p.id))!.head_revision_id!;
    await save(student, p.id, head, { "index.html": "<main>v2</main>" });
    const again = await api(student).post(`/projects/${p.id}/submit`);
    expect(again.status).toBe(200);
    expect((await Submission.findOne({ where: { assignment_id: a.id, student_id: student.id } }))!.status).toBe("resubmitted");

    // Release with release omitted (old clients) still works; a stale version is refused.
    const now = (await api(teacher).get(`/grading/assignment/${a.id}`)).body.rows.find((r: any) => r.student.id === student.id);
    expect(now.revisions.map((r: any) => r.revision)).toEqual([1, 2]);
    const ok = await api(teacher).put(`/grading/assignment/${a.id}/students/${student.id}`, {
      rubric_scores: [{ index: 0, score: 4 }, { index: 1, score: 3 }, { index: 2, score: 3 }],
      if_version: now.grade.version,
    });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ released: true, score: 10, grade: { status: "released", annotations: [] } });
    const stale = await api(teacher).put(`/grading/assignment/${a.id}/students/${student.id}`, {
      rubric_scores: [{ index: 0, score: 1 }, { index: 1, score: 1 }, { index: 2, score: 1 }],
      if_version: now.grade.version,
    });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ code: "GRADE_CHANGED", grade: { score: 10, status: "released" } });
  });

  it("warns when a release locks work the student is still editing (S10)", async () => {
    const a = await Assignment.create({
      title: unique("Unsubmitted"),
      description: "<p>x</p>",
      due_date: new Date(Date.now() + 86_400_000),
      max_score: 10,
      submission_type: "project",
      course_id: COURSE_ID,
      created_by: teacher.id,
      status: "published",
      rubric: [],
    } as any);
    assignmentIds.push(a.id);
    const p = (await api(student).post("/projects", { name: unique("U"), assignment_id: a.id })).body.project;
    projectIds.add(p.id);
    await save(student, p.id, null, { "index.html": "<p>wip</p>" });
    const res = await api(teacher).put(`/grading/assignment/${a.id}/students/${student.id}`, { score: 5 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ released: true, locks_student: true });
    expect((await Project.findByPk(p.id))!.status).toBe("graded");
  });
});
