import axios from "../utils/axiosConfig";
import { ASSESSMENT_TYPE_LABELS } from "./manualAssessmentApi";
import { bandOf, type BandKey } from "./subjectReportApi";

// ─── Student academic overview ────────────────────────────────────────────────
// Everything behind "My Reports". GET /courses/my-grades returns one row per
// enrolled subject with every markable item in it — assignment, quiz, or a mark
// the teacher recorded by hand — and this module turns that into the numbers
// and the advice the page shows.
//
// The one rule that governs all of it: **only marked work counts**. A subject
// where nothing has been marked has no grade (not 0%), and un-marked items are
// never averaged in — reporting a student who has sat one of five tests as
// though they failed the other four is worse than reporting nothing. What is
// still outstanding is surfaced on its own instead, and work whose deadline has
// passed unsubmitted is called out separately again, because that one *is* the
// student's problem to fix.

export type ItemKind = "assignment" | "quiz" | "manual";

export interface SubjectItem {
  kind: ItemKind;
  id: number;
  title: string;
  assessmentType?: string | null;
  assessmentNumber?: number | null;
  maxScore: number;
  score: number | null;
  marked: boolean;
  submitted: boolean;
  date: string | null;
  overdue: boolean;
  countsToFinal: boolean;
}

export interface SubjectRow {
  courseId: number;
  courseName: string;
  code: string;
  totalMaxPoints: number;
  totalPointsEarned: number;
  percentage: number;
  status: "Passing" | "Failing" | "No Grade";
  items: SubjectItem[];
  markedCount: number;
  pendingCount: number;
  overdueCount: number;
  totalAssignments: number;
  totalQuizzes: number;
  totalAssessments: number;
  assessmentsRecorded: number;
}

/** A subject with the derived bits the UI needs. */
export interface SubjectView extends SubjectRow {
  hasMarks: boolean;
  band: BandKey | null;
}

export interface Recommendation {
  id: string;
  tone: "serious" | "warning" | "info" | "good";
  title: string;
  detail: string;
  /** Subject to open when the student acts on it. */
  courseId?: number;
}

export interface StudentOverview {
  subjects: SubjectView[];
  /** Subjects with at least one mark — the only ones that can be averaged. */
  graded: SubjectView[];
  overallAverage: number;
  /** Share of markable work that has actually been marked. */
  progress: number;
  markedCount: number;
  pendingCount: number;
  overdueCount: number;
  subjectsWithoutMarks: number;
  strongest: SubjectView | null;
  weakest: SubjectView | null;
  recommendations: Recommendation[];
}

/** "Midterm 1", or the item's own title when it isn't a typed manual mark. */
export const itemLabel = (item: SubjectItem) => {
  if (item.kind !== "manual") return item.title;
  const base = item.assessmentType
    ? (ASSESSMENT_TYPE_LABELS[item.assessmentType] ?? item.title)
    : item.title;
  return item.assessmentNumber ? `${base} ${item.assessmentNumber}` : base;
};

export const itemPercentage = (item: SubjectItem): number | null =>
  item.marked && item.score !== null && item.maxScore > 0
    ? Math.round((item.score / item.maxScore) * 1000) / 10
    : null;

const round1 = (n: number) => Math.round(n * 10) / 10;

export const buildStudentOverview = (rows: SubjectRow[]): StudentOverview => {
  const subjects: SubjectView[] = (rows ?? []).map((row) => {
    const items = row.items ?? [];
    const markedCount = row.markedCount ?? items.filter((i) => i.marked).length;
    return {
      ...row,
      items,
      markedCount,
      hasMarks: markedCount > 0,
      band: markedCount > 0 ? bandOf(row.percentage) : null,
    };
  });

  const graded = subjects.filter((s) => s.hasMarks);
  const overallAverage =
    graded.length > 0
      ? round1(graded.reduce((acc, s) => acc + s.percentage, 0) / graded.length)
      : 0;

  const totalItems = subjects.reduce((acc, s) => acc + s.items.length, 0);
  const markedCount = subjects.reduce((acc, s) => acc + s.markedCount, 0);
  const pendingCount = subjects.reduce((acc, s) => acc + (s.pendingCount ?? 0), 0);
  const overdueCount = subjects.reduce((acc, s) => acc + (s.overdueCount ?? 0), 0);

  const ranked = [...graded].sort((a, b) => b.percentage - a.percentage);
  const strongest = ranked[0] ?? null;
  const weakest = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  return {
    subjects,
    graded,
    overallAverage,
    progress: totalItems > 0 ? Math.round((markedCount / totalItems) * 100) : 0,
    markedCount,
    pendingCount,
    overdueCount,
    subjectsWithoutMarks: subjects.length - graded.length,
    strongest,
    weakest,
    recommendations: buildRecommendations(subjects, graded, overallAverage, overdueCount),
  };
};

