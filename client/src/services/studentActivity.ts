import { recordedLabel, type MarkInput, type RecordedSubject } from "./studentProfileApi";

// ─── Student profile activity ─────────────────────────────────────────────────
// /students/:id pulls assignments, quizzes and recorded marks from three
// endpoints with three shapes. Everything on the page — the tabs, the
// summary, the insights — reads the one normalised `ActivityItem` built here,
// so a status or a percentage can't mean one thing on a tab and another in the
// average.
//
// Rules (same as the grade screens and GET /users/:id/standing):
//  - a draft submission is not a submission;
//  - an assignment grade is "score/max" against its own max (older rows hold a
//    bare score against the assignment's max_score);
//  - a quiz counts its best *completed* attempt — an attempt still in progress
//    is not a score;
//  - only marked work is averaged; pending work is never a zero.

// ─── Raw endpoint shapes ──────────────────────────────────────────────────────

export interface RawSubjectRef {
  subject_name: string;
  subject_code: string;
}

export interface RawAssignmentSubmission {
  id: number;
  grade: string | null;
  status: string;
  submitted_at: string | null;
}

export interface RawStudentAssignment {
  id: number;
  title: string;
  course_id: number;
  max_score: number | string;
  due_date: string | null;
  submissions?: RawAssignmentSubmission[];
  subject: RawSubjectRef | null;
}

export interface RawQuizSubmission {
  id: number;
  total_score: number | string;
  percentage: number | string;
  passed: boolean | null;
  status?: string;
  attempt_number: number;
  completed_at: string | null;
}

export interface RawStudentQuiz {
  id: number;
  title: string;
  course_id: number;
  passing_score: number | string | null;
  start_date?: string | null;
  end_date?: string | null;
  quizSubmissions?: RawQuizSubmission[];
  subject: RawSubjectRef | null;
}

// ─── Normalised item ──────────────────────────────────────────────────────────

export type ActivityKind = "assignment" | "quiz" | "recorded";

export type ActivityStatus =
  /** Has a mark. */
  | "graded"
  /** Handed in, waiting for the teacher to mark it. */
  | "awaiting"
  /** Quiz started and not finished. */
  | "in_progress"
  /** Past due with nothing handed in / quiz window closed, never attempted. */
  | "overdue"
  /** Due (or closing) within the next few days. */
  | "due_soon"
  /** Can still be done. */
  | "open"
  /** Quiz window hasn't opened yet. */
  | "upcoming"
  /** Recorded assessment the teacher hasn't entered a mark for. */
  | "not_recorded";

export interface ActivityItem {
  key: string;
  kind: ActivityKind;
  id: number;
  courseId: string;
  title: string;
  /** Due date (assignment), closing date (quiz) or assessment date (recorded). */
  date: string | null;
  status: ActivityStatus;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  /** Null until marked. */
  passed: boolean | null;
  countsToFinal: boolean;
  /** Completed quiz attempts. */
  attempts: number;
  submittedAt: string | null;
  /** The quiz attempt a teacher would open to review. */
  submissionId: number | null;
}

export const DUE_SOON_DAYS = 3;
export const PASS_MARK = 50;

const DAY = 24 * 60 * 60 * 1000;

const toTime = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return isNaN(t) ? null : t;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** "8/10" → 8 of 10; "15" → 15 of the fallback max. Null when unusable. */
export const parseGrade = (
  grade: string | null | undefined,
  fallbackMax: number | string | null | undefined,
): { score: number; max: number } | null => {
  if (grade === null || grade === undefined || String(grade).trim() === "") return null;
  const [rawScore, rawMax] = String(grade).split("/");
  const score = parseFloat(rawScore);
  const max = rawMax !== undefined ? parseFloat(rawMax) : Number(fallbackMax);
  if (isNaN(score) || !max || isNaN(max) || max <= 0) return null;
  return { score, max };
};

const upcomingStatus = (deadline: number | null, now: number): ActivityStatus => {
  if (deadline === null) return "open";
  if (deadline < now) return "overdue";
  return deadline - now <= DUE_SOON_DAYS * DAY ? "due_soon" : "open";
};

export const toAssignmentItem = (a: RawStudentAssignment, now: number): ActivityItem => {
  const handedIn = (a.submissions ?? []).filter((s) => s.status !== "draft");
  // A resubmission may carry the grade; take the best graded one.
  let best: { sub: RawAssignmentSubmission; score: number; max: number } | null = null;
  for (const sub of handedIn) {
    const g = parseGrade(sub.grade, a.max_score);
    if (g && (!best || g.score / g.max > best.score / best.max)) best = { sub, ...g };
  }
  const latest = [...handedIn].sort(
    (x, y) => (toTime(y.submitted_at) ?? 0) - (toTime(x.submitted_at) ?? 0),
  )[0];

  const percentage = best ? round1((best.score / best.max) * 100) : null;
  return {
    key: `assignment-${a.id}`,
    kind: "assignment",
    id: a.id,
    courseId: String(a.course_id),
    title: a.title,
    date: a.due_date ?? null,
    status: best ? "graded" : latest ? "awaiting" : upcomingStatus(toTime(a.due_date), now),
    score: best?.score ?? null,
    maxScore: best?.max ?? (Number(a.max_score) || null),
    percentage,
    passed: percentage === null ? null : percentage >= PASS_MARK,
    countsToFinal: true,
    attempts: handedIn.length,
    submittedAt: (best?.sub ?? latest)?.submitted_at ?? null,
    submissionId: (best?.sub ?? latest)?.id ?? null,
  };
};

