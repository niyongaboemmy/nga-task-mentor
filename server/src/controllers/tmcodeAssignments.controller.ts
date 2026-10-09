import { syncProjectStatus } from "../tmcode/projects/status";
import { Request, Response } from "express";
import { z } from "zod";
import { Op, UniqueConstraintError } from "sequelize";
import { sequelize } from "../config/database";
import {
  Assignment,
  AssignmentTmcode,
  Project,
  ProjectActivityLink,
  ProjectEvent,
  ProjectMember,
  ProjectPresence,
  ProjectRevision,
  Submission,
  User,
} from "../models";
import { tmcodeError } from "../middleware/tmcodeAuth";
import { apiOrigin } from "./tmcode.controller";
import { projectDetails, publishEvent, recordEvent, uniqueSlug } from "./projects.controller";
import { getScopedSubjects, ScopedSubject } from "../utils/scopedSubjects";
import { fetchEnrolledStudents, getCurrentTermId, getMisToken } from "../utils/misUtils";
import { canManageAssignment } from "../utils/ownership";
import { termScope } from "../utils/courseItemScope";
import {
  ActivityInfo,
  forgetProjectCourses,
  loadActivity,
  resolveProjectAccess,
  teacherCanSeeActivity,
} from "../tmcode/projects/access";
import { HIDDEN_PRESENCE, presenceSummary, userName, usersById } from "../tmcode/projects/serialize";
import { loadTmAssignment, tmcodeColumns, TmAssignment } from "../tmcode/assignments/load";
import { gradeNumber, isReadOnlyStatus, STUDENT_STATUSES, WorkState, workState } from "../tmcode/assignments/state";

/**
 * TMCode practicals and case studies (ASSIGNMENTS_PLAN.md "API"): the
 * assignment list and brief TMCode shows, the idempotent Start that makes a
 * student's workspace from the teacher's starter files, the teacher's
 * TMCode settings for an assignment, and the per-student workspaces view.
 * Routes run behind tmcodeUserAuth (TMCode user token or TM web token);
 * errors are `{error_code, message, ...}`. Users are LOCAL ids; course ids are
 * MIS subject ids, scoped through getScopedSubjects as the web pages are.
 */

const validation = (res: Response, error: z.ZodError) =>
  tmcodeError(res, 400, "VALIDATION_ERROR", "Invalid request.", {
    errors: error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
  });

const has = (req: Request, key: string) => !!req.user?.permissions?.has(key);
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
const notFound = (res: Response) => tmcodeError(res, 404, "ASSIGNMENT_NOT_FOUND", "Assignment not found.");

/** Staff who can follow students' work (teaching scope, workspaces). */
const isStaff = (req: Request) =>
  ["ASSIGNMENTS_VIEW_SUBMISSIONS", "PROJECTS_MONITOR", "PROJECTS_VIEW_ALL", "ASSIGNMENTS_MANAGE_ANY"].some((k) =>
    has(req, k),
  );

/** The caller's scoped subjects, memoised per request. */
function scoped(req: Request): Promise<{ scope: string; subjects: ScopedSubject[] }> {
  const r = req as any;
  r.__tmAssignScope ??= getScopedSubjects(req);
  return r.__tmAssignScope;
}

async function courseNames(req: Request): Promise<Map<number, string>> {
  const { subjects } = await scoped(req);
  return new Map(subjects.map((s) => [Number(s.id), s.name]));
}

/**
 * Subjects come from MIS, asked with the caller's MIS token (X-MIS-Token from
 * TMCode, the misToken cookie on the web). Without one, every scoped caller
 * looks enrolled in nothing: say so instead of answering an empty list or
 * NOT_ENROLLED (TMCode up to 0.10.0 sent it only on /activities and /links).
 */
async function scopeUnavailable(req: Request, res: Response): Promise<boolean> {
  const { scope, subjects } = await scoped(req);
  // "none" is the role's own answer (no subjects to have), not a missing token.
  if (scope === "all" || scope === "none" || subjects.length > 0 || getMisToken(req, { quiet: true })) return false;
  tmcodeError(res, 409, "MIS_SCOPE_UNAVAILABLE", "Task Mentor couldn't check your subjects with Central MIS. Update TMCode, or sign out and sign in again.");
  return true;
}

