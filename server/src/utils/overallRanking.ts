import { bestBySubmissionScore } from "./gradeMatching";
import { gradePercentage } from "./studentStanding";

// ─── Overall ranking ──────────────────────────────────────────────────────────
// GET /api/rankings ranks students on every mark recorded for them in a set of
// subjects: assignments, quizzes and teacher-recorded assessments. Everything
// here is pure so the rules can be unit-tested without a database; the
// controller only loads rows and picks the view.
//
// Scoring rules (the same as the student profile and utils/studentStanding):
//  - only marked work counts: an unsubmitted assignment, an unattempted quiz or
//    a mark the teacher hasn't entered is pending, never a zero;
//  - a draft submission is not a submission;
//  - a quiz counts its best completed attempt;
//  - a recorded mark flagged "not in final grade" is left out;
//  - a subject score is the mean of its marked items (of the chosen kind);
//  - the overall score is the mean of subject scores, so every subject weighs
//    the same however many items it has;
//  - ties share a rank (1, 2, 2, 4).
//
// The cohort is everyone with at least one mark in the subjects being ranked,
// narrowed to a class group when one applies:
//  - a student is always ranked within their current class group (overall
//    and per subject). A subject is often taught to several class groups, so
//    "everyone with marks in my subjects" would put other classes, and anyone
//    sharing just one subject, into "my place in class". The class roster
//    comes from MIS (utils/rankingCohorts); only when it can't be read does
//    the student fall back to the subject cohort, and the view says so;
//  - staff rank everyone in their subjects, and can narrow to a class group or
//    a grade. Every row also carries its place within its class and grade.
//
// Privacy: the student view never carries another student's key, name or
// score. Aggregates (class average, points to the next place) are only
// disclosed when at least MIN_COHORT_FOR_AGGREGATES students are ranked —
// in a cohort of two, "the class average" is simply the other student's mark.

export type RankKind = "assignment" | "quiz" | "recorded";
export type RankKindFilter = "all" | RankKind;
export const RANK_KINDS: RankKind[] = ["assignment", "quiz", "recorded"];

export const MIN_COHORT_FOR_AGGREGATES = 5;

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface Mark {
  /** Student key: "m<mis id>" when the MIS id is known, else "l<local id>". */
  key: string;
  course_id: string;
  kind: RankKind;
  item_id: number;
  title: string;
  pct: number;
  date: string | null;
}

export const studentKey = (misId: number | null | undefined, localId: number | null | undefined) =>
  misId !== null && misId !== undefined && !isNaN(Number(misId))
    ? `m${Number(misId)}`
    : `l${Number(localId)}`;

type StudentRef = { id?: number | null; mis_user_id?: number | null } | null | undefined;

export interface MarkSources {
  assignments: Array<{
    id: number;
    course_id: number | string | null;
    title: string;
    max_score: number | string | null;
    due_date?: Date | string | null;
    status?: string;
  }>;
  submissions: Array<{
    assignment_id: number;
    grade: string | null;
    status: string;
    student_id: number;
    submitted_at?: Date | string | null;
    student?: StudentRef;
  }>;
  quizzes: Array<{
    id: number;
    course_id: number | string | null;
    title: string;
    status?: string;
    start_date?: Date | string | null;
    end_date?: Date | string | null;
  }>;
  /** Completed attempts only. */
  quizSubmissions: Array<{
    quiz_id: number;
    percentage: number | string;
    total_score: number | string;
    student_id: number;
    completed_at?: Date | string | null;
    student?: StudentRef;
  }>;
  manual: Array<{
    id: number;
    course_id: number | string;
    title: string;
    counts_to_final: boolean;
    max_score: number;
    date: string | null;
  }>;
  /** manual_assessment_scores rows; student_id is a MIS id or a local id. */
  manualScores: Array<{ manual_assessment_id: number; student_id: number; score: number }>;
  /** Local users that may be referenced by the rows above. */
  localUsers: Array<{ id: number; mis_user_id: number | null }>;
  /** MIS ids known from a roster, if any. */
  knownMisIds?: Iterable<number>;
}

const iso = (d: Date | string | null | undefined): string | null => {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) ? null : date.toISOString();
};

/**
 * `manual_assessment_scores.student_id` holds the MIS id for enrolled students
 * and the local users.id for local-only ones (see utils/manualAssessments).
 * An id is read as a MIS id whenever anything says it is one; it is only read
 * as a local id when that local user has no MIS id.
 */
export const manualScoreResolver = (
  localUsers: MarkSources["localUsers"],
  knownMisIds: Iterable<number> = [],
) => {
  const misIds = new Set<number>(knownMisIds);
  const localOnly = new Set<number>();
  for (const u of localUsers) {
    if (u.mis_user_id !== null && u.mis_user_id !== undefined) misIds.add(Number(u.mis_user_id));
    else localOnly.add(Number(u.id));
  }
  return (id: number): string => {
    const n = Number(id);
    if (misIds.has(n)) return `m${n}`;
    if (localOnly.has(n)) return `l${n}`;
    return `m${n}`;
  };
};

