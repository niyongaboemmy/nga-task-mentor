import { Request, Response } from "express";
import { Op } from "sequelize";
import axios from "axios";
import { Assignment } from "../models/Assignment.model";
import { Submission } from "../models/Submission.model";
import { Quiz } from "../models/Quiz.model";
import { QuizSubmission } from "../models/QuizSubmission.model";
import { ProctoringSession } from "../models/ProctoringSession.model";
import { User } from "../models/User.model";
import { getScopedSubjects, type ScopedSubject, type SubjectScope } from "../utils/scopedSubjects";
import { loadSchoolDirectory, type SchoolDirectory } from "../services/schoolDirectory";
import { getMisToken, resolveAcademicTermId, resolveAcademicYearId } from "../utils/misUtils";
import { sendControllerError } from "../utils/controllerErrors";
import {
  buildInstructorOverview,
  InstructorOverview,
  OverviewSubject,
  RosterStudent,
} from "../services/instructorOverview.service";

/**
 * GET /api/dashboard/instructor/overview?subjectId=
 *
 * One decision board across every subject the teacher is assigned this term:
 * assignments AND quizzes (including co-teachers' ones on the same subject,
 * matching the Quizzes/Assignments pages), participation measured against the
 * class-group rosters, grading backlog, deadlines, students who need support
 * and live proctoring. Subjects come from getScopedSubjects, and every query is
 * bounded by that id list, so a forged `subjectId` returns 404.
 */

const ROSTER_TTL_MS = 5 * 60 * 1000;
const rosterCache = new Map<string, { at: number; students: RosterStudent[] }>();

// The top-bar notification bell polls this endpoint from every page, so a
// finished overview is reused briefly per (user, term, subject). `?fresh=1`
// (the dashboard's Refresh button) bypasses it.
const OVERVIEW_TTL_MS = 60 * 1000;
const OVERVIEW_CACHE_MAX = 500;
const overviewCache = new Map<string, { at: number; body: unknown }>();

/** Test hook: forget cached overviews. */
export function clearInstructorOverviewCache() {
  overviewCache.clear();
}

interface AssignedSubjectRaw {
  subject_id?: number;
  id?: number;
  grades?: Array<{ class_group_id?: number; class_group_name?: string; grade_name?: string; academic_year_id?: number }>;
}

async function fetchAssignedSubjects(req: Request, termId: number | null): Promise<AssignedSubjectRaw[] | null> {
  const token = getMisToken(req, { quiet: true });
  if (!token) return null;
  try {
    const res = await axios.get(`${process.env.NGA_MIS_BASE_URL}/academics/my-assigned-subjects`, {
      headers: { Authorization: `Bearer ${token}` },
      params: termId ? { academic_term_id: termId } : {},
    });
    return res.data?.data ?? [];
  } catch (e: any) {
    console.warn("instructorOverview: my-assigned-subjects failed:", e.message);
    return null;
  }
}

async function fetchClassGroupRoster(
  req: Request,
  classGroupId: number,
  className: string,
  yearId: number | null,
): Promise<RosterStudent[] | null> {
  const key = `${classGroupId}:${yearId ?? ""}`;
  const hit = rosterCache.get(key);
  if (hit && Date.now() - hit.at < ROSTER_TTL_MS) return hit.students;
  const token = getMisToken(req, { quiet: true });
  if (!token) return null;
  try {
    const res = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/academics/class-groups/${classGroupId}/students`,
      { headers: { Authorization: `Bearer ${token}` }, params: yearId ? { academic_year_id: yearId } : {} },
    );
    const students: RosterStudent[] = [];
    for (const s of res.data?.data ?? []) {
      const id = Number(s.user_id);
      if (!Number.isFinite(id)) continue;
      students.push({
        mis_user_id: id,
        name: [s.first_name, s.last_name].filter(Boolean).join(" ") || s.username || `Student #${id}`,
        class_group_name: className,
      });
    }
    rosterCache.set(key, { at: Date.now(), students });
    return students;
  } catch (e: any) {
    console.warn(`instructorOverview: roster for class group ${classGroupId} failed:`, e.message);
    return null;
  }
}

export interface OverviewResult {
  scope: SubjectScope;
  /** Every subject the caller may see (not narrowed by subjectId). */
  scoped: ScopedSubject[];
  overview: InstructorOverview;
  /** Loaded for school-wide callers only. */
  directory: SchoolDirectory | null;
  term_id: number | null;
  year_id: number | null;
}