/** Is the course among the caller's subjects ("all" scope: every course)? */
async function inScope(req: Request, courseId: number | null | undefined): Promise<boolean> {
  if (courseId == null) return false;
  const { scope, subjects } = await scoped(req);
  if (scope === "all") return true;
  return subjects.some((s) => Number(s.id) === Number(courseId));
}

const activityOf = (a: Assignment): ActivityInfo => ({
  type: "assignment",
  id: a.id,
  title: a.title,
  course_id: a.course_id ?? null,
  created_by: a.created_by ?? null,
  open: a.status === "published",
  status: a.status,
  due_date: a.due_date ?? null,
});

/** Teacher of the assignment: its creator, a super admin, or staff whose courses include it. */
async function isTeacherOf(req: Request, a: Assignment): Promise<boolean> {
  if (canManageAssignment(req.user, a)) return true;
  if (!isStaff(req)) return false;
  if (await teacherCanSeeActivity(req, activityOf(a))) return true;
  return has(req, "ASSIGNMENTS_VIEW_SUBMISSIONS") && (await inScope(req, a.course_id));
}

// ─── Shapes ──────────────────────────────────────────────────────────────────

export interface MyWork {
  project_id: number | null;
  /** The stored status of the student's project (tmcode/projects/status.ts). */
  project_status: string | null;
  link_id: number | null;
  state: WorkState;
  submitted_at: string | null;
  revision_number: number | null;
  grade: number | null;
  max_points: number;
  feedback: string | null;
}

export interface TeachingCounts {
  students: number;
  started: number;
  submitted: number;
  graded: number;
}

function summaryJson(
  t: TmAssignment,
  names: Map<number, string>,
  my: MyWork | null,
  teaching?: TeachingCounts,
) {
  const a = t.assignment;
  const due = a.due_date ? new Date(a.due_date) : null;
  return {
    id: a.id,
    title: a.title,
    kind: t.tm.tmcode_kind ?? null,
    course_id: a.course_id ?? null,
    course_name: a.course_id != null ? names.get(Number(a.course_id)) ?? null : null,
    status: a.status,
    due_date: iso(due),
    points: Number(a.max_score),
    language: t.tm.tmcode_language ?? null,
    read_only: isReadOnlyStatus(a.status),
    late: !!due && due.getTime() < Date.now(),
    my,
    ...(teaching ? { teaching } : {}),
  };
}

// ─── The caller's own work ───────────────────────────────────────────────────

/** `my` for each assignment: workspace / linked project, link, submission, grade. */
async function myWork(userId: number, assignments: Assignment[]): Promise<Map<number, MyWork>> {
  const ids = assignments.map((a) => a.id);
  const out = new Map<number, MyWork>();
  if (ids.length === 0) return out;
  const mine = await Project.findAll({ where: { owner_id: userId }, attributes: ["id", "assignment_id", "status"] });
  const [links, submissions] = await Promise.all([
    mine.length
      ? ProjectActivityLink.findAll({
          where: {
            activity_type: "assignment",
            activity_id: { [Op.in]: ids },
            project_id: { [Op.in]: mine.map((p) => p.id) },
          },
        })
      : [],
    Submission.findAll({
      where: { assignment_id: { [Op.in]: ids }, student_id: userId },
      attributes: ["id", "assignment_id", "status", "grade", "feedback", "submitted_at"],
    }),
  ]);
  const frozen = links.map((l) => l.revision_id).filter((x): x is number => !!x);
  const revNumbers = new Map(
    (frozen.length ? await ProjectRevision.findAll({ where: { id: frozen }, attributes: ["id", "number"] }) : []).map(
      (r) => [r.id, r.number],
    ),
  );
  for (const a of assignments) {
    const workspace = mine.find((p) => p.assignment_id === a.id) ?? null;
    const link = links.find((l) => l.activity_id === a.id) ?? null;
    const submission = submissions.find((s) => s.assignment_id === a.id) ?? null;
    const projectId = workspace?.id ?? link?.project_id ?? null;
    const ownProject = workspace ?? (link ? mine.find((p) => p.id === link.project_id) : null) ?? null;
    out.set(a.id, {
      project_id: projectId,
      project_status: ownProject?.status ?? null,
      link_id: link?.id ?? null,
      state: workState({ project: projectId ? { id: projectId } : null, link, submission }),
      submitted_at: iso(link?.submitted_at ?? (submission?.status !== "draft" ? submission?.submitted_at : null)),
      revision_number: link?.revision_id ? revNumbers.get(link.revision_id) ?? null : null,
      grade: submission?.status === "graded" ? gradeNumber(submission.grade) : null,
      max_points: Number(a.max_score),
      feedback: submission?.status === "graded" ? submission.feedback ?? null : null,
    });
  }
  return out;
}

