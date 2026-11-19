import { Request } from "express";
import axios from "axios";
import { Op } from "sequelize";
import { ReportCard } from "../models/ReportCard.model";
import { ReportCardAssessment } from "../models/ReportCardAssessment.model";
import { ReportCardAttribute } from "../models/ReportCardAttribute.model";
import { ReportCycle } from "../models/ReportCardWorkflow.model";
import { User } from "../models/User.model";
import {
  calculateSubjectGrade,
  type AssessmentScore,
  type CategoryWeights,
  type SubjectGrade,
} from "./reportCardGrader.service";
import { loadStudentMarks, resolveCardStudent, resolveMark, type ScoreKey } from "../utils/reportCardScores";
import {
  getBranding,
  getGradingBands,
  getReportCardScheme,
  letterFor,
  type Branding,
  type GradeBand,
  type ReportCardScheme,
} from "./tenantSettings";
import { getMisToken } from "../utils/misUtils";
import type { SchoolDirectory } from "./schoolDirectory";
import { tk } from "../tenancy/keys";

/**
 * The rendered report card: everything the card shows, computed once. A
 * draft card is rendered live on every read; approval stores this exact
 * object as the snapshot (report_card_snapshots.payload), and every later
 * read, PDF and QR verification of that version serves the snapshot.
 *
 * Class average and position need the whole class: documents are built for
 * a cohort (the cards of one class group x term), never one card alone.
 */

export const DOCUMENT_SCHEMA = 1;

export type Cat = "CW" | "HW" | "MD" | "EOT";
const CATS: Cat[] = ["CW", "HW", "MD", "EOT"];

export interface DocumentSubject {
  subject_id: number;
  name: string;
  group: string | null;
  teacher: string | null;
  /** Scaled category scores (out of their weight); null = no mark in that category. */
  categories: Record<Cat, number | null>;
  /** Out of 100; null when the subject has no mark at all. */
  total: number | null;
  grade: string | null;
  remark: string | null;
  passed: boolean | null;
  class_average: number | null;
  /** Marks mapped but neither recorded nor resolved absent/exempt. */
  missing_marks: number;
}

export interface ReportCardDocument {
  schema: number;
  card: {
    id: number;
    uuid: string;
    version: number;
    status: string;
    term: string;
    academic_year: string;
    approved_at: string | null;
    published_at: string | null;
  };
  school: Branding;
  student: {
    id: number;
    name: string;
    registration_number: string | null;
    gender: string | null;
    class_group_id: number | null;
    class_name: string | null;
    grade_name: string | null;
    program_name: string | null;
  };
  scheme: {
    category_weights: CategoryWeights;
    pass_mark: number;
    bands: GradeBand[];
    show_position: boolean;
    show_class_average: boolean;
    show_subject_teacher: boolean;
    head_title: string;
  };
  /** Subjects in card order, grouped (a single unnamed group when the school defines none). */
  groups: Array<{ name: string | null; subjects: DocumentSubject[] }>;
  summary: {
    average: number | null;
    grade: string | null;
    remark: string | null;
    total_marks: number;
    subjects_counted: number;
    subjects_passed: number;
    subjects_failed: number;
    position: number | null;
    position_of: number | null;
    class_average: number | null;
  };
  attendance: {
    present: number;
    absent: number;
    excused: number;
    late: number;
    sick: number;
    total: number;
    source: "manual" | "imported";
  };
  attributes: Array<{ attribute_name: string; rating: string }>;
  comments: { class_teacher: string | null; head_teacher: string | null };
  next_term_begins_on: string | null;
  /** Per-assessment detail behind each subject (the preview's drill-down). */
  grades: SubjectGrade[];
}

// ─── Subject names (MIS catalogue, cached briefly per tenant) ───────────────

const SUBJECT_TTL_MS = 5 * 60 * 1000;
const subjectNameCache = new Map<string, { at: number; names: Record<number, string> }>();

