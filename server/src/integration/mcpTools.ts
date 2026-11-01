import type { Request } from "express";
import { Op, QueryTypes } from "sequelize";
import { sequelize } from "../config/database";
import { Assignment, QuestionBank, Submission, User } from "../models";
import { AiDraft } from "../models/AiDraft.model";
import { getAiPolicy } from "../services/aiPolicy";
import { aiAppEnabled, decideAi, externalPupilDataAllowed, type AiPolicy } from "../vendor/nga-access";
import { hasExternalConnect, isStudentRequest, scrub } from "../services/aiHandoff";
import { getScopedSubjects } from "../utils/scopedSubjects";
import { canGradeAssignment } from "../utils/gradingAccess";
import { canManageAssignment } from "../utils/ownership";
import { QuestionValidator } from "../utils/questionValidation";
import { distributeMarks, RUBRIC_MAX_CRITERIA } from "../services/ai/rubricGenerator";
import { htmlToText } from "../services/ai/misCourseResources";
import type { QuestionType } from "../types/quiz.types";
import { appUrl } from "./homeSummary";

/**
 * Task Mentor's tools for the NGA connector (nga_central_mis EXTERNAL_AI_CONTRACT.md §2).
 * The MIS hosts the MCP server; for a tm_* tool it relays here with a short-lived MIS
 * token for the signed-in person (misBearerAuth, like /home-summary), and this app applies
 * its own access rules: never more than the person can see in Task Mentor.
 *
 *   GET  /api/integration/mcp/tools  → { tools: [...] } ([] when off / not allowed)
 *   POST /api/integration/mcp/call   { name, arguments, consent:{ pupilNames } }
 *                                    → { result, summary, openUrl } or 4xx { code, message }
 *
 * Read tools: courses, question bank, assignments, submissions waiting for grading
 * (pupilData: "Student N" unless consent + policy). Draft tools write only to ai_drafts
 * (models/AiDraft.model.ts): nothing is added to the bank, put on an assignment or shown to a
 * student until the teacher confirms the draft in Task Mentor (/ai-drafts).
 */

export class ToolError extends Error {
  constructor(
    readonly status: number,
    readonly code: "TOOL_UNKNOWN" | "TOOL_FORBIDDEN" | "EXTERNAL_OFF" | "EXAM_ACTIVE" | "PUPIL_CONSENT_REQUIRED" | "BAD_ARGUMENTS",
    message: string,
  ) {
    super(message);
    this.name = "ToolError";
  }
}

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  kind: "read" | "draft";
  pupilData: boolean;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required: string[] };
}

export interface ToolAnswer {
  result: unknown;
  summary: string;
  openUrl?: string;
}

interface CallCtx {
  req: Request;
  policy: AiPolicy;
  args: Record<string, any>;
  /** The person ticked "include pupil names" for this connector session. */
  consentNames: boolean;
}

interface Tool extends ToolDef {
  /** Task Mentor permissions, any of which lets the person use the tool. */
  perms: string[];
  run: (ctx: CallCtx) => Promise<ToolAnswer>;
}

/** ~50 KB per result (contract §2); lists page with `cursor`. */
export const RESULT_BUDGET_BYTES = 50_000;
const MAX_PAGE = 100;
const DEFAULT_PAGE = 25;

// ─── Small helpers ───────────────────────────────────────────────────────────

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const posInt = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const bad = (message: string) => new ToolError(400, "BAD_ARGUMENTS", message);
const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
const bytes = (v: unknown) => Buffer.byteLength(JSON.stringify(v), "utf8");

/**
 * One page of `rows` from `cursor` (an offset), at most `limit` rows and RESULT_BUDGET_BYTES.
 * At least one row is returned so a page always moves forward.
 */