/**
 * What the student should actually do, worst first. Every entry names a
 * subject where it can, so the advice is always actionable rather than a
 * general "work harder".
 */
const buildRecommendations = (
  subjects: SubjectView[],
  graded: SubjectView[],
  overallAverage: number,
  overdueCount: number,
): Recommendation[] => {
  const out: Recommendation[] = [];

  // 1. Subjects below the pass mark — the thing to fix first.
  const failing = graded
    .filter((s) => s.percentage < 50)
    .sort((a, b) => a.percentage - b.percentage);
  for (const subject of failing.slice(0, 3)) {
    out.push({
      id: `improve-${subject.courseId}`,
      tone: "serious",
      title: `Improve in ${subject.courseName} — ${subject.percentage}%`,
      detail: `You are below the 50% pass mark here${
        subject.pendingCount > 0
          ? `, with ${subject.pendingCount} assessment${subject.pendingCount !== 1 ? "s" : ""} still to come`
          : ""
      }. Ask your teacher what to revise.`,
      courseId: subject.courseId,
    });
  }
  if (failing.length > 3) {
    out.push({
      id: "improve-more",
      tone: "serious",
      title: `${failing.length - 3} more subject${failing.length - 3 !== 1 ? "s" : ""} below 50%`,
      detail: failing
        .slice(3)
        .map((s) => `${s.code} (${s.percentage}%)`)
        .join(", "),
    });
  }

  // 2. Work that is late — the student's own to fix, unlike an unmarked test.
  const overdueSubjects = subjects.filter((s) => (s.overdueCount ?? 0) > 0);
  if (overdueCount > 0) {
    out.push({
      id: "overdue",
      tone: "serious",
      title: `${overdueCount} piece${overdueCount !== 1 ? "s" : ""} of work past due and not submitted`,
      detail: overdueSubjects.map((s) => s.code).slice(0, 4).join(", "),
      courseId: overdueSubjects[0]?.courseId,
    });
  }

  // 3. Borderline subjects — a nudge before they slip.
  const borderline = graded
    .filter((s) => s.percentage >= 50 && s.percentage < 60)
    .sort((a, b) => a.percentage - b.percentage);
  if (borderline.length > 0) {
    out.push({
      id: "borderline",
      tone: "warning",
      title: `${borderline.length} subject${borderline.length !== 1 ? "s" : ""} just above the pass mark`,
      detail: borderline.map((s) => `${s.code} (${s.percentage}%)`).slice(0, 4).join(", "),
      courseId: borderline[0].courseId,
    });
  }

  // 4. Waiting on the teacher — explains a low "progress" without alarm.
  const pending = subjects.reduce((acc, s) => acc + (s.pendingCount ?? 0), 0);
  if (pending > 0) {
    out.push({
      id: "pending",
      tone: "info",
      title: `${pending} assessment${pending !== 1 ? "s" : ""} not marked yet`,
      detail:
        "These are not counted in your averages. Your grade may move once your teachers enter them.",
    });
  }

  // 5. Subjects with nothing marked — "no grade", not a zero.
  const withoutMarks = subjects.filter((s) => !s.hasMarks);
  if (withoutMarks.length > 0) {
    out.push({
      id: "no-marks",
      tone: "info",
      title: `${withoutMarks.length} subject${withoutMarks.length !== 1 ? "s" : ""} have no marks yet`,
      detail: `${withoutMarks.map((s) => s.code).slice(0, 5).join(", ")} — nothing has been assessed, so they are left out of your average.`,
    });
  }

  // 6. Something to keep doing.
  const best = graded.slice().sort((a, b) => b.percentage - a.percentage)[0];
  if (best && best.percentage >= 70) {
    out.push({
      id: "strength",
      tone: "good",
      title: `Strongest subject: ${best.courseName} — ${best.percentage}%`,
      detail: "Keep the same habits here and apply them to the subjects above.",
      courseId: best.courseId,
    });
  }

  if (out.length === 0 && graded.length > 0 && overallAverage >= 50) {
    out.push({
      id: "on-track",
      tone: "good",
      title: "You are on track in every subject",
      detail: "Nothing is below the pass mark and nothing is overdue.",
    });
  }

  return out;
};

export const fetchMyGrades = async (params?: {
  term?: string;
  academicYear?: string;
}): Promise<SubjectRow[]> => {
  const res = await axios.get("/courses/my-grades", {
    params:
      params?.term && params?.academicYear
        ? { term: params.term, academic_year: params.academicYear }
        : undefined,
  });
  if (!res.data?.success) throw new Error("Failed to load grades");
  return (res.data.data ?? []) as SubjectRow[];
};
