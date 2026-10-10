import crypto from "crypto";
import zlib from "zlib";
import path from "path";
import { Request, Response } from "express";
import { z } from "zod";
import { Op, QueryTypes, Transaction, UniqueConstraintError } from "sequelize";
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
import { composeFeedback, parseCriteriaNotes, RubricScore, rubricScoresWithComments } from "../tmcode/practical/criteriaNotes";
import { rebasePreviewRoots } from "../tmcode/practical/preview";
import {
  Annotation,
  annotationsSchema,
  AssignmentGradeMeta,
  assignmentMeta,
  cleanAnnotations,
  DraftGrade,
  gradeFingerprint,
  NO_GRADE_VERSION,
  parseJson,
  releasedAnnotations,
  versionOf,
  withMeta,
} from "../tmcode/practical/gradeMeta";
import { canGradeAssignment, canGradeQuiz } from "../utils/gradingAccess";
import { isPassed, resultVisibility } from "../utils/quizStudentView";
import { getScopedSubjects } from "../utils/scopedSubjects";
import { tmcodeColumns } from "../tmcode/assignments/load";
import { apiOrigin } from "./tmcode.controller";

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

export type PracticalState = "not_started" | "in_progress" | "submitted" | "graded";

/**
 * For the linkable activities list (S8): per quiz, whether the caller has an
 * open (in_progress) attempt, and per practical question where they stand and
 * their grade, only once it is released (the teacher released it AND the
 * quiz's result rules show the score; never a draft).
 */
