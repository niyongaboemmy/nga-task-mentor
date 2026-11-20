import { Request } from "express";
import axios from "axios";
import { Op } from "sequelize";
import { ReportCard } from "../models/ReportCard.model";
import { ReportCardAssessment } from "../models/ReportCardAssessment.model";
import { ReportCardAttribute } from "../models/ReportCardAttribute.model";
import { ReportCycle, ReportCardSnapshot } from "../models/ReportCardWorkflow.model";
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
  type ModuleCategory,
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

export type Cat = "CW" | "HW" | "MD" | "EOT" | "IA";
const CATS: Cat[] = ["CW", "HW", "MD", "EOT", "IA"];

/** Behaviour (conduct) is out of 40 on RTB/CAMIS cards. */
export const BEHAVIOUR_MAX = 40;

/**
 * One term of a module in CAMIS terms: FA (formative = CW+HW+MD), IA
 * (integrated, Term 3) and CA (comprehensive = EOT), each as scaled points,
 * and the term mark out of 100.
 */
export interface TermCell {
  term: string;
  fa: number | null;
  ia: number | null;
  ca: number | null;
  total: number | null;
}

/** "Term 3" / "Term III" / "Third term" -> 3; null when it doesn't say. */
export function termIndex(term: string | null | undefined): number | null {
  const t = String(term ?? "").toLowerCase();
  const word: Record<string, number> = { first: 1, second: 2, third: 3, one: 1, two: 2, three: 3 };
  for (const [w, n] of Object.entries(word)) if (new RegExp(`\\b${w}\\b`).test(t)) return n;
  const roman = t.match(/\b(iii|ii|i)\b/);
  if (roman) return roman[1].length;
  const digit = t.match(/\b([1-4])\b/);
  return digit ? Number(digit[1]) : null;
}

/** The last term of the year carries the annual results (CAMIS prints the year on it). */
export const isFinalTerm = (term: string | null | undefined) => termIndex(term) === 3;

const sumOrNull = (xs: Array<number | null | undefined>) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) * 100) / 100 : null;
};

/** A subject grade as CAMIS columns. */
export function termCellOf(term: string, g: Pick<SubjectGrade, "categories" | "total_score"> | null | undefined): TermCell {
  const c = (k: Cat) => g?.categories?.[k as keyof SubjectGrade["categories"]]?.scaled_score ?? null;
  return { term, fa: sumOrNull([c("CW"), c("HW"), c("MD")]), ia: c("IA"), ca: c("EOT"), total: g ? g.total_score : null };
}

/** "120", "120 hours", "12 credits" -> learning hours (credits x 10). */
export function learningHours(raw: unknown): number | null {
  const t = String(raw ?? "").toLowerCase();
  const m = t.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return /credit/.test(t) ? n * 10 : n;
}

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
  /** RTB module code (e.g. SPEWI302), when MIS has one. */
  code?: string | null;
  /** RTB module category, from the scheme's groups or the code prefix. */
  category?: ModuleCategory | null;
  /** Points earned (sum of category scores) over `weight_covered` assessed points. */
  points?: number | null;
  weight_covered?: number | null;
  /** The mark this module needs to be Competent, and whether it is (null = no mark yet). */
  threshold?: number | null;
  competent?: boolean | null;
  /** Rank in the class for this module (1 = best), of `rank_of` students with a mark. */
  rank?: number | null;
  rank_of?: number | null;
  /** False when the card maps no assessment for it yet (listed because the class takes it). */
  mapped?: boolean;
  /** Module weight = learning hours (credits x 10), from MIS. */
  weight?: number | null;
  /** RQF level of the module (MIS), e.g. "3". */
  rqf_level?: string | null;
  /** This term in CAMIS columns. */
  term_cell?: TermCell;
  /** Final-term card: the earlier terms of the year, in order. */
  earlier_terms?: TermCell[];
  /** Final-term card: the module over the year (average of the terms assessed). */
  annual?: { total: number | null; competent: boolean | null; terms_assessed: number };
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
    show_subject_rank?: boolean;
    show_competence?: boolean;
    competence_thresholds?: Record<ModuleCategory, number>;
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
    modules_competent?: number;
    modules_nyc?: number;
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
  /** Behaviour out of 40 (outside every total); the earlier terms' too on a final-term card. */
  behaviour?: { mark: number | null; max: number; earlier?: Array<{ term: string; mark: number | null }> };
  /** RTB qualification block (CAMIS): level, trade, title. */
  qualification?: { rqf_level: string | null; trade: string | null; title: string | null; sector: string | null };
  /** Final-term card only: the year (CAMIS annual report). */
  annual?: {
    terms: string[];
    average: number | null;
    position: number | null;
    position_of: number | null;
    modules_competent: number;
    modules_nyc: number;
    total_marks: number;
    total_max: number;
  };
}