/** Every mark that counts, one per student per item. */
export const collectMarks = (src: MarkSources): Mark[] => {
  const marks: Mark[] = [];
  const keyOf = (sub: { student_id: number; student?: StudentRef }) =>
    studentKey(sub.student?.mis_user_id, sub.student?.id ?? sub.student_id);

  // Assignments — best graded, non-draft submission per student.
  const assignmentById = new Map(src.assignments.map((a) => [a.id, a]));
  const bestAssignment = new Map<string, Mark>();
  for (const sub of src.submissions) {
    if (sub.status === "draft") continue;
    const a = assignmentById.get(sub.assignment_id);
    if (!a || a.course_id === null || a.course_id === undefined) continue;
    const pct = gradePercentage(sub.grade, a.max_score);
    if (pct === null) continue;
    const key = keyOf(sub);
    const id = `${a.id}:${key}`;
    const prev = bestAssignment.get(id);
    if (!prev || pct > prev.pct) {
      bestAssignment.set(id, {
        key,
        course_id: String(a.course_id),
        kind: "assignment",
        item_id: a.id,
        title: a.title,
        pct: round1(pct),
        date: iso(sub.submitted_at) ?? iso(a.due_date),
      });
    }
  }
  marks.push(...bestAssignment.values());

  // Quizzes — best completed attempt per student.
  const quizById = new Map(src.quizzes.map((q) => [q.id, q]));
  const attempts = new Map<string, typeof src.quizSubmissions>();
  for (const sub of src.quizSubmissions) {
    const q = quizById.get(sub.quiz_id);
    if (!q || q.course_id === null || q.course_id === undefined) continue;
    const id = `${q.id}:${keyOf(sub)}`;
    const list = attempts.get(id) ?? [];
    list.push(sub);
    attempts.set(id, list);
  }
  for (const subs of attempts.values()) {
    const best = bestBySubmissionScore(subs);
    const pct = best ? Number(best.percentage) : NaN;
    if (!best || isNaN(pct)) continue;
    const q = quizById.get(best.quiz_id)!;
    marks.push({
      key: keyOf(best),
      course_id: String(q.course_id),
      kind: "quiz",
      item_id: q.id,
      title: q.title,
      pct: round1(pct),
      date: iso(best.completed_at),
    });
  }

  // Recorded marks.
  const resolve = manualScoreResolver(src.localUsers, src.knownMisIds);
  const manualById = new Map(src.manual.map((m) => [m.id, m]));
  const seen = new Set<string>();
  for (const s of src.manualScores) {
    const m = manualById.get(s.manual_assessment_id);
    if (!m || !m.counts_to_final || !(m.max_score > 0)) continue;
    const score = Number(s.score);
    if (isNaN(score)) continue;
    const key = resolve(s.student_id);
    const id = `${m.id}:${key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    marks.push({
      key,
      course_id: String(m.course_id),
      kind: "recorded",
      item_id: m.id,
      title: m.title,
      pct: round1((score / m.max_score) * 100),
      date: m.date,
    });
  }

  return marks;
};

// ─── Ranking ─────────────────────────────────────────────────────────────────

export interface KindScore {
  score: number;
  count: number;
}

export interface SubjectResult {
  score: number;
  count: number;
  by_kind: Partial<Record<RankKind, KindScore>>;
}

export interface RankedStudent {
  key: string;
  rank: number;
  score: number;
  marked_items: number;
  subjects: Record<string, SubjectResult>;
}

const matchesKind = (m: Mark, kind: RankKindFilter) => kind === "all" || m.kind === kind;

/** Shared ranks (1, 2, 2, 4) for a list already sorted best first. */
const sharedRanks = (sorted: Array<{ score: number }>): number[] => {
  let rank = 0;
  return sorted.map((s, i) => {
    if (i === 0 || s.score !== sorted[i - 1].score) rank = i + 1;
    return rank;
  });
};

/** Per-student, per-subject scores for the given subjects and kind. */
export const scoreStudents = (
  marks: Mark[],
  courseIds: string[],
  kind: RankKindFilter,
): Map<string, Record<string, SubjectResult>> => {
  const courses = new Set(courseIds);
  const sums = new Map<string, Map<string, Map<RankKind, [number, number]>>>();
  for (const m of marks) {
    if (!courses.has(m.course_id) || !matchesKind(m, kind)) continue;
    const byCourse = sums.get(m.key) ?? new Map();
    sums.set(m.key, byCourse);
    const byKind = byCourse.get(m.course_id) ?? new Map();
    byCourse.set(m.course_id, byKind);
    const tally = byKind.get(m.kind) ?? [0, 0];
    tally[0] += m.pct;
    tally[1] += 1;
    byKind.set(m.kind, tally);
  }

  const out = new Map<string, Record<string, SubjectResult>>();
  for (const [key, byCourse] of sums) {
    const subjects: Record<string, SubjectResult> = {};
    for (const [courseId, byKind] of byCourse) {
      let sum = 0;
      let count = 0;
      const by_kind: SubjectResult["by_kind"] = {};
      for (const [k, [s, c]] of byKind) {
        by_kind[k] = { score: round1(s / c), count: c };
        sum += s;
        count += c;
      }
      subjects[courseId] = { score: round1(sum / count), count, by_kind };
    }
    out.set(key, subjects);
  }
  return out;
};

/** Everyone with a mark, best first, with shared ranks for ties. */
export const rankStudents = (
  marks: Mark[],
  courseIds: string[],
  kind: RankKindFilter,
): RankedStudent[] => {
  const scored = [...scoreStudents(marks, courseIds, kind)].map(([key, subjects]) => {
    const subjectScores = Object.values(subjects);
    return {
      key,
      subjects,
      score: round1(subjectScores.reduce((a, s) => a + s.score, 0) / subjectScores.length),
      marked_items: subjectScores.reduce((a, s) => a + s.count, 0),
    };
  });
  scored.sort((a, b) => b.score - a.score || b.marked_items - a.marked_items || a.key.localeCompare(b.key));
  const ranks = sharedRanks(scored);
  return scored.map((s, i) => ({ ...s, rank: ranks[i] }));
};

export interface CohortSummary {
  ranked_count: number;
  average: number | null;
  median: number | null;
  highest: number | null;
  lowest: number | null;
}

export const summarise = (ranked: Array<{ score: number }>): CohortSummary => {
  const scores = ranked.map((r) => r.score).sort((a, b) => b - a);
  const n = scores.length;
  if (n === 0) return { ranked_count: 0, average: null, median: null, highest: null, lowest: null };
  const mid = Math.floor(n / 2);
  return {
    ranked_count: n,
    average: round1(scores.reduce((a, s) => a + s, 0) / n),
    median: n % 2 ? scores[mid] : round1((scores[mid - 1] + scores[mid]) / 2),
    highest: scores[0],
    lowest: scores[n - 1],
  };
};

export type PerformanceStatus = "excelling" | "on_track" | "needs_attention" | "at_risk" | "no_marks";

/**
 * The client's score bands (80 / 65 / 50, services/subjectReportApi BANDS),
 * nudged down one step when well below the class.
 */
export const performanceStatus = (score: number | null, gap: number | null = null): PerformanceStatus => {
  if (score === null) return "no_marks";
  const order: PerformanceStatus[] = ["excelling", "on_track", "needs_attention", "at_risk"];
  let i = score >= 80 ? 0 : score >= 65 ? 1 : score >= 50 ? 2 : 3;
  if (gap !== null && gap <= -10 && i < 2) i = 2;
  return order[i];
};

export const rankBand = (rank: number, of: number): string => {
  const share = rank / of;
  if (rank === 1) return "Top of the cohort";
  if (share <= 0.1) return "Top 10%";
  if (share <= 0.25) return "Top quarter";
  if (share <= 0.5) return "Upper half";
  if (share <= 0.75) return "Lower half";
  return "Bottom quarter";
};

// ─── Outstanding work (student view) ─────────────────────────────────────────

export type PendingStatus = "overdue" | "due_soon" | "open" | "awaiting_mark" | "missed";

export interface PendingItem {
  kind: RankKind;
  course_id: string;
  item_id: number;
  title: string;
  due_date: string | null;
  status: PendingStatus;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * The student's own outstanding work in the given subjects: assignments not
 * handed in, quizzes not taken, and work handed in but not marked yet.
 */
export const collectPending = (
  src: Pick<MarkSources, "assignments" | "submissions" | "quizzes" | "quizSubmissions">,
  me: { mis_user_id: number | null; user_id: number | null },
  courseIds: string[],
  now: Date,
): PendingItem[] => {
  const courses = new Set(courseIds);
  const isMe = (sub: { student_id: number; student?: StudentRef }) =>
    (me.user_id !== null && Number(sub.student_id) === me.user_id) ||
    (me.mis_user_id !== null &&
      sub.student?.mis_user_id !== null &&
      sub.student?.mis_user_id !== undefined &&
      Number(sub.student.mis_user_id) === me.mis_user_id);

  const out: PendingItem[] = [];

  const mySubs = new Map<number, typeof src.submissions>();
  for (const s of src.submissions) {
    if (s.status === "draft" || !isMe(s)) continue;
    mySubs.set(s.assignment_id, [...(mySubs.get(s.assignment_id) ?? []), s]);
  }
  for (const a of src.assignments) {
    const courseId = String(a.course_id);
    if (!courses.has(courseId) || (a.status && a.status !== "published")) continue;
    const subs = mySubs.get(a.id) ?? [];
    const due = iso(a.due_date);
    if (subs.length === 0) {
      const dueMs = due ? new Date(due).getTime() : null;
      const status: PendingStatus =
        dueMs === null ? "open" : dueMs < now.getTime() ? "overdue" : dueMs - now.getTime() <= 7 * DAY ? "due_soon" : "open";
      out.push({ kind: "assignment", course_id: courseId, item_id: a.id, title: a.title, due_date: due, status });
    } else if (subs.every((s) => gradePercentage(s.grade, a.max_score) === null)) {
      out.push({ kind: "assignment", course_id: courseId, item_id: a.id, title: a.title, due_date: due, status: "awaiting_mark" });
    }
  }

  const taken = new Set(src.quizSubmissions.filter(isMe).map((s) => s.quiz_id));
  for (const q of src.quizzes) {
    const courseId = String(q.course_id);
    if (!courses.has(courseId) || (q.status && q.status !== "published") || taken.has(q.id)) continue;
    const start = iso(q.start_date);
    if (start && new Date(start).getTime() > now.getTime() + 7 * DAY) continue;
    const end = iso(q.end_date);
    const endMs = end ? new Date(end).getTime() : null;
    const status: PendingStatus =
      endMs === null ? "open" : endMs < now.getTime() ? "missed" : endMs - now.getTime() <= 3 * DAY ? "due_soon" : "open";
    out.push({ kind: "quiz", course_id: courseId, item_id: q.id, title: q.title, due_date: end, status });
  }

  const weight: Record<PendingStatus, number> = { overdue: 0, due_soon: 1, missed: 2, open: 3, awaiting_mark: 4 };
  return out.sort(
    (a, b) =>
      weight[a.status] - weight[b.status] ||
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
      a.title.localeCompare(b.title),
  );
};

// ─── Student view ────────────────────────────────────────────────────────────

export interface SubjectInfo {
  course_id: string;
  name: string;
  code: string | null;
}

export interface StudentSubjectView extends SubjectInfo {
  score: number | null;
  rank: number | null;
  ranked_count: number;
  class_average: number | null;
  gap: number | null;
  status: PerformanceStatus;
  by_kind: Partial<Record<RankKind, KindScore>>;
  marked_items: number;
  pending_count: number;
  /** The student's own lowest marks in the subject (below 60%), worst first. */
  weakest: Array<{ kind: RankKind; item_id: number; title: string; pct: number }>;
}

export type SuggestionPriority = "high" | "medium" | "low";

export interface Suggestion {
  id: string;
  priority: SuggestionPriority;
  category: "deadline" | "subject" | "skill" | "review" | "rank" | "strength" | "getting_started";
  title: string;
  detail: string;
  course_id?: string;
  action?: { label: string; href: string };
}

/** Who a student is ranked against. */
export type StudentCohort =
  | { type: "class_group"; class_group_id: number; class_group_name: string; grade_name: string | null }
  /** Class roster unavailable: everyone with marks in the student's subjects. */
  | { type: "subjects" };

export interface StudentView {
  view: "student";
  scope: { subject_id: string | null; kind: RankKindFilter };
  cohort: StudentCohort;
  overall: {
    rank: number | null;
    ranked_count: number;
    score: number | null;
    band: string | null;
    top_percent: number | null;
    class_average: number | null;
    points_to_next: number | null;
    marked_items: number;
    status: PerformanceStatus;
  };
  subjects: StudentSubjectView[];
  pending: PendingItem[];
  suggestions: Suggestion[];
  privacy: { aggregates_hidden: boolean; min_cohort: number };
}

const KIND_LABEL: Record<RankKind, string> = {
  assignment: "assignments",
  quiz: "quizzes",
  recorded: "recorded assessments",
};

const hrefFor = (item: { kind: RankKind; item_id: number; course_id: string }) =>
  item.kind === "assignment"
    ? `/assignments/${item.item_id}`
    : item.kind === "quiz"
      ? "/my-quizzes"
      : `/courses/${item.course_id}`;

export const buildSuggestions = (
  subjects: StudentSubjectView[],
  pending: PendingItem[],
  overall: StudentView["overall"],
): Suggestion[] => {
  const out: Suggestion[] = [];
  const nameOf = new Map(subjects.map((s) => [s.course_id, s.name]));

  // Deadlines first — the cheapest marks to win are the ones not lost yet.
  const overdue = pending.filter((p) => p.kind === "assignment" && p.status === "overdue");
  for (const p of overdue.slice(0, 3)) {
    out.push({
      id: `overdue-${p.item_id}`,
      priority: "high",
      category: "deadline",
      title: `Submit "${p.title}"`,
      detail: `This ${nameOf.get(p.course_id) ?? "subject"} assignment is past its due date and not handed in. Talk to your teacher and hand it in as soon as possible — it can't count until it's submitted.`,
      course_id: p.course_id,
      action: { label: "Open assignment", href: hrefFor(p) },
    });
  }
  const dueSoon = pending.filter((p) => p.status === "due_soon");
  for (const p of dueSoon.slice(0, 3)) {
    out.push({
      id: `due-${p.kind}-${p.item_id}`,
      priority: "high",
      category: "deadline",
      title: p.kind === "quiz" ? `Take the quiz "${p.title}"` : `Hand in "${p.title}"`,
      detail: `Due soon in ${nameOf.get(p.course_id) ?? "this subject"}. Plan time for it now so it doesn't slip.`,
      course_id: p.course_id,
      action: { label: p.kind === "quiz" ? "Go to my quizzes" : "Open assignment", href: hrefFor(p) },
    });
  }
  const openQuizzes = pending.filter((p) => p.kind === "quiz" && p.status === "open");
  if (openQuizzes.length > 0) {
    out.push({
      id: "open-quizzes",
      priority: "medium",
      category: "deadline",
      title: `${openQuizzes.length} quiz${openQuizzes.length === 1 ? "" : "zes"} waiting for you`,
      detail: `Available now: ${openQuizzes.slice(0, 3).map((q) => `"${q.title}"`).join(", ")}${openQuizzes.length > 3 ? "…" : ""}. Every quiz you take adds to your average.`,
      action: { label: "Go to my quizzes", href: "/my-quizzes" },
    });
  }

  // Subjects that need work, weakest first.
  const ranked = subjects.filter((s) => s.score !== null).sort((a, b) => a.score! - b.score!);
  for (const s of ranked) {
    const weakest = s.weakest[0];
    const review = weakest ? ` Start by going over "${weakest.title}" (${weakest.pct}%).` : "";
    if (s.status === "at_risk") {
      out.push({
        id: `risk-${s.course_id}`,
        priority: "high",
        category: "subject",
        title: `${s.name} needs urgent attention`,
        detail: `Your average is ${s.score}%, below the 50% pass mark.${review} Ask your teacher for extra help or practice work.`,
        course_id: s.course_id,
        action: { label: "Open subject", href: `/courses/${s.course_id}` },
      });
    } else if (s.gap !== null && s.gap <= -5) {
      out.push({
        id: `gap-${s.course_id}`,
        priority: "medium",
        category: "subject",
        title: `Close the gap in ${s.name}`,
        detail: `You're ${Math.abs(s.gap)} points below the class average (${s.score}% vs ${s.class_average}%).${review}`,
        course_id: s.course_id,
        action: { label: "Open subject", href: `/courses/${s.course_id}` },
      });
    } else if (s.status === "needs_attention") {
      out.push({
        id: `attention-${s.course_id}`,
        priority: "medium",
        category: "subject",
        title: `Lift your ${s.name} average`,
        detail: `You're at ${s.score}%, just above the pass mark.${review}`,
        course_id: s.course_id,
        action: { label: "Open subject", href: `/courses/${s.course_id}` },
      });
    }

    // One kind of work pulling the subject down.
    const kinds = (Object.entries(s.by_kind) as Array<[RankKind, KindScore]>).sort((a, b) => a[1].score - b[1].score);
    if (kinds.length >= 2) {
      const [weakKind, weak] = kinds[0];
      const [strongKind, strong] = kinds[kinds.length - 1];
      if (strong.score - weak.score >= 15 && weak.score < 65) {
        out.push({
          id: `skill-${s.course_id}-${weakKind}`,
          priority: "medium",
          category: "skill",
          title: `Your ${KIND_LABEL[weakKind]} are holding back ${s.name}`,
          detail: `You average ${weak.score}% on ${KIND_LABEL[weakKind]} but ${strong.score}% on ${KIND_LABEL[strongKind]}. ${
            weakKind === "quiz"
              ? "Revise the topics before each quiz and review your answers afterwards."
              : weakKind === "assignment"
                ? "Read the instructions and rubric carefully and ask for feedback before the deadline."
                : "Prepare for in-class tests the way you prepare for your best work."
          }`,
          course_id: s.course_id,
        });
      }
    }
  }

  // Individual low marks worth revisiting (subjects not already flagged).
  const flagged = new Set(out.filter((o) => o.category === "subject").map((o) => o.course_id));
  const lows = subjects
    .filter((s) => !flagged.has(s.course_id))
    .flatMap((s) => s.weakest.filter((w) => w.pct < 50).map((w) => ({ ...w, course_id: s.course_id, subject: s.name })))
    .sort((a, b) => a.pct - b.pct);
  for (const w of lows.slice(0, 2)) {
    out.push({
      id: `review-${w.kind}-${w.item_id}`,
      priority: "low",
      category: "review",
      title: `Review "${w.title}"`,
      detail: `You scored ${w.pct}% in this ${w.subject} ${w.kind === "recorded" ? "assessment" : w.kind}. Go over the corrections so the same mistakes don't cost marks again.`,
      course_id: w.course_id,
    });
  }

  const unmarked = subjects.filter((s) => s.score === null);
  if (overall.score === null) {
    out.push({
      id: "get-started",
      priority: "medium",
      category: "getting_started",
      title: "Get your first marks",
      detail: "You're not ranked yet because nothing has been marked. Hand in assignments and take quizzes to appear in the ranking.",
      action: { label: "Go to my quizzes", href: "/my-quizzes" },
    });
  } else if (unmarked.length > 0) {
    out.push({
      id: "unmarked-subjects",
      priority: "low",
      category: "getting_started",
      title: `No marks yet in ${unmarked.length} subject${unmarked.length === 1 ? "" : "s"}`,
      detail: `${unmarked.map((s) => s.name).slice(0, 4).join(", ")}${unmarked.length > 4 ? "…" : ""}. These don't count against you, but completing work there broadens your average.`,
    });
  }

  if (overall.points_to_next !== null && overall.rank !== null && overall.rank > 1) {
    out.push({
      id: "next-place",
      priority: "low",
      category: "rank",
      title: `${overall.points_to_next} points to move up`,
      detail: `Raising your average by ${overall.points_to_next} points would move you up at least one place. One strong mark in your weakest subject is usually the fastest way.`,
    });
  }

  const best = ranked[ranked.length - 1];
  if (best && best.score !== null && best.score >= 70 && ranked.length > 1) {
    out.push({
      id: `strength-${best.course_id}`,
      priority: "low",
      category: "strength",
      title: `Keep it up in ${best.name}`,
      detail: `${best.name} is your strongest subject at ${best.score}%. The habits that work there — use them in your weaker subjects.`,
      course_id: best.course_id,
    });
  }

  const order: Record<SuggestionPriority, number> = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 10);
};

