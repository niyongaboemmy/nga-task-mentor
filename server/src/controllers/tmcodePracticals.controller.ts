import crypto from "crypto";
import zlib from "zlib";
import path from "path";
import { Request, Response } from "express";
import { z } from "zod";
import { Op, QueryTypes, UniqueConstraintError } from "sequelize";
import { sequelize } from "../config/database";
import {
  Assignment,
  Project,
  ProjectActivityLink,
  ProjectEvent,
  ProjectMember,
  ProjectRevision,
  QuestionBank,
  Quiz,
  QuizAttempt,
  QuizQuestion,
  QuizSubmission,
  Submission,
} from "../models";
import { tmcodeError } from "../middleware/tmcodeAuth";
import { projectDetails, publishEvent, recordEvent, uniqueSlug } from "./projects.controller";
import {
  canReadRevision,
  forgetProjectCourses,
  loadActivity,
  resolveProjectAccess,
  teacherCanSeeActivity,
  userMayUseActivity,
} from "../tmcode/projects/access";
import { readBlobGz, readManifest } from "../tmcode/projects/storage";
import { userBrief, usersById } from "../tmcode/projects/serialize";
import { syncProjectStatus } from "../tmcode/projects/status";
import { parsePracticalData, PRACTICAL_TYPE, PracticalCriterion } from "../tmcode/practical/question";
import { canGradeAssignment, canGradeQuiz } from "../utils/gradingAccess";
import { isPassed } from "../utils/quizStudentView";

/**
 * TMCode practicals beyond assignments, and the grading of every practical:
 *  - quiz practical questions: start (seeded from the starter files);
 *  - the grading workspace: roster with frozen revisions and grades, and saving
 *    a criteria grade into the assignment submission or the quiz answer;
 *  - a sandboxed preview of a web project at a revision (signed, short-lived).
 */

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
const round2 = (n: number) => Math.round(n * 100) / 100;
const notFound = (res: Response, what = "Not found.") => tmcodeError(res, 404, "NOT_FOUND", what);

// ─── Quiz practical questions ────────────────────────────────────────────────

interface QuizPractical {
  quiz: Quiz;
  qq: QuizQuestion;
  bank: QuestionBank;
  data: ReturnType<typeof parsePracticalData>;
}

export async function loadQuizPractical(quizId: number, quizQuestionId: number): Promise<QuizPractical | null> {
  const quiz = await Quiz.findByPk(quizId);
  if (!quiz) return null;
  const qq = await QuizQuestion.findByPk(quizQuestionId);
  if (!qq || Number(qq.quiz_id) !== quiz.id) return null;
  const bank = await QuestionBank.findByPk(qq.question_id);
  if (!bank || bank.question_type !== PRACTICAL_TYPE) return null;
  return { quiz, qq, bank, data: parsePracticalData(bank.question_data) };
}

/** The practical questions of these quizzes, for the "linkable activities" list. */
export async function practicalQuestionsOf(quizIds: number[]): Promise<Map<number, { question_id: number; title: string; points: number }[]>> {
  const out = new Map<number, { question_id: number; title: string; points: number }[]>();
  if (!quizIds.length) return out;
  try {
    const rows = await sequelize.query<{ quiz_id: number; id: number; points: number; question_text: string }>(
      `SELECT qq.quiz_id, qq.id, qq.points, qb.question_text
         FROM quiz_questions qq JOIN question_bank qb ON qb.id = qq.question_id
        WHERE qq.quiz_id IN (:ids) AND qb.question_type = :type ORDER BY qq.quiz_id, qq.\`order\`, qq.id`,
      { replacements: { ids: quizIds, type: PRACTICAL_TYPE }, type: QueryTypes.SELECT },
    );
    for (const r of rows) {
      const list = out.get(r.quiz_id) ?? [];
      list.push({ question_id: r.id, title: plain(r.question_text).slice(0, 140) || "TMCode practical", points: Number(r.points) });
      out.set(r.quiz_id, list);
    }
  } catch {
    // Before migration 20261007150000 the enum value doesn't exist yet.
  }
  return out;
}