export function paginate<T>(rows: T[], cursor: unknown, limit: unknown): { items: T[]; next_cursor: string | null; total: number } {
  const start = Math.max(0, Number.parseInt(String(cursor ?? "0"), 10) || 0);
  const max = Math.min(MAX_PAGE, posInt(limit) ?? DEFAULT_PAGE);
  const items: T[] = [];
  let size = 64;
  for (let i = start; i < rows.length && items.length < max; i++) {
    const s = bytes(rows[i]) + 1;
    if (items.length > 0 && size + s > RESULT_BUDGET_BYTES) break;
    items.push(rows[i]);
    size += s;
  }
  const next = start + items.length;
  return { items, next_cursor: next < rows.length ? String(next) : null, total: rows.length };
}

const cursorProps = {
  cursor: { type: "string", description: "next_cursor from the previous page" },
  limit: { type: "integer", description: `page size (max ${MAX_PAGE})` },
};

async function subjectsOf(req: Request) {
  const { subjects } = await getScopedSubjects(req);
  return subjects;
}

async function subjectIdsOf(req: Request): Promise<Set<number>> {
  return new Set((await subjectsOf(req)).map((s) => s.id));
}

function courseArg(args: Record<string, any>, allowed: Set<number>, required = false): number | null {
  const raw = args.course_id;
  if (raw === undefined || raw === null || raw === "") {
    if (required) throw bad("course_id is required.");
    return null;
  }
  const id = posInt(raw);
  if (!id) throw bad("course_id must be a positive integer.");
  if (!allowed.has(id)) throw new ToolError(403, "TOOL_FORBIDDEN", "That subject is not one of yours in Task Mentor.");
  return id;
}

const studentName = (u: any) => [u?.first_name, u?.last_name].filter(Boolean).join(" ").trim();

/** A pupil's text with their own name and contact details taken out. */
function anonymiseText(text: string, names: string[]): string {
  let out = scrub(text);
  for (const n of names.filter((x) => x && x.length >= 2)) {
    out = out.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[NAME]");
  }
  return out;
}

// ─── Exams ───────────────────────────────────────────────────────────────────

/**
 * True while a monitored or secure TMCode exam session is live on a quiz this teacher
 * created: during an exam, no connector tool answers (contract rule 3).
 */
export async function examActiveFor(userId: number): Promise<boolean> {
  try {
    const rows = await sequelize.query<{ n: number }>(
      `SELECT 1 AS n FROM tmcode_sessions s JOIN quizzes q ON q.id = s.quiz_id
        WHERE s.status = 'active' AND s.mode IN ('monitored','secure') AND q.created_by = :userId
          AND COALESCE(s.last_heartbeat, s.started_at) > (NOW() - INTERVAL 2 HOUR)
        LIMIT 1`,
      { replacements: { userId }, type: QueryTypes.SELECT },
    );
    return rows.length > 0;
  } catch (err: any) {
    // No TMCode tables (older database): there is no exam to protect.
    if (/doesn't exist|no such table/i.test(String(err?.message))) return false;
    throw err;
  }
}

// ─── Tools ───────────────────────────────────────────────────────────────────

const SUBMITTED = ["submitted", "late", "resubmitted", "completed"];

const QUESTION_TYPES = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "matching",
  "fill_blank",
  "dropdown",
  "numerical",
  "short_answer",
  "ordering",
  "drag_drop",
  "logical_expression",
  "coding",
];