/** MIS subject id -> name. Best effort: a missing name renders "Subject #id". */
export async function resolveSubjectNames(req: Request, subjectIds: number[]): Promise<Record<number, string>> {
  if (subjectIds.length === 0) return {};
  const key = tk("subject-names");
  const hit = subjectNameCache.get(key);
  let names = hit && Date.now() - hit.at < SUBJECT_TTL_MS ? hit.names : null;
  if (!names || subjectIds.some((id) => !(id in names!))) {
    const token = getMisToken(req, { quiet: true });
    if (token) {
      try {
        const response = await axios.get(`${process.env.NGA_MIS_BASE_URL}/academics/subjects`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 500 },
        });
        names = { ...(names ?? {}) };
        for (const s of response.data?.data || []) {
          const id = s.id ?? s.subject_id;
          if (id != null) names[Number(id)] = s.name || s.subject_name || s.title || `Subject #${id}`;
        }
        subjectNameCache.set(key, { at: Date.now(), names });
      } catch (error: any) {
        console.error("resolveSubjectNames: could not fetch MIS subjects:", error?.message ?? error);
      }
    }
  }
  const out: Record<number, string> = {};
  for (const id of subjectIds) if (names?.[id]) out[id] = names[id];
  return out;
}

/** Tests only. */
export function clearSubjectNameCache() {
  subjectNameCache.clear();
}

// ─── Grades of one card ──────────────────────────────────────────────────────

export interface CardGrades {
  grades: SubjectGrade[];
  attributes: Array<{ id?: number; attribute_name: string; rating: string }>;
  rawMappings: ReportCardAssessment[];
  /** subject id -> marks mapped but not recorded and not resolved. */
  missingBySubject: Map<number, number>;
  /** subject ids that have mappings on the card (with or without marks). */
  mappedSubjects: Set<number>;
}

/**
 * A card's live grades: its mappings, the student's recorded marks (through
 * every id the student is known by), absent/exempt resolutions, and the
 * school's category weights.
 */
export async function computeCardGrades(reportCard: ReportCard, weights?: CategoryWeights): Promise<CardGrades> {
  const [assessmentMappings, attributes, identity] = await Promise.all([
    ReportCardAssessment.findAll({ where: { report_card_id: reportCard.id } }),
    ReportCardAttribute.findAll({
      where: { report_card_id: reportCard.id },
      attributes: ["id", "attribute_name", "rating"],
    }),
    resolveCardStudent(reportCard.student_id),
  ]);
  const w = weights ?? (await getReportCardScheme()).category_weights;
  const marks = await loadStudentMarks(identity, assessmentMappings);

  const subjectMap = new Map<number, AssessmentScore[]>();
  const missingBySubject = new Map<number, number>();
  const mappedSubjects = new Set<number>();
  for (const mapping of assessmentMappings) {
    const type = mapping.assessment_type as AssessmentScore["assessment_type"];
    const key = `${type}:${mapping.assessment_id}` as ScoreKey;
    if (!marks.valid.has(key)) continue; // deleted quiz / "part of" assignment
    mappedSubjects.add(mapping.subject_id);
    const score = resolveMark(key, marks, mapping.mark_status);
    if (!score) {
      const resolved = mapping.mark_status === "exempt" || marks.statuses.get(key) === "exempt";
      if (!resolved) missingBySubject.set(mapping.subject_id, (missingBySubject.get(mapping.subject_id) ?? 0) + 1);
      continue;
    }
    const list = subjectMap.get(mapping.subject_id) ?? [];
    list.push({
      assessment_id: mapping.assessment_id,
      assessment_type: type,
      category: mapping.category as AssessmentScore["category"],
      raw_score: score.raw_score,
      max_score: score.max_score,
    });
    subjectMap.set(mapping.subject_id, list);
  }

  const grades = Array.from(subjectMap.entries()).map(([subject_id, list]) => calculateSubjectGrade(subject_id, list, w));
  return {
    grades,
    attributes: attributes.map((a) => ({ id: a.id, attribute_name: a.attribute_name, rating: a.rating })),
    rawMappings: assessmentMappings,
    missingBySubject,
    mappedSubjects,
  };
}