export async function studentQuizStates(
  userId: number,
  quizzes: Quiz[],
  practicals: Map<number, { question_id: number }[]>,
): Promise<Map<number, { attempt_open: boolean; questions: Map<number, { state: PracticalState; grade?: number }> }>> {
  const out = new Map<number, { attempt_open: boolean; questions: Map<number, { state: PracticalState; grade?: number }> }>();
  const ids = quizzes.map((q) => q.id);
  if (!ids.length) return out;
  const [subs, attempts, mine] = await Promise.all([
    QuizSubmission.findAll({ where: { quiz_id: { [Op.in]: ids }, student_id: userId }, order: [["id", "DESC"]] }),
    QuizAttempt.findAll({ where: { quiz_id: { [Op.in]: ids }, student_id: userId }, order: [["id", "DESC"]] }),
    Project.findAll({ where: { owner_id: userId, status: { [Op.ne]: "removed" } }, attributes: ["id"] }),
  ]);
  const links = mine.length
    ? await ProjectActivityLink.findAll({
        where: { activity_type: "quiz", activity_id: { [Op.in]: ids }, project_id: { [Op.in]: mine.map((p) => p.id) } },
      })
    : [];
  for (const quiz of quizzes) {
    const questions = new Map<number, { state: PracticalState; grade?: number }>();
    for (const { question_id } of practicals.get(quiz.id) ?? []) {
      const link = links.find((l) => l.activity_id === quiz.id && l.question_id === question_id) ?? null;
      const attempt = attempts.find((a) => Number(a.quiz_id) === quiz.id && Number(a.question_id) === question_id) ?? null;
      const manual = attempt ? (parseJson<any>(attempt.grading_details) ?? {}).manual : null;
      const sub = attempt?.submission_id ? subs.find((x) => x.id === Number(attempt.submission_id)) ?? null : null;
      const showScore = !!manual && !!sub && sub.status !== "in_progress" && resultVisibility(quiz, sub).show_score;
      const state: PracticalState = manual ? "graded" : link?.status === "submitted" ? "submitted" : link ? "in_progress" : "not_started";
      questions.set(question_id, { state, ...(showScore ? { grade: Number(attempt!.points_earned) || 0 } : {}) });
    }
    out.set(quiz.id, { attempt_open: subs.some((x) => Number(x.quiz_id) === quiz.id && x.status === "in_progress"), questions });
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

// @desc    Grading workspace roster: every student with a project or a hand-in
//          for this assignment / quiz practical question, their frozen
//          revision, status and current grade (draft or released, with line
//          annotations, who graded it and an opaque version), every revision
//          of their project, plus the criteria.
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

  const sources = new Map<number, GradeSource>();
  if (ctx.type === "assignment") {
    for (const s of await assignmentSubmissionRows(ctx.id)) sources.set(Number(s.student_id), { kind: "assignment", row: s });
  } else {
    const attempts = await QuizAttempt.findAll({ where: { quiz_id: ctx.id, question_id: ctx.question!.id }, order: [["id", "DESC"]] });
    for (const a of attempts) {
      const sid = Number(a.student_id);
      if (!sources.has(sid)) sources.set(sid, { kind: "quiz", attempt: a }); // newest attempt per student
    }
  }

  const frozenIds = links.map((l) => l.revision_id).filter((x): x is number => !!x);
  const frozen = frozenIds.length
    ? await ProjectRevision.findAll({ where: { id: frozenIds }, attributes: { exclude: ["manifest_gz"] } })
    : [];
  const revById = new Map(frozen.map((r) => [r.id, r]));
  const graderIds = [...sources.values()].map(graderOf);
  const users = await usersById([...projects.map((p) => p.owner_id), ...sources.keys(), ...graderIds]);

  const studentIds = new Set<number>([...projects.map((p) => p.owner_id), ...sources.keys()]);
  const projectOf = (sid: number) =>
    projects.find((p) => p.owner_id === sid && p.status !== "removed") ?? projects.find((p) => p.owner_id === sid) ?? null;
  const chosen = [...studentIds].map((sid) => projectOf(sid)).filter((p): p is Project => !!p);
  const history = await revisionHistory(req, chosen, links);

  const rows = [...studentIds].map((sid) => {
    const project = projectOf(sid);
    const link = project ? links.find((l) => l.project_id === project.id) ?? null : null;
    const rev = link?.revision_id ? revById.get(link.revision_id) : null;
    const src = sources.get(sid) ?? null;
    const grade = src ? gradeView(src, ctx, users) : null;
    const released = src ? isReleased(src) : false;
    const state = released
      ? "graded"
      : link?.status === "submitted"
        ? "submitted"
        : project
          ? "in_progress"
          : src
            ? "submitted"
            : "not_started";
    const hist = project ? history.get(project.id) : undefined;
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
      grade,
      submitted_at: link?.submitted_at ? iso(link.submitted_at) : submittedAtOf(src),
      late: lateOf(src) || (!!ctx.due_date && !!link?.submitted_at && new Date(link.submitted_at) > new Date(ctx.due_date)),
      // Load any of them with GET /projects/:id/revisions/:revision_id/manifest (+ blobs or files?rev=).
      starter_revision: hist?.starter ?? null,
      revisions: hist?.list ?? [],
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
      // Return for changes / Allow resubmission exist for assignments only.
      can_return: ctx.type === "assignment",
    },
    counts: {
      total: rows.length,
      to_grade: rows.filter((r) => r.state === "submitted").length,
      graded: rows.filter((r) => r.state === "graded").length,
      drafts: rows.filter((r) => r.grade?.status === "draft").length,
    },
    rows,
  });
};

// ─── Grade sources (what is stored) and the grade object (what is returned) ──

interface SubmissionRow {
  id: number;
  student_id: number;
  status: string;
  grade: string | null;
  feedback: string | null;
  rubric_scores: unknown;
  submitted_at: Date | string | null;
  is_late: unknown;
  project_ref: unknown;
}

type GradeSource = { kind: "assignment"; row: SubmissionRow } | { kind: "quiz"; attempt: QuizAttempt };

/** Raw SQL: project_ref (where the grading data lives) isn't mapped by the Submission model. */
async function assignmentSubmissionRows(assignmentId: number, studentId?: number, transaction?: Transaction): Promise<SubmissionRow[]> {
  return sequelize.query<SubmissionRow>(
    `SELECT id, student_id, status, grade, feedback, rubric_scores, submitted_at, is_late, project_ref
       FROM submissions WHERE assignment_id = ?${studentId != null ? " AND student_id = ?" : ""}${transaction ? " FOR UPDATE" : ""}`,
    {
      replacements: studentId != null ? [assignmentId, studentId] : [assignmentId],
      type: QueryTypes.SELECT,
      transaction,
    },
  );
}

const quizDetails = (a: QuizAttempt) => (parseJson<Record<string, any>>(a.grading_details) ?? {}) as Record<string, any>;

