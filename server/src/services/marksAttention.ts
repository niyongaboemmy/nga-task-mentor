import type { Request } from "express";
import { Op } from "sequelize";
import { Assignment, COUNTED_MARKS } from "../models/Assignment.model";
import { Quiz } from "../models/Quiz.model";
import { Submission } from "../models/Submission.model";
import { QuizSubmission } from "../models/QuizSubmission.model";
import { ManualAssessment } from "../models/ManualAssessment.model";
import { ManualAssessmentScore } from "../models/ManualAssessmentScore.model";
import { SubjectAssessmentMapping } from "../models/SubjectAssessmentMapping.model";
import { resolveCurrentAcademicPeriodNames } from "../utils/misUtils";
import type { DashboardAlert } from "./instructorOverview.service";

/**
 * Marks that need the teacher before they can count on report cards:
 *
 *  - NOT MAPPED: a counted assessment of this term already has marks but sits
 *    in no report-card category (CW/HW/MD/EOT), so those marks count nowhere;
 *  - MISSING MARKS: an assessment that is over (due/closed/dated) has marks
 *    for fewer students than the subject's roster.
 *
 * One pure builder (buildMarksAttention) decides; the loader feeds it the
 * teacher's subjects for the current term. The result drives the Grades page
 * attention bar, the top-bar notification bell and the MIS Home to-dos.
 */

export type MarkKind = "quiz" | "assignment" | "manual";

export interface AttentionSubjectIn {
  id: number;
  name: string;
  code: string | null;
  /** Roster size; null when MIS rosters couldn't be read (no "missing" then). */
  students: number | null;
}

export interface AttentionAssessmentIn {
  kind: MarkKind;
  id: number;
  title: string;
  subject_id: number;
  /** Due / close / assessment date (ISO); null = no date. */
  at: string | null;
  /** Over: due date passed, quiz closed, manual assessment dated today or earlier (or undated). */
  closed: boolean;
  /** Students with a mark (graded, or resolved absent/exempt for manual). */
  recorded: number;
}

export interface AttentionItem {
  kind: MarkKind;
  id: number;
  title: string;
  subject_id: number;
  at: string | null;
  recorded: number;
  expected: number | null;
  missing: number;
  unmapped: boolean;
  url: string;
}

export interface AttentionSubject {
  subject_id: number;
  name: string;
  code: string | null;
  unmapped: number;
  incomplete: number;
}

export interface MarksAttention {
  term: string | null;
  academic_year: string | null;
  totals: { unmapped: number; incomplete: number; missing_marks: number };
  subjects: AttentionSubject[];
  /** Assessments needing attention, most urgent first. */
  items: AttentionItem[];
}

const urlOf = (a: { kind: MarkKind; id: number; subject_id: number }) =>
  a.kind === "quiz" ? `/quizzes/${a.id}/submissions` : a.kind === "assignment" ? `/assignments/${a.id}` : `/grades/subjects/${a.subject_id}`;

