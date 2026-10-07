import { Request, Response } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import { User } from "../models";
import { sendControllerError } from "../utils/controllerErrors";
import { loadMarkSources } from "../utils/markSources";
import { fetchEnrolledStudents, getMisToken, resolveAcademicTermId } from "../utils/misUtils";
import { getScopedSubjects, type ScopedSubject } from "../utils/scopedSubjects";
import { loadStaffPlacements, loadStudentClassCohort } from "../utils/rankingCohorts";
import {
  buildStaffView,
  buildStudentSummary,
  buildStudentView,
  collectMarks,
  collectPending,
  studentKey,
  type RosterEntry,
  type SubjectInfo,
} from "../utils/overallRanking";

// @desc    Overall ranking on assignments, quizzes and recorded marks
// @route   GET /api/rankings?subjectId=&kind=&classGroupId=&gradeId=&summary=
// @access  Private (COURSES_VIEW + RANKINGS_VIEW_OWN or RANKINGS_VIEW_ALL) —
//          the view is decided by the caller's subject scope
//          (utils/scopedSubjects), never by a query parameter, and each view
//          needs its own permission:
//   - enrolled (students), RANKINGS_VIEW_OWN: their own position within
//     their current class group, per-subject standing, outstanding work and
//     suggestions. No other student's name, key or score is ever returned;
//     averages are hidden in small cohorts. classGroupId/gradeId are ignored.
//   - assigned / all (teachers, admins), RANKINGS_VIEW_ALL: a named
//     leaderboard over the subjects they teach / every subject, filterable by
//     class group and grade, with each student's place in class and grade.
//   - none, or the view's permission missing: 403.
// ?summary=1 is the top-bar chip: a student gets their overall standing only
// (StudentSummary); staff get { view: "none" } without any work done. A role
// holding neither ranking key is refused by the route before it gets here.
// A subjectId outside the caller's scope is a 403, not an empty result.

export const rankingQuerySchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
  kind: z.enum(["all", "assignment", "quiz", "recorded"]).default("all"),
  classGroupId: z.coerce.number().int().positive().optional(),
  gradeId: z.coerce.number().int().positive().optional(),
  /** Top-bar summary: the student's overall standing only, no filters. */
  summary: z.enum(["1", "true", "0", "false"]).optional().transform((v) => v === "1" || v === "true"),
});

/** Roster calls for an all-subjects leaderboard are capped and batched. */
const MAX_ROSTER_SUBJECTS = 40;
const ROSTER_CONCURRENCY = 5;

const toInfo = (s: ScopedSubject): SubjectInfo => ({
  course_id: String(s.id),
  name: s.name,
  code: s.code,
});

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Names and class groups from MIS; a failed roster just means fewer names. */
async function loadRoster(token: string, courseIds: number[], termId: number | null): Promise<RosterEntry[]> {
  if (!token || courseIds.length === 0) return [];
  const rosters = await mapLimited(courseIds.slice(0, MAX_ROSTER_SUBJECTS), ROSTER_CONCURRENCY, (id) =>
    fetchEnrolledStudents(token, id, termId).catch(() => [] as any[]),
  );
  const entries: RosterEntry[] = [];
  for (const roster of rosters) {
    for (const st of roster) {
      const misId = Number(st.user_id ?? st.id);
      if (isNaN(misId) || misId <= 0) continue;
      const name =
        `${st.first_name ?? st.profile?.first_name ?? ""} ${st.last_name ?? st.profile?.last_name ?? ""}`.trim() ||
        st.username ||
        `Student #${misId}`;
      const classGroupId = st.class_group_id !== undefined && st.class_group_id !== null ? Number(st.class_group_id) : null;
      entries.push({
        key: `m${misId}`,
        mis_user_id: misId,
        name,
        class_group_id: classGroupId,
        class_group_name: st.class_group_name ?? null,
      });
    }
  }
  return entries;
}