const plain = (html: string | null | undefined) =>
  String(html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The student's project for a quiz practical question (its link), if any. */
async function practicalLinkOf(userId: number, quizId: number, quizQuestionId: number) {
  const mine = await Project.findAll({ where: { owner_id: userId, status: { [Op.ne]: "removed" } }, attributes: ["id"] });
  if (!mine.length) return null;
  return ProjectActivityLink.findOne({
    where: {
      activity_type: "quiz",
      activity_id: quizId,
      question_id: quizQuestionId,
      project_id: { [Op.in]: mine.map((p) => p.id) },
    },
  });
}

// @desc    Start a quiz practical question (student): creates their project
//          from the starter files and links it to the question. Idempotent:
//          later calls return the same project.
// @route   POST /api/tmcode/quizzes/:quizId/questions/:questionId/start
export const startQuizPractical = async (req: Request, res: Response) => {
  const userId = Number(req.user.id);
  const p = await loadQuizPractical(Number(req.params.quizId), Number(req.params.questionId));
  if (!p) return notFound(res, "Practical question not found.");
  const activity = await loadActivity("quiz", p.quiz.id);
  if (!activity || !(await userMayUseActivity(req, activity))) {
    return tmcodeError(res, 403, "NOT_ENROLLED", "You aren't enrolled in this quiz's course.");
  }

  const answer = async (projectId: number, created: boolean, linkId: number) => {
    const project = (await Project.findByPk(projectId))!;
    const access = await resolveProjectAccess(req, projectId);
    return res.status(created ? 201 : 200).json({
      project: await projectDetails(req, project, "owner", access ?? undefined),
      link_id: linkId,
      created,
    });
  };

  const existing = await practicalLinkOf(userId, p.quiz.id, p.qq.id);
  if (existing) return answer(existing.project_id, false, existing.id);
  if (!activity.open) return tmcodeError(res, 409, "ACTIVITY_CLOSED", "This quiz is closed.");

  let starter: ProjectRevision | null = null;
  if (p.data.starter_project_id) {
    const sp = await Project.findByPk(p.data.starter_project_id, { attributes: ["id", "head_revision_id"] });
    const revId = p.data.starter_revision_id ?? sp?.head_revision_id ?? null;
    const rev = revId ? await ProjectRevision.findByPk(revId) : null;
    starter = rev && sp && rev.project_id === sp.id ? rev : null;
  }

  const title = `${p.quiz.title} — ${plain(p.bank.question_text).slice(0, 60) || "Practical"}`.slice(0, 120);
  const events: ProjectEvent[] = [];
  let project: Project;
  let link: ProjectActivityLink;
  const transaction = await sequelize.transaction();
  try {
    project = await Project.create(
      {
        owner_id: userId,
        name: title,
        slug: await uniqueSlug(userId, title),
        description: null,
        language: p.data.language,
        kind: "tm",
        visibility: "course",
        share_presence: true,
        last_activity_at: new Date(),
      } as any,
      { transaction },
    );
    await ProjectMember.create(
      { project_id: project.id, user_id: userId, role: "owner", invited_by: null, status: "active" } as any,
      { transaction },
    );
    events.push(await recordEvent(project.id, userId, "created", { kind: "tm", quiz_id: p.quiz.id, question_id: p.qq.id }, transaction));
    if (starter) {
      const revision = await ProjectRevision.create(
        {
          project_id: project.id,
          number: 1,
          parent_id: null,
          author_id: userId,
          message: "Starter files",
          manifest_gz: starter.manifest_gz,
          file_count: starter.file_count,
          size_bytes: starter.size_bytes,
          source: "save",
          created_at: new Date(),
        } as any,
        { transaction },
      );
      await Project.update(
        { head_revision_id: revision.id, size_bytes: starter.size_bytes, file_count: starter.file_count },
        { where: { id: project.id }, transaction },
      );
      events.push(
        await recordEvent(project.id, userId, "saved", { revision_id: revision.id, number: 1, source: "save", starter: true }, transaction),
      );
    }
    link = await ProjectActivityLink.create(
      {
        project_id: project.id,
        activity_type: "quiz",
        activity_id: p.quiz.id,
        question_id: p.qq.id,
        linked_by: userId,
        status: "linked",
      } as any,
      { transaction },
    );
    events.push(
      await recordEvent(
        project.id,
        userId,
        "linked",
        { link_id: link.id, activity_type: "quiz", activity_id: p.quiz.id, question_id: p.qq.id, title: p.quiz.title },
        transaction,
      ),
    );
    await transaction.commit();
  } catch (e) {
    await transaction.rollback().catch(() => {});
    if (e instanceof UniqueConstraintError) {
      const winner = await practicalLinkOf(userId, p.quiz.id, p.qq.id);
      if (winner) return answer(winner.project_id, false, winner.id);
    }
    throw e;
  }
  forgetProjectCourses(project.id);
  events.forEach(publishEvent);
  return answer(project.id, true, link.id);
};

// ─── Grading workspace ───────────────────────────────────────────────────────

type ActivityKind = "assignment" | "quiz";

interface GradingContext {
  type: ActivityKind;
  id: number;
  title: string;
  course_id: number | null;
  due_date: Date | null;
  max_points: number;
  rubric: PracticalCriterion[];
  /** quiz only: the practical question. */
  question: { id: number; text: string; instructions: string } | null;
  quiz?: Quiz;
  assignment?: Assignment;
}

function parseAssignmentRubric(raw: unknown): PracticalCriterion[] {
  let r: any = raw;
  if (typeof r === "string") {
    try {
      r = JSON.parse(r);
    } catch {
      r = [];
    }
  }
  return Array.isArray(r)
    ? r
        .map((c: any) => ({ criteria: String(c?.criteria ?? "").trim(), description: c?.description ?? null, max_score: Number(c?.max_score) || 0 }))
        .filter((c) => c.criteria)
    : [];
}

async function gradingContext(type: string, id: number, questionId: number | null): Promise<GradingContext | null> {
  if (type === "assignment") {
    const a = await Assignment.findByPk(id);
    if (!a) return null;
    return {
      type: "assignment",
      id: a.id,
      title: a.title,
      course_id: a.course_id ?? null,
      due_date: a.due_date ?? null,
      max_points: Number(a.max_score),
      rubric: parseAssignmentRubric((a as any).rubric),
      question: null,
      assignment: a,
    };
  }
  if (type === "quiz") {
    // No question picked: the quiz's first practical question.
    const qid = questionId ?? (await practicalQuestionsOf([id])).get(id)?.[0]?.question_id ?? null;
    if (!qid) return null;
    const p = await loadQuizPractical(id, qid);
    if (!p) return null;
    return {
      type: "quiz",
      id: p.quiz.id,
      title: p.quiz.title,
      course_id: (p.quiz as any).course_id ?? null,
      due_date: (p.quiz as any).end_date ?? null,
      max_points: Number(p.qq.points),
      rubric: p.data.rubric,
      question: { id: p.qq.id, text: p.bank.question_text, instructions: p.data.instructions },
      quiz: p.quiz,
    };
  }
  return null;
}

/** Comments per criterion travel inside the feedback the student reads. */
function composeFeedback(feedback: string, rubric: PracticalCriterion[], scores: RubricScore[]): string {
  const notes = scores
    .map((s) => (s.comment?.trim() ? `• ${rubric[s.index]?.criteria ?? `Criterion ${s.index + 1}`}: ${s.comment.trim()}` : null))
    .filter(Boolean);
  return [feedback.trim(), notes.length ? `Criteria notes:\n${notes.join("\n")}` : ""].filter(Boolean).join("\n\n");
}

interface RubricScore {
  index: number;
  score: number;
  comment?: string | null;
}

// @desc    Grading workspace roster: every student with a project or a hand-in
//          for this assignment / quiz practical question, their frozen
//          revision, status and current grade, plus the criteria.
// @route   GET /api/tmcode/grading/:type/:id?question_id=
export const gradingRoster = async (req: Request, res: Response) => {
  const questionId = req.query.question_id ? Number(req.query.question_id) : null;
  const ctx = await gradingContext(String(req.params.type), Number(req.params.id), questionId);
  if (!ctx) return notFound(res, "Activity not found.");
  const activity = await loadActivity(ctx.type, ctx.id);
  if (!activity || !(await teacherCanSeeActivity(req, activity))) {
    return tmcodeError(res, 403, "FORBIDDEN", "This activity isn't in your courses.");
  }

  const linkWhere: any = { activity_type: ctx.type, activity_id: ctx.id };
  if (ctx.type === "quiz") linkWhere.question_id = ctx.question!.id;
  const links = await ProjectActivityLink.findAll({ where: linkWhere, order: [["id", "ASC"]] });
  const workspaces = ctx.type === "assignment" ? await Project.findAll({ where: { assignment_id: ctx.id } }) : [];
  const linkedIds = links.map((l) => l.project_id).filter((pid) => !workspaces.some((w) => w.id === pid));
  const projects = [...workspaces, ...(linkedIds.length ? await Project.findAll({ where: { id: { [Op.in]: linkedIds } } }) : [])];

  type Grade = { score: number | null; rubric: RubricScore[] | null; feedback: string | null; graded_at: string | null; status: string; ref_id: number | null; submitted_at: string | null; late: boolean };
  const grades = new Map<number, Grade>();
  if (ctx.type === "assignment") {
    const subs = await Submission.findAll({ where: { assignment_id: ctx.id } });
    for (const s of subs) {
      const g = String(s.grade ?? "");
      const score = s.status === "graded" && g ? Number(g.split("/")[0]) : null;
      const rs = s.rubric_scores && typeof s.rubric_scores === "object" ? (s.rubric_scores as Record<string, number>) : null;
      grades.set(Number(s.student_id), {
        score: Number.isFinite(score as number) ? score : null,
        rubric: rs ? Object.entries(rs).map(([k, v]) => ({ index: Number(k), score: Number(v) })) : null,
        feedback: s.feedback ?? null,
        graded_at: s.status === "graded" ? iso((s as any).updated_at) : null,
        status: s.status,
        ref_id: s.id,
        submitted_at: s.status === "draft" ? null : iso(s.submitted_at),
        late: !!s.is_late,
      });
    }
  } else {
    const attempts = await QuizAttempt.findAll({ where: { quiz_id: ctx.id, question_id: ctx.question!.id }, order: [["id", "DESC"]] });
    for (const a of attempts) {
      const sid = Number(a.student_id);
      if (grades.has(sid)) continue; // newest attempt per student
      const d = (a.grading_details ?? {}) as any;
      const manual = d.manual ?? null;
      grades.set(sid, {
        score: manual ? Number(a.points_earned) : null,
        rubric: manual?.rubric_scores ?? null,
        feedback: manual?.feedback ?? null,
        graded_at: manual?.graded_at ?? null,
        status: manual ? "graded" : d.grade_status === "pending" ? "submitted" : a.status,
        ref_id: a.id,
        submitted_at: iso(a.completed_at),
        late: false,
      });
    }
  }

  const frozenIds = links.map((l) => l.revision_id).filter((x): x is number => !!x);
  const frozen = frozenIds.length
    ? await ProjectRevision.findAll({ where: { id: frozenIds }, attributes: { exclude: ["manifest_gz"] } })
    : [];
  const revById = new Map(frozen.map((r) => [r.id, r]));
  const users = await usersById([...projects.map((p) => p.owner_id), ...grades.keys()]);

  const studentIds = new Set<number>([...projects.map((p) => p.owner_id), ...grades.keys()]);
  const rows = [...studentIds].map((sid) => {
    const project = projects.find((p) => p.owner_id === sid && p.status !== "removed") ?? projects.find((p) => p.owner_id === sid) ?? null;
    const link = project ? links.find((l) => l.project_id === project.id) ?? null : null;
    const rev = link?.revision_id ? revById.get(link.revision_id) : null;
    const g = grades.get(sid) ?? null;
    const state = g?.status === "graded" ? "graded" : link?.status === "submitted" ? "submitted" : project ? "in_progress" : g ? "submitted" : "not_started";
    return {
      student: userBrief(users.get(sid), sid),
      state,
      project: project
        ? { id: project.id, name: project.name, status: project.status, kind: project.kind, language: project.language ?? null, repo_url: project.repo_url ?? null }
        : null,
      link: link
        ? {
            id: link.id,
            status: link.status,
            submitted_at: iso(link.submitted_at),
            revision_id: link.revision_id ?? null,
            revision_number: rev?.number ?? null,
            git_commit: link.git_commit ?? null,
          }
        : null,
      grade: g
        ? { score: g.score, rubric_scores: g.rubric, feedback: g.feedback, graded_at: g.graded_at, ref_id: g.ref_id }
        : null,
      submitted_at: link?.submitted_at ? iso(link.submitted_at) : g?.submitted_at ?? null,
      late: !!g?.late || (!!ctx.due_date && !!link?.submitted_at && new Date(link.submitted_at) > new Date(ctx.due_date)),
    };
  });
  const order: Record<string, number> = { submitted: 0, in_progress: 1, graded: 2, not_started: 3 };
  rows.sort((a, b) => order[a.state] - order[b.state] || String(a.student?.name ?? "").localeCompare(String(b.student?.name ?? "")));

  const canGrade =
    ctx.type === "assignment" ? await canGradeAssignment(req, ctx.assignment as any) : await canGradeQuiz(req, ctx.quiz as any);
  return res.status(200).json({
    activity: {
      type: ctx.type,
      id: ctx.id,
      title: ctx.title,
      course_id: ctx.course_id,
      due_date: iso(ctx.due_date),
      max_points: ctx.max_points,
      rubric: ctx.rubric,
      question: ctx.question,
      // Every practical question of the quiz, for switching between them.
      questions: ctx.type === "quiz" ? ((await practicalQuestionsOf([ctx.id])).get(ctx.id) ?? []) : [],
      can_grade: !!canGrade,
    },
    counts: {
      total: rows.length,
      to_grade: rows.filter((r) => r.state === "submitted").length,
      graded: rows.filter((r) => r.state === "graded").length,
    },
    rows,
  });
};

const gradeSchema = z.object({
  question_id: z.number().int().positive().optional().nullable(),
  rubric_scores: z
    .array(z.object({ index: z.number().int().min(0), score: z.number().min(0), comment: z.string().max(2000).optional().nullable() }))
    .default([]),
  /** Used when the activity has no criteria. */
  score: z.number().min(0).optional().nullable(),
  feedback: z.string().max(10_000).default(""),
});

// @desc    Save a criteria grade for one student. Assignments: the submission
//          row (grade "x/max", rubric_scores, feedback, status graded). Quiz
//          practical: the question's attempt (points + grading_details.manual),
//          then the quiz submission's total. The project becomes graded.
// @route   PUT /api/tmcode/grading/:type/:id/students/:studentId
export const saveGrade = async (req: Request, res: Response) => {
  const parsed = gradeSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return tmcodeError(res, 400, "VALIDATION_ERROR", "Invalid grade.", { issues: parsed.error.issues.map((i) => i.message) });
  }
  const body = parsed.data;
  const ctx = await gradingContext(String(req.params.type), Number(req.params.id), body.question_id ?? (req.query.question_id ? Number(req.query.question_id) : null));
  if (!ctx) return notFound(res, "Activity not found.");
  const studentId = Number(req.params.studentId);
  const allowed =
    ctx.type === "assignment" ? await canGradeAssignment(req, ctx.assignment as any) : await canGradeQuiz(req, ctx.quiz as any);
  if (!allowed) return tmcodeError(res, 403, "FORBIDDEN", "Only a teacher of this subject, the creator or a super admin can grade this.");

  // Total from the criteria (each capped by its max), else the overall score.
  let total: number;
  const scores: RubricScore[] = [];
  if (ctx.rubric.length) {
    for (const s of body.rubric_scores) {
      const c = ctx.rubric[s.index];
      if (!c) return tmcodeError(res, 422, "UNKNOWN_CRITERION", `There is no criterion #${s.index + 1}.`);
      if (s.score > c.max_score) {
        return tmcodeError(res, 422, "SCORE_TOO_HIGH", `“${c.criteria}” is out of ${c.max_score}.`);
      }
      scores.push({ index: s.index, score: s.score, comment: s.comment ?? null });
    }
    total = round2(scores.reduce((n, s) => n + s.score, 0));
  } else {
    if (body.score == null) return tmcodeError(res, 422, "SCORE_REQUIRED", "Enter a score.");
    total = body.score;
  }
  if (total > ctx.max_points + 0.001) {
    return tmcodeError(res, 422, "SCORE_TOO_HIGH", `The total can't be more than ${ctx.max_points}.`);
  }
  const graderId = Number(req.user.id);
  const now = new Date();

  if (ctx.type === "assignment") {
    const feedback = composeFeedback(body.feedback, ctx.rubric, scores);
    const rubricMap = scores.length ? Object.fromEntries(scores.map((s) => [s.index, s.score])) : null;
    const existing = await Submission.findOne({ where: { assignment_id: ctx.id, student_id: studentId } });
    const grade = `${total}/${ctx.max_points}`;
    if (existing) {
      await Submission.update({ grade, status: "graded", feedback, rubric_scores: rubricMap } as any, { where: { id: existing.id } });
    } else {
      await Submission.create({
        assignment_id: ctx.id,
        student_id: studentId,
        submitted_by: graderId,
        status: "graded",
        submitted_at: now,
        is_late: !!ctx.due_date && now > new Date(ctx.due_date),
        grade,
        feedback,
        rubric_scores: rubricMap,
      } as any);
    }
  } else {
    const attempt = await QuizAttempt.findOne({
      where: { quiz_id: ctx.id, question_id: ctx.question!.id, student_id: studentId },
      order: [["id", "DESC"]],
    });
    if (!attempt) return tmcodeError(res, 409, "NOT_ANSWERED", "This student hasn't answered the practical yet.");
    const details = { ...((attempt.grading_details ?? {}) as any) };
    details.grade_status = "graded";
    details.manual = {
      rubric_scores: scores,
      feedback: body.feedback,
      graded_by: graderId,
      graded_at: now.toISOString(),
    };
    await attempt.update({ points_earned: total, is_correct: total > 0, grading_details: details } as any);
    if (attempt.submission_id) await recomputeQuizSubmission(Number(attempt.submission_id), graderId);
  }

  // The student's project for this activity is now graded (and locked).
  const linkWhere: any = { activity_type: ctx.type, activity_id: ctx.id };
  if (ctx.type === "quiz") linkWhere.question_id = ctx.question!.id;
  const mine = await Project.findAll({ where: { owner_id: studentId }, attributes: ["id"] });
  if (mine.length) {
    const links = await ProjectActivityLink.findAll({ where: { ...linkWhere, project_id: { [Op.in]: mine.map((p) => p.id) } } });
    for (const l of links) await syncProjectStatus(l.project_id, graderId);
  }
  return res.status(200).json({ ok: true, score: total, max_points: ctx.max_points });
};

