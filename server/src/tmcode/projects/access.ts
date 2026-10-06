import { Request } from "express";
import { Op } from "sequelize";
import {
  Assignment,
  ManualAssessment,
  Project,
  ProjectActivityLink,
  ProjectMember,
  ProjectMemberRole,
  Quiz,
  ActivityType,
} from "../../models";
import { getScopedSubjects } from "../../utils/scopedSubjects";

/**
 * Who may do what with a project, and with the activities projects link to.
 *
 *   owner         everything on their project
 *   collaborator  (github projects) read, presence, git reports
 *   viewer        (github projects) read, presence
 *   admin         PROJECTS_VIEW_ALL: read any project, any revision
 *   teacher       PROJECTS_MONITOR + a link from the project to an activity
 *                 the teacher has access to: read the frozen (submitted)
 *                 revisions of those links -- every revision when the owner
 *                 set visibility "course"
 *
 * Activity access for teachers (scoped as the TM pages are): PROJECTS_VIEW_ALL,
 * the activity's creator, or PROJECTS_MONITOR with the activity's course
 * (MIS subject) among getScopedSubjects() -- "all" scope sees every course.
 */

export const ACTIVITY_TYPES: ActivityType[] = ["quiz", "assignment", "manual_assessment"];

export interface ActivityInfo {
  type: ActivityType;
  id: number;
  title: string;
  course_id: number | null;
  created_by: number | null;
  /** Open for linking and submitting. */
  open: boolean;
  status: string | null;
  due_date: Date | null;
}

export async function loadActivity(type: ActivityType, id: number): Promise<ActivityInfo | null> {
  if (type === "assignment") {
    const a = await Assignment.findByPk(id);
    if (!a) return null;
    return {
      type,
      id: a.id,
      title: a.title,
      course_id: a.course_id ?? null,
      created_by: a.created_by ?? null,
      open: a.status === "published",
      status: a.status,
      due_date: a.due_date ?? null,
    };
  }
  if (type === "quiz") {
    const q = await Quiz.findByPk(id);
    if (!q) return null;
    const ended = q.end_date ? new Date(q.end_date).getTime() < Date.now() : false;
    return {
      type,
      id: q.id,
      title: q.title,
      course_id: q.course_id ?? null,
      created_by: q.created_by ?? null,
      open: q.status === "published" && !ended,
      status: q.status,
      due_date: q.end_date ?? null,
    };
  }
  const m = await ManualAssessment.findByPk(id);
  if (!m) return null;
  return {
    type,
    id: m.id,
    title: m.title,
    course_id: m.course_id ?? null,
    created_by: m.created_by ?? null,
    open: true,
    status: null,
    due_date: null,
  };
}

/** The caller's scoped subjects, memoised per request (null = every subject). */
export async function scopedCourseIds(req: Request): Promise<Set<number> | null> {
  const r = req as any;
  if (!r.__projectScope) {
    r.__projectScope = getScopedSubjects(req).then(({ scope, subjects }) =>
      scope === "all" ? null : new Set(subjects.map((s) => Number(s.id))),
    );
  }
  return r.__projectScope;
}

const perms = (req: Request): Set<string> => req.user?.permissions ?? new Set();

/** May the caller (as staff) see this activity's linked projects? */
export async function teacherCanSeeActivity(req: Request, activity: ActivityInfo): Promise<boolean> {
  const p = perms(req);
  if (p.has("PROJECTS_VIEW_ALL")) return true;
  if (!p.has("PROJECTS_MONITOR")) return false;
  if (activity.created_by && Number(activity.created_by) === Number(req.user.id)) return true;
  if (activity.course_id == null) return false;
  const scope = await scopedCourseIds(req);
  return scope === null || scope.has(Number(activity.course_id));
}

/** May the caller (as a student/owner) link to and submit for this activity? */
export async function userMayUseActivity(req: Request, activity: ActivityInfo): Promise<boolean> {
  if (activity.course_id == null) return false;
  const scope = await scopedCourseIds(req);
  return scope === null || scope.has(Number(activity.course_id));
}