// ─── Subject names (MIS catalogue, cached briefly per tenant) ───────────────

const SUBJECT_TTL_MS = 5 * 60 * 1000;
interface SubjectInfo {
  name: string;
  code: string | null;
  learning_hours?: number | null;
  rqf_level?: string | null;
}
const subjectInfoCache = new Map<string, { at: number; info: Record<number, SubjectInfo> }>();

/** MIS subject id -> name and module code (best effort, cached briefly per tenant). */
export async function resolveSubjectInfo(req: Request, subjectIds: number[]): Promise<Record<number, SubjectInfo>> {
  if (subjectIds.length === 0) return {};
  const key = tk("subject-info");
  const hit = subjectInfoCache.get(key);
  let info = hit && Date.now() - hit.at < SUBJECT_TTL_MS ? hit.info : null;
  if (!info || subjectIds.some((id) => !(id in info!))) {
    const token = getMisToken(req, { quiet: true });
    if (token) {
      try {
        const response = await axios.get(`${process.env.NGA_MIS_BASE_URL}/academics/subjects`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 500 },
        });
        info = { ...(info ?? {}) };
        for (const s of response.data?.data || []) {
          const id = s.id ?? s.subject_id;
          if (id != null) {
            info[Number(id)] = {
              name: s.name || s.subject_name || s.title || `Subject #${id}`,
              code: typeof s.code === "string" && s.code.trim() ? s.code.trim() : null,
              learning_hours: learningHours(s.learning_hours ?? s.credits),
              rqf_level: s.rqf_level != null && String(s.rqf_level).trim() ? String(s.rqf_level).trim() : null,
            };
          }
        }
        subjectInfoCache.set(key, { at: Date.now(), info });
      } catch (error: any) {
        console.error("resolveSubjectInfo: could not fetch MIS subjects:", error?.message ?? error);
      }
    }
  }
  const out: Record<number, SubjectInfo> = {};
  for (const id of subjectIds) if (info?.[id]) out[id] = info[id];
  return out;
}

/** MIS subject id -> name. Best effort: a missing name renders "Subject #id". */
export async function resolveSubjectNames(req: Request, subjectIds: number[]): Promise<Record<number, string>> {
  const info = await resolveSubjectInfo(req, subjectIds);
  return Object.fromEntries(Object.entries(info).map(([id, v]) => [Number(id), v.name]));
}

/**
 * The module code as printed: MIS may append "_<timestamp>" to keep codes
 * unique (e.g. SFEPE301_1789738744651), which is not part of the code.
 */
export const displayCode = (code: string | null | undefined): string | null =>
  code ? code.replace(/_\d{6,}$/, "").trim().toUpperCase() || null : null;

/**
 * RTB module category from its code: CCM… complementary, GEN… general, any
 * other trade code (e.g. SPE…, SFE…) specific. Null without a code.
 */
export function categoryFromCode(code: string | null | undefined): ModuleCategory | null {
  const c = displayCode(code)?.toUpperCase();
  if (!c) return null;
  if (c.startsWith("CCM")) return "complementary";
  if (c.startsWith("GEN")) return "general";
  if (/^[A-Z]{3,}/.test(c)) return "specific";
  return null;
}

export const CATEGORY_LABEL: Record<ModuleCategory, string> = {
  specific: "Specific modules",
  general: "General modules",
  complementary: "Complementary modules",
};

/** Competition ranking of values, highest first (null = unranked). */
export function rankValues(entries: Array<{ id: number; value: number | null }>): Map<number, number> {
  const ranked = entries.filter((e) => e.value != null).sort((a, b) => (b.value as number) - (a.value as number));
  const out = new Map<number, number>();
  ranked.forEach((e, i) => {
    const prev = ranked[i - 1];
    out.set(e.id, prev && prev.value === e.value ? out.get(prev.id)! : i + 1);
  });
  return out;
}

/** Tests only. */
export function clearSubjectNameCache() {
  subjectInfoCache.clear();
}

// ─── Grades of one card ──────────────────────────────────────────────────────