// ─── Rosters and teaching counts ─────────────────────────────────────────────

interface RosterStudent {
  mis_user_id: number | null;
  name: string;
  email: string | null;
  avatar_url: string | null;
}

/** The MIS roster of a course (memoised per request; [] without an MIS token or on failure). */
async function roster(req: Request, courseId: number | null | undefined): Promise<RosterStudent[]> {
  if (courseId == null) return [];
  const r = req as any;
  r.__tmRosters ??= new Map<number, Promise<RosterStudent[]>>();
  if (!r.__tmRosters.has(courseId)) {
    r.__tmRosters.set(
      courseId,
      (async () => {
        const token = getMisToken(req, { quiet: true });
        if (!token) return [];
        const termId = await getCurrentTermId(req);
        const rows = await fetchEnrolledStudents(token, courseId, termId);
        return rows.map((s: any) => {
          const misId = Number(s.id ?? s.user_id ?? s.student_id ?? s.userId);
          const name =
            `${s.first_name ?? s.firstName ?? ""} ${s.last_name ?? s.lastName ?? ""}`.trim() ||
            s.name ||
            s.email ||
            `Student #${misId}`;
          return {
            mis_user_id: Number.isFinite(misId) && misId > 0 ? misId : null,
            name,
            email: s.email ?? null,
            avatar_url: s.profile_image ?? s.profileImage ?? null,
          };
        });
      })().catch(() => []),
    );
  }
  return r.__tmRosters.get(courseId);
}

/** started / submitted / graded per assignment, from workspaces, links and submissions. */
async function teachingCounts(req: Request, assignments: Assignment[]): Promise<Map<number, TeachingCounts>> {
  const ids = assignments.map((a) => a.id);
  const out = new Map<number, TeachingCounts>();
  if (ids.length === 0) return out;
  const [workspaces, links, submissions] = await Promise.all([
    Project.findAll({ where: { assignment_id: { [Op.in]: ids } }, attributes: ["id", "owner_id", "assignment_id"] }),
    ProjectActivityLink.findAll({
      where: { activity_type: "assignment", activity_id: { [Op.in]: ids } },
      attributes: ["id", "project_id", "activity_id", "status"],
    }),
    Submission.findAll({ where: { assignment_id: { [Op.in]: ids } }, attributes: ["assignment_id", "student_id", "status"] }),
  ]);
  const linkOwners = new Map(
    (links.length
      ? await Project.findAll({ where: { id: { [Op.in]: links.map((l) => l.project_id) } }, attributes: ["id", "owner_id"] })
      : []
    ).map((p) => [p.id, p.owner_id]),
  );
  for (const a of assignments) {
    const started = new Set<number>();
    workspaces.filter((p) => p.assignment_id === a.id).forEach((p) => started.add(p.owner_id));
    links
      .filter((l) => l.activity_id === a.id)
      .forEach((l) => linkOwners.has(l.project_id) && started.add(linkOwners.get(l.project_id)!));
    const subs = submissions.filter((s) => s.assignment_id === a.id && s.status !== "draft");
    subs.forEach((s) => started.add(s.student_id));
    const students = (await roster(req, a.course_id)).length;
    out.set(a.id, {
      students: Math.max(students, started.size),
      started: started.size,
      // Cumulative: graded work was submitted too.
      submitted: subs.length,
      graded: subs.filter((s) => s.status === "graded").length,
    });
  }
  return out;
}

// ─── GET /assignments ────────────────────────────────────────────────────────

