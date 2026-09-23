import axios from "../utils/axiosConfig";
import { ASSESSMENT_TYPE_LABELS } from "./manualAssessmentApi";

// ─── Subject assessment report ────────────────────────────────────────────────
// One subject, one term: every assessment that can carry marks (quizzes,
// assignments and the marks a teacher records by hand) folded into a single
// picture the subject teacher can act on.
//
// There is no dedicated endpoint for this — GET /courses/:id/grades already
// returns the full grade matrix (roster × assessments), so the report is
// *derived* here rather than duplicated on the server. Everything below the
// fetch is pure, which keeps it unit-testable and keeps the page component
// about layout.

export type AssessmentKind = "quiz" | "assignment" | "manual";

/** Score bands. Ordered best → worst; the order drives every chart legend. */
export const BANDS = [
  { key: "excellent", label: "Excellent", short: "80%+", min: 80, color: "#10b981" },
  { key: "good", label: "Good", short: "65–79%", min: 65, color: "#3b82f6" },
  { key: "fair", label: "Fair", short: "50–64%", min: 50, color: "#f59e0b" },
  { key: "at_risk", label: "At risk", short: "Below 50%", min: 0, color: "#ef4444" },
] as const;

export type BandKey = (typeof BANDS)[number]["key"];

export const bandOf = (percentage: number): BandKey =>
  (BANDS.find((b) => percentage >= b.min) ?? BANDS[BANDS.length - 1]).key;

export const bandMeta = (key: BandKey) => BANDS.find((b) => b.key === key)!;

// ─── Raw payload (GET /courses/:id/grades) ───────────────────────────────────

interface RawAssessmentMeta {
  id: number;
  title: string;
  max_score: number | string | null;
  date?: string | null;
  assessment_type?: string | null;
  assessment_number?: number | null;
  assessment_date?: string | null;
  counts_to_final?: boolean;
}

interface RawStudentGrade {
  student: {
    id: number;
    name: string;
    email: string;
    profile_image?: string;
  };
  assignments: Array<{
    assignment_id: number;
    grade: number | string | null;
    submitted: boolean;
    max_score: number | string | null;
  }>;
  quizzes: Array<{
    quiz_id: number;
    score: number | null;
    submitted: boolean;
    max_score: number | string | null;
  }>;
  assessments?: Array<{
    assessment_id: number;
    score: number | null;
    recorded: boolean;
    max_score: number;
  }>;
  summary: {
    total_points_earned: number;
    total_max_points: number;
    total_percentage: number;
    assignment_percentage: number;
    quiz_percentage: number;
    assessment_percentage?: number;
  };
}

export interface SubjectGradesPayload {
  course_id: string | number;
  students: RawStudentGrade[];
  assignments: RawAssessmentMeta[];
  quizzes: RawAssessmentMeta[];
  assessments?: RawAssessmentMeta[];
}

// ─── Derived report ──────────────────────────────────────────────────────────

/** One assessment, as the class experienced it. */
export interface AssessmentStat {
  key: string;
  kind: AssessmentKind;
  id: number;
  title: string;
  date: string | null;
  maxScore: number;
  countsToFinal: boolean;
  /** How many students have a mark for it, out of the whole roster. */
  markedCount: number;
  rosterSize: number;
  averagePct: number | null;
  highestPct: number | null;
  lowestPct: number | null;
  /** Marked students below the 50% pass line. */
  failingCount: number;
}

/** One student, across every assessment in the subject. */
export interface StudentStat {
  id: number;
  name: string;
  email: string;
  profileImage?: string;
  overallPct: number;
  pointsEarned: number;
  pointsMax: number;
  markedCount: number;
  band: BandKey;
  /** assessment key → percentage, or null when not marked yet. */
  marks: Record<string, number | null>;
  /** The raw row, so existing per-student views can be reused as-is. */
  raw: RawStudentGrade;
}

export interface SubjectReport {
  assessments: AssessmentStat[];
  students: StudentStat[];
  rosterSize: number;
  /** Class average of every student who has at least one mark. */
  classAverage: number;
  medianPct: number;
  passRate: number;
  atRiskCount: number;
  /** Student×assessment cells still waiting on a mark. */
  outstandingMarks: number;
  /** Assessments nobody has been marked for yet. */
  unmarkedAssessments: AssessmentStat[];
  bandCounts: Record<BandKey, number>;
  /** Assessments with a date, oldest first — the trend line's input. */
  timeline: AssessmentStat[];
}

/** "Midterm 1", or the free-text title when the teacher left the type blank. */
export const manualLabel = (a: RawAssessmentMeta) => {
  const base = a.assessment_type
    ? (ASSESSMENT_TYPE_LABELS[a.assessment_type] ?? a.title)
    : a.title;
  return a.assessment_number ? `${base} ${a.assessment_number}` : base;
};

const toNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  // Assignment grades are sometimes stored as "15/20".
  const raw = String(value).includes("/")
    ? String(value).split("/")[0]
    : String(value);
  const parsed = Number(raw);
  return isNaN(parsed) ? null : parsed;
};

const pct = (score: number, max: number) =>
  max > 0 ? Math.round((score / max) * 1000) / 10 : 0;

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10
    : sorted[mid];
};

export const buildSubjectReport = (
  payload: SubjectGradesPayload,
): SubjectReport => {
  const rawStudents = payload.students ?? [];
  const rosterSize = rawStudents.length;

  // Every assessment, keyed the same way on both axes of the matrix.
  const definitions: Array<{
    key: string;
    kind: AssessmentKind;
    id: number;
    title: string;
    date: string | null;
    maxScore: number;
    countsToFinal: boolean;
    /** Pulls this student's percentage, or null when unmarked. */
    markOf: (student: RawStudentGrade) => number | null;
  }> = [
    ...(payload.quizzes ?? []).map((q) => ({
      key: `quiz-${q.id}`,
      kind: "quiz" as const,
      id: q.id,
      title: q.title,
      date: q.date ?? null,
      maxScore: toNumber(q.max_score) ?? 0,
      countsToFinal: true,
      markOf: (s: RawStudentGrade) => {
        const row = s.quizzes?.find((r) => r.quiz_id === q.id);
        const score = toNumber(row?.score ?? null);
        const max = toNumber(q.max_score) ?? 0;
        return row?.submitted && score !== null ? pct(score, max) : null;
      },
    })),
    ...(payload.assignments ?? []).map((a) => ({
      key: `assignment-${a.id}`,
      kind: "assignment" as const,
      id: a.id,
      title: a.title,
      date: a.date ?? null,
      maxScore: toNumber(a.max_score) ?? 0,
      countsToFinal: true,
      markOf: (s: RawStudentGrade) => {
        const row = s.assignments?.find((r) => r.assignment_id === a.id);
        const score = toNumber(row?.grade ?? null);
        const max = toNumber(a.max_score) ?? 0;
        return row?.submitted && score !== null ? pct(score, max) : null;
      },
    })),
    ...(payload.assessments ?? []).map((m) => ({
      key: `manual-${m.id}`,
      kind: "manual" as const,
      id: m.id,
      title: manualLabel(m),
      date: m.assessment_date ?? m.date ?? null,
      maxScore: toNumber(m.max_score) ?? 0,
      countsToFinal: m.counts_to_final !== false,
      markOf: (s: RawStudentGrade) => {
        const row = s.assessments?.find((r) => r.assessment_id === m.id);
        const score = toNumber(row?.score ?? null);
        return row?.recorded && score !== null ? pct(score, m.max_score as number) : null;
      },
    })),
  ];

  // Walk the matrix once: it feeds both the per-assessment and the
  // per-student views, so there's no second pass and no risk of the two
  // disagreeing.
  const marksByStudent = new Map<number, Record<string, number | null>>();
  rawStudents.forEach((s) => marksByStudent.set(s.student.id, {}));

  const assessments: AssessmentStat[] = definitions.map((def) => {
    const marks: number[] = [];
    for (const student of rawStudents) {
      const mark = def.markOf(student);
      marksByStudent.get(student.student.id)![def.key] = mark;
      if (mark !== null) marks.push(mark);
    }
    const sum = marks.reduce((acc, m) => acc + m, 0);
    return {
      key: def.key,
      kind: def.kind,
      id: def.id,
      title: def.title,
      date: def.date,
      maxScore: def.maxScore,
      countsToFinal: def.countsToFinal,
      markedCount: marks.length,
      rosterSize,
      averagePct: marks.length > 0 ? Math.round((sum / marks.length) * 10) / 10 : null,
      highestPct: marks.length > 0 ? Math.max(...marks) : null,
      lowestPct: marks.length > 0 ? Math.min(...marks) : null,
      failingCount: marks.filter((m) => m < 50).length,
    };
  });

  const students: StudentStat[] = rawStudents.map((s) => {
    const marks = marksByStudent.get(s.student.id) ?? {};
    const overallPct = Number(s.summary?.total_percentage ?? 0);
    return {
      id: s.student.id,
      name: s.student.name,
      email: s.student.email,
      profileImage: s.student.profile_image,
      overallPct,
      pointsEarned: Number(s.summary?.total_points_earned ?? 0),
      pointsMax: Number(s.summary?.total_max_points ?? 0),
      markedCount: Object.values(marks).filter((m) => m !== null).length,
      band: bandOf(overallPct),
      marks,
      raw: s,
    };
  });

  // A student with nothing marked isn't a 0% — they're "no data". Counting
  // them would drag the class average down and invent a failing cohort.
  const graded = students.filter((s) => s.markedCount > 0);
  const classAverage =
    graded.length > 0
      ? Math.round(
          (graded.reduce((acc, s) => acc + s.overallPct, 0) / graded.length) * 10,
        ) / 10
      : 0;

  const bandCounts = BANDS.reduce(
    (acc, b) => ({ ...acc, [b.key]: graded.filter((s) => s.band === b.key).length }),
    {} as Record<BandKey, number>,
  );

  return {
    assessments,
    students,
    rosterSize,
    classAverage,
    medianPct: median(graded.map((s) => s.overallPct)),
    passRate:
      graded.length > 0
        ? Math.round((graded.filter((s) => s.overallPct >= 50).length / graded.length) * 100)
        : 0,
    atRiskCount: graded.filter((s) => s.overallPct < 50).length,
    outstandingMarks: assessments.reduce(
      (acc, a) => acc + Math.max(0, a.rosterSize - a.markedCount),
      0,
    ),
    unmarkedAssessments: assessments.filter((a) => a.markedCount === 0),
    bandCounts,
    timeline: assessments
      .filter((a) => a.date && a.averagePct !== null)
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
  };
};

