import type { Request } from "express";
import { Op } from "sequelize";
import { Quiz } from "../models/Quiz.model";
import { Assignment, COUNTED_MARKS } from "../models/Assignment.model";
import { ManualAssessment } from "../models/ManualAssessment.model";
import { SubjectAssessmentMapping } from "../models/SubjectAssessmentMapping.model";
import { ReportCard } from "../models/ReportCard.model";
import { ReportCardAssessment } from "../models/ReportCardAssessment.model";
import { getReportCardScheme } from "./tenantSettings";
import { getCurrentTermId, resolveCurrentAcademicPeriodNames } from "../utils/misUtils";

/**
 * TVET schools map their work into FA (formative) by default, so a teacher
 * doesn't have to map every quiz, assignment and recorded mark by hand: the
 * comprehensive (CA) and integrated (IA) assessments are the few they move.
 *
 *  - autoMapNewToFormative: a quiz, assignment or manual assessment created
 *    while the school uses the TVET builder is mapped to FA for its term.
 *  - mapUnmappedToFormative: every unmapped assessment of a term gets FA
 *    (the Templates page button, the switch to TVET, and the CLI backfill).
 *
 * A mapping is added, never changed: work already mapped (to anything) keeps
 * its category. The subject's saved mapping gets the row, and so do the draft
 * report cards that already hold that subject's mapping (cards without it
 * receive the whole set when the class workbench next syncs). Assignments
 * whose marks are part of another assessment and deleted quizzes are skipped.
 */

export type MappableKind = "quiz" | "assignment" | "manual";
export interface MappableItem {
  kind: MappableKind;
  id: number;
  subject_id: number;
  title?: string;
}