// @desc    The caller's TMCode assignments. scope=student: published or
//          completed ones of the subjects they're enrolled in (current term),
//          with `my`. scope=teaching: the ones they created or teach (not
//          removed), with `teaching` counts.
// @route   GET /api/tmcode/assignments?scope=student|teaching
export const listAssignments = async (req: Request, res: Response) => {
  const parsed = z.object({ scope: z.enum(["student", "teaching"]).default("student") }).safeParse(req.query);
  if (!parsed.success) return validation(res, parsed.error);
  const userId = Number(req.user.id);
  const tm = await tmcodeColumns();
  if (tm.size === 0) return res.status(200).json({ assignments: [] });

  const { scope, subjects } = await scoped(req);
  const names = await courseNames(req);
  const termId = await getCurrentTermId(req);
  const courseIds = subjects.map((s) => Number(s.id));

  if (parsed.data.scope === "teaching") {
    if (!isStaff(req)) {
      return tmcodeError(res, 403, "FORBIDDEN", "Only teachers have a teaching scope.");
    }
    const all = scope === "all" || has(req, "ASSIGNMENTS_MANAGE_ANY") || has(req, "PROJECTS_VIEW_ALL");
    const who = all
      ? {}
      : { [Op.or]: [{ created_by: userId }, ...(courseIds.length ? [{ course_id: { [Op.in]: courseIds } }] : [])] };
    const rows = await Assignment.findAll({
      where: { id: { [Op.in]: [...tm.keys()] }, status: { [Op.ne]: "removed" }, ...who } as any,
      order: [["due_date", "ASC"]],
      limit: 300,
    });
    const counts = await teachingCounts(req, rows);
    return res.status(200).json({
      assignments: rows.map((a) => summaryJson({ assignment: a, tm: tm.get(a.id)! }, names, null, counts.get(a.id))),
    });
  }

  if (scope === "none" || (scope !== "all" && courseIds.length === 0)) {
    if (await scopeUnavailable(req, res)) return;
    return res.status(200).json({ assignments: [] });
  }
  const rows = await Assignment.findAll({
    where: {
      [Op.and]: [
        { id: { [Op.in]: [...tm.keys()] } },
        { status: { [Op.in]: [...STUDENT_STATUSES] } },
        scope === "all" ? {} : { course_id: { [Op.in]: courseIds } },
        termScope(termId),
      ],
    } as any,
    order: [["due_date", "ASC"]],
    limit: 300,
  });
  const mine = await myWork(userId, rows);
  return res.status(200).json({
    assignments: rows.map((a) => summaryJson({ assignment: a, tm: tm.get(a.id)! }, names, mine.get(a.id) ?? null)),
  });
};

// ─── GET /assignments/:id ────────────────────────────────────────────────────

type Role = "teacher" | "student";

/**
 * Load :id and decide the caller's role, or answer the error:
 * 404 when it doesn't exist (or, for a student, isn't a published/completed
 * TMCode assignment), 403 NOT_ENROLLED when the student isn't in its course.
 */
async function assignmentFor(req: Request, res: Response): Promise<(TmAssignment & { role: Role }) | null> {
  const t = await loadTmAssignment(Number(req.params.id));
  if (!t) {
    notFound(res);
    return null;
  }
  if (await isTeacherOf(req, t.assignment)) return { ...t, role: "teacher" };
  const visible = !!t.tm.tmcode_kind && (STUDENT_STATUSES as readonly string[]).includes(t.assignment.status);
  if (!visible) {
    notFound(res);
    return null;
  }
  if (!(await inScope(req, t.assignment.course_id))) {
    if (await scopeUnavailable(req, res)) return null;
    tmcodeError(res, 403, "NOT_ENROLLED", "You aren't enrolled in this assignment's course.");
    return null;
  }
  return { ...t, role: "student" };
}

function parseJsonArray(v: unknown): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** The starter project's revision a Start would copy (explicit, else the head). */
async function starterRevision(tm: AssignmentTmcode): Promise<ProjectRevision | null> {
  if (!tm.tmcode_starter_project_id) return null;
  const project = await Project.findByPk(tm.tmcode_starter_project_id, { attributes: ["id", "head_revision_id"] });
  if (!project) return null;
  const revId = tm.tmcode_starter_revision_id ?? project.head_revision_id;
  if (!revId) return null;
  const rev = await ProjectRevision.findByPk(revId);
  return rev && rev.project_id === project.id ? rev : null;
}