/** Sum the attempts, then graded only when no answer is still waiting for review. */
export async function recomputeQuizSubmission(submissionId: number, graderId: number | null) {
  const submission = await QuizSubmission.findByPk(submissionId);
  if (!submission) return;
  const quiz = await Quiz.findByPk(submission.quiz_id);
  const [attempts, questions] = await Promise.all([
    QuizAttempt.findAll({ where: { submission_id: submission.id } }),
    QuizQuestion.findAll({ where: { quiz_id: submission.quiz_id }, attributes: ["id", "points"] }),
  ]);
  const total = round2(attempts.reduce((n, a) => n + (Number(a.points_earned) || 0), 0));
  const max = questions.reduce((n, q) => n + (Number(q.points) || 0), 0);
  const percentage = max > 0 ? round2((total / max) * 100) : 0;
  const stillPending = attempts.some((a) => ((a.grading_details ?? {}) as any).grade_status === "pending");
  await submission.update({
    total_score: total,
    max_score: max,
    percentage,
    passed: isPassed(percentage, quiz),
    grade_status: stillPending ? "pending" : "graded",
    ...(stillPending ? {} : { graded_at: new Date(), graded_by: graderId }),
  } as any);
}

// ─── Web preview ─────────────────────────────────────────────────────────────

const PREVIEW_TTL_MS = 30 * 60 * 1000;
const secret = () => process.env.JWT_SECRET || "tmcode-preview";
const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");