export const toQuizItem = (q: RawStudentQuiz, now: number): ActivityItem => {
  const subs = q.quizSubmissions ?? [];
  // Rows without a status predate the column — they were always completed.
  const completed = subs.filter((s) => (s.status ?? "completed") === "completed");
  const best = completed.reduce<RawQuizSubmission | null>(
    (acc, s) => (acc === null || Number(s.total_score) > Number(acc.total_score) ? s : acc),
    null,
  );
  const inProgress = subs.some((s) => s.status === "in_progress");
  const start = toTime(q.start_date);

  let status: ActivityStatus;
  if (best) status = "graded";
  else if (inProgress) status = "in_progress";
  else if (start !== null && start > now) status = "upcoming";
  else status = upcomingStatus(toTime(q.end_date), now);

  const percentage = best ? round1(Number(best.percentage)) : null;
  const passing = Number(q.passing_score);
  const passed =
    percentage === null
      ? null
      : typeof best?.passed === "boolean"
        ? best.passed
        : percentage >= (isNaN(passing) || !q.passing_score ? PASS_MARK : passing);

  return {
    key: `quiz-${q.id}`,
    kind: "quiz",
    id: q.id,
    courseId: String(q.course_id),
    title: q.title,
    date: q.end_date ?? q.start_date ?? null,
    status,
    score: best ? Number(best.total_score) : null,
    maxScore: null,
    percentage,
    passed,
    countsToFinal: true,
    attempts: completed.length,
    submittedAt: best?.completed_at ?? null,
    submissionId: best?.id ?? null,
  };
};

export const toRecordedItems = (subjects: RecordedSubject[]): ActivityItem[] =>
  subjects.flatMap((subject) =>
    subject.assessments.map((row) => {
      const marked = row.recorded && row.percentage !== null;
      const percentage = marked ? round1(row.percentage as number) : null;
      return {
        key: `recorded-${row.assessment_id}`,
        kind: "recorded" as const,
        id: row.assessment_id,
        courseId: String(subject.course_id),
        title: recordedLabel(row),
        date: row.assessment_date,
        status: (marked ? "graded" : "not_recorded") as ActivityStatus,
        score: marked ? row.score : null,
        maxScore: row.max_score,
        percentage,
        passed: percentage === null ? null : percentage >= PASS_MARK,
        countsToFinal: row.counts_to_final,
        attempts: 0,
        submittedAt: null,
        submissionId: null,
      };
    }),
  );

export const buildActivity = (
  assignments: RawStudentAssignment[],
  quizzes: RawStudentQuiz[],
  recorded: RecordedSubject[],
  now: number = Date.now(),
): ActivityItem[] => [
  ...assignments.map((a) => toAssignmentItem(a, now)),
  ...quizzes.map((q) => toQuizItem(q, now)),
  ...toRecordedItems(recorded),
];

export const toMarkInputs = (items: ActivityItem[]): MarkInput[] =>
  items.map((item) => ({
    courseKey: item.courseId,
    kind: item.kind,
    marked: item.status === "graded" && item.percentage !== null,
    percentage: item.percentage,
    excluded: !item.countsToFinal,
  }));

// ─── Status presentation ──────────────────────────────────────────────────────

export type Tone = "danger" | "warning" | "info" | "success" | "neutral";

export const statusLabel = (item: Pick<ActivityItem, "kind" | "status" | "passed">): string => {
  switch (item.status) {
    case "graded":
      if (item.kind === "quiz") return item.passed ? "Passed" : "Failed";
      return item.passed === false ? "Below pass" : "Marked";
    case "awaiting":
      return "Awaiting marking";
    case "in_progress":
      return "In progress";
    case "overdue":
      return item.kind === "quiz" ? "Missed" : "Overdue";
    case "due_soon":
      return item.kind === "quiz" ? "Closes soon" : "Due soon";
    case "open":
      return item.kind === "quiz" ? "Open" : "Not submitted";
    case "upcoming":
      return "Upcoming";
    case "not_recorded":
      return "Not marked";
  }
};

export const statusTone = (item: Pick<ActivityItem, "status" | "passed">): Tone => {
  switch (item.status) {
    case "graded":
      return item.passed === false ? "danger" : "success";
    case "overdue":
      return "danger";
    case "due_soon":
    case "not_recorded":
      return "warning";
    case "awaiting":
    case "in_progress":
      return "info";
    default:
      return "neutral";
  }
};

/** Something a teacher should look at: red or amber. */
export const needsAttention = (item: ActivityItem) => {
  const tone = statusTone(item);
  return tone === "danger" || tone === "warning";
};

/** "in 2 days", "today", "3 days ago". */
export const relativeDays = (date: string | null, now: number = Date.now()): string | null => {
  const t = toTime(date);
  if (t === null) return null;
  const startOfDay = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.round((startOfDay(t) - startOfDay(now)) / DAY);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
};