function versionOfSource(src: GradeSource | null): string {
  if (!src) return NO_GRADE_VERSION;
  if (src.kind === "assignment") {
    const s = src.row;
    return versionOf(["a", s.id, s.status, s.grade ?? null, s.feedback ?? null, parseJson(s.rubric_scores), assignmentMeta(s.project_ref)]);
  }
  return versionOf(["q", src.attempt.id, String(src.attempt.points_earned ?? ""), quizDetails(src.attempt)]);
}

function isReleased(src: GradeSource): boolean {
  return src.kind === "assignment" ? src.row.status === "graded" : !!quizDetails(src.attempt).manual;
}

function graderOf(src: GradeSource): number | null {
  if (src.kind === "assignment") {
    const m = assignmentMeta(src.row.project_ref);
    return Number(m.draft?.by ?? m.graded_by) || null;
  }
  const d = quizDetails(src.attempt);
  return Number(d.draft?.by ?? d.manual?.graded_by) || null;
}

const submittedAtOf = (src: GradeSource | null) =>
  !src ? null : src.kind === "assignment" ? (src.row.status === "draft" ? null : iso(src.row.submitted_at)) : iso(src.attempt.completed_at);
const lateOf = (src: GradeSource | null) => (src?.kind === "assignment" ? !!Number(src.row.is_late) || src.row.is_late === true : false);

/** "Graded by X": a user brief, or null. */
const graderBrief = (id: unknown, users: Map<number, any>) => {
  const n = Number(id);
  if (!n) return null;
  const b = userBrief(users.get(n), n);
  return b ? { id: n, name: b.name } : null;
};

/**
 * The grade object of a roster row. When a draft exists it is what the
 * teacher sees (`released: false`, `status: "draft"`), and `released_score`
 * is what the student still sees (null when nothing was released).
 * `graded_by` / `graded_at` describe the grade shown: the draft's author and
 * save time, or the release.
 */
function gradeView(src: GradeSource, ctx: GradingContext, users: Map<number, any>) {
  const version = versionOfSource(src);
  if (src.kind === "assignment") {
    const s = src.row;
    const meta = assignmentMeta(s.project_ref);
    const released = s.status === "graded";
    const parsedScore = released && s.grade ? Number(String(s.grade).split("/")[0]) : null;
    const releasedScore = Number.isFinite(parsedScore as number) ? parsedScore : null;
    // Meta written by our own release (or the web marking): still describes this grade?
    const metaValid = released && !!meta.fp && meta.fp === gradeFingerprint(s.grade, s.feedback);
    if (meta.draft) {
      const d = meta.draft;
      return {
        score: d.score,
        rubric_scores: d.rubric_scores,
        feedback: d.feedback,
        graded_at: d.at ?? null,
        ref_id: s.id,
        annotations: cleanAnnotations(d.annotations),
        released: false,
        status: "draft" as const,
        graded_by: graderBrief(d.by, users),
        released_score: releasedScore,
        version,
      };
    }
    return {
      score: releasedScore,
      // { index, score, comment }: the notes come back out of the feedback.
      rubric_scores: rubricScoresWithComments(parseJson(s.rubric_scores), s.feedback, ctx.rubric),
      feedback: s.feedback ?? null,
      graded_at: metaValid ? meta.graded_at ?? null : null,
      ref_id: s.id,
      annotations: metaValid ? cleanAnnotations(meta.annotations) : [],
      released,
      status: released ? ("released" as const) : ("ungraded" as const),
      graded_by: metaValid ? graderBrief(meta.graded_by, users) : null,
      released_score: releasedScore,
      version,
    };
  }
  const a = src.attempt;
  const d = quizDetails(a);
  const manual = d.manual ?? null;
  const releasedScore = manual ? Number(a.points_earned) : null;
  if (d.draft) {
    const dr = d.draft as DraftGrade;
    return {
      score: dr.score,
      rubric_scores: rubricScoresWithComments(dr.rubric_scores, dr.feedback, ctx.rubric),
      feedback: dr.feedback ?? null,
      graded_at: dr.at ?? null,
      ref_id: a.id,
      annotations: cleanAnnotations(dr.annotations),
      released: false,
      status: "draft" as const,
      graded_by: graderBrief(dr.by, users),
      released_score: releasedScore,
      version,
    };
  }
  return {
    score: releasedScore,
    rubric_scores: manual ? rubricScoresWithComments(manual.rubric_scores, manual.feedback, ctx.rubric) : null,
    feedback: manual?.feedback ?? null,
    graded_at: manual?.graded_at ?? null,
    ref_id: a.id,
    annotations: manual ? cleanAnnotations(manual.annotations) : [],
    released: !!manual,
    status: manual ? ("released" as const) : ("ungraded" as const),
    graded_by: manual ? graderBrief(manual.graded_by, users) : null,
    released_score: releasedScore,
    version,
  };
}