export function previewToken(projectId: number, revisionId: number, now = Date.now()): string {
  const payload = b64url(JSON.stringify({ p: projectId, r: revisionId, e: now + PREVIEW_TTL_MS }));
  return `${payload}.${sign(payload)}`;
}

export function readPreviewToken(token: string, now = Date.now()): { p: number; r: number } | null {
  const [payload, sig] = String(token).split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!(d.e > now)) return null;
    return { p: Number(d.p), r: Number(d.r) };
  } catch {
    return null;
  }
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
};

/** The page the preview opens: index.html at the root, else the shallowest .html. */
export function previewEntry(paths: string[]): string | null {
  if (paths.includes("index.html")) return "index.html";
  const html = paths.filter((p) => /\.html?$/i.test(p)).sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
  return html[0] ?? null;
}

// @desc    A short-lived URL that serves the project at a revision as a static
//          site, for the grading workspace's Preview tab. Readable revisions
//          only (a teacher sees frozen ones). 422 NO_HTML when there's no page.
// @route   POST /api/tmcode/projects/:id/preview  { rev? }
export const createPreview = async (req: Request, res: Response) => {
  const access = await resolveProjectAccess(req, Number(req.params.id));
  if (!access) return notFound(res, "Project not found.");
  const revId = req.body?.rev ? Number(req.body.rev) : access.project.head_revision_id;
  if (!revId) return tmcodeError(res, 422, "NO_REVISIONS", "Nothing has been saved to this project yet.");
  const rev = await ProjectRevision.findByPk(revId);
  if (!rev || rev.project_id !== access.project.id || !canReadRevision(access, rev.id)) {
    return tmcodeError(res, 404, "REVISION_NOT_FOUND", "Revision not found.");
  }
  const entry = previewEntry(readManifest(rev).map((f) => f.path));
  if (!entry) return tmcodeError(res, 422, "NO_HTML", "There's no HTML page to preview in this revision.");
  const token = previewToken(access.project.id, rev.id);
  const base = `${req.protocol}://${req.get("host")}/api/tmcode/preview/${token}/`;
  return res.status(200).json({ url: `${base}${entry.split("/").map(encodeURIComponent).join("/")}`, entry, expires_in: PREVIEW_TTL_MS / 1000 });
};