export interface CardGrades {
  grades: SubjectGrade[];
  attributes: Array<{ id?: number; attribute_name: string; rating: string }>;
  rawMappings: ReportCardAssessment[];
  /** subject id -> marks mapped but not recorded and not resolved. */
  missingBySubject: Map<number, number>;
  /** subject id -> which mapped assessments those missing marks are. */
  missingItems: Map<number, Array<{ assessment_type: string; assessment_id: number; category: string }>>;
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
  const missingItems: CardGrades["missingItems"] = new Map();
  const mappedSubjects = new Set<number>();
  for (const mapping of assessmentMappings) {
    const type = mapping.assessment_type as AssessmentScore["assessment_type"];
    const key = `${type}:${mapping.assessment_id}` as ScoreKey;
    if (!marks.valid.has(key)) continue; // deleted quiz / "part of" assignment
    mappedSubjects.add(mapping.subject_id);
    const score = resolveMark(key, marks, mapping.mark_status);
    if (!score) {
      const resolved = mapping.mark_status === "exempt" || marks.statuses.get(key) === "exempt";
      if (!resolved) {
        missingBySubject.set(mapping.subject_id, (missingBySubject.get(mapping.subject_id) ?? 0) + 1);
        const list = missingItems.get(mapping.subject_id) ?? [];
        list.push({ assessment_type: type, assessment_id: mapping.assessment_id, category: mapping.category });
        missingItems.set(mapping.subject_id, list);
      }
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
    missingItems,
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
  // Every subject the class takes is listed, mapped or not, so a missing
  // mapping shows on the card instead of the subject silently vanishing.
  const classSubjectsOf = (classGroupId: number | null): number[] =>
    classGroupId != null && opts.directory ? (opts.directory.class_group_subjects.get(classGroupId) ?? []) : [];
  for (const c of cards) {
    const cgId = c.class_group_id ?? info.get(c.student_id)?.class_group_id ?? null;
    classSubjectsOf(cgId).forEach((id) => allSubjectIds.add(id));
  }
  const subjectInfo = await resolveSubjectInfo(req, [...allSubjectIds]);
  const names = Object.fromEntries(Object.entries(subjectInfo).map(([id, v]) => [Number(id), v.name])) as Record<number, string>;

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
  const cohortStats = new Map<
    string,
    {
      subjectAvg: Map<number, number>;
      /** subject id -> (card id -> rank in that subject), and how many were ranked. */
      subjectRanks: Map<number, { ranks: Map<number, number>; of: number }>;
      ranks: Map<number, number>;
      size: number;
      classAvg: number | null;
    }
  >();
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
    const subjectRanks = new Map<number, { ranks: Map<number, number>; of: number }>();
    for (const sid of sums.keys()) {
      const entries = members.map((m) => ({
        id: m.id!,
        value: computed.get(m.id!)!.grades.find((x) => x.subject_id === sid)?.total_score ?? null,
      }));
      subjectRanks.set(sid, { ranks: rankValues(entries), of: entries.filter((e) => e.value != null).length });
    }
    cohortStats.set(k, {
      subjectAvg: new Map([...sums].map(([sid, s]) => [sid, round2(s.sum / s.n)])),
      subjectRanks,
      ranks: rankAverages(avgs),
      size: ranked.length,
      classAvg: ranked.length ? round2(ranked.reduce((a, b) => a + (b.average as number), 0) / ranked.length) : null,
    });
  }

  // Final-term cohorts (CAMIS annual report): each member's earlier terms of
  // the year. A frozen earlier card counts with its snapshot's grades.
  const earlierByCard = new Map<number, Array<{ term: string; grades: SubjectGrade[]; behaviour: number | null }>>();
  for (const members of byCohort.values()) {
    const finals = members.filter((m) => isFinalTerm(m.term));
    if (!finals.length) continue;
    const cur = termIndex(finals[0].term) ?? 3;
    const siblings = await ReportCard.findAll({
      where: { academic_year: finals[0].academic_year, student_id: { [Op.in]: [...new Set(members.map((m) => m.student_id))] } },
    });
    const earlier = siblings.filter((c) => {
      const i = termIndex(c.term);
      return i != null && i < cur;
    });
    const gradesOf = new Map<number, SubjectGrade[]>();
    const frozenIds = earlier.filter((c) => c.status === "approved" || c.status === "published").map((c) => c.id!);
    if (frozenIds.length) {
      const snaps = await ReportCardSnapshot.findAll({
        where: { report_card_id: { [Op.in]: frozenIds }, superseded_at: { [Op.is]: null } as any },
      });
      for (const sn of snaps as any[]) gradesOf.set(Number(sn.report_card_id), (sn.payload as ReportCardDocument | null)?.grades ?? []);
    }
    for (const c of earlier) if (!gradesOf.has(c.id!)) gradesOf.set(c.id!, (await computeCardGrades(c, scheme.category_weights)).grades);
    for (const m of finals) {
      const byTerm = new Map<string, ReportCard>();
      for (const c of earlier.filter((x) => x.student_id === m.student_id).sort((a, b) => (termIndex(a.term) ?? 0) - (termIndex(b.term) ?? 0))) {
        if (!byTerm.has(c.term)) byTerm.set(c.term, c);
      }
      earlierByCard.set(
        m.id!,
        [...byTerm.values()].map((c) => ({ term: c.term, grades: gradesOf.get(c.id!) ?? [], behaviour: c.behaviour_mark ?? null })),
      );
    }
  }
  /** A final-term card's modules over the year: subject id -> average of the term marks assessed. */
  const annualOf = (card: ReportCard): Map<number, { total: number; terms: number }> => {
    const out = new Map<number, { sum: number; n: number }>();
    const add = (grades: SubjectGrade[]) => {
      for (const g of grades) {
        const a = out.get(g.subject_id) ?? { sum: 0, n: 0 };
        a.sum += g.total_score;
        a.n += 1;
        out.set(g.subject_id, a);
      }
    };
    for (const e of earlierByCard.get(card.id!) ?? []) add(e.grades);
    add(computed.get(card.id!)!.grades);
    return new Map([...out].map(([sid, a]) => [sid, { total: round2(a.sum / a.n), terms: a.n }]));
  };
  const annualAverage = (card: ReportCard) => {
    const totals = [...annualOf(card).values()].map((x) => x.total);
    return totals.length ? round2(totals.reduce((a, b) => a + b, 0) / totals.length) : null;
  };
  const annualRanks = new Map<string, { ranks: Map<number, number>; of: number }>();
  for (const [k, members] of byCohort) {
    const finals = members.filter((m) => isFinalTerm(m.term));
    if (!finals.length) continue;
    const avgs = finals.map((m) => ({ id: m.id!, average: annualAverage(m) }));
    annualRanks.set(k, { ranks: rankAverages(avgs), of: avgs.filter((a) => a.average != null).length });
  }

  const cycles = await ReportCycle.findAll({
    where: {
      class_group_id: { [Op.in]: [...new Set(cards.map(classOf).filter((x): x is number => x != null))] },
    },
  }).catch(() => [] as ReportCycle[]);
  const cycleOf = (c: ReportCard) =>
    cycles.find((y) => y.class_group_id === classOf(c) && y.term === c.term && y.academic_year === c.academic_year) ?? null;

  // Module category: the scheme's own groups when named like an RTB category,
  // else the module code's prefix.
  const categoryFromGroupName = (name: string | null | undefined): ModuleCategory | null => {
    const n = (name ?? "").toLowerCase();
    if (n.includes("complementary")) return "complementary";
    if (n.includes("general")) return "general";
    if (n.includes("specific") || n.includes("core")) return "specific";
    return null;
  };
  const schemeGroupOf = (subjectId: number) => scheme.subject_groups.find((g) => g.subject_ids.includes(subjectId))?.name ?? null;
  const categoryOf = (subjectId: number): ModuleCategory | null =>
    categoryFromGroupName(schemeGroupOf(subjectId)) ?? categoryFromCode(subjectInfo[subjectId]?.code);
  // Groups: the school's own when it defined any; otherwise RTB categories from codes.
  const useSchemeGroups = scheme.subject_groups.length > 0;
  const groupOf = (subjectId: number) => {
    if (useSchemeGroups) return schemeGroupOf(subjectId);
    const c = categoryOf(subjectId);
    return c ? CATEGORY_LABEL[c] : null;
  };
  const CATEGORY_ORDER = Object.values(CATEGORY_LABEL);
  const groupOrder = (name: string | null) => {
    const list = useSchemeGroups ? scheme.subject_groups.map((g) => g.name) : CATEGORY_ORDER;
    const i = list.indexOf(name ?? "");
    return i === -1 ? list.length : i;
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
    const final = isFinalTerm(card.term);
    const annual = final ? annualOf(card) : null;
    const subjectIds = [
      ...new Set([...g.mappedSubjects, ...gradeBySubject.keys(), ...classSubjectsOf(cg), ...(annual ? annual.keys() : [])]),
    ];
    const subjects: DocumentSubject[] = subjectIds.map((sid) => {
      const grade = gradeBySubject.get(sid);
      const total = grade ? grade.total_score : null;
      const letter = total != null ? letterFor(total, bands) : null;
      const categories = Object.fromEntries(
        CATS.map((c) => [c, grade?.categories[c]?.scaled_score ?? null]),
      ) as Record<Cat, number | null>;
      const category = categoryOf(sid);
      const threshold = scheme.competence_thresholds[category ?? "specific"] ?? scheme.pass_mark;
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
        code: displayCode(subjectInfo[sid]?.code),
        category,
        points: grade ? round2(grade.points) : null,
        weight_covered: grade ? grade.weight_covered : null,
        threshold,
        competent: total != null ? total >= threshold : null,
        rank: stats.subjectRanks.get(sid)?.ranks.get(card.id!) ?? null,
        rank_of: stats.subjectRanks.get(sid)?.of ?? null,
        mapped: g.mappedSubjects.has(sid) || gradeBySubject.has(sid),
        weight: subjectInfo[sid]?.learning_hours ?? null,
        rqf_level: subjectInfo[sid]?.rqf_level ?? null,
        term_cell: termCellOf(card.term, grade),
        ...(final
          ? {
              earlier_terms: (earlierByCard.get(card.id!) ?? []).map((e) =>
                termCellOf(e.term, e.grades.find((x) => x.subject_id === sid)),
              ),
              annual: (() => {
                const a = annual!.get(sid);
                return { total: a?.total ?? null, competent: a ? a.total >= threshold : null, terms_assessed: a?.terms ?? 0 };
              })(),
            }
          : {}),
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
        show_subject_rank: scheme.show_subject_rank,
        show_competence: scheme.show_competence,
        competence_thresholds: scheme.competence_thresholds,
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
        modules_competent: counted.filter((x) => x.competent === true).length,
        modules_nyc: counted.filter((x) => x.competent === false).length,
      },
      attendance,
      attributes,
      comments: {
        class_teacher: card.class_teacher_comment ?? null,
        head_teacher: card.head_teacher_comment ?? null,
      },
      next_term_begins_on: cycle?.next_term_begins_on ?? null,
      grades: g.grades,
      behaviour: {
        mark: card.behaviour_mark ?? null,
        max: BEHAVIOUR_MAX,
        ...(final ? { earlier: (earlierByCard.get(card.id!) ?? []).map((e) => ({ term: e.term, mark: e.behaviour })) } : {}),
      },
      qualification: qualificationOf(subjects, s.program_name, card.class_name ?? s.class_name, s.grade_name),
      ...(final
        ? {
            annual: (() => {
              const withYear = subjects.filter((x) => x.annual?.total != null);
              const rk = annualRanks.get(cohortKey(card));
              const position = rk?.ranks.get(card.id!) ?? null;
              return {
                terms: [...(earlierByCard.get(card.id!) ?? []).map((e) => e.term), card.term],
                average: annualAverage(card),
                position,
                position_of: position != null ? (rk?.of ?? null) : null,
                modules_competent: withYear.filter((x) => x.annual!.competent === true).length,
                modules_nyc: withYear.filter((x) => x.annual!.competent === false).length,
                total_marks: round2(withYear.reduce((a, x) => a + (x.annual!.total as number), 0)),
                total_max: withYear.length * 100,
              };
            })(),
          }
        : {}),
    });
  }
  return out;
}