async function detailJson(req: Request, t: TmAssignment & { role: Role }) {
  const a = t.assignment;
  const names = await courseNames(req);
  const my = t.role === "student" ? (await myWork(Number(req.user.id), [a])).get(a.id) ?? null : null;
  const teaching = t.role === "teacher" ? (await teachingCounts(req, [a])).get(a.id) : undefined;
  const origin = apiOrigin(req);
  const starterRev = await starterRevision(t.tm);
  return {
    ...summaryJson(t, names, my, teaching),
    // Untrusted rich-text HTML from the assignment editor: TMCode sanitises it before rendering.
    description_html: a.description ?? "",
    instructions: t.tm.tmcode_instructions ?? null,
    attachments: parseJsonArray(a.attachments).map((f: any) => ({
      name: String(f?.name ?? "file"),
      url: /^https?:\/\//.test(String(f?.url ?? "")) ? f.url : `${origin}${String(f?.url ?? "").startsWith("/") ? "" : "/"}${f?.url ?? ""}`,
    })),
    rubric: parseJsonArray(a.rubric),
    starter: t.tm.tmcode_starter_project_id
      ? {
          project_id: t.tm.tmcode_starter_project_id,
          revision_id: starterRev?.id ?? t.tm.tmcode_starter_revision_id ?? null,
          file_count: starterRev?.file_count ?? 0,
          size_bytes: Number(starterRev?.size_bytes ?? 0),
        }
      : null,
  };
}

// @desc    One TMCode assignment: the brief, instructions, attachments,
//          rubric, starter, and the caller's work (student) or counts (teacher).
// @route   GET /api/tmcode/assignments/:id
export const getAssignment = async (req: Request, res: Response) => {
  const t = await assignmentFor(req, res);
  if (!t) return;
  return res.status(200).json({ assignment: await detailJson(req, t) });
};

// @desc    The tmcode:// deep link that opens the assignment in TMCode (the
//          web "Open in TMCode" button; same origin rule as projects' open-link).
// @route   GET /api/tmcode/assignments/:id/open-link
export const assignmentOpenLink = async (req: Request, res: Response) => {
  const t = await assignmentFor(req, res);
  if (!t) return;
  const api = encodeURIComponent(apiOrigin(req));
  return res.status(200).json({ deeplink: `tmcode://assignment?id=${t.assignment.id}&api=${api}` });
};

// ─── POST /assignments/:id/start ─────────────────────────────────────────────

async function workspaceOf(userId: number, assignmentId: number) {
  return Project.findOne({ where: { owner_id: userId, assignment_id: assignmentId } });
}

