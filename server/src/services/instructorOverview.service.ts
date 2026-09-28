import { parseAssignmentGrade } from "./reportCardGrader.service";

/**
 * Pure analytics behind the instructor dashboard
 * (GET /api/dashboard/instructor/overview). The controller loads rows; this
 * turns them into the decision board. Kept free of Sequelize/MIS so every
 * number on the dashboard is unit-testable.
 *
 * Scoring rules match the student profile (see services/studentActivity.ts on
 * the client): drafts aren't submissions, an assignment grade "a/b" is read
 * against its own max, a quiz counts its best graded completed attempt, a
 * student's subject average is the mean of their items, and an overall average
 * is the mean of subject averages rather than pooled items.
 */

export const PASS_MARK = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
export const TREND_WEEKS = 10;
/** A submission waiting longer than this for a grade is "overdue grading". */
export const GRADING_SLA_DAYS = 7;
export const UPCOMING_WINDOW_DAYS = 14;
/** A proctoring session with no heartbeat for this long isn't really live. */
export const LIVE_HEARTBEAT_MINUTES = 10;

export const SCORE_BANDS = [
  { key: "0-39", min: 0, max: 40 },
  { key: "40-49", min: 40, max: 50 },
  { key: "50-59", min: 50, max: 60 },
  { key: "60-69", min: 60, max: 70 },
  { key: "70-79", min: 70, max: 80 },
  { key: "80-89", min: 80, max: 90 },
  { key: "90-100", min: 90, max: Infinity },
] as const;

// ─── Input rows ────────────────────────────────────────────────────────────────

export interface OverviewSubject {
  id: number;
  name: string;
  code: string | null;
  class_groups: string[];
  /** Who teaches it (school-wide views); omitted for a teacher's own view. */
  teachers?: string[];
}

export interface RosterStudent {
  mis_user_id: number;
  name: string;
  class_group_name: string | null;
}

export interface AssignmentRow {
  id: number;
  title: string;
  course_id: number;
  status: string;
  due_date: Date | string | null;
  max_score: number | null;
  created_at?: Date | string | null;
}

export interface QuizRow {
  id: number;
  title: string;
  course_id: number;
  status: string;
  type?: string | null;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  require_manual_grading?: boolean;
  created_at?: Date | string | null;
}

export interface SubmissionRow {
  id: number;
  assignment_id: number;
  student_id: number;
  status: string;
  grade?: string | null;
  is_late?: boolean;
  submitted_at?: Date | string | null;
  updated_at?: Date | string | null;
}

export interface QuizSubmissionRow {
  id: number;
  quiz_id: number;
  student_id: number;
  status: string;
  grade_status: string;
  percentage: number | string | null;
  completed_at?: Date | string | null;
  graded_at?: Date | string | null;
  updated_at?: Date | string | null;
}

export interface ProctoringRow {
  id: number;
  quiz_id: number;
  status: string;
  is_connected?: boolean;
  last_connection_time?: Date | string | null;
  flags_count?: number;
}

export interface LocalUserRow {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  mis_user_id?: number | null;
}

export interface OverviewInput {
  now: Date;
  academic_term_id: number | null;
  subjects: OverviewSubject[];
  /** subject id -> roster; absent when MIS rosters couldn't be loaded. */
  rosters: Map<number, RosterStudent[]> | null;
  assignments: AssignmentRow[];
  quizzes: QuizRow[];
  submissions: SubmissionRow[];
  quizSubmissions: QuizSubmissionRow[];
  proctoring: ProctoringRow[];
  users: LocalUserRow[];
  /** Also return every student's summary (students.all) — the admin directory. */
  include_all_students?: boolean;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export type SubjectHealth = "on_track" | "watch" | "at_risk" | "no_data";
export type AlertSeverity = "critical" | "warning" | "info" | "success";
export type AssessmentKind = "assignment" | "quiz";

export interface AssessmentSummary {
  id: number;
  kind: AssessmentKind;
  title: string;
  subject_id: number;
  subject_code: string | null;
  subject_name: string;
  status: string;
  quiz_type: string | null;
  due_at: string | null;
  is_closed: boolean;
  submitted: number;
  expected: number | null;
  participation: number | null;
  pending: number;
  graded: number;
  late: number;
  avg_score: number | null;
  pass_rate: number | null;
  url: string;
}

export interface SubjectSummary {
  subject_id: number;
  subject_name: string;
  subject_code: string | null;
  class_groups: string[];
  teachers: string[];
  students: number | null;
  assignments: number;
  quizzes: number;
  published: number;
  drafts: number;
  submissions: number;
  pending: number;
  overdue_pending: number;
  graded: number;
  avg_score: number | null;
  pass_rate: number | null;
  participation: number | null;
  late_rate: number | null;
  missing: number;
  at_risk: number;
  next_due: { title: string; kind: AssessmentKind; due_at: string; url: string } | null;
  last_activity_at: string | null;
  health: SubjectHealth;
  health_reasons: string[];
}

export interface StudentSummary {
  mis_user_id: number | null;
  local_id: number | null;
  name: string;
  class_group_name: string | null;
  avg_score: number | null;
  graded_count: number;
  missing: number;
  subjects: string[];
  reasons: string[];
  url: string | null;
}

export interface GradingQueueItem {
  id: number;
  kind: AssessmentKind;
  title: string;
  subject_id: number;
  subject_code: string | null;
  subject_name: string;
  pending: number;
  oldest_at: string | null;
  waiting_days: number;
  url: string;
}

export interface DashboardAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  subject_id: number | null;
  action?: { label: string; url: string };
}

