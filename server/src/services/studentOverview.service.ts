import { parseAssignmentGrade } from "./reportCardGrader.service";

/**
 * Pure logic behind the student dashboard (GET /api/dashboard/student/overview):
 * every assignment and quiz in the student's enrolled subjects this term,
 * classified into one state with its timing, plus the reminders a student
 * needs the moment they open the app. The controller loads rows; nothing here
 * touches the DB or MIS, so every state and reminder is unit-testable.
 *
 * Scoring follows the student profile rules: a draft is not a submission, an
 * assignment grade "a/b" is read against its own max, and a quiz counts its
 * best *graded* finished attempt. Averages that include teacher-recorded marks
 * come from the ranking endpoint, not from here.
 *
 * Submissions after an assignment's due date are refused by the server
 * (submission.controller), so an unsubmitted past-due assignment is "missed",
 * never "submit late".
 */

export const PASS_MARK = 50;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
export const DUE_SOON_DAYS = 3;
export const WEEK_DAYS = 7;
export const NEW_TASK_DAYS = 3;
export const RECENT_RESULT_DAYS = 21;
export const MISSED_WINDOW_DAYS = 30;

// ─── Input rows ────────────────────────────────────────────────────────────────

export interface StudentSubject {
  id: number;
  name: string;
  code: string | null;
}

export interface AssignmentRow {
  id: number;
  title: string;
  course_id: number;
  status: string;
  due_date: Date | string | null;
  max_score: number | string | null;
  submission_type?: string | null;
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
  time_limit?: number | null;
  max_attempts?: number | null;
  passing_score?: number | null;
  created_at?: Date | string | null;
}

export interface QuizStatsRow {
  quiz_id: number;
  question_count: number;
  total_points: number;
  /** Sum of per-question time limits, seconds (0 = untimed). */
  total_seconds: number;
}

export interface MySubmissionRow {
  id: number;
  assignment_id: number;
  status: string;
  grade?: string | null;
  feedback?: string | null;
  is_late?: boolean;
  submitted_at?: Date | string | null;
  updated_at?: Date | string | null;
}

export interface MyAttemptRow {
  id: number;
  quiz_id: number;
  status: string;
  grade_status: string;
  percentage?: number | string | null;
  total_score?: number | string | null;
  max_score?: number | string | null;
  passed?: boolean | null;
  started_at?: Date | string | null;
  end_time?: Date | string | null;
  completed_at?: Date | string | null;
  graded_at?: Date | string | null;
  feedback?: string | null;
  attempt_number?: number | null;
}

export interface StudentOverviewInput {
  now: Date;
  academic_term_id: number | null;
  subjects: StudentSubject[];
  assignments: AssignmentRow[];
  quizzes: QuizRow[];
  quizStats: QuizStatsRow[];
  submissions: MySubmissionRow[];
  attempts: MyAttemptRow[];
}

// ─── Output ───────────────────────────────────────────────────────────────────

export type TaskKind = "assignment" | "quiz";
export type TaskState =
  | "in_progress" // a quiz attempt is running
  | "due_today" // due within 24 hours, not handed in
  | "due_soon" // due within 3 days
  | "upcoming" // open, due later (or no due date)
  | "not_open" // a quiz that hasn't opened yet
  | "submitted" // handed in, waiting for a mark
  | "graded" // marked
  | "missed"; // deadline passed with nothing handed in

export interface StudentTask {
  id: number;
  kind: TaskKind;
  title: string;
  subject_id: number;
  subject_code: string | null;
  subject_name: string;
  state: TaskState;
  quiz_type: string | null;
  opens_at: string | null;
  due_at: string | null;
  /** When the countdown on this task ends: an attempt's end, else the due date / opening. */
  countdown_to: string | null;
  countdown_label: "time_left" | "due" | "opens" | null;
  max_score: number | null;
  question_count: number | null;
  /** Estimated/allowed duration for a quiz, minutes. */
  duration_minutes: number | null;
  attempts_used: number;
  max_attempts: number | null;
  can_retake: boolean;
  has_draft: boolean;
  submitted_at: string | null;
  is_late: boolean;
  score_pct: number | null;
  score_display: string | null;
  passed: boolean | null;
  has_feedback: boolean;
  graded_at: string | null;
  is_new: boolean;
  action: { label: string; url: string } | null;
}