// @desc    Start (or continue) the caller's workspace. The first call makes a
//          tm project (the assignment's title, visibility course) whose
//          revision 1 is the starter's file list (blobs are shared, nothing is
//          copied) and links it to the assignment. Later calls return it.
// @route   POST /api/tmcode/assignments/:id/start
export const startAssignment = async (req: Request, res: Response) => {
  const t = await assignmentFor(req, res);
  if (!t) return;
  const a = t.assignment;
  const userId = Number(req.user.id);
  if (!t.tm.tmcode_kind) return notFound(res);
  if (t.role === "teacher" && !(STUDENT_STATUSES as readonly string[]).includes(a.status)) {
    return tmcodeError(res, 409, "ASSIGNMENT_NOT_PUBLISHED", "Publish the assignment before starting it.");
  }
  if (t.role === "teacher" && !(await inScope(req, a.course_id)) && !canManageAssignment(req.user, a)) {
    return tmcodeError(res, 403, "NOT_ENROLLED", "You aren't enrolled in this assignment's course.");
  }

  const answer = async (project: Project, created: boolean) =>
    res.status(created ? 201 : 200).json({
      project: await projectDetails(req, (await Project.findByPk(project.id))!, "owner"),
      created,
    });

  const existing = await workspaceOf(userId, a.id);
  if (existing) {
    // Starting again after removing the workspace brings it back.
    if (existing.status === "removed") {
      await existing.update({ status: "draft", status_changed_at: new Date(), status_changed_by: userId });
      await syncProjectStatus(existing.id, userId);
    }
    return answer(existing, false);
  }
  if (isReadOnlyStatus(a.status)) {
    return tmcodeError(res, 409, "ASSIGNMENT_COMPLETED", "This assignment is completed; it can't be started any more.");
  }

  const starter = await starterRevision(t.tm);
  const events: ProjectEvent[] = [];
  let project: Project;
  const transaction = await sequelize.transaction();
  try {
    project = await Project.create(
      {
        owner_id: userId,
        name: a.title.slice(0, 120),
        slug: await uniqueSlug(userId, a.title),
        description: null,
        language: t.tm.tmcode_language ?? null,
        kind: "tm",
        visibility: "course",
        assignment_id: a.id,
        share_presence: true,
        last_activity_at: new Date(),
      } as any,
      { transaction },
    );
    await ProjectMember.create(
      { project_id: project.id, user_id: userId, role: "owner", invited_by: null, status: "active" } as any,
      { transaction },
    );
    events.push(
      await recordEvent(project.id, userId, "created", { kind: "tm", assignment_id: a.id }, transaction),
    );
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
        await recordEvent(
          project.id,
          userId,
          "saved",
          { revision_id: revision.id, number: 1, source: "save", file_count: starter.file_count, starter: true },
          transaction,
        ),
      );
    }
    // One link per activity per owner: an unsubmitted link from another of
    // their projects moves to the workspace; a submitted one stays put.
    const mine = await Project.findAll({ where: { owner_id: userId }, attributes: ["id"], transaction });
    const previous = await ProjectActivityLink.findOne({
      where: { activity_type: "assignment", activity_id: a.id, project_id: { [Op.in]: mine.map((p) => p.id) } },
      transaction,
    });
    let link: ProjectActivityLink | null = null;
    if (!previous) {
      link = await ProjectActivityLink.create(
        { project_id: project.id, activity_type: "assignment", activity_id: a.id, linked_by: userId, status: "linked" } as any,
        { transaction },
      );
    } else if (previous.status === "linked") {
      forgetProjectCourses(previous.project_id);
      await previous.update({ project_id: project.id }, { transaction });
      link = previous;
    }
    if (link) {
      events.push(
        await recordEvent(
          project.id,
          userId,
          "linked",
          { link_id: link.id, activity_type: "assignment", activity_id: a.id, title: a.title },
          transaction,
        ),
      );
    }
    await transaction.commit();
  } catch (e) {
    await transaction.rollback().catch(() => {});
    // Two Starts at once: the unique (owner, assignment) index lets one win.
    if (e instanceof UniqueConstraintError) {
      const winner = await workspaceOf(userId, a.id);
      if (winner) return answer(winner, false);
    }
    throw e;
  }
  forgetProjectCourses(project.id);
  events.forEach(publishEvent);
  return answer(project, true);
};

// ─── PUT /assignments/:id/tmcode ─────────────────────────────────────────────

const tmcodeSchema = z.object({
  kind: z.enum(["practical", "case_study"]).nullable(),
  language: z.string().trim().max(40).nullable().optional(),
  starter_project_id: z.number().int().positive().nullable().optional(),
  starter_revision_id: z.number().int().positive().nullable().optional(),
  instructions: z.string().max(20_000).nullable().optional(),
});