// ─── Cohort documents ────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Competition ranking (1, 2, 2, 4) of averages, highest first; null averages are unranked. */
export function rankAverages(entries: Array<{ id: number; average: number | null }>): Map<number, number> {
  const ranked = entries.filter((e) => e.average != null).sort((a, b) => (b.average as number) - (a.average as number));
  const out = new Map<number, number>();
  ranked.forEach((e, i) => {
    const prev = ranked[i - 1];
    out.set(e.id, prev && prev.average === e.average ? out.get(prev.id)! : i + 1);
  });
  return out;
}

export interface StudentInfo {
  name: string;
  registration_number: string | null;
  gender: string | null;
  class_group_id: number | null;
  class_name: string | null;
  grade_name: string | null;
  program_name: string | null;
}

/** Names etc. from the directory, else the linked local account (never a users.id collision). */
export async function resolveStudentInfo(
  studentIds: number[],
  directory?: SchoolDirectory | null,
): Promise<Map<number, StudentInfo>> {
  const out = new Map<number, StudentInfo>();
  const groups = new Map((directory?.class_groups ?? []).map((g) => [g.id, g]));
  for (const s of directory?.students ?? []) {
    if (!studentIds.includes(s.mis_user_id)) continue;
    const g = groups.get(s.class_group_id);
    out.set(s.mis_user_id, {
      name: s.name,
      registration_number: s.registration_number,
      gender: s.gender,
      class_group_id: s.class_group_id,
      class_name: g?.name ?? null,
      grade_name: g?.grade_name ?? null,
      program_name: g?.program_name ?? null,
    });
  }
  const rest = studentIds.filter((id) => !out.has(id));
  if (rest.length) {
    const users = await User.findAll({
      where: { [Op.or]: [{ mis_user_id: { [Op.in]: rest } }, { id: { [Op.in]: rest } }] },
      attributes: ["id", "mis_user_id", "first_name", "last_name"],
      raw: true,
    });
    for (const id of rest) {
      // A MIS id's linked account wins over a local account that merely shares the number.
      const u: any =
        users.find((x: any) => Number(x.mis_user_id) === id) ??
        users.find((x: any) => Number(x.id) === id && x.mis_user_id == null);
      out.set(id, {
        name: u ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || `Student #${id}` : `Student #${id}`,
        registration_number: null,
        gender: null,
        class_group_id: null,
        class_name: null,
        grade_name: null,
        program_name: null,
      });
    }
  }
  return out;
}

export interface BuildOptions {
  directory?: SchoolDirectory | null;
  /** Every card of the class this term (defaults to the cards themselves). */
  cohort?: ReportCard[];
  /** Grades already computed (card id -> grades), e.g. by the workbench. */
  computed?: Map<number, CardGrades>;
}

/**
 * Render `cards` as documents. Class averages and positions are over the
 * cohort (cards of the same class group, term and year).
 */