export const fetchSubjectGrades = async (
  courseId: number | string,
  params?: { academicTermId?: number; term?: string; academicYear?: string },
): Promise<SubjectGradesPayload> => {
  const res = await axios.get(`/courses/${courseId}/grades`, {
    params: {
      academicTermId: params?.academicTermId,
      term: params?.term,
      academic_year: params?.academicYear,
    },
  });
  if (!res.data?.success) throw new Error("Failed to load subject grades");
  return res.data.data as SubjectGradesPayload;
};

// ─── Alerts ───────────────────────────────────────────────────────────────────
// The "what needs doing" list. Derived here rather than in a page so the
// subject report and the course report notify a teacher about exactly the same
// things; each page decides how to act on a descriptor (navigate vs filter).

export interface ReportAlert {
  id: string;
  tone: "serious" | "warning" | "good";
  title: string;
  detail: string;
  action?:
    | { kind: "assessment"; label: string; assessment: AssessmentStat }
    | { kind: "filter"; label: string; filter: "incomplete" | "at_risk" }
    | { kind: "focus"; label: string; assessmentKey: string };
}

export const buildReportAlerts = (report: SubjectReport): ReportAlert[] => {
  const alerts: ReportAlert[] = [];

  if (report.unmarkedAssessments.length > 0) {
    const n = report.unmarkedAssessments.length;
    alerts.push({
      id: "unmarked",
      tone: "serious",
      title: `${n} assessment${n !== 1 ? "s" : ""} with no marks at all`,
      detail: report.unmarkedAssessments.map((a) => a.title).slice(0, 3).join(", "),
      action: {
        kind: "assessment",
        label: "Open it",
        assessment: report.unmarkedAssessments[0],
      },
    });
  }

  const partial = report.assessments.filter(
    (a) => a.markedCount > 0 && a.markedCount < a.rosterSize,
  );
  if (partial.length > 0) {
    alerts.push({
      id: "partial",
      tone: "warning",
      title: `${partial.length} assessment${partial.length !== 1 ? "s" : ""} only partly marked`,
      detail: `${report.outstandingMarks} student mark${report.outstandingMarks !== 1 ? "s" : ""} still missing across the subject.`,
      action: { kind: "filter", label: "Show these", filter: "incomplete" },
    });
  }

  if (report.atRiskCount > 0) {
    alerts.push({
      id: "at-risk",
      tone: "serious",
      title: `${report.atRiskCount} student${report.atRiskCount !== 1 ? "s" : ""} below 50%`,
      detail: "They need intervention before the report card is issued.",
      action: { kind: "filter", label: "List them", filter: "at_risk" },
    });
  }

  const weakest = [...report.assessments]
    .filter((a) => a.averagePct !== null)
    .sort((a, b) => (a.averagePct ?? 0) - (b.averagePct ?? 0))[0];
  if (weakest && (weakest.averagePct ?? 0) < 50) {
    alerts.push({
      id: "weak-assessment",
      tone: "warning",
      title: `The class averaged ${weakest.averagePct}% on "${weakest.title}"`,
      detail: "Worth re-teaching this topic before moving on.",
      action: { kind: "focus", label: "Focus", assessmentKey: weakest.key },
    });
  }

  if (alerts.length === 0 && report.assessments.length > 0) {
    alerts.push({
      id: "clear",
      tone: "good",
      title: "Everything is marked and nobody is below 50%",
      detail: "This subject is ready for report cards.",
    });
  }

  return alerts;
};