// @desc    Turn TMCode on (kind set; submission_type becomes 'project') or off
//          (kind null; the tmcode columns are cleared, submission_type is left
//          alone), and set the language, starter and instructions. The starter
//          must be a tm project the caller can read; the revision one of its.
// @route   PUT /api/tmcode/assignments/:id/tmcode
export const updateAssignmentTmcode = async (req: Request, res: Response) => {
  const t = await loadTmAssignment(Number(req.params.id));
  if (!t) return notFound(res);
  if (!canManageAssignment(req.user, t.assignment)) {
    return tmcodeError(res, 403, "FORBIDDEN", "Only the assignment's creator can change its TMCode settings.");
  }
  const parsed = tmcodeSchema.safeParse(req.body ?? {});
  if (!parsed.success) return validation(res, parsed.error);
  const b = parsed.data;

  const values: Partial<AssignmentTmcode> = {
    tmcode_kind: null,
    tmcode_language: null,
    tmcode_starter_project_id: null,
    tmcode_starter_revision_id: null,
    tmcode_instructions: null,
  };
  if (b.kind) {
    if (b.starter_revision_id && !b.starter_project_id) {
      return tmcodeError(res, 422, "STARTER_INVALID", "Choose the starter project for that revision.");
    }
    if (b.starter_project_id) {
      const access = await resolveProjectAccess(req, b.starter_project_id);
      if (!access) return tmcodeError(res, 422, "STARTER_NOT_FOUND", "Starter project not found.");
      if (access.project.kind !== "tm") {
        return tmcodeError(res, 422, "STARTER_KIND", "The starter must be a Task Mentor project (not GitHub).");
      }
      if (access.project.assignment_id) {
        return tmcodeError(res, 422, "STARTER_INVALID", "A student's assignment workspace can't be a starter.");
      }
      if (b.starter_revision_id) {
        const rev = await ProjectRevision.findByPk(b.starter_revision_id, { attributes: ["id", "project_id"] });
        if (!rev || rev.project_id !== access.project.id || !(access.allRevisions || access.revisionIds.has(rev.id))) {
          return tmcodeError(res, 422, "STARTER_REVISION_NOT_FOUND", "That revision isn't one of the starter project's.");
        }
      } else if (!access.allRevisions) {
        return tmcodeError(res, 422, "STARTER_NOT_FOUND", "Starter project not found.");
      }
    }
    Object.assign(values, {
      tmcode_kind: b.kind,
      tmcode_language: b.language || null,
      tmcode_starter_project_id: b.starter_project_id ?? null,
      tmcode_starter_revision_id: b.starter_project_id ? b.starter_revision_id ?? null : null,
      tmcode_instructions: b.instructions?.trim() ? b.instructions : null,
    });
  }
  await sequelize.transaction(async (transaction) => {
    await AssignmentTmcode.update(values, { where: { id: t.assignment.id }, transaction });
    if (b.kind && t.assignment.submission_type !== "project") {
      await Assignment.update({ submission_type: "project" }, { where: { id: t.assignment.id }, transaction });
    }
  });
  const fresh = (await loadTmAssignment(t.assignment.id))!;
  return res.status(200).json({ assignment: await detailJson(req, { ...fresh, role: "teacher" }) });
};

// ─── GET /assignments/:id/workspaces ─────────────────────────────────────────