export const buildStudentView = (input: {
  meKey: string;
  subjects: SubjectInfo[];
  marks: Mark[];
  pending: PendingItem[];
  kind: RankKindFilter;
  subjectId: string | null;
  /**
   * The student's class group and its members' keys. Everyone else's marks
   * are dropped before ranking; null ranks against the whole subject cohort.
   */
  classCohort?: { class_group_id: number; class_group_name: string; grade_name: string | null; keys: Set<string> } | null;
}): StudentView => {
  const { meKey, kind, subjectId } = input;
  const classCohort = input.classCohort ?? null;
  const marks = classCohort
    ? input.marks.filter((m) => m.key === meKey || classCohort.keys.has(m.key))
    : input.marks;
  const subjects = subjectId ? input.subjects.filter((s) => s.course_id === subjectId) : input.subjects;
  const courseIds = subjects.map((s) => s.course_id);
  const pending = input.pending.filter((p) => courseIds.includes(p.course_id));

  const overallRanked = rankStudents(marks, courseIds, kind);
  const summary = summarise(overallRanked);
  const showAggregates = summary.ranked_count >= MIN_COHORT_FOR_AGGREGATES;
  const mine = overallRanked.find((r) => r.key === meKey) ?? null;

  let pointsToNext: number | null = null;
  if (mine && mine.rank > 1 && showAggregates) {
    const above = overallRanked.filter((r) => r.score > mine.score).map((r) => r.score);
    pointsToNext = round1(Math.min(...above) - mine.score);
  }

  const subjectViews: StudentSubjectView[] = subjects.map((s) => {
    const ranked = rankStudents(marks, [s.course_id], kind);
    const sum = summarise(ranked);
    const me = ranked.find((r) => r.key === meKey) ?? null;
    const visible = sum.ranked_count >= MIN_COHORT_FOR_AGGREGATES;
    const result = me?.subjects[s.course_id] ?? null;
    const gap = me && visible && sum.average !== null ? round1(me.score - sum.average) : null;
    const weakest = marks
      .filter((m) => m.key === meKey && m.course_id === s.course_id && matchesKind(m, kind) && m.pct < 60)
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 3)
      .map((m) => ({ kind: m.kind, item_id: m.item_id, title: m.title, pct: m.pct }));
    return {
      ...s,
      score: me?.score ?? null,
      rank: me?.rank ?? null,
      ranked_count: sum.ranked_count,
      class_average: visible ? sum.average : null,
      gap,
      status: performanceStatus(me?.score ?? null, gap),
      by_kind: result?.by_kind ?? {},
      marked_items: result?.count ?? 0,
      pending_count: pending.filter((p) => p.course_id === s.course_id && p.status !== "awaiting_mark").length,
      weakest,
    };
  });

  const overall: StudentView["overall"] = {
    rank: mine?.rank ?? null,
    ranked_count: summary.ranked_count,
    score: mine?.score ?? null,
    band: mine ? rankBand(mine.rank, summary.ranked_count) : null,
    top_percent: mine ? Math.max(1, Math.round((mine.rank / summary.ranked_count) * 100)) : null,
    class_average: showAggregates ? summary.average : null,
    points_to_next: pointsToNext,
    marked_items: mine?.marked_items ?? 0,
    status: performanceStatus(
      mine?.score ?? null,
      mine && showAggregates && summary.average !== null ? round1(mine.score - summary.average) : null,
    ),
  };

  return {
    view: "student",
    scope: { subject_id: subjectId, kind },
    cohort: classCohort
      ? {
          type: "class_group",
          class_group_id: classCohort.class_group_id,
          class_group_name: classCohort.class_group_name,
          grade_name: classCohort.grade_name,
        }
      : { type: "subjects" },
    overall,
    subjects: subjectViews,
    pending: pending.slice(0, 20),
    suggestions: buildSuggestions(subjectViews, pending, overall),
    privacy: {
      aggregates_hidden: !showAggregates || subjectViews.some((s) => s.ranked_count > 0 && s.ranked_count < MIN_COHORT_FOR_AGGREGATES),
      min_cohort: MIN_COHORT_FOR_AGGREGATES,
    },
  };
};