// @desc    Serve one file of a previewed revision. The token is the only key
//          (iframes send no Authorization header); responses are sandboxed so
//          student code runs in an opaque origin with no access to the API.
// @route   GET /api/tmcode/preview/:token/*
export const servePreview = async (req: Request, res: Response) => {
  const t = readPreviewToken(req.params.token);
  if (!t) return res.status(410).type("text/plain").send("This preview link has expired. Open the preview again.");
  const rev = await ProjectRevision.findByPk(t.r);
  if (!rev || rev.project_id !== t.p) return res.status(404).type("text/plain").send("Not found");
  const files = readManifest(rev);
  let wanted = decodeURIComponent(String((req.params as any)[0] ?? "")).replace(/^\/+/, "");
  if (!wanted || wanted.endsWith("/")) wanted = `${wanted}index.html`;
  const entry = files.find((f) => f.path === wanted);
  if (!entry) return res.status(404).type("text/plain").send(`${wanted} isn't in this revision.`);
  const gz = await readBlobGz(entry.sha256);
  if (!gz) return res.status(404).type("text/plain").send("Missing file content");

  res.removeHeader("X-Frame-Options");
  res.setHeader(
    "Content-Security-Policy",
    "sandbox allow-scripts allow-forms allow-modals allow-popups; default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; frame-ancestors *",
  );
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.type(MIME[path.extname(entry.path).toLowerCase()] ?? "application/octet-stream");
  return res.status(200).send(zlib.gunzipSync(gz));
};
