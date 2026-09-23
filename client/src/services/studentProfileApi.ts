import axios from "../utils/axiosConfig";
import { ASSESSMENT_TYPE_LABELS } from "./manualAssessmentApi";

// ─── Student profile marks ────────────────────────────────────────────────────
// What a teacher sees on /students/:misUserId. The profile already pulled
// assignments and quizzes from their own endpoints; marks a teacher records by
// hand live in manual_assessments and had nowhere to come from, so a subject
// assessed entirely in class read as a student who had done nothing at all.
//
// The rule here matches the rest of the grade screens: **only marked work
// counts**. An assignment with no grade, a quiz never attempted and a mark the
// teacher hasn't entered are all "pending", never a zero — averaging them in
// would invent a failing student out of an empty term.

export interface RecordedRow {
  assessment_id: number;
  title: string;
  assessment_type: string | null;
  assessment_number: number | null;
  assessment_date: string | null;
  counts_to_final: boolean;
  max_score: number;
  recorded: boolean;
  score: number | null;
  percentage: number | null;
}

export interface RecordedSubject {
  course_id: number;
  subject_name: string;
  subject_code: string;
  assessments: RecordedRow[];
  recorded_count: number;
  pending_count: number;
}

/** "Midterm 1", or the free-text title when the teacher left the type blank. */
export const recordedLabel = (row: RecordedRow) => {
  const base = row.assessment_type
    ? (ASSESSMENT_TYPE_LABELS[row.assessment_type] ?? row.title)
    : row.title;
  return row.assessment_number ? `${base} ${row.assessment_number}` : base;
};

export const fetchStudentRecordedAssessments = async (
  misUserId: string | number,
): Promise<RecordedSubject[]> => {
  const res = await axios.get(`/users/${misUserId}/recorded-assessments`);
  if (!res.data?.success) throw new Error("Failed to load recorded marks");
  return (res.data.data ?? []) as RecordedSubject[];
};

// ─── Summary ──────────────────────────────────────────────────────────────────

export type MarkKind = "assignment" | "quiz" | "recorded";

/** One markable thing, flattened out of whichever endpoint produced it. */
export interface MarkInput {
  /** Whatever the caller groups by — a subject code here. */
  courseKey: string;
  kind: MarkKind;
  marked: boolean;
  /** 0–100, or null when not marked. */
  percentage: number | null;
}

export interface KindTally {
  marked: number;
  total: number;
}

export interface CourseMarks {
  courseKey: string;
  assignments: KindTally;
  quizzes: KindTally;
  recorded: KindTally;
  /** Average over marked work only — null when nothing has been marked. */
  average: number | null;
  markedCount: number;
  totalCount: number;
}

export interface MarksSummary {
  /** Null, not 0, when the student has no marks anywhere. */
  overallAverage: number | null;
  markedCount: number;
  pendingCount: number;
  totalCount: number;
  byCourse: Record<string, CourseMarks>;
}

const emptyTally = (): KindTally => ({ marked: 0, total: 0 });

const average = (values: number[]): number | null =>
  values.length === 0
    ? null
    : Math.round((values.reduce((a, v) => a + v, 0) / values.length) * 10) / 10;

export const summariseMarks = (marks: MarkInput[]): MarksSummary => {
  const byCourse: Record<string, CourseMarks> = {};
  const courseScores: Record<string, number[]> = {};

  for (const mark of marks) {
    const key = mark.courseKey;
    if (!byCourse[key]) {
      byCourse[key] = {
        courseKey: key,
        assignments: emptyTally(),
        quizzes: emptyTally(),
        recorded: emptyTally(),
        average: null,
        markedCount: 0,
        totalCount: 0,
      };
      courseScores[key] = [];
    }

    const entry = byCourse[key];
    const tally =
      mark.kind === "assignment"
        ? entry.assignments
        : mark.kind === "quiz"
          ? entry.quizzes
          : entry.recorded;

    tally.total += 1;
    entry.totalCount += 1;
    if (mark.marked && mark.percentage !== null) {
      tally.marked += 1;
      entry.markedCount += 1;
      courseScores[key].push(mark.percentage);
    }
  }

  for (const key of Object.keys(byCourse)) {
    byCourse[key].average = average(courseScores[key]);
  }

  const allScores = marks
    .filter((m) => m.marked && m.percentage !== null)
    .map((m) => m.percentage as number);

  return {
    overallAverage: average(allScores),
    markedCount: allScores.length,
    pendingCount: marks.length - allScores.length,
    totalCount: marks.length,
    byCourse,
  };
};