// ─── Staff view ──────────────────────────────────────────────────────────────

export interface RosterEntry {
  key: string;
  mis_user_id: number | null;
  name: string;
  class_group_id: number | null;
  class_group_name: string | null;
}

/** A student's class group (and its grade) for the selected academic year. */
export interface ClassPlacement {
  class_group_id: number;
  class_group_name: string;
  grade_id: number | null;
  grade_name: string | null;
}

export interface LeaderboardRow {
  rank: number;
  key: string;
  mis_user_id: number | null;
  name: string;
  class_group_id: number | null;
  class_group_name: string | null;
  grade_id: number | null;
  grade_name: string | null;
  /** Place within the student's class group / grade (same rules, ties shared). */
  class_rank: number | null;
  class_size: number | null;
  grade_rank: number | null;
  grade_size: number | null;
  score: number;
  status: PerformanceStatus;
  marked_items: number;
  subjects_marked: number;
  subject_scores: Record<string, number>;
  by_kind: Partial<Record<RankKind, number>>;
}

/** One class group or grade in the current selection; id null = no class group. */
export interface GroupSummary {
  id: number | null;
  name: string;
  grade_name: string | null;
  ranked_count: number;
  unranked_count: number;
  average: number | null;
  median: number | null;
  highest: number | null;
  lowest: number | null;
  distribution: { excelling: number; on_track: number; needs_attention: number; at_risk: number };
}