/**
 * Per project: every revision the caller may read ({revision, at, id}), oldest
 * first, and the number of the revision that holds the starter files (null
 * when the project didn't start from any). A teacher reads every revision of a
 * "course" project (practicals always are), else only the frozen one.
 */
async function revisionHistory(req: Request, projects: Project[], links: ProjectActivityLink[]) {
  const out = new Map<number, { starter: number | null; list: { revision: number; at: string; id: number }[] }>();
  if (!projects.length) return out;
  const all = await ProjectRevision.findAll({
    where: { project_id: { [Op.in]: projects.map((p) => p.id) } },
    attributes: ["id", "project_id", "number", "message", "created_at"],
    order: [["number", "ASC"]],
  });
  const viewAll = !!req.user?.permissions?.has("PROJECTS_VIEW_ALL");
  for (const p of projects) {
    const frozen = new Set(links.filter((l) => l.project_id === p.id && l.status === "submitted" && l.revision_id).map((l) => l.revision_id!));
    const readable = (r: ProjectRevision) => viewAll || p.visibility === "course" || frozen.has(r.id);
    const mine = all.filter((r) => r.project_id === p.id);
    const first = mine[0];
    out.set(p.id, {
      starter: first && first.number === 1 && first.message === "Starter files" && readable(first) ? 1 : null,
      list: mine.filter(readable).map((r) => ({ revision: r.number, at: iso(r.created_at)!, id: r.id })),
    });
  }
  return out;
}

const gradeSchema = z.object({
  question_id: z.number().int().positive().optional().nullable(),
  rubric_scores: z
    .array(z.object({ index: z.number().int().min(0), score: z.number().min(0), comment: z.string().max(2000).optional().nullable() }))
    .default([]),
  /** Used when the activity has no criteria. */
  score: z.number().min(0).optional().nullable(),
  feedback: z.string().max(10_000).default(""),
  /** Line comments on the student's files. Missing: keep the ones already saved (old clients). */
  annotations: annotationsSchema.optional(),
  /** false: save a draft the student doesn't see. Missing: release (the old behaviour). */
  release: z.boolean().default(true),
  /** The `grade.version` the client edited; a different current version answers 409 GRADE_CHANGED. */
  if_version: z.string().max(64).optional().nullable(),
});

interface GradeInput {
  scores: RubricScore[];
  total: number;
  /** As typed (assignments compose the criteria notes into it). */
  feedback: string;
  /** undefined: keep the saved ones. */
  annotations?: Annotation[];
}

class GradeChanged extends Error {
  constructor(public src: GradeSource | null) {
    super("GRADE_CHANGED");
  }
}
class Refused extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** The student's projects linked to this activity (question). */
async function linkedProjectsOf(ctx: GradingContext, studentId: number): Promise<Project[]> {
  const mine = await Project.findAll({ where: { owner_id: studentId } });
  if (!mine.length) return [];
  const linkWhere: any = { activity_type: ctx.type, activity_id: ctx.id, project_id: { [Op.in]: mine.map((p) => p.id) } };
  if (ctx.type === "quiz") linkWhere.question_id = ctx.question!.id;
  const links = await ProjectActivityLink.findAll({ where: linkWhere, attributes: ["project_id"] });
  const ids = new Set(links.map((l) => l.project_id));
  return mine.filter((p) => ids.has(p.id));
}

/**
 * Write one grade, draft or released, under a row lock, after the optional
 * version check. Releasing writes what students read (as before); a draft
 * writes only the hidden grading data.
 */