const TOOLS: Tool[] = [
  {
    name: "tm_list_my_courses",
    title: "My Task Mentor courses",
    description:
      "Lists the subjects (Task Mentor courses) the signed-in teacher teaches this term, with how many question-bank questions and assignments each has. Use the course_id with the other tm_ tools.",
    kind: "read",
    pupilData: false,
    perms: ["COURSES_VIEW", "QUESTION_BANK_VIEW", "ASSIGNMENTS_VIEW"],
    inputSchema: { type: "object", properties: { ...cursorProps }, required: [] },
    async run({ req, args }) {
      const subjects = await subjectsOf(req);
      const ids = subjects.map((s) => s.id);
      const [qCounts, aCounts] = ids.length
        ? await Promise.all([
            QuestionBank.findAll({
              where: { course_id: { [Op.in]: ids } },
              attributes: ["course_id", [sequelize.fn("COUNT", sequelize.col("id")), "n"]],
              group: ["course_id"],
              raw: true,
            }) as Promise<any[]>,
            Assignment.findAll({
              where: { course_id: { [Op.in]: ids }, status: { [Op.ne]: "removed" } },
              attributes: ["course_id", [sequelize.fn("COUNT", sequelize.col("id")), "n"]],
              group: ["course_id"],
              raw: true,
            }) as Promise<any[]>,
          ])
        : [[], []];
      const q = new Map(qCounts.map((r) => [Number(r.course_id), Number(r.n)]));
      const a = new Map(aCounts.map((r) => [Number(r.course_id), Number(r.n)]));
      const rows = subjects.map((s) => ({
        course_id: s.id,
        name: s.name,
        code: s.code,
        question_bank_count: q.get(s.id) ?? 0,
        assignment_count: a.get(s.id) ?? 0,
      }));
      const page = paginate(rows, args.cursor, args.limit);
      return { result: page, summary: `${rows.length} course(s) in Task Mentor.`, openUrl: `${appUrl()}/courses` };
    },
  },
  {
    name: "tm_search_question_bank",
    title: "Search my question bank",
    description:
      "Searches the question bank of the subjects the teacher teaches. Returns question id, subject, type, difficulty, the question text and choices (no answers). Filter by course_id, text query, question_type or difficulty.",
    kind: "read",
    pupilData: false,
    perms: ["QUESTION_BANK_VIEW"],
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "words in the question text" },
        course_id: { type: "integer" },
        question_type: { type: "string", enum: QUESTION_TYPES },
        difficulty: { type: "string", enum: ["EASY", "MEDIUM", "DIFFICULT"] },
        ...cursorProps,
      },
      required: [],
    },
    async run({ req, args }) {
      const allowed = await subjectIdsOf(req);
      const course = courseArg(args, allowed);
      if (!allowed.size) return { result: paginate([], 0, 0), summary: "You have no subjects in Task Mentor this term." };
      const where: any = { course_id: course ? course : { [Op.in]: [...allowed] } };
      const query = str(args.query, 200);
      if (query) where.question_text = { [Op.like]: `%${query.replace(/[%_\\]/g, (c) => `\\${c}`)}%` };
      if (args.question_type) {
        if (!QUESTION_TYPES.includes(args.question_type)) throw bad("Unknown question_type.");
        where.question_type = args.question_type;
      }
      if (args.difficulty) {
        if (!["EASY", "MEDIUM", "DIFFICULT"].includes(args.difficulty)) throw bad("difficulty must be EASY, MEDIUM or DIFFICULT.");
        where.difficulty_level = args.difficulty;
      }
      const found = (await QuestionBank.findAll({
        where,
        attributes: ["id", "course_id", "question_type", "question_text", "question_data", "difficulty_level", "tags"],
        order: [["id", "DESC"]],
        limit: 500,
        raw: true,
      })) as any[];
      const rows = found.map((r) => {
        const data = typeof r.question_data === "string" ? safeJson(r.question_data) : r.question_data;
        const options = Array.isArray(data?.options)
          ? data.options.map((o: any) => truncate(htmlToText(String(o?.text ?? o?.label ?? o ?? "")), 200)).slice(0, 10)
          : undefined;
        return {
          id: r.id,
          course_id: r.course_id,
          question_type: r.question_type,
          difficulty: r.difficulty_level ?? null,
          question_text: truncate(htmlToText(String(r.question_text || "")), 600),
          ...(options ? { options } : {}),
          tags: Array.isArray(r.tags) ? r.tags : typeof r.tags === "string" ? safeJson(r.tags) ?? [] : [],
        };
      });
      const page = paginate(rows, args.cursor, args.limit);
      const url = course ? `${appUrl()}/courses/${course}/question-bank` : `${appUrl()}/question-bank`;
      return { result: page, summary: `${rows.length} question(s) found${rows.length === 500 ? " (first 500)" : ""}.`, openUrl: url };
    },
  },
  {
    name: "tm_list_assignments",
    title: "My assignments",
    description:
      "Lists assignments in the subjects the teacher teaches (not removed ones): id, title, subject, due date, marks, status, whether it has a rubric, and how many submissions wait for grading.",
    kind: "read",
    pupilData: false,
    perms: ["ASSIGNMENTS_VIEW"],
    inputSchema: {
      type: "object",
      properties: {
        course_id: { type: "integer" },
        status: { type: "string", enum: ["draft", "published", "completed"] },
        ...cursorProps,
      },
      required: [],
    },
    async run({ req, args }) {
      const allowed = await subjectIdsOf(req);
      const course = courseArg(args, allowed);
      if (!allowed.size) return { result: paginate([], 0, 0), summary: "You have no subjects in Task Mentor this term." };
      const where: any = { course_id: course ? course : { [Op.in]: [...allowed] }, status: { [Op.ne]: "removed" } };
      if (args.status) {
        if (!["draft", "published", "completed"].includes(args.status)) throw bad("status must be draft, published or completed.");
        where.status = args.status;
      }
      const list = (await Assignment.findAll({
        where,
        attributes: ["id", "title", "course_id", "due_date", "max_score", "status", "rubric", "submission_type"],
        order: [["due_date", "DESC"]],
        limit: 500,
        raw: true,
      })) as any[];
      const ids = list.map((a) => a.id);
      const waiting = ids.length
        ? ((await Submission.findAll({
            where: { assignment_id: { [Op.in]: ids }, status: { [Op.in]: SUBMITTED }, grade: null },
            attributes: ["assignment_id", [sequelize.fn("COUNT", sequelize.col("id")), "n"]],
            group: ["assignment_id"],
            raw: true,
          })) as any[])
        : [];
      const w = new Map(waiting.map((r) => [Number(r.assignment_id), Number(r.n)]));
      const rows = list.map((a) => {
        const rubric = typeof a.rubric === "string" ? safeJson(a.rubric) : a.rubric;
        return {
          id: a.id,
          title: a.title,
          course_id: a.course_id,
          due_date: a.due_date,
          max_score: Number(a.max_score),
          status: a.status,
          submission_type: a.submission_type,
          has_rubric: Array.isArray(rubric) && rubric.length > 0,
          waiting_for_grading: w.get(a.id) ?? 0,
        };
      });
      const page = paginate(rows, args.cursor, args.limit);
      return { result: page, summary: `${rows.length} assignment(s).`, openUrl: `${appUrl()}/assignments` };
    },
  },
  {
    name: "tm_list_submissions_to_grade",
    title: "Submissions waiting for me",
    description:
      'Lists assignment submissions waiting for this teacher to grade, with the assignment, rubric and the written answer (first 1500 characters). Pupils appear as "Student N" unless the school allows names and the teacher consented for this session.',
    kind: "read",
    pupilData: true,
    perms: ["SUBMISSIONS_GRADE"],
    inputSchema: {
      type: "object",
      properties: { assignment_id: { type: "integer" }, course_id: { type: "integer" }, ...cursorProps },
      required: [],
    },
    async run({ req, args, policy, consentNames }) {
      const allowed = await subjectIdsOf(req);
      const course = courseArg(args, allowed);
      const assignmentWhere: any = { status: { [Op.ne]: "removed" } };
      if (args.assignment_id !== undefined) {
        const id = posInt(args.assignment_id);
        if (!id) throw bad("assignment_id must be a positive integer.");
        assignmentWhere.id = id;
      } else {
        if (!allowed.size) return { result: paginate([], 0, 0), summary: "You have no subjects in Task Mentor this term." };
        assignmentWhere.course_id = course ? course : { [Op.in]: [...allowed] };
      }
      const assignments = (await Assignment.findAll({
        where: assignmentWhere,
        attributes: ["id", "title", "course_id", "academic_term_id", "created_by", "max_score", "rubric"],
        limit: 500,
      })) as any[];
      const gradable: any[] = [];
      for (const a of assignments) if (await canGradeAssignment(req, a)) gradable.push(a);
      if (args.assignment_id !== undefined && !gradable.length) {
        throw new ToolError(403, "TOOL_FORBIDDEN", "You can't grade that assignment.");
      }
      const byId = new Map(gradable.map((a) => [a.id, a]));
      const subs = byId.size
        ? ((await Submission.findAll({
            where: { assignment_id: { [Op.in]: [...byId.keys()] }, status: { [Op.in]: SUBMITTED }, grade: null },
            attributes: ["id", "assignment_id", "student_id", "status", "submitted_at", "is_late", "text_submission", "file_submissions"],
            include: [{ model: User, as: "student", attributes: ["id", "first_name", "last_name"] }],
            order: [["submitted_at", "ASC"], ["id", "ASC"]],
            limit: 1000,
          })) as any[])
        : [];
      const named = externalPupilDataAllowed(policy, consentNames);
      const rows = subs.map((s, i) => {
        const a = byId.get(s.assignment_id);
        const name = studentName(s.student);
        const text = htmlToText(String(s.text_submission || ""));
        const files = Array.isArray(s.file_submissions) ? s.file_submissions : safeJson(s.file_submissions) ?? [];
        return {
          submission_id: s.id,
          assignment_id: s.assignment_id,
          assignment_title: a?.title ?? "",
          course_id: a?.course_id ?? null,
          max_score: Number(a?.max_score) || 0,
          rubric: (typeof a?.rubric === "string" ? safeJson(a.rubric) : a?.rubric) ?? [],
          student: named ? { id: s.student_id, name: name || `Student ${i + 1}` } : { label: `Student ${i + 1}` },
          submitted_at: s.submitted_at,
          late: !!s.is_late,
          text: truncate(named ? scrub(text) : anonymiseText(text, [name, s.student?.first_name, s.student?.last_name]), 1500),
          file_count: Array.isArray(files) ? files.length : 0,
        };
      });
      const page = paginate(rows, args.cursor, args.limit);
      return {
        result: { ...page, pupil_names: named },
        summary: `${rows.length} submission(s) waiting for grading${named ? "" : " (pupils anonymised)"}.`,
        openUrl: `${appUrl()}/grading`,
      };
    },
  },
  {
    name: "tm_add_questions_draft",
    title: "Draft questions for my bank",
    description:
      "Saves questions as an AI draft for one of the teacher's subjects. Nothing is added to the question bank until the teacher reviews the draft in Task Mentor and confirms it. Each question: question_type, question_text, question_data (e.g. options + correct choice ids for choice questions), optional correct_answer, explanation, difficulty_level (EASY|MEDIUM|DIFFICULT). Returns the draft link.",
    kind: "draft",
    pupilData: false,
    perms: ["QUESTION_BANK_CREATE"],
    inputSchema: {
      type: "object",
      properties: {
        course_id: { type: "integer" },
        title: { type: "string" },
        questions: {
          type: "array",
          maxItems: 50,
          items: {
            type: "object",
            properties: {
              question_type: { type: "string", enum: QUESTION_TYPES },
              question_text: { type: "string" },
              question_data: { type: "object" },
              correct_answer: {},
              explanation: { type: "string" },
              difficulty_level: { type: "string", enum: ["EASY", "MEDIUM", "DIFFICULT"] },
            },
            required: ["question_type", "question_text", "question_data"],
          },
        },
      },
      required: ["course_id", "questions"],
    },
    async run({ req, args }) {
      const allowed = await subjectIdsOf(req);
      const course = courseArg(args, allowed, true)!;
      if (!Array.isArray(args.questions) || !args.questions.length) throw bad("questions must be a non-empty array.");
      if (args.questions.length > 50) throw bad("At most 50 questions per draft.");
      const kept: any[] = [];
      const skipped: { index: number; reason: string }[] = [];
      args.questions.forEach((q: any, index: number) => {
        const type = String(q?.question_type || "");
        const text = str(q?.question_text, 5000);
        if (!QUESTION_TYPES.includes(type)) return skipped.push({ index, reason: "Unknown question_type" });
        if (!text) return skipped.push({ index, reason: "Empty question_text" });
        const data = q?.question_data && typeof q.question_data === "object" ? q.question_data : null;
        const v = QuestionValidator.validateQuestionData(type as QuestionType, data);
        if (!v.isValid) return skipped.push({ index, reason: v.errors?.[0] || "Invalid question_data" });
        kept.push({
          question_type: type,
          question_text: text,
          question_data: data,
          correct_answer: q?.correct_answer ?? null,
          explanation: str(q?.explanation, 3000) || null,
          difficulty_level: ["EASY", "MEDIUM", "DIFFICULT"].includes(q?.difficulty_level) ? q.difficulty_level : "MEDIUM",
          tags: ["ai-draft"],
        });
      });
      if (!kept.length) throw bad(`None of the questions are valid: ${skipped.map((s) => `#${s.index + 1} ${s.reason}`).join("; ")}`);
      const draft = await AiDraft.create({
        user_id: req.user!.id,
        kind: "questions",
        course_id: course,
        title: str(args.title, 200) || `${kept.length} question(s) from my AI`,
        payload: { questions: kept, skipped },
        status: "draft",
        source: "connector",
      });
      const openUrl = `${appUrl()}/ai-drafts/${draft.id}`;
      return {
        result: { draft_id: draft.id, saved: kept.length, skipped, status: "draft" },
        summary: `Saved ${kept.length} question(s) as a draft${skipped.length ? ` (${skipped.length} skipped)` : ""}. The teacher adds them to the bank in Task Mentor.`,
        openUrl,
      };
    },
  },
  {
    name: "tm_draft_rubric",
    title: "Draft a rubric",
    description:
      "Saves a grading rubric as an AI draft: criteria with descriptions and marks, scaled to add up to exactly max_score. Optionally for an existing assignment the teacher owns. Nothing changes on the assignment until the teacher loads the draft in the assignment form and saves.",
    kind: "draft",
    pupilData: false,
    perms: ["ASSIGNMENTS_CREATE", "ASSIGNMENTS_EDIT"],
    inputSchema: {
      type: "object",
      properties: {
        assignment_id: { type: "integer" },
        title: { type: "string" },
        max_score: { type: "number" },
        criteria: {
          type: "array",
          maxItems: RUBRIC_MAX_CRITERIA,
          items: {
            type: "object",
            properties: { criteria: { type: "string" }, description: { type: "string" }, max_score: { type: "number" } },
            required: ["criteria", "max_score"],
          },
        },
      },
      required: ["criteria"],
    },
    async run({ req, args }) {
      let assignment: any = null;
      if (args.assignment_id !== undefined && args.assignment_id !== null) {
        const id = posInt(args.assignment_id);
        if (!id) throw bad("assignment_id must be a positive integer.");
        assignment = await Assignment.findByPk(id, { attributes: ["id", "title", "course_id", "created_by", "max_score", "status"] });
        if (!assignment || assignment.status === "removed") throw bad("No such assignment.");
        if (!canManageAssignment(req.user as any, assignment)) {
          throw new ToolError(403, "TOOL_FORBIDDEN", "Only the assignment's creator can change its rubric.");
        }
      }
      const maxScore = Number(args.max_score ?? assignment?.max_score);
      if (!(maxScore > 0) || maxScore > 1000) throw bad("max_score must be between 0 and 1000 (or give an assignment_id).");
      if (!Array.isArray(args.criteria) || args.criteria.length < 1) throw bad("criteria must be a non-empty array.");
      const rows = args.criteria
        .slice(0, RUBRIC_MAX_CRITERIA)
        .map((c: any) => ({ name: str(c?.criteria ?? c?.name, 120), description: str(c?.description, 1000), points: Number(c?.max_score ?? c?.points) }))
        .filter((c: any) => c.name);
      if (!rows.length) throw bad("Every criterion needs a name (criteria).");
      const marks = distributeMarks(
        rows.map((r: any) => r.points),
        maxScore,
      );
      const criteria = rows.map((r: any, i: number) => ({ criteria: r.name, description: r.description, max_score: marks[i] }));
      const draft = await AiDraft.create({
        user_id: req.user!.id,
        kind: "rubric",
        course_id: assignment?.course_id ?? null,
        assignment_id: assignment?.id ?? null,
        title: str(args.title, 200) || (assignment ? `Rubric for ${assignment.title}` : "Rubric from my AI"),
        payload: { criteria, max_score: maxScore },
        status: "draft",
        source: "connector",
      });
      return {
        result: { draft_id: draft.id, criteria, total: maxScore, status: "draft" },
        summary: `Saved a ${criteria.length}-criterion rubric (${maxScore} marks) as a draft. The teacher loads it in the assignment form.`,
        openUrl: `${appUrl()}/ai-drafts/${draft.id}`,
      };
    },
  },
  {
    name: "tm_draft_feedback",
    title: "Draft marking feedback",
    description:
      "Saves marking feedback for one submission (from tm_list_submissions_to_grade) as a private AI draft: feedback text, optional per-criterion scores and a suggested score. It is never released to the student; the teacher reads it while grading and decides.",
    kind: "draft",
    pupilData: true,
    perms: ["SUBMISSIONS_GRADE"],
    inputSchema: {
      type: "object",
      properties: {
        submission_id: { type: "integer" },
        feedback: { type: "string" },
        suggested_score: { type: "number" },
        rubric_scores: {
          type: "array",
          items: {
            type: "object",
            properties: { criteria: { type: "string" }, score: { type: "number" }, comment: { type: "string" } },
            required: ["criteria", "score"],
          },
        },
      },
      required: ["submission_id", "feedback"],
    },
    async run({ req, args, policy, consentNames }) {
      const id = posInt(args.submission_id);
      if (!id) throw bad("submission_id must be a positive integer.");
      const feedback = str(args.feedback, 8000);
      if (!feedback) throw bad("feedback is required.");
      const sub = (await Submission.findByPk(id, {
        attributes: ["id", "assignment_id", "student_id"],
        include: [
          { model: Assignment, as: "assignment", attributes: ["id", "title", "course_id", "academic_term_id", "created_by", "max_score"] },
          { model: User, as: "student", attributes: ["id", "first_name", "last_name"] },
        ],
      })) as any;
      if (!sub || !sub.assignment) throw bad("No such submission.");
      if (!(await canGradeAssignment(req, sub.assignment))) throw new ToolError(403, "TOOL_FORBIDDEN", "You can't grade that submission.");
      const max = Number(sub.assignment.max_score) || 0;
      const suggested = args.suggested_score === undefined || args.suggested_score === null ? null : Number(args.suggested_score);
      if (suggested !== null && (!Number.isFinite(suggested) || suggested < 0 || (max > 0 && suggested > max))) {
        throw bad(`suggested_score must be between 0 and ${max}.`);
      }
      const rubricScores = Array.isArray(args.rubric_scores)
        ? args.rubric_scores
            .slice(0, RUBRIC_MAX_CRITERIA)
            .map((r: any) => ({ criteria: str(r?.criteria, 120), score: Number(r?.score) || 0, comment: str(r?.comment, 1000) || undefined }))
            .filter((r: any) => r.criteria)
        : [];
      const draft = await AiDraft.create({
        user_id: req.user!.id,
        kind: "feedback",
        course_id: sub.assignment.course_id ?? null,
        assignment_id: sub.assignment.id,
        submission_id: sub.id,
        title: `Feedback draft: ${sub.assignment.title}`,
        payload: { feedback, suggested_score: suggested, rubric_scores: rubricScores, max_score: max },
        status: "draft",
        source: "connector",
      });
      const named = externalPupilDataAllowed(policy, consentNames);
      return {
        result: {
          draft_id: draft.id,
          submission_id: sub.id,
          student: named ? { id: sub.student_id, name: studentName(sub.student) } : { label: "the student" },
          status: "draft",
          released: false,
        },
        summary: "Saved the feedback as a private draft. The student sees nothing until the teacher grades the submission.",
        openUrl: `${appUrl()}/ai-drafts/${draft.id}`,
      };
    },
  },
];