export type ReminderSeverity = "critical" | "warning" | "info" | "success";

export interface StudentReminder {
  id: string;
  severity: ReminderSeverity;
  title: string;
  message: string;
  /** Live countdown target for the reminder, if any. */
  countdown_to: string | null;
  subject_id: number | null;
  action?: { label: string; url: string };
}

export interface StudentSubjectSummary {
  subject_id: number;
  subject_name: string;
  subject_code: string | null;
  total: number;
  todo: number;
  due_soon: number;
  missed: number;
  awaiting: number;
  graded: number;
  completion: number | null;
  recent_average: number | null;
  next_task: { title: string; kind: TaskKind; due_at: string; url: string | null } | null;
}

export interface StudentOverview {
  generated_at: string;
  academic_term_id: number | null;
  summary: {
    subjects: number;
    todo: number;
    in_progress: number;
    due_today: number;
    due_this_week: number;
    not_open: number;
    awaiting_grade: number;
    graded: number;
    missed: number;
    drafts: number;
    /** Handed in / everything that has closed or been handed in. */
    completion_rate: number | null;
    /** Handed in on time / handed in (assignments). */
    on_time_rate: number | null;
    /** Mean of graded online work in the last 30 days. */
    recent_average: number | null;
    new_results: number;
    next_deadline: string | null;
  };
  tasks: StudentTask[];
  subjects: StudentSubjectSummary[];
  reminders: StudentReminder[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDate = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const round1 = (n: number) => Math.round(n * 10) / 10;
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const fmtScore = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const hasText = (s: string | null | undefined) =>
  !!s && s.replace(/<[^>]*>/g, "").trim().length > 0;
const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

const FINISHED = new Set(["completed", "timed_out"]);
const GRADED = new Set(["graded", "auto_graded"]);
const HANDED_IN = new Set(["submitted", "late", "resubmitted", "graded"]);

/** "in 3h 20m" / "in 2 days" / "5h ago" — for reminder text only (the UI ticks live). */
export function relTime(target: Date, nowMs: number): string {
  const diff = target.getTime() - nowMs;
  const abs = Math.abs(diff);
  let text: string;
  if (abs < HOUR) text = `${Math.max(1, Math.round(abs / MINUTE))} min`;
  else if (abs < DAY) {
    const h = Math.floor(abs / HOUR);
    const m = Math.round((abs - h * HOUR) / MINUTE);
    text = m > 0 && h < 6 ? `${h}h ${m}m` : `${h}h`;
  } else text = plural(Math.round(abs / DAY), "day");
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

function dueState(due: Date | null, nowMs: number): TaskState {
  if (!due) return "upcoming";
  const left = due.getTime() - nowMs;
  if (left < 0) return "missed";
  if (left <= DAY) return "due_today";
  if (left <= DUE_SOON_DAYS * DAY) return "due_soon";
  return "upcoming";
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildStudentOverview(input: StudentOverviewInput): StudentOverview {
  const nowMs = input.now.getTime();
  const subjectById = new Map(input.subjects.map((s) => [s.id, s]));
  const statsByQuiz = new Map(input.quizStats.map((s) => [s.quiz_id, s]));

  const subsByAssignment = new Map<number, MySubmissionRow[]>();
  for (const s of input.submissions) {
    subsByAssignment.set(s.assignment_id, [...(subsByAssignment.get(s.assignment_id) ?? []), s]);
  }
  const attemptsByQuiz = new Map<number, MyAttemptRow[]>();
  for (const a of input.attempts) {
    attemptsByQuiz.set(a.quiz_id, [...(attemptsByQuiz.get(a.quiz_id) ?? []), a]);
  }

  const tasks: StudentTask[] = [];
  const base = (
    kind: TaskKind,
    row: { id: number; title: string; course_id: number; created_at?: Date | string | null },
    subject: StudentSubject,
  ) => ({
    id: row.id,
    kind,
    title: row.title,
    subject_id: subject.id,
    subject_code: subject.code,
    subject_name: subject.name,
    quiz_type: null as string | null,
    opens_at: null as string | null,
    max_score: null as number | null,
    question_count: null as number | null,
    duration_minutes: null as number | null,
    attempts_used: 0,
    max_attempts: null as number | null,
    can_retake: false,
    has_draft: false,
    submitted_at: null as string | null,
    is_late: false,
    score_pct: null as number | null,
    score_display: null as string | null,
    passed: null as boolean | null,
    has_feedback: false,
    graded_at: null as string | null,
    created: toDate(row.created_at),
  });

  // ── Assignments ──
  for (const a of input.assignments) {
    const subject = subjectById.get(a.course_id);
    if (!subject || (a.status !== "published" && a.status !== "completed")) continue;
    const due = toDate(a.due_date);
    const subs = subsByAssignment.get(a.id) ?? [];
    const handedIn = subs
      .filter((s) => HANDED_IN.has(s.status))
      .sort((x, y) => (toDate(y.submitted_at)?.getTime() ?? 0) - (toDate(x.submitted_at)?.getTime() ?? 0))[0];
    const draft = subs.find((s) => s.status === "draft");
    const t = base("assignment", a, subject);
    t.max_score = num(a.max_score);
    t.has_draft = !handedIn && !!draft;

    let state: TaskState;
    if (handedIn) {
      t.submitted_at = iso(toDate(handedIn.submitted_at) ?? toDate(handedIn.updated_at));
      t.is_late = !!handedIn.is_late || handedIn.status === "late";
      if (handedIn.status === "graded") {
        state = "graded";
        const parsed = parseAssignmentGrade(handedIn.grade ?? null);
        const bare = num(handedIn.grade);
        if (parsed) {
          t.score_pct = round1((parsed.raw_score / parsed.max_score) * 100);
          t.score_display = `${fmtScore(parsed.raw_score)}/${fmtScore(parsed.max_score)}`;
        } else if (bare != null && t.max_score) {
          // Older rows hold a bare score against the assignment's max.
          t.score_pct = round1((bare / t.max_score) * 100);
          t.score_display = `${fmtScore(bare)}/${fmtScore(t.max_score)}`;
        }
        t.passed = t.score_pct != null ? t.score_pct >= PASS_MARK : null;
        t.has_feedback = hasText(handedIn.feedback);
        t.graded_at = iso(toDate(handedIn.updated_at));
      } else state = "submitted";
    } else if (a.status === "completed") {
      state = "missed";
    } else {
      state = dueState(due, nowMs);
    }

    const url = `/assignments/${a.id}`;
    const action =
      state === "graded"
        ? { label: t.has_feedback ? "View feedback" : "View result", url }
        : state === "submitted"
          ? { label: "View submission", url }
          : state === "missed"
            ? { label: "View", url }
            : { label: t.has_draft ? "Finish & submit" : "Submit", url };

    const { created, ...rest } = t;
    tasks.push({
      ...rest,
      state,
      due_at: iso(due),
      countdown_to: ["due_today", "due_soon", "upcoming"].includes(state) && due ? iso(due) : null,
      countdown_label: ["due_today", "due_soon", "upcoming"].includes(state) && due ? "due" : null,
      is_new:
        !handedIn && created != null && nowMs - created.getTime() <= NEW_TASK_DAYS * DAY && state !== "missed",
      action,
    });
  }

  // ── Quizzes ──
  for (const q of input.quizzes) {
    const subject = subjectById.get(q.course_id);
    if (!subject || (q.status !== "published" && q.status !== "completed")) continue;
    const opens = toDate(q.start_date);
    const closes = toDate(q.end_date);
    const stats = statsByQuiz.get(q.id);
    const attempts = attemptsByQuiz.get(q.id) ?? [];
    const finished = attempts.filter((x) => FINISHED.has(x.status));
    const graded = finished.filter((x) => GRADED.has(x.grade_status));
    const best = graded.reduce<MyAttemptRow | null>(
      (b, x) => (b == null || (num(x.percentage) ?? 0) > (num(b.percentage) ?? 0) ? x : b),
      null,
    );
    const running = attempts.find((x) => x.status === "in_progress");

    const t = base("quiz", q, subject);
    t.quiz_type = q.type ?? null;
    t.opens_at = iso(opens);
    t.question_count = stats?.question_count ?? null;
    t.max_score = stats?.total_points ?? null;
    t.duration_minutes = q.time_limit
      ? q.time_limit
      : stats && stats.total_seconds > 0
        ? Math.max(1, Math.round(stats.total_seconds / 60))
        : null;
    t.attempts_used = finished.length;
    t.max_attempts = q.max_attempts ?? null;

    const isClosed = q.status === "completed" || (closes != null && closes.getTime() < nowMs);
    const notOpen = opens != null && opens.getTime() > nowMs;
    const attemptsLeft = t.max_attempts == null ? Infinity : t.max_attempts - finished.length;

    // A running attempt ends at its own end_time, but never after the quiz closes.
    const attemptEnd = running ? toDate(running.end_time) : null;
    const runningDeadline =
      attemptEnd && closes ? new Date(Math.min(attemptEnd.getTime(), closes.getTime())) : attemptEnd ?? closes;
    const runningAlive = running && (!runningDeadline || runningDeadline.getTime() > nowMs) && !isClosed;

    let state: TaskState;
    if (runningAlive) state = "in_progress";
    else if (best) state = "graded";
    else if (finished.length > 0) state = "submitted";
    else if (notOpen) state = "not_open";
    else if (isClosed) state = "missed";
    else state = dueState(closes, nowMs);

    if (best) {
      t.score_pct = round1(num(best.percentage) ?? 0);
      const got = num(best.total_score);
      const max = num(best.max_score);
      t.score_display = got != null && max ? `${fmtScore(got)}/${fmtScore(max)}` : null;
      const passMark = q.passing_score ?? PASS_MARK;
      t.passed = best.passed ?? t.score_pct >= passMark;
      t.has_feedback = hasText(best.feedback);
      t.graded_at = iso(toDate(best.graded_at) ?? toDate(best.completed_at));
    }
    if (finished.length > 0) {
      const last = finished
        .map((x) => toDate(x.completed_at))
        .filter((d): d is Date => d != null)
        .sort((x, y) => y.getTime() - x.getTime())[0];
      t.submitted_at = iso(last ?? null);
    }
    t.can_retake = finished.length > 0 && !runningAlive && !isClosed && !notOpen && attemptsLeft > 0;

    const take = `/quizzes/${q.id}/take`;
    const action =
      state === "in_progress"
        ? { label: "Resume", url: take }
        : state === "graded" || state === "submitted"
          ? t.can_retake
            ? { label: "Retake", url: take }
            : { label: "See result", url: `/quizzes/${q.id}/results` }
          : state === "not_open" || state === "missed"
            ? { label: "View subject", url: `/courses/${subject.id}` }
            : { label: "Start quiz", url: take };

    let countdown_to: string | null = null;
    let countdown_label: StudentTask["countdown_label"] = null;
    if (state === "in_progress" && runningDeadline) {
      countdown_to = iso(runningDeadline);
      countdown_label = "time_left";
    } else if (state === "not_open" && opens) {
      countdown_to = iso(opens);
      countdown_label = "opens";
    } else if (["due_today", "due_soon", "upcoming"].includes(state) && closes) {
      countdown_to = iso(closes);
      countdown_label = "due";
    }

    const { created, ...rest } = t;
    tasks.push({
      ...rest,
      state,
      due_at: iso(closes),
      countdown_to,
      countdown_label,
      is_new:
        finished.length === 0 &&
        created != null &&
        nowMs - created.getTime() <= NEW_TASK_DAYS * DAY &&
        state !== "missed",
      action,
    });
  }

  // Order: what needs doing first, then by time.
  const rank: Record<TaskState, number> = {
    in_progress: 0,
    due_today: 1,
    due_soon: 2,
    upcoming: 3,
    not_open: 4,
    submitted: 5,
    graded: 6,
    missed: 7,
  };
  const timeKey = (t: StudentTask) =>
    t.state === "graded"
      ? -(toDate(t.graded_at)?.getTime() ?? 0)
      : t.state === "missed"
        ? -(toDate(t.due_at)?.getTime() ?? 0)
        : toDate(t.countdown_to ?? t.due_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  tasks.sort((a, b) => rank[a.state] - rank[b.state] || timeKey(a) - timeKey(b));

  // Missed work older than the window is history, not a to-do.
  const missedCutoff = nowMs - MISSED_WINDOW_DAYS * DAY;
  const visible = tasks.filter(
    (t) => t.state !== "missed" || (toDate(t.due_at)?.getTime() ?? nowMs) >= missedCutoff,
  );

  // ── Summary ──
  const TODO: TaskState[] = ["in_progress", "due_today", "due_soon", "upcoming"];
  const weekEnd = nowMs + WEEK_DAYS * DAY;
  const handedIn = tasks.filter((t) => t.state === "submitted" || t.state === "graded");
  const closedOrDone = tasks.filter((t) => t.state === "missed" || t.state === "submitted" || t.state === "graded");
  const assignmentsIn = handedIn.filter((t) => t.kind === "assignment");
  const recentCut = nowMs - 30 * DAY;
  const recentScores = tasks
    .filter((t) => t.score_pct != null && (toDate(t.graded_at)?.getTime() ?? 0) >= recentCut)
    .map((t) => t.score_pct!);
  const resultCut = nowMs - 7 * DAY;
  const newResults = tasks.filter((t) => t.state === "graded" && (toDate(t.graded_at)?.getTime() ?? 0) >= resultCut);
  const nextDeadline = tasks
    .filter((t) => TODO.includes(t.state) && t.due_at)
    .map((t) => toDate(t.countdown_to ?? t.due_at)!)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const summary: StudentOverview["summary"] = {
    subjects: input.subjects.length,
    todo: tasks.filter((t) => TODO.includes(t.state)).length,
    in_progress: tasks.filter((t) => t.state === "in_progress").length,
    due_today: tasks.filter((t) => t.state === "due_today").length,
    due_this_week: tasks.filter(
      (t) => TODO.includes(t.state) && t.due_at && new Date(t.due_at).getTime() <= weekEnd,
    ).length,
    not_open: tasks.filter((t) => t.state === "not_open").length,
    awaiting_grade: tasks.filter((t) => t.state === "submitted").length,
    graded: tasks.filter((t) => t.state === "graded").length,
    missed: visible.filter((t) => t.state === "missed").length,
    drafts: tasks.filter((t) => t.has_draft && TODO.includes(t.state)).length,
    completion_rate: closedOrDone.length ? round1((handedIn.length / closedOrDone.length) * 100) : null,
    on_time_rate: assignmentsIn.length
      ? round1((assignmentsIn.filter((t) => !t.is_late).length / assignmentsIn.length) * 100)
      : null,
    recent_average: recentScores.length
      ? round1(recentScores.reduce((a, b) => a + b, 0) / recentScores.length)
      : null,
    new_results: newResults.length,
    next_deadline: iso(nextDeadline ?? null),
  };

  // ── Per subject ──
  const subjects: StudentSubjectSummary[] = input.subjects.map((s) => {
    const mine = tasks.filter((t) => t.subject_id === s.id);
    const done = mine.filter((t) => t.state === "submitted" || t.state === "graded");
    const closed = mine.filter((t) => t.state === "missed" || t.state === "submitted" || t.state === "graded");
    const scores = mine.filter((t) => t.score_pct != null && (toDate(t.graded_at)?.getTime() ?? 0) >= recentCut);
    const next = mine.find((t) => TODO.includes(t.state) && t.due_at);
    return {
      subject_id: s.id,
      subject_name: s.name,
      subject_code: s.code,
      total: mine.length,
      todo: mine.filter((t) => TODO.includes(t.state)).length,
      due_soon: mine.filter((t) => t.state === "due_today" || t.state === "due_soon" || t.state === "in_progress").length,
      missed: mine.filter((t) => t.state === "missed" && (toDate(t.due_at)?.getTime() ?? nowMs) >= missedCutoff).length,
      awaiting: mine.filter((t) => t.state === "submitted").length,
      graded: mine.filter((t) => t.state === "graded").length,
      completion: closed.length ? round1((done.length / closed.length) * 100) : null,
      recent_average: scores.length
        ? round1(scores.reduce((a, t) => a + t.score_pct!, 0) / scores.length)
        : null,
      next_task: next
        ? { title: next.title, kind: next.kind, due_at: next.countdown_to ?? next.due_at!, url: next.action?.url ?? null }
        : null,
    };
  });

  return {
    generated_at: input.now.toISOString(),
    academic_term_id: input.academic_term_id,
    summary,
    tasks: visible,
    subjects,
    reminders: buildStudentReminders(tasks, input.now),
  };
}

// ─── Reminders ────────────────────────────────────────────────────────────────

const MAX_ITEM_REMINDERS = 3;

export function buildStudentReminders(tasks: StudentTask[], now: Date): StudentReminder[] {
  const nowMs = now.getTime();
  const out: StudentReminder[] = [];
  const label = (t: StudentTask) => t.subject_code || t.subject_name;
  const capped = (items: StudentReminder[], rollup: (rest: number) => StudentReminder) => {
    out.push(...items.slice(0, MAX_ITEM_REMINDERS));
    if (items.length > MAX_ITEM_REMINDERS) out.push(rollup(items.length - MAX_ITEM_REMINDERS));
  };

  // Running quiz: the most time-critical thing a student can have.
  for (const t of tasks.filter((x) => x.state === "in_progress")) {
    const end = t.countdown_to ? new Date(t.countdown_to) : null;
    out.push({
      id: `running-${t.id}`,
      severity: "critical",
      title: `"${t.title}" is in progress`,
      message: end
        ? `Your attempt ends ${relTime(end, nowMs)}. Answers not submitted by then may be lost.`
        : "You started this quiz. Resume it to finish.",
      countdown_to: t.countdown_to,
      subject_id: t.subject_id,
      action: t.action ?? undefined,
    });
  }

  capped(
    tasks
      .filter((t) => t.state === "due_today")
      .map((t) => ({
        id: `due-today-${t.kind}-${t.id}`,
        severity: "critical" as const,
        title: `${t.kind === "quiz" ? "Quiz" : "Assignment"} due ${relTime(new Date(t.due_at!), nowMs)}: ${t.title}`,
        message:
          t.kind === "quiz"
            ? `${label(t)}${t.duration_minutes ? ` · about ${t.duration_minutes} min` : ""}${t.question_count ? ` · ${plural(t.question_count, "question")}` : ""}. It closes at the deadline.`
            : `${label(t)}${t.has_draft ? " · you have a saved draft, submit it" : ""}. Late submissions are not accepted.`,
        countdown_to: t.due_at,
        subject_id: t.subject_id,
        action: t.action ?? undefined,
      })),
    (rest) => ({
      id: "due-today-more",
      severity: "critical",
      title: `${plural(rest, "more task")} due in the next 24 hours`,
      message: "See Today on your dashboard.",
      countdown_to: null,
      subject_id: null,
      action: { label: "See all", url: "#today" },
    }),
  );

  const drafts = tasks.filter((t) => t.has_draft && t.state !== "due_today" && ["due_soon", "upcoming"].includes(t.state));
  if (drafts.length > 0) {
    out.push({
      id: "drafts",
      severity: "warning",
      title: drafts.length === 1 ? `Draft not submitted: ${drafts[0].title}` : `${drafts.length} drafts not submitted`,
      message: "A draft doesn't count until you submit it.",
      countdown_to: drafts[0].due_at,
      subject_id: drafts.length === 1 ? drafts[0].subject_id : null,
      action: drafts[0].action ?? undefined,
    });
  }

  capped(
    tasks
      .filter((t) => t.state === "due_soon")
      .map((t) => ({
        id: `due-soon-${t.kind}-${t.id}`,
        severity: "warning" as const,
        title: `${t.title} is due ${relTime(new Date(t.due_at!), nowMs)}`,
        message: `${label(t)} · ${t.kind === "quiz" ? t.quiz_type || "Quiz" : "Assignment"}. Plan time for it now.`,
        countdown_to: t.due_at,
        subject_id: t.subject_id,
        action: t.action ?? undefined,
      })),
    (rest) => ({
      id: "due-soon-more",
      severity: "warning",
      title: `${plural(rest, "more task")} due in the next ${DUE_SOON_DAYS} days`,
      message: "See This week on your dashboard.",
      countdown_to: null,
      subject_id: null,
      action: { label: "This week", url: "#week" },
    }),
  );

  const recentlyMissed = tasks.filter(
    (t) => t.state === "missed" && t.due_at && nowMs - new Date(t.due_at).getTime() <= 7 * DAY,
  );
  if (recentlyMissed.length > 0) {
    out.push({
      id: "missed",
      severity: "warning",
      title:
        recentlyMissed.length === 1
          ? `You missed "${recentlyMissed[0].title}"`
          : `You missed ${recentlyMissed.length} tasks this week`,
      message: `${recentlyMissed.map((t) => `${t.title} (${label(t)})`).slice(0, 3).join(", ")}. Talk to your teacher about catching up.`,
      countdown_to: null,
      subject_id: recentlyMissed.length === 1 ? recentlyMissed[0].subject_id : null,
      action: recentlyMissed[0].action ?? undefined,
    });
  }

  // Failed but can try again while the quiz is still open.
  capped(
    tasks
      .filter((t) => t.kind === "quiz" && t.can_retake && t.passed === false)
      .map((t) => ({
        id: `retake-${t.id}`,
        severity: "warning" as const,
        title: `You can retake "${t.title}"`,
        message: `Best score ${t.score_pct}%.${t.max_attempts != null ? ` ${plural(t.max_attempts - t.attempts_used, "attempt")} left.` : ""}${t.due_at ? ` Closes ${relTime(new Date(t.due_at), nowMs)}.` : ""}`,
        countdown_to: t.due_at,
        subject_id: t.subject_id,
        action: t.action ?? undefined,
      })),
    (rest) => ({
      id: "retake-more",
      severity: "warning",
      title: `${plural(rest, "more quiz", "more quizzes")} you can retake`,
      message: "Check your results.",
      countdown_to: null,
      subject_id: null,
      action: { label: "Results", url: "#results" },
    }),
  );

  const opening = tasks.filter(
    (t) => t.state === "not_open" && t.opens_at && new Date(t.opens_at).getTime() - nowMs <= 2 * DAY,
  );
  for (const t of opening.slice(0, MAX_ITEM_REMINDERS)) {
    out.push({
      id: `opens-${t.id}`,
      severity: "info",
      title: `${t.quiz_type || "Quiz"} opens ${relTime(new Date(t.opens_at!), nowMs)}: ${t.title}`,
      message: `${label(t)}${t.duration_minutes ? ` · about ${t.duration_minutes} min` : ""}${t.question_count ? ` · ${plural(t.question_count, "question")}` : ""}. Be ready.`,
      countdown_to: t.opens_at,
      subject_id: t.subject_id,
      action: t.action ?? undefined,
    });
  }

  const fresh = tasks
    .filter((t) => t.state === "graded" && t.graded_at && nowMs - new Date(t.graded_at).getTime() <= 7 * DAY)
    .sort((a, b) => b.graded_at!.localeCompare(a.graded_at!));
  capped(
    fresh.map((t) => ({
      id: `result-${t.kind}-${t.id}`,
      severity: t.passed === false ? ("warning" as const) : ("success" as const),
      title: `New result: ${t.score_display ?? `${t.score_pct}%`} on ${t.title}`,
      message: `${label(t)}${t.score_pct != null ? ` · ${t.score_pct}%` : ""}${t.has_feedback ? " · your teacher left feedback" : ""}.`,
      countdown_to: null,
      subject_id: t.subject_id,
      action: t.action ?? undefined,
    })),
    (rest) => ({
      id: "results-more",
      severity: "success",
      title: `${plural(rest, "more new result")} this week`,
      message: "See Recent results.",
      countdown_to: null,
      subject_id: null,
      action: { label: "Results", url: "#results" },
    }),
  );

  const newWork = tasks.filter((t) => t.is_new && t.state !== "due_today" && t.state !== "in_progress");
  if (newWork.length > 0) {
    out.push({
      id: "new-work",
      severity: "info",
      title: newWork.length === 1 ? `New ${newWork[0].kind}: ${newWork[0].title}` : `${newWork.length} new tasks posted`,
      message: newWork
        .slice(0, 3)
        .map((t) => `${t.title} (${label(t)})`)
        .join(", "),
      countdown_to: null,
      subject_id: newWork.length === 1 ? newWork[0].subject_id : null,
      action: newWork.length === 1 && newWork[0].action ? newWork[0].action : { label: "See tasks", url: "#week" },
    });
  }

  const urgent = out.some((r) => r.severity === "critical" || r.severity === "warning");
  if (!urgent) {
    const upcoming = tasks.filter((t) => t.state === "upcoming").length;
    out.push({
      id: "all-clear",
      severity: "success",
      title: "You're on top of things",
      message: upcoming > 0 ? `Nothing due in the next ${DUE_SOON_DAYS} days. ${plural(upcoming, "task")} coming up later.` : "Nothing is due right now.",
      countdown_to: null,
      subject_id: null,
    });
  }
  const order: Record<ReminderSeverity, number> = { critical: 0, warning: 1, info: 2, success: 3 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}