async function writeGrade(
  ctx: GradingContext,
  studentId: number,
  input: GradeInput,
  opts: { release: boolean; ifVersion?: string | null; graderId: number },
): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  const draftOf = (annotations: Annotation[]): DraftGrade => ({
    score: input.total,
    rubric_scores: input.scores,
    feedback: ctx.type === "assignment" ? composeFeedback(input.feedback, ctx.rubric, input.scores) : input.feedback,
    annotations,
    by: opts.graderId,
    at: nowIso,
  });
  await sequelize.transaction(async (transaction) => {
    if (ctx.type === "assignment") {
      const [row] = await assignmentSubmissionRows(ctx.id, studentId, transaction);
      const src: GradeSource | null = row ? { kind: "assignment", row } : null;
      if (opts.ifVersion && opts.ifVersion !== versionOfSource(src)) throw new GradeChanged(src);
      const meta: AssignmentGradeMeta = row ? assignmentMeta(row.project_ref) : {};
      const kept = meta.draft?.annotations ?? (row && releasedAnnotations(row).length ? meta.annotations : undefined) ?? [];
      const annotations = input.annotations ?? cleanAnnotations(kept);
      const draft = draftOf(annotations);
      if (!opts.release) {
        if (!row) {
          // A draft lives on the student's submission row; creating one would
          // show the student a "Submitted" assignment they never handed in.
          throw new Refused(
            409,
            "DRAFT_NEEDS_SUBMISSION",
            "There's nothing handed in to keep a draft on yet. Save & release to grade work that wasn't submitted.",
          );
        }
        const next: AssignmentGradeMeta = { ...meta, draft, saved_at: nowIso };
        await sequelize.query("UPDATE submissions SET project_ref = ? WHERE id = ?", {
          replacements: [withMeta(row.project_ref, next), row.id],
          transaction,
        });
        return;
      }
      const grade = `${input.total}/${ctx.max_points}`;
      const feedback = draft.feedback;
      const rubricMap = input.scores.length ? Object.fromEntries(input.scores.map((s) => [s.index, s.score])) : null;
      const next: AssignmentGradeMeta = {
        ...meta,
        draft: null,
        annotations,
        graded_by: opts.graderId,
        graded_at: nowIso,
        fp: gradeFingerprint(grade, feedback),
        saved_at: nowIso,
      };
      if (row) {
        await sequelize.query(
          "UPDATE submissions SET grade = ?, status = 'graded', feedback = ?, rubric_scores = ?, project_ref = ?, updated_at = ? WHERE id = ?",
          {
            replacements: [grade, feedback, rubricMap ? JSON.stringify(rubricMap) : null, withMeta(row.project_ref, next), now, row.id],
            transaction,
          },
        );
      } else {
        // Grading work that was never handed in (today's behaviour): a graded row.
        await sequelize.query(
          `INSERT INTO submissions (assignment_id, student_id, submitted_by, status, submitted_at, text_submission,
             file_submissions, resubmissions, is_late, comments, grade, feedback, rubric_scores, project_ref, created_at, updated_at)
           VALUES (?, ?, ?, 'graded', ?, NULL, NULL, '[]', ?, '[]', ?, ?, ?, ?, ?, ?)`,
          {
            replacements: [
              ctx.id,
              studentId,
              opts.graderId,
              now,
              !!ctx.due_date && now > new Date(ctx.due_date),
              grade,
              feedback,
              rubricMap ? JSON.stringify(rubricMap) : null,
              withMeta(null, next),
              now,
              now,
            ],
            type: QueryTypes.INSERT,
            transaction,
          },
        );
      }
      return;
    }

    const attempt = await QuizAttempt.findOne({
      where: { quiz_id: ctx.id, question_id: ctx.question!.id, student_id: studentId },
      order: [["id", "DESC"]],
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    const src: GradeSource | null = attempt ? { kind: "quiz", attempt } : null;
    if (opts.ifVersion && opts.ifVersion !== versionOfSource(src)) throw new GradeChanged(src);
    if (!attempt) throw new Refused(409, "NOT_ANSWERED", "This student hasn't answered the practical yet.");
    const details = { ...quizDetails(attempt) };
    const annotations = input.annotations ?? cleanAnnotations(details.draft?.annotations ?? details.manual?.annotations ?? []);
    details.saved_at = nowIso;
    if (!opts.release) {
      details.draft = draftOf(annotations);
      await attempt.update({ grading_details: details } as any, { transaction });
      return;
    }
    delete details.draft;
    details.grade_status = "graded";
    details.manual = {
      rubric_scores: input.scores,
      feedback: input.feedback,
      annotations,
      graded_by: opts.graderId,
      graded_at: nowIso,
    };
    await attempt.update({ points_earned: input.total, is_correct: input.total > 0, grading_details: details } as any, { transaction });
  });
  if (opts.release && ctx.type === "quiz") {
    const attempt = await QuizAttempt.findOne({
      where: { quiz_id: ctx.id, question_id: ctx.question!.id, student_id: studentId },
      order: [["id", "DESC"]],
    });
    if (attempt?.submission_id) await recomputeQuizSubmission(Number(attempt.submission_id), opts.graderId);
  }
}

/** Re-read one student's grade object (after a write, or for a 409). */
async function currentGrade(ctx: GradingContext, studentId: number) {
  let src: GradeSource | null = null;
  if (ctx.type === "assignment") {
    const [row] = await assignmentSubmissionRows(ctx.id, studentId);
    if (row) src = { kind: "assignment", row };
  } else {
    const attempt = await QuizAttempt.findOne({
      where: { quiz_id: ctx.id, question_id: ctx.question!.id, student_id: studentId },
      order: [["id", "DESC"]],
    });
    if (attempt) src = { kind: "quiz", attempt };
  }
  if (!src) return null;
  return gradeView(src, ctx, await usersById([graderOf(src)]));
}

/** Validate the criteria scores; the total (each capped by its max) or a refusal. */
function gradeInputOf(
  ctx: GradingContext,
  body: { rubric_scores: { index: number; score: number; comment?: string | null }[]; score?: number | null; feedback: string; annotations?: Annotation[] },
): GradeInput | Refused {
  let total: number;
  const scores: RubricScore[] = [];
  if (ctx.rubric.length) {
    for (const s of body.rubric_scores) {
      const c = ctx.rubric[s.index];
      if (!c) return new Refused(422, "UNKNOWN_CRITERION", `There is no criterion #${s.index + 1}.`);
      if (s.score > c.max_score) return new Refused(422, "SCORE_TOO_HIGH", `“${c.criteria}” is out of ${c.max_score}.`);
      scores.push({ index: s.index, score: s.score, comment: s.comment ?? null });
    }
    // A client that sent no comment at all (not even null) but kept the notes
    // block in the feedback: keep those notes rather than wipe them.
    if (body.rubric_scores.every((s) => s.comment === undefined)) {
      const kept = parseCriteriaNotes(body.feedback, ctx.rubric);
      for (const s of scores) s.comment = kept.get(s.index) ?? null;
    }
    total = round2(scores.reduce((n, s) => n + s.score, 0));
  } else {
    if (body.score == null) return new Refused(422, "SCORE_REQUIRED", "Enter a score.");
    total = body.score;
  }
  if (total > ctx.max_points + 0.001) return new Refused(422, "SCORE_TOO_HIGH", `The total can't be more than ${ctx.max_points}.`);
  return { scores, total, feedback: body.feedback, annotations: body.annotations };
}

const gradeChanged = async (res: Response, ctx: GradingContext, studentId: number) =>
  tmcodeError(res, 409, "GRADE_CHANGED", "Someone else changed this grade since you opened it. Review their version, then save again.", {
    code: "GRADE_CHANGED",
    grade: await currentGrade(ctx, studentId),
  });

// @desc    Save a criteria grade for one student, as a draft (`release: false`,
//          hidden from the student) or released (the default). Released
//          assignments: the submission row (grade "x/max", rubric_scores,
//          feedback, status graded). Released quiz practical: the question's
//          attempt (points + grading_details.manual), then the quiz
//          submission's total. A release locks the student's project
//          (`locks_student` says it was still being worked on); a draft never.
//          `if_version` guards against overwriting someone else's save.
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

  const input = gradeInputOf(ctx, body);
  if (input instanceof Refused) return tmcodeError(res, input.status, input.code, input.message, { code: input.code });
  const graderId = Number(req.user.id);

  // Releasing on work the student is still editing makes it read-only for them (S10).
  const projects = await linkedProjectsOf(ctx, studentId);
  const locksStudent = body.release && projects.some((p) => p.status === "draft");
  try {
    await writeGrade(ctx, studentId, input, { release: body.release, ifVersion: body.if_version, graderId });
  } catch (e) {
    if (e instanceof GradeChanged) return gradeChanged(res, ctx, studentId);
    if (e instanceof Refused) return tmcodeError(res, e.status, e.code, e.message, { code: e.code });
    throw e;
  }
  if (body.release) for (const p of projects) await syncProjectStatus(p.id, graderId);
  const grade = await currentGrade(ctx, studentId);
  return res.status(200).json({
    ok: true,
    score: input.total,
    max_points: ctx.max_points,
    released: body.release,
    locks_student: locksStudent,
    grade,
    version: grade?.version ?? NO_GRADE_VERSION,
  });
};

