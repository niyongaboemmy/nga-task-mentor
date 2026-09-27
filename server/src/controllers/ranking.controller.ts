import { Request, Response } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import { Assignment, Quiz, QuizSubmission, Submission, User } from "../models";
import { sendControllerError } from "../utils/controllerErrors";
import { fetchManualAssessments } from "../utils/manualAssessments";
import { fetchEnrolledStudents, getMisToken, resolveAcademicTermId } from "../utils/misUtils";
import { getScopedSubjects, type ScopedSubject } from "../utils/scopedSubjects";
import {
  buildStaffView,
  buildStudentView,
  collectMarks,
  collectPending,
  studentKey,
  type MarkSources,
  type RosterEntry,
  type SubjectInfo,
} from "../utils/overallRanking";

// @desc    Overall ranking on assignments, quizzes and recorded marks
// @route   GET /api/rankings?subjectId=&kind=&classGroupId=
// @access  Private — the view is decided by the caller's subject scope
//          (utils/scopedSubjects), never by a query parameter:
//   - enrolled (students): their own position, per-subject standing,
//     outstanding work and suggestions. No other student's name, key or
//     score is ever returned; averages are hidden in small cohorts.
//   - assigned / all (teachers, admins): a named leaderboard over the
//     subjects they teach / every subject.
//   - none: 403.
// A subjectId outside the caller's scope is a 403, not an empty result.

export const rankingQuerySchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
  kind: z.enum(["all", "assignment", "quiz", "recorded"]).default("all"),
  classGroupId: z.coerce.number().int().positive().optional(),
});

/** Roster calls for an all-subjects leaderboard are capped and batched. */
const MAX_ROSTER_SUBJECTS = 40;
const ROSTER_CONCURRENCY = 5;

const toInfo = (s: ScopedSubject): SubjectInfo => ({
  course_id: String(s.id),
  name: s.name,
  code: s.code,
});

/** Assignments, quizzes and recorded marks for the courses, for everyone. */
async function loadSources(
  req: Request,
  courseIds: number[],
  termId: number | null,
  knownMisIds: number[] = [],
): Promise<MarkSources> {
  const termWhere = termId
    ? { [Op.or]: [{ academic_term_id: termId }, { academic_term_id: null }] }
    : {};

  const [assignments, quizzes] = await Promise.all([
    Assignment.findAll({
      where: {
        course_id: { [Op.in]: courseIds },
        status: { [Op.in]: ["published", "completed"] },
        ...termWhere,
      },
      attributes: ["id", "course_id", "title", "max_score", "due_date", "status"],
    }),
    Quiz.findAll({
      where: {
        course_id: { [Op.in]: courseIds },
        status: { [Op.in]: ["published", "completed"] },
        ...termWhere,
      },
      attributes: ["id", "course_id", "title", "status", "start_date", "end_date"],
    }),
  ]);

  const studentInclude = { model: User, as: "student", attributes: ["id", "mis_user_id"] };
  const [submissions, quizSubmissions, manual] = await Promise.all([
    assignments.length
      ? Submission.findAll({
          where: {
            assignment_id: { [Op.in]: assignments.map((a) => a.id!) },
            status: { [Op.ne]: "draft" },
          },
          attributes: ["assignment_id", "grade", "status", "student_id", "submitted_at"],
          include: [studentInclude],
        })
      : [],
    quizzes.length
      ? QuizSubmission.findAll({
          where: { quiz_id: { [Op.in]: quizzes.map((q) => q.id) }, status: "completed" },
          attributes: ["quiz_id", "percentage", "total_score", "student_id", "completed_at"],
          include: [studentInclude],
        })
      : [],
    fetchManualAssessments(req, courseIds, "all"),
  ]);

  const manualScores: MarkSources["manualScores"] = [];
  for (const [assessmentId, bucket] of manual.scoresByAssessment) {
    for (const [studentId, score] of bucket) {
      manualScores.push({ manual_assessment_id: assessmentId, student_id: Number(studentId), score });
    }
  }
  const scoreIds = Array.from(new Set(manualScores.map((s) => s.student_id)));
  const localUsers = scoreIds.length
    ? await User.findAll({
        where: {
          [Op.or]: [{ id: { [Op.in]: scoreIds } }, { mis_user_id: { [Op.in]: scoreIds } }],
        },
        attributes: ["id", "mis_user_id"],
      })
    : [];

  return {
    assignments: assignments.map((a: any) => a.toJSON()),
    submissions: submissions.map((s: any) => s.toJSON()),
    quizzes: quizzes.map((q: any) => q.toJSON()),
    quizSubmissions: quizSubmissions.map((s: any) => s.toJSON()),
    manual: manual.assessments.map((a) => ({
      id: a.id!,
      course_id: a.course_id,
      title: a.title,
      counts_to_final: a.add_to_final_grade !== false,
      max_score: Number(a.max_score) || 0,
      date: a.assessment_date ?? null,
    })),
    manualScores,
    localUsers: localUsers.map((u) => ({ id: u.id, mis_user_id: u.mis_user_id ?? null })),
    knownMisIds,
  };
}

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
    const { subjectId, kind, classGroupId } = parsed.data;

    const { scope, subjects } = await getScopedSubjects(req);
    if (scope === "none") {
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
      // Students never get a class-group view: that filter is staff-only.
      const me = {
        mis_user_id: req.user?.mis_user_id ? Number(req.user.mis_user_id) : null,
        user_id: req.user?.id ? Number(req.user.id) : null,
      };
      const sources = courseIds.length
        ? await loadSources(req, courseIds, termId, me.mis_user_id ? [me.mis_user_id] : [])
        : null;
      const marks = sources ? collectMarks(sources) : [];
      const pending = sources
        ? collectPending(sources, me, courseIds.map(String), new Date())
        : [];
      const view = buildStudentView({
        meKey: studentKey(me.mis_user_id, me.user_id),
        subjects: available,
        marks,
        pending,
        kind,
        subjectId: subjectKey,
      });
      return res.status(200).json({ success: true, data: { ...view, available_subjects: available } });
    }

    // Staff: teachers (assigned) and admins (all).
    const sources = courseIds.length ? await loadSources(req, courseIds, termId) : null;
    let marks = sources ? collectMarks(sources) : [];

    // Roster for names/class groups: the selected subject, or every subject
    // that has marks (an admin's catalogue can run to hundreds of subjects).
    const markedCourses = Array.from(new Set(marks.map((m) => Number(m.course_id))));
    const roster = await loadRoster(
      getMisToken(req, { quiet: true }),
      subjectId !== undefined ? [subjectId] : markedCourses,
      termId,
    );

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
      kind,
      subjectId: subjectKey,
      classGroupId: classGroupId ?? null,
    });
    return res.status(200).json({
      success: true,
      data: { ...view, available_subjects: available, subject_scope: scope },
    });
  } catch (error: any) {
    return sendControllerError(res, error, "Failed to load the ranking");
  }
};