export async function buildCardDocuments(
  req: Request,
  cards: ReportCard[],
  opts: BuildOptions = {},
): Promise<Map<number, ReportCardDocument>> {
  const out = new Map<number, ReportCardDocument>();
  if (cards.length === 0) return out;
  const [scheme, bands, school] = await Promise.all([getReportCardScheme(), getGradingBands(), getBranding()]);

  const cohort = new Map<number, ReportCard>();
  for (const c of [...(opts.cohort ?? []), ...cards]) cohort.set(c.id!, c);
  const computed = new Map(opts.computed ?? []);
  for (const c of cohort.values()) {
    if (!computed.has(c.id!)) computed.set(c.id!, await computeCardGrades(c, scheme.category_weights));
  }

  const info = await resolveStudentInfo([...new Set([...cohort.values()].map((c) => c.student_id))], opts.directory);
  const allSubjectIds = new Set<number>();
  for (const g of computed.values()) {
    g.grades.forEach((x) => allSubjectIds.add(x.subject_id));
    g.mappedSubjects.forEach((id) => allSubjectIds.add(id));
  }
  const names = await resolveSubjectNames(req, [...allSubjectIds]);

  // A cohort key: class group (stored or from the directory) + period.
  const classOf = (c: ReportCard) => c.class_group_id ?? info.get(c.student_id)?.class_group_id ?? null;
  const cohortKey = (c: ReportCard) => `${classOf(c) ?? `solo-${c.id}`}|${c.term}|${c.academic_year}`;
  const byCohort = new Map<string, ReportCard[]>();
  for (const c of cohort.values()) {
    const k = cohortKey(c);
    byCohort.set(k, [...(byCohort.get(k) ?? []), c]);
  }

  const averageOf = (g: CardGrades) => {
    const totals = g.grades.map((x) => x.total_score);
    return totals.length ? round2(totals.reduce((a, b) => a + b, 0) / totals.length) : null;
  };
  const cohortStats = new Map<string, { subjectAvg: Map<number, number>; ranks: Map<number, number>; size: number; classAvg: number | null }>();
  for (const [k, members] of byCohort) {
    const sums = new Map<number, { sum: number; n: number }>();
    for (const m of members) {
      for (const g of computed.get(m.id!)!.grades) {
        const s = sums.get(g.subject_id) ?? { sum: 0, n: 0 };
        s.sum += g.total_score;
        s.n += 1;
        sums.set(g.subject_id, s);
      }
    }
    const avgs = members.map((m) => ({ id: m.id!, average: averageOf(computed.get(m.id!)!) }));
    const ranked = avgs.filter((a) => a.average != null);
    cohortStats.set(k, {
      subjectAvg: new Map([...sums].map(([sid, s]) => [sid, round2(s.sum / s.n)])),
      ranks: rankAverages(avgs),
      size: ranked.length,
      classAvg: ranked.length ? round2(ranked.reduce((a, b) => a + (b.average as number), 0) / ranked.length) : null,
    });
  }

  const cycles = await ReportCycle.findAll({
    where: {
      class_group_id: { [Op.in]: [...new Set(cards.map(classOf).filter((x): x is number => x != null))] },
    },
  }).catch(() => [] as ReportCycle[]);
  const cycleOf = (c: ReportCard) =>
    cycles.find((y) => y.class_group_id === classOf(c) && y.term === c.term && y.academic_year === c.academic_year) ?? null;

  const groupOf = (subjectId: number) =>
    scheme.subject_groups.find((g) => g.subject_ids.includes(subjectId))?.name ?? null;
  const groupOrder = (name: string | null) => {
    const i = scheme.subject_groups.findIndex((g) => g.name === name);
    return i === -1 ? scheme.subject_groups.length : i;
  };

  for (const card of cards) {
    const g = computed.get(card.id!)!;
    const stats = cohortStats.get(cohortKey(card))!;
    const s = info.get(card.student_id)!;
    const cg = classOf(card);
    const teacherOf = (subjectId: number) => {
      if (!opts.directory) return null;
      const list =
        (cg != null ? opts.directory.class_subject_teachers.get(`${cg}:${subjectId}`) : null) ??
        opts.directory.subject_teachers.get(subjectId) ??
        [];
      return list.length ? list.map((t) => t.name).join(", ") : null;
    };
    const gradeBySubject = new Map(g.grades.map((x) => [x.subject_id, x]));
    const subjectIds = [...new Set([...g.mappedSubjects, ...gradeBySubject.keys()])];
    const subjects: DocumentSubject[] = subjectIds.map((sid) => {
      const grade = gradeBySubject.get(sid);
      const total = grade ? grade.total_score : null;
      const letter = total != null ? letterFor(total, bands) : null;
      const categories = Object.fromEntries(
        CATS.map((c) => [c, grade?.categories[c]?.scaled_score ?? null]),
      ) as Record<Cat, number | null>;
      return {
        subject_id: sid,
        name: names[sid] ?? `Subject #${sid}`,
        group: groupOf(sid),
        teacher: teacherOf(sid),
        categories,
        total,
        grade: letter?.letter ?? null,
        remark: letter?.remark ?? null,
        passed: total != null ? total >= scheme.pass_mark : null,
        class_average: stats.subjectAvg.get(sid) ?? null,
        missing_marks: g.missingBySubject.get(sid) ?? 0,
      };
    });
    subjects.sort((a, b) => groupOrder(a.group) - groupOrder(b.group) || a.name.localeCompare(b.name));
    const groups: ReportCardDocument["groups"] = [];
    for (const sub of subjects) {
      const last = groups[groups.length - 1];
      if (last && last.name === sub.group) last.subjects.push(sub);
      else groups.push({ name: sub.group, subjects: [sub] });
    }

    const counted = subjects.filter((x) => x.total != null);
    const average = averageOf(g);
    const avgLetter = average != null ? letterFor(average, bands) : null;
    const position = stats.ranks.get(card.id!) ?? null;
    const cycle = cycleOf(card);
    const attendance = {
      present: card.attendance_present ?? 0,
      absent: card.attendance_absent ?? 0,
      excused: card.attendance_excused ?? 0,
      late: card.attendance_late ?? 0,
      sick: card.attendance_sick ?? 0,
      total: 0,
      source: (card.attendance_source ?? "manual") as "manual" | "imported",
    };
    attendance.total = attendance.present + attendance.absent + attendance.excused + attendance.late + attendance.sick;

    // Attributes in the scheme's order, then any legacy names the card still has.
    const attrOrder = (n: string) => {
      const i = scheme.attributes.findIndex((a) => a.toLowerCase() === n.toLowerCase());
      return i === -1 ? scheme.attributes.length : i;
    };
    const attributes = [...g.attributes]
      .map((a) => ({ attribute_name: a.attribute_name, rating: a.rating }))
      .sort((a, b) => attrOrder(a.attribute_name) - attrOrder(b.attribute_name));

    out.set(card.id!, {
      schema: DOCUMENT_SCHEMA,
      card: {
        id: card.id!,
        uuid: card.uuid,
        version: card.version ?? 0,
        status: card.status,
        term: card.term,
        academic_year: card.academic_year,
        approved_at: card.approved_at ? new Date(card.approved_at).toISOString() : null,
        published_at: card.published_at ? new Date(card.published_at).toISOString() : null,
      },
      school,
      student: {
        id: card.student_id,
        name: s.name,
        registration_number: s.registration_number,
        gender: s.gender,
        class_group_id: cg,
        class_name: card.class_name ?? s.class_name,
        grade_name: s.grade_name,
        program_name: s.program_name,
      },
      scheme: {
        category_weights: scheme.category_weights,
        pass_mark: scheme.pass_mark,
        bands,
        show_position: scheme.show_position,
        show_class_average: scheme.show_class_average,
        show_subject_teacher: scheme.show_subject_teacher,
        head_title: scheme.head_title,
      },
      groups,
      summary: {
        average,
        grade: avgLetter?.letter ?? null,
        remark: avgLetter?.remark ?? null,
        total_marks: round2(counted.reduce((a, x) => a + (x.total as number), 0)),
        subjects_counted: counted.length,
        subjects_passed: counted.filter((x) => x.passed).length,
        subjects_failed: counted.filter((x) => x.passed === false).length,
        position,
        position_of: position != null ? stats.size : null,
        class_average: stats.classAvg,
      },
      attendance,
      attributes,
      comments: {
        class_teacher: card.class_teacher_comment ?? null,
        head_teacher: card.head_teacher_comment ?? null,
      },
      next_term_begins_on: cycle?.next_term_begins_on ?? null,
      grades: g.grades,
    });
  }
  return out;
}

/** The cohort of a card: every card of its class group this term (itself when it has no class). */
export async function loadCohort(card: ReportCard): Promise<ReportCard[]> {
  if (card.class_group_id == null) return [card];
  return ReportCard.findAll({
    where: { class_group_id: card.class_group_id, term: card.term, academic_year: card.academic_year },
  });
}
