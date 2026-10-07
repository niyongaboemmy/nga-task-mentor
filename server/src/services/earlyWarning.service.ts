import {
  AssignmentRow,
  MyAttemptRow,
  MySubmissionRow,
  QuizRow,
  buildStudentOverview,
} from "./studentOverview.service";

/**
 * Pure logic behind the daily early-warning push to NGA MIS
 * (PUT /early-warning/signals, see services/earlyWarningPush.ts): per student,
 * how much work fell due recently, how much of it was missed, and how their
 * marks are trending.
 *
 * Every task is classified by the student dashboard's own builder
 * (buildStudentOverview), so "my tasks", "missed" and "my score" mean exactly
 * what the student sees: a draft is not a submission, late work is refused so
 * past-due unhandled work is missed, an assignment grade "a/b" is read against
 * its own max (bare scores against the assignment max), and a quiz counts its
 * best graded finished attempt.
 *
 * Windows end at `now`: due in (now-14d, now]; marks graded in (now-30d, now]
 * and the 30 days before that.
 */

const DAY = 24 * 60 * 60 * 1000;
export const DUE_WINDOW_DAYS = 14;
export const MARKS_WINDOW_DAYS = 30;
export const FAIL_BELOW_PCT = 50;
/** MIS takes at most this many students per call. */
export const SIGNAL_BATCH_SIZE = 1000;

export interface StudentMetrics {
  due_14d: number;
  missed_14d: number;
  avg_pct_30d: number | null;
  avg_pct_prev_30d: number | null;
  failed_30d: number;
}

export interface StudentSignal {
  student_id: number;
  metrics: StudentMetrics;
}

export interface StudentWorkInput {
  now: Date;
  /** Subjects (= Task Mentor course ids) the student is enrolled in. */
  subjectIds: number[];
  /** Candidate tasks; ones outside the student's subjects are ignored. */
  assignments: AssignmentRow[];
  quizzes: QuizRow[];
  /** Only this student's rows. */
  submissions: MySubmissionRow[];
  attempts: MyAttemptRow[];
}

const ms = (v: string | null | undefined): number | null => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function computeStudentMetrics(input: StudentWorkInput): StudentMetrics {
  const nowMs = input.now.getTime();
  const overview = buildStudentOverview({
    now: input.now,
    academic_term_id: null,
    subjects: input.subjectIds.map((id) => ({ id, name: "", code: null })),
    assignments: input.assignments,
    quizzes: input.quizzes,
    quizStats: [],
    submissions: input.submissions,
    attempts: input.attempts,
  });

  const dueFrom = nowMs - DUE_WINDOW_DAYS * DAY;
  const curFrom = nowMs - MARKS_WINDOW_DAYS * DAY;
  const prevFrom = nowMs - 2 * MARKS_WINDOW_DAYS * DAY;

  let due = 0;
  let missed = 0;
  const cur: number[] = [];
  const prev: number[] = [];
  for (const t of overview.tasks) {
    const dueAt = ms(t.due_at);
    if (dueAt != null && dueAt > dueFrom && dueAt <= nowMs) {
      due++;
      if (t.state === "missed") missed++;
    }
    if (t.score_pct == null) continue;
    const gradedAt = ms(t.graded_at);
    if (gradedAt == null || gradedAt > nowMs) continue;
    if (gradedAt > curFrom) cur.push(t.score_pct);
    else if (gradedAt > prevFrom) prev.push(t.score_pct);
  }

  return {
    due_14d: due,
    missed_14d: missed,
    avg_pct_30d: avg(cur),
    avg_pct_prev_30d: avg(prev),
    failed_30d: cur.filter((p) => p < FAIL_BELOW_PCT).length,
  };
}

/** Something to report: work fell due, or a mark landed, in the windows. */
export const hasSignal = (m: StudentMetrics) =>
  m.due_14d > 0 || m.avg_pct_30d !== null || m.avg_pct_prev_30d !== null;

/** Africa/Kigali (UTC+2, no DST) calendar date of `now`, YYYY-MM-DD. */
export function kigaliDate(now: Date): string {
  return new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function chunk<T>(items: T[], size = SIGNAL_BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface RosterStudent {
  /** MIS user id -- the id MIS knows the student by. */
  mis_user_id: number;
  /** Linked Task Mentor users.id; null = never signed in, so nothing handed in. */
  local_user_id: number | null;
  subject_ids: number[];
}

/**
 * One signal per roster student with something to report, keyed by MIS id.
 * Submissions/attempts carry the local student_id; they are grouped once and
 * tasks are indexed by subject, so this is linear in the rows, not
 * students x tasks.
 */
export function buildSignals(
  now: Date,
  roster: RosterStudent[],
  rows: {
    assignments: AssignmentRow[];
    quizzes: QuizRow[];
    submissions: Array<MySubmissionRow & { student_id: number }>;
    attempts: Array<MyAttemptRow & { student_id: number }>;
  },
): StudentSignal[] {
  const bySubject = <T extends { course_id: number }>(rowsIn: T[]) => {
    const map = new Map<number, T[]>();
    for (const r of rowsIn) {
      const k = Number(r.course_id);
      const list = map.get(k);
      if (list) list.push(r);
      else map.set(k, [r]);
    }
    return map;
  };
  const byStudent = <T extends { student_id: number }>(rowsIn: T[]) => {
    const map = new Map<number, T[]>();
    for (const r of rowsIn) {
      const k = Number(r.student_id);
      const list = map.get(k);
      if (list) list.push(r);
      else map.set(k, [r]);
    }
    return map;
  };
  const assignmentsBySubject = bySubject(rows.assignments);
  const quizzesBySubject = bySubject(rows.quizzes);
  const subsByStudent = byStudent(rows.submissions);
  const attemptsByStudent = byStudent(rows.attempts);

  const out: StudentSignal[] = [];
  const seen = new Set<number>();
  for (const s of roster) {
    if (!Number.isInteger(s.mis_user_id) || s.mis_user_id <= 0 || seen.has(s.mis_user_id)) continue;
    seen.add(s.mis_user_id);
    const subjectIds = [...new Set(s.subject_ids)];
    const metrics = computeStudentMetrics({
      now,
      subjectIds,
      assignments: subjectIds.flatMap((id) => assignmentsBySubject.get(id) ?? []),
      quizzes: subjectIds.flatMap((id) => quizzesBySubject.get(id) ?? []),
      submissions: s.local_user_id != null ? subsByStudent.get(s.local_user_id) ?? [] : [],
      attempts: s.local_user_id != null ? attemptsByStudent.get(s.local_user_id) ?? [] : [],
    });
    if (hasSignal(metrics)) out.push({ student_id: s.mis_user_id, metrics });
  }
  return out;
}