export type ProjectRole = ProjectMemberRole | "admin" | "teacher";

export interface ProjectAccess {
  project: Project;
  role: ProjectRole;
  /** owner only: save, links, settings, members */
  isOwner: boolean;
  /** owner / collaborator: git reports */
  canReportGit: boolean;
  /** owner / members: presence heartbeats */
  canPresence: boolean;
  /** Read any revision (else only `revisionIds`). */
  allRevisions: boolean;
  revisionIds: Set<number>;
}

/**
 * The caller's access to project `id`, or null (answer 404, so a project's
 * existence isn't leaked).
 */
export async function resolveProjectAccess(req: Request, id: number): Promise<ProjectAccess | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const project = await Project.findByPk(id);
  if (!project) return null;
  const userId = Number(req.user.id);
  const base = { project, revisionIds: new Set<number>() };

  if (project.owner_id === userId) {
    return { ...base, role: "owner", isOwner: true, canReportGit: true, canPresence: true, allRevisions: true };
  }
  const member = await ProjectMember.findOne({
    where: { project_id: project.id, user_id: userId, status: { [Op.ne]: "removed" } },
  });
  if (member && member.role !== "owner") {
    return {
      ...base,
      role: member.role,
      isOwner: false,
      canReportGit: member.role === "collaborator",
      canPresence: true,
      allRevisions: true,
    };
  }
  const p = perms(req);
  if (p.has("PROJECTS_VIEW_ALL")) {
    return { ...base, role: "admin", isOwner: false, canReportGit: false, canPresence: false, allRevisions: true };
  }
  if (p.has("PROJECTS_MONITOR")) {
    const links = await ProjectActivityLink.findAll({ where: { project_id: project.id } });
    const revisionIds = new Set<number>();
    let any = false;
    for (const link of links) {
      const activity = await loadActivity(link.activity_type, link.activity_id);
      if (!activity || !(await teacherCanSeeActivity(req, activity))) continue;
      any = true;
      if (link.status === "submitted" && link.revision_id) revisionIds.add(link.revision_id);
    }
    if (any) {
      return {
        project,
        revisionIds,
        role: "teacher",
        isOwner: false,
        canReportGit: false,
        canPresence: false,
        allRevisions: project.visibility === "course",
      };
    }
  }
  return null;
}

export const canReadRevision = (access: ProjectAccess, revisionId: number) =>
  access.allRevisions || access.revisionIds.has(revisionId);

// ─── Course ids of a project (monitor scoping) ───────────────────────────────

const courseCache = new Map<number, { at: number; ids: number[] }>();
const COURSE_TTL_MS = 60_000;

export const forgetProjectCourses = (projectId: number) => courseCache.delete(projectId);

/** MIS subject ids of the activities a project is linked to (cached 60 s). */
export async function projectCourseIds(projectId: number): Promise<number[]> {
  const hit = courseCache.get(projectId);
  if (hit && Date.now() - hit.at < COURSE_TTL_MS) return hit.ids;
  const links = await ProjectActivityLink.findAll({ where: { project_id: projectId } });
  const ids = new Set<number>();
  const byType = (t: ActivityType) => links.filter((l) => l.activity_type === t).map((l) => l.activity_id);
  const collect = (rows: Array<{ course_id?: number | null }>) =>
    rows.forEach((r) => r.course_id != null && ids.add(Number(r.course_id)));
  const a = byType("assignment");
  const q = byType("quiz");
  const m = byType("manual_assessment");
  if (a.length) collect(await Assignment.findAll({ where: { id: a }, attributes: ["id", "course_id"] }));
  if (q.length) collect(await Quiz.findAll({ where: { id: q }, attributes: ["id", "course_id"] }));
  if (m.length) collect(await ManualAssessment.findAll({ where: { id: m }, attributes: ["id", "course_id"] }));
  const out = [...ids].sort((x, y) => x - y);
  courseCache.set(projectId, { at: Date.now(), ids: out });
  return out;
}