export interface InstructorOverview {
  generated_at: string;
  academic_term_id: number | null;
  rosters_available: boolean;
  totals: {
    subjects: number;
    class_groups: number;
    students: number | null;
    assessments: number;
    assignments: number;
    quizzes: number;
    published: number;
    drafts: number;
    submissions: number;
    pending_grading: number;
    overdue_grading: number;
    graded: number;
    avg_score: number | null;
    pass_rate: number | null;
    participation: number | null;
    late_rate: number | null;
    at_risk_students: number;
    missing_work: number;
    /** Rolling window, so a Sunday view still shows Monday's deadlines. */
    due_next_7_days: number;
    live_proctoring: number;
    stale_proctoring: number;
    flagged_sessions: number;
    submissions_this_week: number;
    submissions_last_week: number;
    /** Work turned in during the last 24 hours. */
    new_submissions_24h: number;
    graded_this_week: number;
    graded_last_week: number;
  };
  subjects: SubjectSummary[];
  trend: Array<{ week_start: string; submissions: number; graded: number; avg_score: number | null }>;
  distribution: Array<{ band: string; count: number }>;
  grading_queue: GradingQueueItem[];
  upcoming: AssessmentSummary[];
  assessments: AssessmentSummary[];
  students: { at_risk: StudentSummary[]; top: StudentSummary[]; all?: StudentSummary[] };
  alerts: DashboardAlert[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDate = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pctOf = (part: number, whole: number) => (whole > 0 ? round1((part / whole) * 100) : null);
const clampPct = (n: number) => Math.max(0, Math.min(100, n));

/** Monday 00:00 UTC of the week containing `d`. */
export function weekStart(d: Date): Date {
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
}

export function bandOf(pct: number): string {
  const p = clampPct(pct);
  return (SCORE_BANDS.find((b) => p >= b.min && p < b.max) ?? SCORE_BANDS[SCORE_BANDS.length - 1]).key;
}

const PENDING_ASSIGNMENT = new Set(["submitted", "late", "resubmitted"]);
const FINISHED_QUIZ = new Set(["completed", "timed_out"]);
const GRADED_QUIZ = new Set(["graded", "auto_graded"]);
const LIVE_ASSESSMENT = new Set(["published", "completed"]);

function subjectHealth(s: Omit<SubjectSummary, "health" | "health_reasons">): {
  health: SubjectHealth;
  reasons: string[];
} {
  const reasons: string[] = [];
  let severity = 0; // 0 on track, 1 watch, 2 at risk
  if (s.published === 0 && s.submissions === 0) {
    return { health: "no_data", reasons: ["No published assessments this term"] };
  }
  if (s.avg_score != null) {
    if (s.avg_score < PASS_MARK) {
      severity = 2;
      reasons.push(`Class average ${s.avg_score}% is below the ${PASS_MARK}% pass mark`);
    } else if (s.avg_score < 60) {
      severity = Math.max(severity, 1);
      reasons.push(`Class average ${s.avg_score}% is close to the pass mark`);
    }
  }
  if (s.participation != null) {
    if (s.participation < 50) {
      severity = 2;
      reasons.push(`Only ${s.participation}% of expected work has been submitted`);
    } else if (s.participation < 75) {
      severity = Math.max(severity, 1);
      reasons.push(`Participation is ${s.participation}%`);
    }
  }
  if (s.overdue_pending > 0) {
    severity = Math.max(severity, 1);
    reasons.push(`${s.overdue_pending} submission(s) waiting over ${GRADING_SLA_DAYS} days to be graded`);
  }
  if (s.students != null && s.students > 0 && s.at_risk / s.students >= 0.25) {
    severity = Math.max(severity, 1);
    reasons.push(`${s.at_risk} of ${s.students} students need attention`);
  }
  if (severity === 0) reasons.push("Scores, participation and grading are on track");
  return { health: severity === 2 ? "at_risk" : severity === 1 ? "watch" : "on_track", reasons };
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildInstructorOverview(input: OverviewInput): InstructorOverview {
  const { now } = input;
  const nowMs = now.getTime();
  const subjectById = new Map(input.subjects.map((s) => [s.id, s]));
  const userById = new Map(input.users.map((u) => [u.id, u]));
  const misOfLocal = (localId: number) => userById.get(localId)?.mis_user_id ?? null;

  // Roster lookups. A student is identified by MIS id where we know it, and by
  // "local:<id>" otherwise, so submitters missing from the roster still count.
  const rosterBySubject = new Map<number, Map<number, RosterStudent>>();
  const rosterStudent = new Map<number, RosterStudent>();
  if (input.rosters) {
    for (const [sid, list] of input.rosters) {
      const m = new Map<number, RosterStudent>();
      for (const st of list) {
        m.set(st.mis_user_id, st);
        if (!rosterStudent.has(st.mis_user_id)) rosterStudent.set(st.mis_user_id, st);
      }
      rosterBySubject.set(sid, m);
    }
  }
  const studentKey = (localId: number) => {
    const mis = misOfLocal(localId);
    return mis != null ? `mis:${mis}` : `local:${localId}`;
  };

  // ── Per-assessment aggregation ──
  interface Acc {
    summary: AssessmentSummary;
    submitters: Set<string>;
    scores: Map<string, number>; // student -> best %
    pendingDates: Date[];
  }
  const accs: Acc[] = [];
  const newAcc = (
    kind: AssessmentKind,
    row: { id: number; title: string; course_id: number; status: string },
    due: Date | null,
    extra: Partial<AssessmentSummary>,
  ): Acc | null => {
    const subject = subjectById.get(row.course_id);
    if (!subject) return null;
    const roster = rosterBySubject.get(subject.id);
    const summary: AssessmentSummary = {
      id: row.id,
      kind,
      title: row.title,
      subject_id: subject.id,
      subject_code: subject.code,
      subject_name: subject.name,
      status: row.status,
      quiz_type: null,
      due_at: iso(due),
      is_closed: row.status === "completed" || (due != null && due.getTime() < nowMs),
      submitted: 0,
      expected: roster ? roster.size : null,
      participation: null,
      pending: 0,
      graded: 0,
      late: 0,
      avg_score: null,
      pass_rate: null,
      url: kind === "assignment" ? `/assignments/${row.id}` : `/quizzes/${row.id}/submissions`,
      ...extra,
    };
    const acc: Acc = { summary, submitters: new Set(), scores: new Map(), pendingDates: [] };
    accs.push(acc);
    return acc;
  };

  const assignmentAcc = new Map<number, Acc>();
  for (const a of input.assignments) {
    if (a.status === "removed") continue;
    const acc = newAcc("assignment", a, toDate(a.due_date), {});
    if (acc) assignmentAcc.set(a.id, acc);
  }
  const quizAcc = new Map<number, Acc>();
  for (const q of input.quizzes) {
    const acc = newAcc("quiz", q, toDate(q.end_date), { quiz_type: q.type ?? null });
    if (acc) quizAcc.set(q.id, acc);
  }

  // Event streams for the weekly trend.
  const submittedEvents: Date[] = [];
  const gradedEvents: Array<{ at: Date; pct: number }> = [];
  // student -> subject -> item percentages
  const studentScores = new Map<string, Map<number, number[]>>();
  const localOfKey = new Map<string, number>();

  const recordScore = (key: string, subjectId: number, pct: number) => {
    const bySubject = studentScores.get(key) ?? new Map<number, number[]>();
    const list = bySubject.get(subjectId) ?? [];
    list.push(pct);
    bySubject.set(subjectId, list);
    studentScores.set(key, bySubject);
  };

  for (const s of input.submissions) {
    const acc = assignmentAcc.get(s.assignment_id);
    if (!acc || s.status === "draft") continue;
    const key = studentKey(s.student_id);
    localOfKey.set(key, s.student_id);
    acc.submitters.add(key);
    acc.summary.submitted = acc.submitters.size;
    if (s.is_late || s.status === "late") acc.summary.late++;
    const submittedAt = toDate(s.submitted_at) ?? toDate(s.updated_at);
    if (submittedAt) submittedEvents.push(submittedAt);
    if (s.status === "graded") {
      acc.summary.graded++;
      const parsed = parseAssignmentGrade(s.grade ?? null);
      if (parsed) {
        const pct = clampPct((parsed.raw_score / parsed.max_score) * 100);
        acc.scores.set(key, Math.max(acc.scores.get(key) ?? -1, pct));
        const gradedAt = toDate(s.updated_at);
        if (gradedAt) gradedEvents.push({ at: gradedAt, pct });
      }
    } else if (PENDING_ASSIGNMENT.has(s.status)) {
      acc.summary.pending++;
      if (submittedAt) acc.pendingDates.push(submittedAt);
    }
  }

  for (const qs of input.quizSubmissions) {
    const acc = quizAcc.get(qs.quiz_id);
    if (!acc || !FINISHED_QUIZ.has(qs.status)) continue;
    const key = studentKey(qs.student_id);
    localOfKey.set(key, qs.student_id);
    acc.submitters.add(key);
    acc.summary.submitted = acc.submitters.size;
    const completedAt = toDate(qs.completed_at) ?? toDate(qs.updated_at);
    if (completedAt) submittedEvents.push(completedAt);
    if (GRADED_QUIZ.has(qs.grade_status)) {
      acc.summary.graded++;
      const pct = clampPct(Number(qs.percentage ?? 0));
      acc.scores.set(key, Math.max(acc.scores.get(key) ?? -1, pct));
      const gradedAt = toDate(qs.graded_at) ?? completedAt;
      if (gradedAt) gradedEvents.push({ at: gradedAt, pct });
    } else {
      acc.summary.pending++;
      if (completedAt) acc.pendingDates.push(completedAt);
    }
  }

  // Finalise each assessment and fan scores out to students.
  const allItemScores: number[] = [];
  for (const acc of accs) {
    const s = acc.summary;
    const scores = [...acc.scores.values()];
    s.avg_score = scores.length ? round1(mean(scores)!) : null;
    s.pass_rate = scores.length ? pctOf(scores.filter((p) => p >= PASS_MARK).length, scores.length) : null;
    s.participation = s.expected ? Math.min(100, pctOf(s.submitted, s.expected) ?? 0) : null;
    for (const [key, pct] of acc.scores) {
      recordScore(key, s.subject_id, pct);
      allItemScores.push(pct);
    }
  }

  // Missing work: roster students with nothing turned in for a closed, live assessment.
  const missingByStudent = new Map<string, number>();
  const missingBySubject = new Map<number, number>();
  const missingByStudentSubject = new Map<string, number>(); // `${key}|${subjectId}`
  for (const acc of accs) {
    const s = acc.summary;
    if (!s.is_closed || !LIVE_ASSESSMENT.has(s.status)) continue;
    const roster = rosterBySubject.get(s.subject_id);
    if (!roster) continue;
    for (const misId of roster.keys()) {
      const key = `mis:${misId}`;
      if (acc.submitters.has(key)) continue;
      missingByStudent.set(key, (missingByStudent.get(key) ?? 0) + 1);
      const ks = `${key}|${s.subject_id}`;
      missingByStudentSubject.set(ks, (missingByStudentSubject.get(ks) ?? 0) + 1);
      missingBySubject.set(s.subject_id, (missingBySubject.get(s.subject_id) ?? 0) + 1);
    }
  }

  // ── Students ──
  const allStudentKeys = new Set<string>([...studentScores.keys(), ...missingByStudent.keys()]);
  for (const r of rosterBySubject.values()) for (const misId of r.keys()) allStudentKeys.add(`mis:${misId}`);

  const studentSummaries: StudentSummary[] = [];
  const atRiskBySubject = new Map<number, number>();
  for (const key of allStudentKeys) {
    const bySubject = studentScores.get(key) ?? new Map<number, number[]>();
    const subjectAverages = [...bySubject.values()].map((xs) => mean(xs)!);
    const avg = subjectAverages.length ? round1(mean(subjectAverages)!) : null;
    const graded = [...bySubject.values()].reduce((n, xs) => n + xs.length, 0);
    const missing = missingByStudent.get(key) ?? 0;

    const misId = key.startsWith("mis:") ? Number(key.slice(4)) : null;
    const localId = localOfKey.get(key) ?? (key.startsWith("local:") ? Number(key.slice(6)) : null);
    const roster = misId != null ? rosterStudent.get(misId) : undefined;
    const local = localId != null ? userById.get(localId) : undefined;
    const name =
      roster?.name ||
      [local?.first_name, local?.last_name].filter(Boolean).join(" ") ||
      (misId != null ? `Student #${misId}` : `Student #${localId}`);

    const subjectIds = new Set<number>(bySubject.keys());
    if (misId != null) {
      for (const [sid, r] of rosterBySubject) if (r.has(misId)) subjectIds.add(sid);
    }
    const reasons: string[] = [];
    if (avg != null && avg < PASS_MARK) reasons.push(`Average ${avg}%`);
    const failingSubjects = [...bySubject.entries()].filter(([, xs]) => mean(xs)! < PASS_MARK);
    if (failingSubjects.length > 0 && (avg == null || avg >= PASS_MARK)) {
      reasons.push(
        `Below ${PASS_MARK}% in ${failingSubjects
          .map(([sid]) => subjectById.get(sid)?.code || subjectById.get(sid)?.name)
          .join(", ")}`,
      );
    }
    if (missing >= 2) reasons.push(`${missing} missing submissions`);

    const summary: StudentSummary = {
      mis_user_id: misId,
      local_id: localId,
      name,
      class_group_name: roster?.class_group_name ?? null,
      avg_score: avg,
      graded_count: graded,
      missing,
      subjects: [...subjectIds].map((sid) => subjectById.get(sid)?.code || subjectById.get(sid)?.name || `#${sid}`),
      reasons,
      url: misId != null ? `/students/${misId}` : null,
    };
    studentSummaries.push(summary);
    if (reasons.length > 0) {
      // Count the student against a subject only where the problem is: failing
      // there, or missing work there (not merely enrolled in it).
      for (const sid of subjectIds) {
        const xs = bySubject.get(sid);
        const failingHere = xs ? mean(xs)! < PASS_MARK : false;
        const missingHere = missingByStudentSubject.get(`${key}|${sid}`) ?? 0;
        if (failingHere || (missing >= 2 && missingHere > 0)) {
          atRiskBySubject.set(sid, (atRiskBySubject.get(sid) ?? 0) + 1);
        }
      }
    }
  }
  const atRisk = studentSummaries
    .filter((s) => s.reasons.length > 0)
    .sort((a, b) => (a.avg_score ?? 101) - (b.avg_score ?? 101) || b.missing - a.missing);
  const top = studentSummaries
    .filter((s) => s.avg_score != null && s.graded_count >= 2 && s.avg_score >= PASS_MARK)
    .sort((a, b) => b.avg_score! - a.avg_score! || b.graded_count - a.graded_count);

  // ── Subjects ──
  const overdueCutoff = nowMs - GRADING_SLA_DAYS * DAY_MS;
  const subjects: SubjectSummary[] = input.subjects.map((subject) => {
    const mine = accs.filter((a) => a.summary.subject_id === subject.id);
    const live = mine.filter((a) => LIVE_ASSESSMENT.has(a.summary.status));
    const roster = rosterBySubject.get(subject.id);
    const submissions = mine.reduce((n, a) => n + a.summary.submitted, 0);
    const late = mine.reduce((n, a) => n + a.summary.late, 0);
    const pending = mine.reduce((n, a) => n + a.summary.pending, 0);
    const overdue = mine.reduce((n, a) => n + a.pendingDates.filter((d) => d.getTime() < overdueCutoff).length, 0);

    // Per-student subject averages -> class average.
    const studentAverages: number[] = [];
    for (const bySubject of studentScores.values()) {
      const xs = bySubject.get(subject.id);
      if (xs?.length) studentAverages.push(mean(xs)!);
    }
    const closedLive = live.filter((a) => a.summary.is_closed);
    const expectedClosed = roster ? closedLive.length * roster.size : 0;
    const submittedClosed = closedLive.reduce((n, a) => n + Math.min(a.summary.submitted, roster?.size ?? Infinity), 0);

    const upcoming = live
      .filter((a) => a.summary.due_at && new Date(a.summary.due_at).getTime() >= nowMs)
      .sort((a, b) => a.summary.due_at!.localeCompare(b.summary.due_at!))[0];

    const activity: number[] = [];
    for (const a of mine) for (const d of a.pendingDates) activity.push(d.getTime());
    const lastAt = activity.length ? new Date(Math.max(...activity)) : null;

    const base = {
      subject_id: subject.id,
      subject_name: subject.name,
      subject_code: subject.code,
      class_groups: subject.class_groups,
      teachers: subject.teachers ?? [],
      students: roster ? roster.size : null,
      assignments: mine.filter((a) => a.summary.kind === "assignment").length,
      quizzes: mine.filter((a) => a.summary.kind === "quiz").length,
      published: live.length,
      drafts: mine.filter((a) => a.summary.status === "draft").length,
      submissions,
      pending,
      overdue_pending: overdue,
      graded: mine.reduce((n, a) => n + a.summary.graded, 0),
      avg_score: studentAverages.length ? round1(mean(studentAverages)!) : null,
      pass_rate: studentAverages.length
        ? pctOf(studentAverages.filter((p) => p >= PASS_MARK).length, studentAverages.length)
        : null,
      participation: expectedClosed > 0 ? pctOf(submittedClosed, expectedClosed) : null,
      late_rate: submissions > 0 ? pctOf(late, submissions) : null,
      missing: missingBySubject.get(subject.id) ?? 0,
      at_risk: atRiskBySubject.get(subject.id) ?? 0,
      next_due: upcoming
        ? {
            title: upcoming.summary.title,
            kind: upcoming.summary.kind,
            due_at: upcoming.summary.due_at!,
            url: upcoming.summary.url,
          }
        : null,
      last_activity_at: iso(lastAt),
    };
    const { health, reasons } = subjectHealth(base);
    return { ...base, health, health_reasons: reasons };
  });

  // Last activity should reflect every submission, not only pending ones.
  const lastSubmissionBySubject = new Map<number, number>();
  const bump = (sid: number | undefined, d: Date | null) => {
    if (sid == null || !d) return;
    lastSubmissionBySubject.set(sid, Math.max(lastSubmissionBySubject.get(sid) ?? 0, d.getTime()));
  };
  for (const s of input.submissions) {
    if (s.status !== "draft") bump(assignmentAcc.get(s.assignment_id)?.summary.subject_id, toDate(s.submitted_at) ?? toDate(s.updated_at));
  }
  for (const qs of input.quizSubmissions) {
    if (FINISHED_QUIZ.has(qs.status)) bump(quizAcc.get(qs.quiz_id)?.summary.subject_id, toDate(qs.completed_at) ?? toDate(qs.updated_at));
  }
  for (const s of subjects) {
    const at = lastSubmissionBySubject.get(s.subject_id);
    if (at) s.last_activity_at = new Date(at).toISOString();
  }

  // ── Trend ──
  const thisWeek = weekStart(now);
  const weeks = Array.from({ length: TREND_WEEKS }, (_, i) =>
    new Date(thisWeek.getTime() - (TREND_WEEKS - 1 - i) * 7 * DAY_MS),
  );
  const weekIndex = (d: Date) => {
    const idx = Math.floor((weekStart(d).getTime() - weeks[0].getTime()) / (7 * DAY_MS));
    return idx >= 0 && idx < TREND_WEEKS ? idx : -1;
  };
  const trend = weeks.map((w) => ({ week_start: w.toISOString(), submissions: 0, graded: 0, scores: [] as number[] }));
  for (const d of submittedEvents) {
    const i = weekIndex(d);
    if (i >= 0) trend[i].submissions++;
  }
  for (const g of gradedEvents) {
    const i = weekIndex(g.at);
    if (i >= 0) {
      trend[i].graded++;
      trend[i].scores.push(g.pct);
    }
  }

  // ── Distribution (best score per student per assessment) ──
  const distribution = SCORE_BANDS.map((b) => ({ band: b.key, count: 0 }));
  for (const pct of allItemScores) distribution[SCORE_BANDS.findIndex((b) => b.key === bandOf(pct))].count++;

  // ── Grading queue ──
  const grading_queue: GradingQueueItem[] = accs
    .filter((a) => a.summary.pending > 0)
    .map((a) => {
      const oldest = a.pendingDates.length ? new Date(Math.min(...a.pendingDates.map((d) => d.getTime()))) : null;
      return {
        id: a.summary.id,
        kind: a.summary.kind,
        title: a.summary.title,
        subject_id: a.summary.subject_id,
        subject_code: a.summary.subject_code,
        subject_name: a.summary.subject_name,
        pending: a.summary.pending,
        oldest_at: iso(oldest),
        waiting_days: oldest ? Math.max(0, Math.floor((nowMs - oldest.getTime()) / DAY_MS)) : 0,
        url: a.summary.url,
      };
    })
    .sort((a, b) => b.waiting_days - a.waiting_days || b.pending - a.pending);

  // ── Upcoming + recent assessments ──
  const horizon = nowMs + UPCOMING_WINDOW_DAYS * DAY_MS;
  const upcoming = accs
    .map((a) => a.summary)
    .filter((s) => s.status === "published" && s.due_at && new Date(s.due_at).getTime() >= nowMs && new Date(s.due_at).getTime() <= horizon)
    .sort((a, b) => a.due_at!.localeCompare(b.due_at!));
  const assessments = accs
    .map((a) => a.summary)
    .filter((s) => LIVE_ASSESSMENT.has(s.status))
    .sort((a, b) => (b.due_at ?? "").localeCompare(a.due_at ?? ""));

  // ── Proctoring (only for the quizzes in scope) ──
  const heartbeatCutoff = nowMs - LIVE_HEARTBEAT_MINUTES * 60 * 1000;
  let live_proctoring = 0;
  let stale_proctoring = 0;
  let flagged_sessions = 0;
  for (const p of input.proctoring) {
    if (!quizAcc.has(p.quiz_id)) continue;
    if (p.status === "flagged" || (p.flags_count ?? 0) > 0) flagged_sessions++;
    if (p.status === "active" || p.status === "paused") {
      const beat = toDate(p.last_connection_time);
      if (p.is_connected && beat && beat.getTime() >= heartbeatCutoff) live_proctoring++;
      else stale_proctoring++;
    }
  }

  // ── Totals ──
  const subjectAvgs = subjects.map((s) => s.avg_score).filter((x): x is number => x != null);
  const studentAvgs = studentSummaries.map((s) => s.avg_score).filter((x): x is number => x != null);
  const rosterTotal = input.rosters ? new Set([...rosterStudent.keys()]).size : null;
  const liveSubjects = subjects.filter((s) => s.participation != null);
  const expectedAll = liveSubjects.reduce((n, s) => {
    const closed = accs.filter((a) => a.summary.subject_id === s.subject_id && a.summary.is_closed && LIVE_ASSESSMENT.has(a.summary.status)).length;
    return n + closed * (s.students ?? 0);
  }, 0);
  const submittedAll = liveSubjects.reduce((n, s) => {
    const r = rosterBySubject.get(s.subject_id)?.size ?? Infinity;
    return (
      n +
      accs
        .filter((a) => a.summary.subject_id === s.subject_id && a.summary.is_closed && LIVE_ASSESSMENT.has(a.summary.status))
        .reduce((m, a) => m + Math.min(a.summary.submitted, r), 0)
    );
  }, 0);
  const totalSubmissions = subjects.reduce((n, s) => n + s.submissions, 0);
  const totalLate = accs.reduce((n, a) => n + a.summary.late, 0);
  const weekOf = (offset: number) => trend[TREND_WEEKS - 1 - offset];
  const weekAhead = nowMs + 7 * DAY_MS;

  const totals: InstructorOverview["totals"] = {
    subjects: subjects.length,
    class_groups: new Set(input.subjects.flatMap((s) => s.class_groups)).size,
    students: rosterTotal,
    assessments: accs.length,
    assignments: accs.filter((a) => a.summary.kind === "assignment").length,
    quizzes: accs.filter((a) => a.summary.kind === "quiz").length,
    published: accs.filter((a) => LIVE_ASSESSMENT.has(a.summary.status)).length,
    drafts: accs.filter((a) => a.summary.status === "draft").length,
    submissions: totalSubmissions,
    pending_grading: subjects.reduce((n, s) => n + s.pending, 0),
    overdue_grading: subjects.reduce((n, s) => n + s.overdue_pending, 0),
    graded: subjects.reduce((n, s) => n + s.graded, 0),
    avg_score: subjectAvgs.length ? round1(mean(subjectAvgs)!) : null,
    pass_rate: studentAvgs.length ? pctOf(studentAvgs.filter((p) => p >= PASS_MARK).length, studentAvgs.length) : null,
    participation: expectedAll > 0 ? pctOf(submittedAll, expectedAll) : null,
    late_rate: totalSubmissions > 0 ? pctOf(totalLate, totalSubmissions) : null,
    at_risk_students: atRisk.length,
    missing_work: [...missingByStudent.values()].reduce((a, b) => a + b, 0),
    due_next_7_days: upcoming.filter((u) => new Date(u.due_at!).getTime() <= weekAhead).length,
    live_proctoring,
    stale_proctoring,
    flagged_sessions,
    submissions_this_week: weekOf(0).submissions,
    new_submissions_24h: submittedEvents.filter((d) => d.getTime() >= nowMs - DAY_MS && d.getTime() <= nowMs).length,
    submissions_last_week: weekOf(1).submissions,
    graded_this_week: weekOf(0).graded,
    graded_last_week: weekOf(1).graded,
  };

  return {
    generated_at: now.toISOString(),
    academic_term_id: input.academic_term_id,
    rosters_available: input.rosters != null,
    totals,
    subjects,
    trend: trend.map(({ scores, ...w }) => ({ ...w, avg_score: scores.length ? round1(mean(scores)!) : null })),
    distribution,
    grading_queue: grading_queue.slice(0, 25),
    upcoming: upcoming.slice(0, 20),
    assessments: assessments.slice(0, 40),
    students: {
      at_risk: atRisk.slice(0, 12),
      top: top.slice(0, 8),
      ...(input.include_all_students ? { all: studentSummaries } : {}),
    },
    alerts: buildAlerts({ totals, subjects, grading_queue, upcoming, assessments, nowMs }),
  };
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

/** Per-assessment alerts of one kind beyond this are folded into one summary. */
const MAX_ITEM_ALERTS = 3;
/** "Just closed" window for follow-up alerts on missing work / low scores. */
const RECENT_CLOSE_DAYS = 7;
const LOW_SCORE_MIN_RESULTS = 3;
const LOW_PARTICIPATION = 60;

const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export function buildAlerts(ctx: {
  totals: InstructorOverview["totals"];
  subjects: SubjectSummary[];
  grading_queue: GradingQueueItem[];
  upcoming: AssessmentSummary[];
  assessments?: AssessmentSummary[];
  nowMs: number;
}): DashboardAlert[] {
  const { totals, subjects, grading_queue, upcoming, nowMs } = ctx;
  const assessments = ctx.assessments ?? [];
  const alerts: DashboardAlert[] = [];
  const label = (s: { subject_code: string | null; subject_name: string }) => s.subject_code || s.subject_name;

  /** Push up to MAX_ITEM_ALERTS item alerts, then one roll-up for the rest. */
  const pushCapped = (items: DashboardAlert[], rollup: (rest: number) => DashboardAlert) => {
    alerts.push(...items.slice(0, MAX_ITEM_ALERTS));
    if (items.length > MAX_ITEM_ALERTS) alerts.push(rollup(items.length - MAX_ITEM_ALERTS));
  };

  // ── Grading backlog ──
  if (totals.overdue_grading > 0) {
    const oldest = grading_queue[0];
    alerts.push({
      id: "grading-overdue",
      severity: "critical",
      title: `${plural(totals.overdue_grading, "submission")} waiting over ${GRADING_SLA_DAYS} days`,
      message: oldest
        ? `Oldest: "${oldest.title}" (${label(oldest)}), waiting ${oldest.waiting_days} days. ${totals.pending_grading} to grade in total.`
        : "Students are waiting for feedback.",
      subject_id: oldest?.subject_id ?? null,
      action: oldest ? { label: "Grade now", url: oldest.url } : undefined,
    });
  } else if (totals.pending_grading > 0) {
    alerts.push({
      id: "grading-pending",
      severity: "warning",
      title: `${plural(totals.pending_grading, "submission")} to grade`,
      message: `Across ${plural(grading_queue.length, "assessment")}.`,
      subject_id: null,
      action: grading_queue[0] ? { label: "Open queue", url: grading_queue[0].url } : undefined,
    });
  }

  // ── Subjects at risk ──
  for (const s of subjects) {
    if (s.health === "at_risk") {
      alerts.push({
        id: `subject-risk-${s.subject_id}`,
        severity: "critical",
        title: `${label(s)} needs attention`,
        message: s.health_reasons.join(". ") + ".",
        subject_id: s.subject_id,
        action: { label: "Open subject", url: `/courses/${s.subject_id}` },
      });
    }
  }

  // ── Deadlines closing within 48h ──
  const soon = nowMs + 48 * 60 * 60 * 1000;
  const closingSoon = upcoming.filter((u) => new Date(u.due_at!).getTime() <= soon);
  const lowClosing = closingSoon.filter((u) => u.participation != null && u.participation < 50);
  pushCapped(
    lowClosing.map((u) => ({
      id: `due-low-${u.kind}-${u.id}`,
      severity: "warning" as const,
      title: `"${u.title}" closes ${relTime(u.due_at!, nowMs)} with ${u.participation}% submitted`,
      message: `${u.submitted} of ${u.expected} students in ${label(u)} have submitted. Consider a reminder.`,
      subject_id: u.subject_id,
      action: { label: "View", url: u.url },
    })),
    (rest) => ({
      id: "due-low-more",
      severity: "warning",
      title: `${plural(rest, "more deadline")} closing soon with low submissions`,
      message: "See Upcoming deadlines for the full list.",
      subject_id: null,
      action: { label: "Deadlines", url: "#upcoming" },
    }),
  );
  const dueToday = upcoming.filter(
    (u) => new Date(u.due_at!).getTime() <= nowMs + DAY_MS && !lowClosing.includes(u),
  );
  if (dueToday.length > 0) {
    const first = dueToday[0];
    alerts.push({
      id: "due-24h",
      severity: "info",
      title:
        dueToday.length === 1
          ? `"${first.title}" is due ${relTime(first.due_at!, nowMs)}`
          : `${dueToday.length} assessments are due in the next 24 hours`,
      message: dueToday
        .slice(0, 3)
        .map((u) => `${u.title} (${label(u)})${u.expected != null ? `: ${u.submitted}/${u.expected} submitted` : ""}`)
        .join(" · "),
      subject_id: dueToday.length === 1 ? first.subject_id : null,
      action: { label: "View", url: dueToday.length === 1 ? first.url : "#upcoming" },
    });
  }

  // ── Just-closed work: students who didn't submit ──
  const recentCutoff = nowMs - RECENT_CLOSE_DAYS * DAY_MS;
  const recentlyClosed = assessments.filter(
    (a) => a.is_closed && a.due_at && new Date(a.due_at).getTime() >= recentCutoff && new Date(a.due_at).getTime() <= nowMs,
  );
  pushCapped(
    recentlyClosed
      .filter((a) => a.expected != null && a.expected > 0 && a.participation != null && a.participation < LOW_PARTICIPATION)
      .map((a) => ({
        id: `closed-missing-${a.kind}-${a.id}`,
        severity: "warning" as const,
        title: `${plural(a.expected! - Math.min(a.submitted, a.expected!), "student")} didn't submit "${a.title}"`,
        message: `It closed ${relTime(a.due_at!, nowMs)} in ${label(a)} with ${a.participation}% submitted. Follow up or reopen it.`,
        subject_id: a.subject_id,
        action: { label: "View", url: a.url },
      })),
    (rest) => ({
      id: "closed-missing-more",
      severity: "warning",
      title: `${plural(rest, "more assessment")} closed with low submissions`,
      message: "See Assessment performance for details.",
      subject_id: null,
      action: { label: "Review", url: "#assessments" },
    }),
  );

  // ── Class struggled on a graded assessment ──
  pushCapped(
    assessments
      .filter(
        (a) =>
          a.is_closed &&
          a.avg_score != null &&
          a.avg_score < PASS_MARK &&
          a.graded >= LOW_SCORE_MIN_RESULTS &&
          (!a.due_at || new Date(a.due_at).getTime() >= nowMs - 3 * RECENT_CLOSE_DAYS * DAY_MS),
      )
      .sort((x, y) => x.avg_score! - y.avg_score!)
      .map((a) => ({
        id: `low-score-${a.kind}-${a.id}`,
        severity: "warning" as const,
        title: `Class struggled on "${a.title}": average ${a.avg_score}%`,
        message: `${label(a)} · ${a.pass_rate ?? 0}% passed. Consider reteaching or a remedial activity.`,
        subject_id: a.subject_id,
        action: { label: "See results", url: a.url },
      })),
    (rest) => ({
      id: "low-score-more",
      severity: "warning",
      title: `${plural(rest, "more assessment")} averaged below ${PASS_MARK}%`,
      message: "See Assessment performance for details.",
      subject_id: null,
      action: { label: "Review", url: "#assessments" },
    }),
  );

  // ── Students ──
  if (totals.at_risk_students > 0) {
    alerts.push({
      id: "students-at-risk",
      severity: "warning",
      title: `${plural(totals.at_risk_students, "student")} need${totals.at_risk_students === 1 ? "s" : ""} support`,
      message: `Below ${PASS_MARK}% or with 2+ missing submissions across your subjects.`,
      subject_id: null,
      action: { label: "See list", url: "#students" },
    });
  }

  // ── Proctoring ──
  if (totals.live_proctoring > 0) {
    alerts.push({
      id: "proctoring-live",
      severity: "info",
      title: `${plural(totals.live_proctoring, "student")} taking a proctored quiz now`,
      message: "Watch the live sessions for integrity events.",
      subject_id: null,
      action: { label: "Watch live", url: "/proctoring/live" },
    });
  }
  if (totals.flagged_sessions > 0) {
    alerts.push({
      id: "proctoring-flagged",
      severity: "warning",
      title: `${plural(totals.flagged_sessions, "flagged proctoring session")}`,
      message: "Integrity events were recorded during quizzes this term.",
      subject_id: null,
      action: { label: "Review", url: "/proctoring/live" },
    });
  }
  if (totals.stale_proctoring > 0) {
    alerts.push({
      id: "proctoring-stale",
      severity: "info",
      title: `${plural(totals.stale_proctoring, "proctoring session")} left open`,
      message: `Marked active but with no heartbeat in the last ${LIVE_HEARTBEAT_MINUTES} minutes. Review and close them.`,
      subject_id: null,
      action: { label: "Live proctoring", url: "/proctoring/live" },
    });
  }

  // ── Activity + housekeeping ──
  if (totals.new_submissions_24h > 0) {
    alerts.push({
      id: "new-submissions",
      severity: "info",
      title: `${plural(totals.new_submissions_24h, "new submission")} in the last 24 hours`,
      message: totals.pending_grading > 0 ? `${totals.pending_grading} still to grade.` : "All of them are graded.",
      subject_id: null,
      action: { label: "Submissions", url: "/submissions" },
    });
  }
  const empty = subjects.filter((s) => s.health === "no_data");
  if (empty.length > 0) {
    alerts.push({
      id: "subjects-empty",
      severity: "info",
      title: `${empty.length} subject${empty.length === 1 ? " has" : "s have"} no published assessment`,
      message: `${empty.map(label).join(", ")}: nothing students can work on yet this term.`,
      subject_id: empty.length === 1 ? empty[0].subject_id : null,
      action: { label: "Create assignment", url: "/assignments/create" },
    });
  }
  if (totals.drafts > 0) {
    alerts.push({
      id: "drafts",
      severity: "info",
      title: `${plural(totals.drafts, "draft")} not yet published`,
      message: "Students can't see drafts. Publish them when they're ready.",
      subject_id: null,
      action: { label: "Assignments", url: "/assignments" },
    });
  }

  const actionable = alerts.some((a) => a.severity === "critical" || a.severity === "warning");
  if (!actionable && subjects.length > 0) {
    alerts.push({
      id: "all-clear",
      severity: "success",
      title: "All caught up",
      message: "Nothing urgent. Grading, participation and scores are on track.",
      subject_id: null,
    });
  }
  const rank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2, success: 3 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** "in 5h" / "in 2 days" / "3 days ago" relative to `nowMs`. */
function relTime(iso: string, nowMs: number): string {
  const diff = new Date(iso).getTime() - nowMs;
  const hours = Math.round(Math.abs(diff) / 3600000);
  const text = hours < 24 ? `${Math.max(1, hours)}h` : plural(Math.round(hours / 24), "day");
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}