const ROMAN: Record<string, string> = { "1": "I", "2": "II", "3": "III", "4": "IV", "5": "V" };

/**
 * The RTB qualification block: RQF level (the modules' level from MIS, else
 * "L3"/"Level 3" in the class or grade name), trade (the programme) and the
 * title "TVET Certificate III in <trade>".
 */
export function qualificationOf(
  subjects: Array<Pick<DocumentSubject, "rqf_level">>,
  program: string | null | undefined,
  className: string | null | undefined,
  gradeName: string | null | undefined,
): NonNullable<ReportCardDocument["qualification"]> {
  const counts = new Map<string, number>();
  for (const s of subjects) {
    const m = String(s.rqf_level ?? "").match(/[1-8]/);
    if (m) counts.set(m[0], (counts.get(m[0]) ?? 0) + 1);
  }
  let level: string | null = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  if (!level) {
    const m = `${className ?? ""} ${gradeName ?? ""}`.match(/\b(?:l|level|rqf)\s*\.?\s*([1-8])\b/i);
    level = m ? m[1] : null;
  }
  const trade = program?.trim() || null;
  const title = level && ROMAN[level] && trade ? `TVET Certificate ${ROMAN[level]} in ${trade}` : null;
  return { rqf_level: level, trade, title, sector: null };
}

/** The cohort of a card: every card of its class group this term (itself when it has no class). */
export async function loadCohort(card: ReportCard): Promise<ReportCard[]> {
  if (card.class_group_id == null) return [card];
  return ReportCard.findAll({
    where: { class_group_id: card.class_group_id, term: card.term, academic_year: card.academic_year },
  });
}