export class SubjectOutOfScopeError extends Error {}

/**
 * Loads and builds the overview for the caller's subject scope. Shared by the
 * teacher dashboard (scope "assigned") and the admin dashboard, subjects and
 * students reports (scope "all"), so a number never differs between them.
 * Throws SubjectOutOfScopeError for a subjectId outside the caller's scope.
 */
export async function computeOverview(
  req: Request,
  opts: { subjectId?: number | null; fresh?: boolean; includeAllStudents?: boolean } = {},
): Promise<OverviewResult> {
  const termId = await resolveAcademicTermId(req);
  const { scope, subjects: scoped } = await getScopedSubjects(req);

  const subjectIdParam = opts.subjectId ?? null;
  if (subjectIdParam != null && !scoped.some((s) => s.id === subjectIdParam)) {
    throw new SubjectOutOfScopeError("Subject not found in your assigned subjects");
  }
  const cacheKey = [
    req.user?.id,
    termId ?? "",
    subjectIdParam ?? "",
    opts.includeAllStudents ? "all-students" : "",
    scoped.map((s) => s.id).join(","),
  ].join(":");
  const cached = overviewCache.get(cacheKey);
  if (!opts.fresh && cached && Date.now() - cached.at < OVERVIEW_TTL_MS) return cached.body as OverviewResult;

  const inScope = subjectIdParam != null ? scoped.filter((s) => s.id === subjectIdParam) : scoped;
  const ids = inScope.map((s) => s.id);

  // Class groups (and so rosters) come from the teacher's own assignments, or,
  // for a school-wide viewer, from the MIS teacher-assignment list.
  const assignedRaw = scope === "assigned" ? await fetchAssignedSubjects(req, termId) : null;
  const groupsBySubject = new Map<number, Array<{ id: number; name: string }>>();
  let yearId: number | null = null;
  for (const raw of assignedRaw ?? []) {
    const sid = Number(raw.subject_id ?? raw.id);
    const list: Array<{ id: number; name: string }> = [];
    for (const g of raw.grades ?? []) {
      const cg = Number(g.class_group_id);
      if (!Number.isFinite(cg)) continue;
      yearId = yearId ?? (g.academic_year_id ? Number(g.academic_year_id) : null);
      if (!list.some((x) => x.id === cg)) list.push({ id: cg, name: g.class_group_name || g.grade_name || `Class ${cg}` });
    }
    groupsBySubject.set(sid, list);
  }

  let directory: SchoolDirectory | null = null;
  if (scope === "all") {
    yearId = await resolveAcademicYearId(req);
    directory = await loadSchoolDirectory(req, yearId, { fresh: opts.fresh });
    const groupName = new Map(directory.class_groups.map((g) => [g.id, g.name]));
    for (const id of ids) {
      groupsBySubject.set(
        id,
        (directory.subject_class_groups.get(id) ?? []).map((cg) => ({ id: cg, name: groupName.get(cg) ?? `Class ${cg}` })),
      );
    }
  }

  const subjects: OverviewSubject[] = inScope.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    class_groups: (groupsBySubject.get(s.id) ?? []).map((g) => g.name),
    ...(directory ? { teachers: (directory.subject_teachers.get(s.id) ?? []).map((t) => t.name) } : {}),
  }));

  let rosters: Map<number, RosterStudent[]> | null = null;
  if (directory) {
    // A partial roster would understate participation, so all or nothing.
    if (directory.rosters_complete && directory.assignments_available) {
      const byMis = new Map(directory.students.map((st) => [st.mis_user_id, st]));
      const groupName = new Map(directory.class_groups.map((g) => [g.id, g.name]));
      rosters = new Map();
      for (const id of ids) {
        const byId = new Map<number, RosterStudent>();
        for (const g of groupsBySubject.get(id) ?? []) {
          for (const misId of directory.rosters.get(g.id) ?? []) {
            const st = byMis.get(misId);
            byId.set(misId, {
              mis_user_id: misId,
              name: st?.name ?? `Student #${misId}`,
              class_group_name: groupName.get(st?.class_group_id ?? g.id) ?? g.name,
            });
          }
        }
        rosters.set(id, [...byId.values()]);
      }
    }
  } else if (assignedRaw && ids.some((id) => (groupsBySubject.get(id) ?? []).length > 0)) {
    yearId = yearId ?? (await resolveAcademicYearId(req));
    const uniqueGroups = new Map<number, string>();
    for (const id of ids) for (const g of groupsBySubject.get(id) ?? []) uniqueGroups.set(g.id, g.name);
    const loaded = new Map<number, RosterStudent[] | null>();
    await Promise.all(
      [...uniqueGroups].map(async ([cg, name]) => loaded.set(cg, await fetchClassGroupRoster(req, cg, name, yearId))),
    );
    // A partial roster would understate participation, so all or nothing.
    if ([...loaded.values()].every((r) => r != null)) {
      rosters = new Map();
      for (const id of ids) {
        const byId = new Map<number, RosterStudent>();
        for (const g of groupsBySubject.get(id) ?? []) for (const st of loaded.get(g.id) ?? []) byId.set(st.mis_user_id, st);
        rosters.set(id, [...byId.values()]);
      }
    }
  }

  const termWhere = termId ? { [Op.or]: [{ academic_term_id: termId }, { academic_term_id: null }] } : {};
  const [assignments, quizzes] = ids.length
    ? await Promise.all([
        Assignment.findAll({
          where: { course_id: { [Op.in]: ids }, status: { [Op.ne]: "removed" }, ...termWhere },
          attributes: ["id", "title", "course_id", "status", "due_date", "max_score", "created_at"],
          raw: true,
        }),
        Quiz.findAll({
          where: { course_id: { [Op.in]: ids }, ...termWhere },
          attributes: ["id", "title", "course_id", "status", "type", "start_date", "end_date", "require_manual_grading", "created_at"],
          raw: true,
        }),
      ])
    : [[], []];

  const assignmentIds = assignments.map((a: any) => a.id);
  const quizIds = quizzes.map((q: any) => q.id);
  const [submissions, quizSubmissions, proctoring] = await Promise.all([
    assignmentIds.length
      ? Submission.findAll({
          where: { assignment_id: { [Op.in]: assignmentIds } },
          attributes: ["id", "assignment_id", "student_id", "status", "grade", "is_late", "submitted_at", "updated_at"],
          raw: true,
        })
      : [],
    quizIds.length
      ? QuizSubmission.findAll({
          where: { quiz_id: { [Op.in]: quizIds } },
          attributes: ["id", "quiz_id", "student_id", "status", "grade_status", "percentage", "completed_at", "graded_at", "updated_at"],
          raw: true,
        })
      : [],
    quizIds.length
      ? ProctoringSession.findAll({
          where: {
            quiz_id: { [Op.in]: quizIds },
            [Op.or]: [
              { status: { [Op.in]: ["active", "paused", "flagged"] } },
              { flags_count: { [Op.gt]: 0 } },
            ],
          },
          attributes: ["id", "quiz_id", "status", "is_connected", "last_connection_time", "flags_count"],
          raw: true,
        })
      : [],
  ]);

  const studentIds = [
    ...new Set([...submissions.map((s: any) => s.student_id), ...quizSubmissions.map((s: any) => s.student_id)]),
  ];
  const users = studentIds.length
    ? await User.findAll({
        where: { id: { [Op.in]: studentIds } },
        attributes: ["id", "first_name", "last_name", "mis_user_id"],
        raw: true,
      })
    : [];

  const overview = buildInstructorOverview({
    now: new Date(),
    academic_term_id: termId,
    subjects,
    rosters,
    assignments: assignments as any[],
    quizzes: quizzes as any[],
    submissions: submissions as any[],
    quizSubmissions: quizSubmissions as any[],
    proctoring: proctoring as any[],
    users: users as any[],
    include_all_students: opts.includeAllStudents,
  });

  const result: OverviewResult = { scope, scoped, overview, directory, term_id: termId, year_id: yearId };
  if (overviewCache.size >= OVERVIEW_CACHE_MAX) {
    const oldest = overviewCache.keys().next().value;
    if (oldest !== undefined) overviewCache.delete(oldest);
  }
  overviewCache.set(cacheKey, { at: Date.now(), body: result });
  return result;
}

export const getInstructorOverview = async (req: Request, res: Response) => {
  try {
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
    const { overview, scope } = await computeOverview(req, { subjectId, fresh: req.query.fresh === "1" });
    return res.status(200).json({ success: true, data: { ...overview, scope } });
  } catch (error) {
    if (error instanceof SubjectOutOfScopeError) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return sendControllerError(res, error, "getInstructorOverview");
  }
};