// @desc    Release every draft grade of an activity (quiz: of one practical
//          question): each becomes the student's grade, as a PUT with
//          release:true would. Drafts are released as saved.
// @route   POST /api/tmcode/grading/:type/:id/release   {question_id?}
export const releaseDrafts = async (req: Request, res: Response) => {
  const questionId = req.body?.question_id ? Number(req.body.question_id) : req.query.question_id ? Number(req.query.question_id) : null;
  const ctx = await gradingContext(String(req.params.type), Number(req.params.id), questionId);
  if (!ctx) return notFound(res, "Activity not found.");
  const allowed =
    ctx.type === "assignment" ? await canGradeAssignment(req, ctx.assignment as any) : await canGradeQuiz(req, ctx.quiz as any);
  if (!allowed) return tmcodeError(res, 403, "FORBIDDEN", "Only a teacher of this subject, the creator or a super admin can grade this.");
  const graderId = Number(req.user.id);

  const drafts: { studentId: number; draft: DraftGrade; version: string }[] = [];
  if (ctx.type === "assignment") {
    for (const row of await assignmentSubmissionRows(ctx.id)) {
      const d = assignmentMeta(row.project_ref).draft;
      if (d) drafts.push({ studentId: Number(row.student_id), draft: d, version: versionOfSource({ kind: "assignment", row }) });
    }
  } else {
    const attempts = await QuizAttempt.findAll({ where: { quiz_id: ctx.id, question_id: ctx.question!.id }, order: [["id", "DESC"]] });
    const seen = new Set<number>();
    for (const a of attempts) {
      const sid = Number(a.student_id);
      if (seen.has(sid)) continue;
      seen.add(sid);
      const d = quizDetails(a).draft as DraftGrade | undefined;
      if (d) drafts.push({ studentId: sid, draft: d, version: versionOfSource({ kind: "quiz", attempt: a }) });
    }
  }

  const released: number[] = [];
  const skipped: { student_id: number; code: string }[] = [];
  let locks = 0;
  for (const { studentId, draft, version } of drafts) {
    const input: GradeInput = {
      scores: draft.rubric_scores ?? [],
      total: Number(draft.score) || 0,
      // Assignment drafts hold the composed feedback; composing again keeps it as is.
      feedback: draft.feedback ?? "",
      annotations: cleanAnnotations(draft.annotations),
    };
    const projects = await linkedProjectsOf(ctx, studentId);
    try {
      await writeGrade(ctx, studentId, input, { release: true, ifVersion: version, graderId });
    } catch (e) {
      if (e instanceof GradeChanged || e instanceof Refused) {
        skipped.push({ student_id: studentId, code: e instanceof Refused ? e.code : "GRADE_CHANGED" });
        continue;
      }
      throw e;
    }
    if (projects.some((p) => p.status === "draft")) locks += 1;
    for (const p of projects) await syncProjectStatus(p.id, graderId);
    released.push(studentId);
  }
  return res.status(200).json({ released: released.length, student_ids: released, skipped, locked_students: locks });
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

/** tmcode://grading?type=&id=&question=&student=&api= (question and student optional). */
export function gradingDeeplink(api: string, type: ActivityKind, id: number, questionId?: number | null, studentId?: number | null): string {
  const q = new URLSearchParams({ type, id: String(id) });
  if (questionId) q.set("question", String(questionId));
  if (studentId) q.set("student", String(studentId));
  q.set("api", api);
  return `tmcode://grading?${q.toString()}`;
}

// @desc    Deep link that opens TMCode's grading view on this activity (and
//          question / student when given), for the web grading page (G9).
// @route   GET /api/tmcode/grading/:type/:id/open-link?question_id=&student_id=
export const gradingOpenLink = async (req: Request, res: Response) => {
  const questionId = req.query.question_id ? Number(req.query.question_id) : null;
  const ctx = await gradingContext(String(req.params.type), Number(req.params.id), questionId);
  if (!ctx) return notFound(res, "Activity not found.");
  const activity = await loadActivity(ctx.type, ctx.id);
  if (!activity || !(await teacherCanSeeActivity(req, activity))) {
    return tmcodeError(res, 403, "FORBIDDEN", "This activity isn't in your courses.");
  }
  const studentId = req.query.student_id ? Number(req.query.student_id) : null;
  return res.status(200).json({
    deeplink: gradingDeeplink(apiOrigin(req), ctx.type, ctx.id, ctx.question?.id ?? null, Number.isInteger(studentId) ? studentId : null),
  });
};

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
  const ext = path.extname(entry.path).toLowerCase();
  res.type(MIME[ext] ?? "application/octet-stream");
  const body = zlib.gunzipSync(gz);
  const kind = ext === ".html" || ext === ".htm" ? "html" : ext === ".css" ? "css" : null;
  if (!kind) return res.status(200).send(body);
  // Keep root-relative links ("/style.css", "/src/main.tsx") inside the preview.
  const base = `${req.baseUrl}/preview/${encodeURIComponent(req.params.token)}/`;
  return res.status(200).send(rebasePreviewRoots(body.toString("utf8"), base, kind));
};