export function buildMarksAttention(input: {
  term: string | null;
  academic_year: string | null;
  subjects: AttentionSubjectIn[];
  assessments: AttentionAssessmentIn[];
  /** "kind:id" of every mapped assessment. */
  mapped: Set<string>;
}): MarksAttention {
  const subj = new Map(input.subjects.map((s) => [s.id, s]));
  const items: AttentionItem[] = [];
  for (const a of input.assessments) {
    const s = subj.get(a.subject_id);
    if (!s) continue;
    const unmapped = a.recorded > 0 && !input.mapped.has(`${a.kind}:${a.id}`);
    const expected = s.students;
    const missing = a.closed && expected != null && expected > 0 ? Math.max(0, expected - a.recorded) : 0;
    if (!unmapped && !missing) continue;
    items.push({ kind: a.kind, id: a.id, title: a.title, subject_id: a.subject_id, at: a.at, recorded: a.recorded, expected, missing, unmapped, url: urlOf(a) });
  }
  // Unmapped first (their marks count nowhere), then most missing, then oldest.
  items.sort(
    (x, y) =>
      Number(y.unmapped) - Number(x.unmapped) || y.missing - x.missing || (x.at ?? "9999").localeCompare(y.at ?? "9999") || x.title.localeCompare(y.title),
  );
  const subjects: AttentionSubject[] = input.subjects
    .map((s) => ({
      subject_id: s.id,
      name: s.name,
      code: s.code,
      unmapped: items.filter((i) => i.subject_id === s.id && i.unmapped).length,
      incomplete: items.filter((i) => i.subject_id === s.id && i.missing > 0).length,
    }))
    .filter((s) => s.unmapped || s.incomplete);
  return {
    term: input.term,
    academic_year: input.academic_year,
    totals: {
      unmapped: items.filter((i) => i.unmapped).length,
      incomplete: items.filter((i) => i.missing > 0).length,
      missing_marks: items.reduce((a, i) => a + i.missing, 0),
    },
    subjects,
    items,
  };
}

const plural = (n: number, w: string, p = `${w}s`) => `${n} ${n === 1 ? w : p}`;
const label = (s: AttentionSubject) => s.code || s.name;

/** Bell / dashboard alerts for the attention (ids carry the counts, so getting worse notifies again). */
export function marksAttentionAlerts(m: MarksAttention): DashboardAlert[] {
  const out: DashboardAlert[] = [];
  if (m.totals.unmapped) {
    const where = m.subjects
      .filter((s) => s.unmapped)
      .slice(0, 3)
      .map((s) => `${label(s)} (${s.unmapped})`)
      .join(", ");
    out.push({
      id: `marks-unmapped-${m.term}-${m.totals.unmapped}`,
      severity: "warning",
      title: `${plural(m.totals.unmapped, "assessment")} with marks not mapped`,
      message: `${where}. Unmapped marks don't count on report cards: put each in CW, HW, MD or EOT.`,
      subject_id: m.subjects.length === 1 ? m.subjects[0].subject_id : null,
      action: { label: "Map marks", url: "/grades?attention=unmapped" },
    });
  }
  if (m.totals.incomplete) {
    const worst = m.items.find((i) => i.missing > 0)!;
    out.push({
      id: `marks-missing-${m.term}-${m.totals.incomplete}-${m.totals.missing_marks}`,
      severity: "warning",
      title: `${plural(m.totals.incomplete, "assessment")} with missing marks`,
      message: `${plural(m.totals.missing_marks, "mark")} not recorded, e.g. "${worst.title}" (${worst.recorded}/${worst.expected}). Record them, or mark students absent/exempt.`,
      subject_id: null,
      action: { label: "Complete marks", url: "/grades?attention=missing" },
    });
  }
  return out;
}

// ─── Loader ──────────────────────────────────────────────────────────────────

const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * The attention for these subjects in the current term. Quizzes/assignments
 * are the term's (or undated-term) published ones; manual assessments are
 * matched by term/year names, as report cards are.
 */