export interface StaffView {
  view: "staff";
  scope: { subject_id: string | null; kind: RankKindFilter; class_group_id: number | null; grade_id: number | null };
  subjects: Array<SubjectInfo & { ranked_count: number; average: number | null }>;
  /** Filter options: every class group / grade with a student in the subjects. */
  class_groups: Array<{ id: number; name: string; grade_id: number | null; grade_name: string | null }>;
  grades: Array<{ id: number; name: string }>;
  summary: CohortSummary & {
    distribution: { excelling: number; on_track: number; needs_attention: number; at_risk: number };
    unranked_count: number;
  };
  /** The current selection broken down by class group and by grade. */
  groups: { class_groups: GroupSummary[]; grades: GroupSummary[] };
  rows: LeaderboardRow[];
  unranked: Array<{
    key: string;
    mis_user_id: number | null;
    name: string;
    class_group_id: number | null;
    class_group_name: string | null;
    grade_id: number | null;
    grade_name: string | null;
  }>;
}

const emptyDistribution = () => ({ excelling: 0, on_track: 0, needs_attention: 0, at_risk: 0 });

export const buildStaffView = (input: {
  subjects: SubjectInfo[];
  marks: Mark[];
  roster: RosterEntry[];
  /** Names for students off the roster (local accounts). */
  fallbackNames: Map<string, { name: string; mis_user_id: number | null }>;
  /** Student key -> class group and grade. A student missing here has no class group. */
  placements?: Map<string, ClassPlacement>;
  kind: RankKindFilter;
  subjectId: string | null;
  classGroupId: number | null;
  gradeId?: number | null;
}): StaffView => {
  const { kind, subjectId, classGroupId } = input;
  const gradeId = input.gradeId ?? null;
  const subjects = subjectId ? input.subjects.filter((s) => s.course_id === subjectId) : input.subjects;
  const courseIds = subjects.map((s) => s.course_id);
  const courseSet = new Set(courseIds);

  const rosterByKey = new Map<string, RosterEntry>();
  for (const r of input.roster) if (!rosterByKey.has(r.key)) rosterByKey.set(r.key, r);

  // A placement from MIS class rosters wins; a roster row that names its class
  // group (the teacher roster does) is the fallback.
  const placements = new Map<string, ClassPlacement>(input.placements ?? []);
  for (const r of rosterByKey.values()) {
    if (!placements.has(r.key) && r.class_group_id !== null && r.class_group_name) {
      placements.set(r.key, { class_group_id: r.class_group_id, class_group_name: r.class_group_name, grade_id: null, grade_name: null });
    }
  }

  // Everyone in these subjects (marked or enrolled) decides the filter options.
  const inSubjects = new Set<string>(rosterByKey.keys());
  for (const m of input.marks) if (courseSet.has(m.course_id)) inSubjects.add(m.key);
  const classOptions = new Map<number, StaffView["class_groups"][number]>();
  const gradeOptions = new Map<number, string>();
  for (const key of inSubjects) {
    const p = placements.get(key);
    if (!p) continue;
    if (!classOptions.has(p.class_group_id)) {
      classOptions.set(p.class_group_id, { id: p.class_group_id, name: p.class_group_name, grade_id: p.grade_id, grade_name: p.grade_name });
    }
    if (p.grade_id !== null && !gradeOptions.has(p.grade_id)) gradeOptions.set(p.grade_id, p.grade_name ?? `Grade ${p.grade_id}`);
  }

  // Class-group and grade filters rank within that group only.
  const inSelection = (key: string) => {
    if (classGroupId === null && gradeId === null) return true;
    const p = placements.get(key);
    if (!p) return false;
    return (classGroupId === null || p.class_group_id === classGroupId) && (gradeId === null || p.grade_id === gradeId);
  };
  const filtering = classGroupId !== null || gradeId !== null;
  const marks = filtering ? input.marks.filter((m) => inSelection(m.key)) : input.marks;

  const ranked = rankStudents(marks, courseIds, kind);
  const summary = summarise(ranked);

  // Place within class group and grade, over the whole subject cohort (the
  // same numbers whichever filter is on).
  const everyone = filtering ? rankStudents(input.marks, courseIds, kind) : ranked;
  const classPlace = new Map<string, { rank: number; size: number }>();
  const gradePlace = new Map<string, { rank: number; size: number }>();
  const placeWithin = (groupOf: (key: string) => number | null, out: Map<string, { rank: number; size: number }>) => {
    const byGroup = new Map<number, RankedStudent[]>();
    for (const r of everyone) {
      const g = groupOf(r.key);
      if (g === null) continue;
      const list = byGroup.get(g) ?? [];
      list.push(r);
      byGroup.set(g, list);
    }
    for (const list of byGroup.values()) {
      const ranks = sharedRanks(list);
      list.forEach((r, i) => out.set(r.key, { rank: ranks[i], size: list.length }));
    }
  };
  placeWithin((k) => placements.get(k)?.class_group_id ?? null, classPlace);
  placeWithin((k) => placements.get(k)?.grade_id ?? null, gradePlace);

  const identify = (key: string) => {
    const p = placements.get(key);
    const placement = {
      class_group_id: p?.class_group_id ?? null,
      class_group_name: p?.class_group_name ?? rosterByKey.get(key)?.class_group_name ?? null,
      grade_id: p?.grade_id ?? null,
      grade_name: p?.grade_name ?? null,
    };
    const r = rosterByKey.get(key);
    if (r) return { name: r.name, mis_user_id: r.mis_user_id, ...placement };
    const f = input.fallbackNames.get(key);
    return { name: f?.name ?? "Unknown student", mis_user_id: f?.mis_user_id ?? null, ...placement };
  };

  const rows: LeaderboardRow[] = ranked.map((r) => {
    const byKind: Partial<Record<RankKind, [number, number]>> = {};
    for (const s of Object.values(r.subjects)) {
      for (const [k, v] of Object.entries(s.by_kind) as Array<[RankKind, KindScore]>) {
        const t = (byKind[k] ??= [0, 0]);
        t[0] += v.score * v.count;
        t[1] += v.count;
      }
    }
    const cp = classPlace.get(r.key);
    const gp = gradePlace.get(r.key);
    return {
      rank: r.rank,
      key: r.key,
      ...identify(r.key),
      class_rank: cp?.rank ?? null,
      class_size: cp?.size ?? null,
      grade_rank: gp?.rank ?? null,
      grade_size: gp?.size ?? null,
      score: r.score,
      status: performanceStatus(r.score),
      marked_items: r.marked_items,
      subjects_marked: Object.keys(r.subjects).length,
      subject_scores: Object.fromEntries(Object.entries(r.subjects).map(([id, s]) => [id, s.score])),
      by_kind: Object.fromEntries(
        (Object.entries(byKind) as Array<[RankKind, [number, number]]>).map(([k, [s, c]]) => [k, round1(s / c)]),
      ),
    };
  });

  const rankedKeys = new Set(ranked.map((r) => r.key));
  const unranked = [...rosterByKey.values()]
    .filter((r) => !rankedKeys.has(r.key) && inSelection(r.key))
    .map((r) => ({ key: r.key, ...identify(r.key) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const distribution = emptyDistribution();
  for (const row of rows) distribution[row.status as keyof typeof distribution] += 1;

  // Breakdown of the current selection by class group and by grade.
  const summariseGroups = (
    idOf: (x: { class_group_id: number | null; grade_id: number | null }) => number | null,
    labelOf: (x: { class_group_name: string | null; grade_name: string | null }) => { name: string; grade_name: string | null },
    noneLabel: string,
  ): GroupSummary[] => {
    const groups = new Map<number | null, { name: string; grade_name: string | null; rows: LeaderboardRow[]; unranked: number }>();
    const slot = (x: Parameters<typeof idOf>[0] & Parameters<typeof labelOf>[0]) => {
      const id = idOf(x);
      if (!groups.has(id)) groups.set(id, { ...(id === null ? { name: noneLabel, grade_name: null } : labelOf(x)), rows: [], unranked: 0 });
      return groups.get(id)!;
    };
    for (const row of rows) slot(row).rows.push(row);
    for (const u of unranked) slot(u).unranked += 1;
    return [...groups]
      .map(([id, g]) => {
        const dist = emptyDistribution();
        for (const row of g.rows) dist[row.status as keyof typeof dist] += 1;
        return { id, name: g.name, grade_name: g.grade_name, ...summarise(g.rows), unranked_count: g.unranked, distribution: dist };
      })
      .sort((a, b) => (a.id === null ? 1 : b.id === null ? -1 : a.name.localeCompare(b.name, undefined, { numeric: true })));
  };

  return {
    view: "staff",
    scope: { subject_id: subjectId, kind, class_group_id: classGroupId, grade_id: gradeId },
    subjects: subjects.map((s) => {
      const sum = summarise(ranked.filter((r) => r.subjects[s.course_id]).map((r) => ({ score: r.subjects[s.course_id].score })));
      return { ...s, ranked_count: sum.ranked_count, average: sum.average };
    }),
    class_groups: [...classOptions.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    grades: [...gradeOptions]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    summary: { ...summary, distribution, unranked_count: unranked.length },
    groups: {
      class_groups: summariseGroups(
        (x) => x.class_group_id,
        (x) => ({ name: x.class_group_name ?? "", grade_name: x.grade_name }),
        "No class group",
      ),
      grades: summariseGroups(
        (x) => x.grade_id,
        (x) => ({ name: x.grade_name ?? "", grade_name: x.grade_name }),
        "No grade",
      ),
    },
    rows,
    unranked,
  };
};

// ─── Navbar summary (student) ────────────────────────────────────────────────
// GET /api/rankings?summary=1 — the student's standing in one glance for the
// top bar: position, average against the class, what is at risk, and the one
// thing to do next. Derived from the full student view so the numbers can
// never disagree with the Ranking page; the payload is just smaller.

export interface StudentSummary {
  view: "student_summary";
  rank: number | null;
  ranked_count: number;
  /** The class group the rank is within; null when ranked across the subjects. */
  class_group_name: string | null;
  score: number | null;
  band: string | null;
  status: PerformanceStatus;
  class_average: number | null;
  gap: number | null;
  points_to_next: number | null;
  subject_count: number;
  /** Subjects below the pass mark, weakest first (at most 3). */
  at_risk_subjects: Array<{ course_id: string; name: string; score: number }>;
  at_risk_count: number;
  overdue_count: number;
  top_suggestion: Suggestion | null;
}

export const buildStudentSummary = (view: StudentView): StudentSummary => {
  const atRisk = view.subjects
    .filter((s) => s.status === "at_risk" && s.score !== null)
    .sort((a, b) => a.score! - b.score!);
  const { overall } = view;
  return {
    view: "student_summary",
    rank: overall.rank,
    ranked_count: overall.ranked_count,
    class_group_name: view.cohort.type === "class_group" ? view.cohort.class_group_name : null,
    score: overall.score,
    band: overall.band,
    status: overall.status,
    class_average: overall.class_average,
    gap:
      overall.score !== null && overall.class_average !== null
        ? round1(overall.score - overall.class_average)
        : null,
    points_to_next: overall.points_to_next,
    subject_count: view.subjects.length,
    at_risk_subjects: atRisk.slice(0, 3).map((s) => ({ course_id: s.course_id, name: s.name, score: s.score! })),
    at_risk_count: atRisk.length,
    overdue_count: view.pending.filter((p) => p.status === "overdue").length,
    top_suggestion: view.suggestions[0] ?? null,
  };
};