// ─── GET /grading: what the caller can grade ─────────────────────────────────

const can = (req: Request, key: string) => !!req.user?.permissions?.has(key);

// @desc    The TMCode practicals the caller grades: TMCode assignments (and
//          assignments that take a project) plus quizzes with practical
//          questions, published or completed, that they created or teach
//          (scoped subjects; everything for admins). TMCode's Grading view.
// @route   GET /api/tmcode/grading
export const listGradable = async (req: Request, res: Response) => {
  const userId = Number(req.user.id);
  const { scope, subjects } = await getScopedSubjects(req);
  const names = new Map(subjects.map((s) => [Number(s.id), s.name]));
  const all = scope === "all" || can(req, "PROJECTS_VIEW_ALL") || can(req, "ASSIGNMENTS_MANAGE_ANY");
  const courseIds = [...names.keys()];
  const who = all ? {} : { [Op.or]: [{ created_by: userId }, ...(courseIds.length ? [{ course_id: { [Op.in]: courseIds } }] : [])] };
  const tm = await tmcodeColumns();
  const [assignments, quizzes] = await Promise.all([
    Assignment.findAll({
      where: {
        [Op.and]: [
          who,
          { status: { [Op.in]: ["published", "completed"] } },
          { [Op.or]: [{ submission_type: "project" }, ...(tm.size ? [{ id: { [Op.in]: [...tm.keys()] } }] : [])] },
        ],
      } as any,
      order: [["due_date", "ASC"]],
      limit: 300,
    }),
    Quiz.findAll({ where: { [Op.and]: [who, { status: { [Op.ne]: "draft" } }] } as any, order: [["created_at", "DESC"]], limit: 500 }),
  ]);
  const practicals = await practicalQuestionsOf(quizzes.map((q) => q.id));
  const course = (id: number | null | undefined) => ({ course_id: id ?? null, course_name: id != null ? names.get(Number(id)) ?? null : null });
  return res.status(200).json({
    activities: [
      ...assignments.map((a) => ({
        type: "assignment" as const,
        id: a.id,
        title: a.title,
        ...course(a.course_id),
        due_date: iso(a.due_date),
        status: a.status,
        max_points: Number(a.max_score),
        kind: tm.get(a.id)?.tmcode_kind ?? null,
        questions: null,
      })),
      ...quizzes
        .filter((q) => (practicals.get(q.id)?.length ?? 0) > 0)
        .map((q) => ({
          type: "quiz" as const,
          id: q.id,
          title: q.title,
          ...course((q as any).course_id),
          due_date: iso((q as any).end_date),
          status: q.status,
          max_points: null,
          questions: practicals.get(q.id)!,
        })),
    ],
  });
};