export const getRanking = async (req: Request, res: Response) => {
  try {
    const parsed = rankingQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid ranking filters",
        errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      });
    }
    const { kind, classGroupId, gradeId, summary } = parsed.data;
    // The summary is always the overall standing on all work.
    const subjectId = summary ? undefined : parsed.data.subjectId;

    const { scope, subjects } = await getScopedSubjects(req);
    const permissions: Set<string> = req.user?.permissions ?? new Set();
    const viewPermission = scope === "enrolled" ? "RANKINGS_VIEW_OWN" : "RANKINGS_VIEW_ALL";
    if (summary && (scope !== "enrolled" || !permissions.has(viewPermission))) {
      // The chip asks on every page; nothing to show is not an error.
      return res.status(200).json({ success: true, data: { view: "none" } });
    }
    if (scope === "none" || !permissions.has(viewPermission)) {
      return res.status(403).json({ success: false, message: "You don't have access to rankings" });
    }
    if (subjectId !== undefined && !subjects.some((s) => s.id === subjectId)) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to this subject's ranking",
      });
    }

    const available = subjects.map(toInfo);
    const courseIds = subjectId !== undefined ? [subjectId] : subjects.map((s) => s.id);
    const termId = await resolveAcademicTermId(req);
    const subjectKey = subjectId !== undefined ? String(subjectId) : null;

    if (scope === "enrolled") {
      // A student is ranked within their own class group; the class-group and
      // grade filters are staff-only and ignored here.
      const me = {
        mis_user_id: req.user?.mis_user_id ? Number(req.user.mis_user_id) : null,
        user_id: req.user?.id ? Number(req.user.id) : null,
      };
      const [sources, classCohort] = await Promise.all([
        courseIds.length
          ? loadMarkSources(req, courseIds, termId, me.mis_user_id ? [me.mis_user_id] : [])
          : Promise.resolve(null),
        loadStudentClassCohort(req, me.mis_user_id),
      ]);
      const marks = sources ? collectMarks(sources) : [];
      const pending = sources
        ? collectPending(sources, me, courseIds.map(String), new Date())
        : [];
      const view = buildStudentView({
        meKey: studentKey(me.mis_user_id, me.user_id),
        subjects: available,
        marks,
        pending,
        kind: summary ? "all" : kind,
        subjectId: subjectKey,
        classCohort,
      });
      if (summary) {
        return res.status(200).json({ success: true, data: buildStudentSummary(view) });
      }
      return res.status(200).json({ success: true, data: { ...view, available_subjects: available } });
    }

    // Staff: teachers (assigned) and admins (all).
    const sources = courseIds.length ? await loadMarkSources(req, courseIds, termId) : null;
    let marks = sources ? collectMarks(sources) : [];

    // Roster for names/class groups: the selected subject, or every subject
    // that has marks (an admin's catalogue can run to hundreds of subjects).
    const markedCourses = Array.from(new Set(marks.map((m) => Number(m.course_id))));
    const [roster, placements] = await Promise.all([
      loadRoster(getMisToken(req, { quiet: true }), subjectId !== undefined ? [subjectId] : markedCourses, termId),
      // Class groups and grades come from class rosters: the admin subject
      // roster names a student's class but not its id, and neither has grades.
      loadStaffPlacements(req, scope, courseIds, termId),
    ]);

    // With the roster in hand, recorded marks can be re-resolved against it
    // (an id on the roster is a MIS id even without a local account).
    if (sources && roster.length) {
      marks = collectMarks({ ...sources, knownMisIds: roster.map((r) => r.mis_user_id!).filter(Boolean) });
    }

    const rosterKeys = new Set(roster.map((r) => r.key));
    const offRoster = Array.from(new Set(marks.map((m) => m.key))).filter((k) => !rosterKeys.has(k));
    const localIds = offRoster.filter((k) => k.startsWith("l")).map((k) => Number(k.slice(1)));
    const misIds = offRoster.filter((k) => k.startsWith("m")).map((k) => Number(k.slice(1)));
    const fallbackUsers =
      localIds.length || misIds.length
        ? await User.findAll({
            where: {
              [Op.or]: [
                ...(localIds.length ? [{ id: { [Op.in]: localIds } }] : []),
                ...(misIds.length ? [{ mis_user_id: { [Op.in]: misIds } }] : []),
              ],
            },
            attributes: ["id", "mis_user_id", "first_name", "last_name"],
          })
        : [];
    const fallbackNames = new Map<string, { name: string; mis_user_id: number | null }>();
    for (const u of fallbackUsers) {
      const misId = u.mis_user_id ?? null;
      fallbackNames.set(studentKey(misId, u.id), {
        name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || `Student #${misId ?? u.id}`,
        mis_user_id: misId,
      });
    }

    const view = buildStaffView({
      subjects: available,
      marks,
      roster,
      fallbackNames,
      placements,
      kind,
      subjectId: subjectKey,
      classGroupId: classGroupId ?? null,
      gradeId: gradeId ?? null,
    });
    return res.status(200).json({
      success: true,
      data: { ...view, available_subjects: available, subject_scope: scope },
    });
  } catch (error: any) {
    return sendControllerError(res, error, "Failed to load the ranking");
  }
};