export async function loadMarksAttention(
  req: Request,
  subjects: AttentionSubjectIn[],
  termId: number | null,
  now = new Date(),
): Promise<MarksAttention> {
  const period = await resolveCurrentAcademicPeriodNames(req).catch(() => ({ term: null, academicYear: null }) as { term: string | null; academicYear: string | null });
  const term = period.term ?? null;
  const year = period.academicYear ?? null;
  const ids = subjects.map((s) => s.id);
  if (!ids.length) return buildMarksAttention({ term, academic_year: year, subjects, assessments: [], mapped: new Set() });

  const termWhere = termId ? { [Op.or]: [{ academic_term_id: termId }, { academic_term_id: null }] } : {};
  const [assignments, quizzes, manuals, mappings] = await Promise.all([
    Assignment.findAll({
      where: { course_id: { [Op.in]: ids }, status: "published", ...COUNTED_MARKS, ...termWhere } as any,
      attributes: ["id", "title", "course_id", "due_date"],
      raw: true,
    }),
    Quiz.findAll({
      where: { course_id: { [Op.in]: ids }, status: { [Op.in]: ["published", "completed"] }, ...termWhere } as any,
      attributes: ["id", "title", "course_id", "status", "end_date"],
      raw: true,
    }),
    term && year
      ? ManualAssessment.findAll({
          where: { course_id: { [Op.in]: ids }, term, academic_year: year, add_to_final_grade: { [Op.ne]: false } } as any,
          attributes: ["id", "title", "course_id", "assessment_date"],
          raw: true,
        })
      : Promise.resolve([] as any[]),
    term && year
      ? SubjectAssessmentMapping.findAll({ where: { subject_id: { [Op.in]: ids }, term, academic_year: year }, attributes: ["assessment_type", "assessment_id"], raw: true })
      : Promise.resolve([] as any[]),
  ]);

  const aIds = (assignments as any[]).map((a) => a.id);
  const qIds = (quizzes as any[]).map((q) => q.id);
  const mIds = (manuals as any[]).map((m) => m.id);
  const [subs, qsubs, scores] = await Promise.all([
    aIds.length ? Submission.findAll({ where: { assignment_id: { [Op.in]: aIds } }, attributes: ["assignment_id", "student_id", "grade"], raw: true }) : [],
    qIds.length
      ? QuizSubmission.findAll({ where: { quiz_id: { [Op.in]: qIds }, status: "completed" }, attributes: ["quiz_id", "student_id", "grade_status"], raw: true })
      : [],
    mIds.length ? ManualAssessmentScore.findAll({ where: { manual_assessment_id: { [Op.in]: mIds } }, attributes: ["manual_assessment_id", "student_id"], raw: true }) : [],
  ]);
  const distinct = (rows: any[], key: string, ok: (r: any) => boolean = () => true) => {
    const m = new Map<number, Set<number>>();
    for (const r of rows) {
      if (!ok(r)) continue;
      const id = Number(r[key]);
      if (!m.has(id)) m.set(id, new Set());
      m.get(id)!.add(Number(r.student_id));
    }
    return (id: number) => m.get(id)?.size ?? 0;
  };
  const graded = distinct(subs as any[], "assignment_id", (r) => r.grade !== null && r.grade !== undefined && r.grade !== "");
  const quizDone = distinct(qsubs as any[], "quiz_id", (r) => r.grade_status !== "pending");
  const manualDone = distinct(scores as any[], "manual_assessment_id");
  const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);
  const today = endOfToday();

  const assessments: AttentionAssessmentIn[] = [
    ...(assignments as any[]).map((a) => ({
      kind: "assignment" as const,
      id: a.id,
      title: a.title,
      subject_id: a.course_id,
      at: iso(a.due_date),
      closed: !!a.due_date && new Date(a.due_date) < now,
      recorded: graded(a.id),
    })),
    ...(quizzes as any[]).map((q) => ({
      kind: "quiz" as const,
      id: q.id,
      title: q.title,
      subject_id: q.course_id,
      at: iso(q.end_date),
      closed: q.status === "completed" || (!!q.end_date && new Date(q.end_date) < now),
      recorded: quizDone(q.id),
    })),
    ...(manuals as any[]).map((m) => ({
      kind: "manual" as const,
      id: m.id,
      title: m.title,
      subject_id: m.course_id,
      at: m.assessment_date ? iso(m.assessment_date) : null,
      closed: !m.assessment_date || new Date(m.assessment_date) <= today,
      recorded: manualDone(m.id),
    })),
  ];
  const mapped = new Set((mappings as any[]).map((m) => `${m.assessment_type}:${m.assessment_id}`));
  return buildMarksAttention({ term, academic_year: year, subjects, assessments, mapped });
}