// @desc    Teacher view: every enrolled student (MIS roster, plus anyone who
//          started or submitted) with their workspace state, live status
//          (only when shared), submitted revision and grade.
// @route   GET /api/tmcode/assignments/:id/workspaces
export const assignmentWorkspaces = async (req: Request, res: Response) => {
  const t = await loadTmAssignment(Number(req.params.id));
  if (!t) return notFound(res);
  const a = t.assignment;
  if (!(await isTeacherOf(req, a))) {
    return tmcodeError(res, 403, "FORBIDDEN", "This assignment isn't in your courses.");
  }

  const [workspaces, links, submissions, students] = await Promise.all([
    Project.findAll({ where: { assignment_id: a.id } }),
    ProjectActivityLink.findAll({ where: { activity_type: "assignment", activity_id: a.id } }),
    Submission.findAll({
      where: { assignment_id: a.id },
      attributes: ["id", "student_id", "status", "grade", "feedback", "submitted_at"],
    }),
    roster(req, a.course_id),
  ]);
  const linkedIds = links.map((l) => l.project_id).filter((id) => !workspaces.some((w) => w.id === id));
  const linked = linkedIds.length ? await Project.findAll({ where: { id: { [Op.in]: linkedIds } } }) : [];
  const projects = [...workspaces, ...linked];
  const projectIds = projects.map((p) => p.id);
  const [presence, frozen] = await Promise.all([
    projectIds.length ? ProjectPresence.findAll({ where: { project_id: { [Op.in]: projectIds } } }) : [],
    (() => {
      const ids = links.map((l) => l.revision_id).filter((x): x is number => !!x);
      return ids.length ? ProjectRevision.findAll({ where: { id: ids }, attributes: ["id", "number"] }) : [];
    })(),
  ]);
  const revNumbers = new Map(frozen.map((r) => [r.id, r.number]));

  // Roster (MIS ids) -> local users; then anyone with work who isn't on it.
  const misIds = students.map((s) => s.mis_user_id).filter((x): x is number => !!x);
  const byMis = new Map(
    (misIds.length
      ? await User.findAll({
          where: { mis_user_id: { [Op.in]: misIds } },
          attributes: ["id", "mis_user_id", "first_name", "last_name", "email", "profile_image"],
        })
      : []
    ).map((u) => [Number(u.mis_user_id), u]),
  );
  const workers = await usersById([...projects.map((p) => p.owner_id), ...submissions.map((s) => s.student_id)]);

  type Row = { user: { id: number | null; mis_user_id: number | null; name: string; email: string | null; avatar_url: string | null } };
  const rows = new Map<string, Row>();
  for (const s of students) {
    const u = s.mis_user_id ? byMis.get(s.mis_user_id) : undefined;
    const key = u ? `u${u.id}` : `m${s.mis_user_id ?? s.email}`;
    rows.set(key, {
      user: {
        id: u?.id ?? null,
        mis_user_id: s.mis_user_id,
        name: (u && userName(u)) || s.name,
        email: u?.email ?? s.email,
        avatar_url: u?.profile_image ?? s.avatar_url,
      },
    });
  }
  for (const [id, u] of workers) {
    if (rows.has(`u${id}`)) continue;
    rows.set(`u${id}`, {
      user: {
        id,
        mis_user_id: u.mis_user_id ? Number(u.mis_user_id) : null,
        name: userName(u) as string,
        email: u.email ?? null,
        avatar_url: u.profile_image ?? null,
      },
    });
  }

  const now = Date.now();
  const out = [...rows.values()].map(({ user }) => {
    const project =
      (user.id && (workspaces.find((p) => p.owner_id === user.id) ?? linked.find((p) => p.owner_id === user.id))) || null;
    const ownerProjectIds = user.id ? projects.filter((p) => p.owner_id === user.id).map((p) => p.id) : [];
    const link = links.find((l) => ownerProjectIds.includes(l.project_id)) ?? null;
    const submission = user.id ? submissions.find((s) => s.student_id === user.id) ?? null : null;
    const shared = project ? project.share_presence !== false : true;
    return {
      user,
      project_id: project?.id ?? null,
      project_status: project?.status ?? null,
      link_id: link?.id ?? null,
      submission_id: submission?.id ?? null,
      state: workState({ project, link, submission }),
      last_activity_at: iso(project?.last_activity_at),
      presence: project
        ? shared
          ? { shared: true, ...presenceSummary(presence.filter((r) => r.project_id === project.id), now) }
          : { shared: false, ...HIDDEN_PRESENCE }
        : null,
      revision_id: link?.revision_id ?? null,
      revision_number: link?.revision_id ? revNumbers.get(link.revision_id) ?? null : null,
      submitted_at: iso(link?.submitted_at ?? (submission && submission.status !== "draft" ? submission.submitted_at : null)),
      grade: submission?.status === "graded" ? gradeNumber(submission.grade) : null,
      max_points: Number(a.max_score),
    };
  });
  const order: Record<WorkState, number> = { in_progress: 0, submitted: 1, graded: 2, not_started: 3 };
  out.sort((x, y) => order[x.state] - order[y.state] || x.user.name.localeCompare(y.user.name));

  return res.status(200).json({
    assignment: {
      id: a.id,
      title: a.title,
      status: a.status,
      kind: t.tm.tmcode_kind ?? null,
      course_id: a.course_id ?? null,
      due_date: iso(a.due_date),
      points: Number(a.max_score),
      read_only: isReadOnlyStatus(a.status),
    },
    counts: {
      students: out.length,
      started: out.filter((r) => r.state !== "not_started").length,
      submitted: out.filter((r) => r.state === "submitted" || r.state === "graded").length,
      graded: out.filter((r) => r.state === "graded").length,
      live: out.filter((r) => r.presence?.online).length,
    },
    workspaces: out,
  });
};

/** Exposed for GET /api/assignments/:id (the web form's TMCode section). */
export async function assignmentTmcodeSettings(id: number) {
  try {
    const tm = await AssignmentTmcode.findByPk(id, {
      attributes: ["id", "tmcode_kind", "tmcode_language", "tmcode_starter_project_id", "tmcode_starter_revision_id", "tmcode_instructions"],
    });
    if (!tm?.tmcode_kind) return null;
    return {
      kind: tm.tmcode_kind,
      language: tm.tmcode_language ?? null,
      starter_project_id: tm.tmcode_starter_project_id ?? null,
      starter_revision_id: tm.tmcode_starter_revision_id ?? null,
      instructions: tm.tmcode_instructions ?? null,
    };
  } catch {
    // Before migration 20261007090000 the columns don't exist.
    return null;
  }
}