/** Adds FA mappings for items not mapped in their subject this term; returns how many were added. */
export async function addFormativeMappings(items: MappableItem[], term: string, academicYear: string, by: number | null = null): Promise<{ added: MappableItem[]; cardsUpdated: number }> {
  if (!items.length || !term || !academicYear) return { added: [], cardsUpdated: 0 };
  const subjectIds = [...new Set(items.map((i) => i.subject_id))];
  const existing = await SubjectAssessmentMapping.findAll({
    where: { subject_id: { [Op.in]: subjectIds }, term, academic_year: academicYear },
    attributes: ["subject_id", "assessment_type", "assessment_id"],
  });
  const mapped = new Set(existing.map((m) => `${m.subject_id}:${m.assessment_type}:${m.assessment_id}`));
  const seen = new Set<string>();
  const added = items.filter((i) => {
    const k = `${i.subject_id}:${i.kind}:${i.id}`;
    if (mapped.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (!added.length) return { added, cardsUpdated: 0 };
  await SubjectAssessmentMapping.bulkCreate(
    added.map((i) => ({ subject_id: i.subject_id, term, academic_year: academicYear, assessment_type: i.kind, assessment_id: i.id, category: "FA", created_by: by })) as any,
  );

  // Draft cards that already carry these subjects' mapping get the new rows too.
  const drafts = await ReportCard.findAll({ where: { term, academic_year: academicYear, status: "draft" }, attributes: ["id"] });
  let cardsUpdated = 0;
  if (drafts.length) {
    const rows = await ReportCardAssessment.findAll({
      where: { report_card_id: { [Op.in]: drafts.map((c) => c.id!) }, subject_id: { [Op.in]: [...new Set(added.map((i) => i.subject_id))] } },
      attributes: ["report_card_id", "subject_id", "assessment_type", "assessment_id"],
    });
    const has = new Set(rows.map((r) => `${r.report_card_id}:${r.subject_id}:${r.assessment_type}:${r.assessment_id}`));
    const cardsBySubject = new Map<number, Set<number>>();
    for (const r of rows) cardsBySubject.set(r.subject_id, (cardsBySubject.get(r.subject_id) ?? new Set()).add(r.report_card_id));
    const create: Array<Record<string, unknown>> = [];
    const touched = new Set<number>();
    for (const i of added) {
      for (const cardId of cardsBySubject.get(i.subject_id) ?? []) {
        if (has.has(`${cardId}:${i.subject_id}:${i.kind}:${i.id}`)) continue;
        create.push({ report_card_id: cardId, subject_id: i.subject_id, assessment_type: i.kind, assessment_id: i.id, category: "FA", mark_status: "auto" });
        touched.add(cardId);
      }
    }
    if (create.length) await ReportCardAssessment.bulkCreate(create as any);
    cardsUpdated = touched.size;
  }
  return { added, cardsUpdated };
}

/** The promise's value, or false when it takes longer than `secs` (it keeps running). */
export function withinSeconds(p: Promise<boolean>, secs: number): Promise<boolean> {
  return Promise.race([p, new Promise<boolean>((resolve) => setTimeout(() => resolve(false), secs * 1000).unref?.())]);
}

const isTvet = async () => (await getReportCardScheme()).builder === "tvet";

/**
 * After a create: map the new assessment to FA when the school uses TVET.
 * Never throws (creating the assessment already succeeded); logs instead.
 */
export async function autoMapNewToFormative(
  req: Request,
  item: MappableItem & { term?: string | null; academic_year?: string | null; academic_term_id?: number | null; part_of?: boolean },
): Promise<boolean> {
  try {
    if (item.part_of || !(await isTvet())) return false;
    let term = item.term ?? null;
    let year = item.academic_year ?? null;
    if (!term || !year) {
      // Quizzes and assignments carry a MIS term id: map them when it's the term in use (or unset).
      if (item.academic_term_id != null) {
        const current = await getCurrentTermId(req).catch(() => null);
        if (current != null && Number(current) !== Number(item.academic_term_id)) return false;
      }
      const names = await resolveCurrentAcademicPeriodNames(req);
      term = names.term;
      year = names.academicYear;
    }
    if (!term || !year) return false;
    const { added } = await addFormativeMappings([item], term, year, (req as any).user?.id ?? null);
    return added.length > 0;
  } catch (e: any) {
    console.error("autoMapNewToFormative:", e?.message ?? e);
    return false;
  }
}

/** Every assessment that counts for a term (what the Grades page lists against it). */
export async function termAssessments(term: string, academicYear: string, termId: number | null): Promise<MappableItem[]> {
  const termScope = termId != null ? { [Op.or]: [{ academic_term_id: termId }, { academic_term_id: null }] } : { academic_term_id: null };
  const [quizzes, assignments, manuals] = await Promise.all([
    Quiz.findAll({ where: { ...termScope, status: { [Op.ne]: "deleted" } } as any, attributes: ["id", "course_id", "title"] }),
    Assignment.findAll({ where: { ...termScope, ...COUNTED_MARKS } as any, attributes: ["id", "course_id", "title"] }),
    ManualAssessment.findAll({ where: { term, academic_year: academicYear }, attributes: ["id", "course_id", "title", "add_to_final_grade"] }),
  ]);
  return [
    ...quizzes.filter((q: any) => q.course_id != null).map((q: any) => ({ kind: "quiz" as const, id: q.id, subject_id: Number(q.course_id), title: q.title })),
    ...assignments.filter((a: any) => a.course_id != null).map((a: any) => ({ kind: "assignment" as const, id: a.id, subject_id: Number(a.course_id), title: a.title })),
    ...manuals.filter((m: any) => m.add_to_final_grade !== false).map((m: any) => ({ kind: "manual" as const, id: m.id, subject_id: Number(m.course_id), title: m.title })),
  ];
}

export interface FormativeBackfillResult {
  term: string;
  academic_year: string;
  scanned: number;
  already_mapped: number;
  mapped: number;
  by_kind: Record<MappableKind, number>;
  subjects: number;
  cards_updated: number;
  dry_run: boolean;
}

/** Maps every unmapped assessment of a term to FA (dryRun counts without writing). */
export async function mapUnmappedToFormative(opts: { term: string; academicYear: string; termId: number | null; dryRun?: boolean; by?: number | null }): Promise<FormativeBackfillResult> {
  const items = await termAssessments(opts.term, opts.academicYear, opts.termId);
  const existing = await SubjectAssessmentMapping.findAll({
    where: { term: opts.term, academic_year: opts.academicYear },
    attributes: ["subject_id", "assessment_type", "assessment_id"],
  });
  const mapped = new Set(existing.map((m) => `${m.subject_id}:${m.assessment_type}:${m.assessment_id}`));
  const todo = items.filter((i) => !mapped.has(`${i.subject_id}:${i.kind}:${i.id}`));
  const byKind: Record<MappableKind, number> = { quiz: 0, assignment: 0, manual: 0 };
  todo.forEach((i) => byKind[i.kind]++);
  let cardsUpdated = 0;
  let added = todo.length;
  if (!opts.dryRun && todo.length) {
    const r = await addFormativeMappings(todo, opts.term, opts.academicYear, opts.by ?? null);
    added = r.added.length;
    cardsUpdated = r.cardsUpdated;
  }
  return {
    term: opts.term,
    academic_year: opts.academicYear,
    scanned: items.length,
    already_mapped: items.length - todo.length,
    mapped: added,
    by_kind: byKind,
    subjects: new Set(todo.map((i) => i.subject_id)).size,
    cards_updated: cardsUpdated,
    dry_run: !!opts.dryRun,
  };
}