function safeJson(s: unknown): any {
  if (typeof s !== "string") return s ?? null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// ─── Who may use the tools ───────────────────────────────────────────────────

/** Why the connector is closed for this person, or null when it is open. */
async function gate(req: Request): Promise<{ policy: AiPolicy | null; closed: ToolError | null }> {
  const policy = await getAiPolicy();
  if (!policy || !aiAppEnabled(policy, "tm") || !policy.external?.connector) {
    return { policy, closed: new ToolError(403, "EXTERNAL_OFF", "Using your own Claude or ChatGPT with Task Mentor is turned off for the school.") };
  }
  if (!req.user || isStudentRequest(req)) {
    return { policy, closed: new ToolError(403, "TOOL_FORBIDDEN", "The NGA connector is for staff.") };
  }
  const hasAiUse = !!(req.user as any).permissions?.has("AI_USE");
  if (!decideAi(policy, { app: "tm", feature: "author", hasAiUse }).allowed || !(await hasExternalConnect(req))) {
    return { policy, closed: new ToolError(403, "TOOL_FORBIDDEN", "Your role cannot use your own Claude or ChatGPT with NGA.") };
  }
  return { policy, closed: null };
}

const allowedFor = (req: Request, tool: Tool) => {
  const perms: Set<string> | undefined = (req.user as any)?.permissions;
  return tool.perms.some((p) => perms?.has(p));
};

const publicDef = ({ name, title, description, kind, pupilData, inputSchema }: Tool): ToolDef => ({
  name,
  title,
  description,
  kind,
  pupilData,
  inputSchema,
});

/** GET /mcp/tools: the tools this person may use right now ([] when closed). */
export async function listTools(req: Request): Promise<ToolDef[]> {
  if (!req.user) return [];
  const { closed } = await gate(req);
  if (closed) return [];
  return TOOLS.filter((t) => allowedFor(req, t)).map(publicDef);
}

/** POST /mcp/call. Throws ToolError for every refusal. */
export async function callTool(req: Request, body: any): Promise<ToolAnswer> {
  const name = typeof body?.name === "string" ? body.name : "";
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new ToolError(404, "TOOL_UNKNOWN", `No Task Mentor tool called "${name}".`);
  const args = body?.arguments ?? {};
  if (typeof args !== "object" || Array.isArray(args)) throw bad("arguments must be an object.");
  if (!req.user) throw new ToolError(403, "TOOL_FORBIDDEN", "Sign in to Task Mentor once before using it from your AI.");
  const { policy, closed } = await gate(req);
  if (closed) throw closed;
  if (!allowedFor(req, tool)) throw new ToolError(403, "TOOL_FORBIDDEN", "Your role can't use this Task Mentor tool.");
  if (await examActiveFor(req.user.id)) {
    throw new ToolError(423, "EXAM_ACTIVE", "One of your TMCode exams is running: Task Mentor tools are paused until it ends.");
  }
  const consentNames = body?.consent?.pupilNames === true;
  return tool.run({ req, policy: policy!, args, consentNames });
}

/** Tests. */
export const TOOL_NAMES = TOOLS.map((t) => t.name);
