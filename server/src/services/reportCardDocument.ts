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
import { getSchoolProfile } from "./schoolProfile";
import { effectiveCategory, gradingOf, type Grading, type ReportCardBuilderKind } from "./reportCardBuilders";
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

export const DOCUMENT_SCHEMA = 2;

export type Cat = "CW" | "HW" | "MD" | "EOT" | "FA" | "CA" | "IA";
const CATS: Cat[] = ["CW", "HW", "MD", "EOT", "FA", "CA", "IA"];

/** Behaviour (conduct) is out of 40 on RTB/CAMIS cards. */
export const BEHAVIOUR_MAX = 40;

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

// ─── TVET (RTB / CAMIS) maths ────────────────────────────────────────────────
// Each component (FA, CA, IA) is a percentage scaled to the module weight W
// (learning hours): FA 75% of a 30-hour module is 22.5. A term's TO is the sum
// of the components assessed, out of W per component (2W, or 3W with IA). The
// year (AT) is the sum of the term TOs over the sum of their maxima, and the
// class's totals and percentage are weighted by learning hours the same way.

const r2 = (n: number) => Math.round(n * 100) / 100;

/** A grade's FA / CA / IA as percentages, whichever builder produced it (Normal snapshots: CW+HW+MD -> FA, EOT -> CA). */
export function componentPcts(g: Pick<SubjectGrade, "categories"> | null | undefined): { fa: number | null; ca: number | null; ia: number | null } {
  const cats = (g?.categories ?? {}) as Record<string, { scaled_score: number; weight: number; avg_percentage: number } | undefined>;
  const pctOf = (keys: string[]) => {
    const present = keys.map((k) => cats[k]).filter((c): c is NonNullable<typeof c> => !!c);
    if (!present.length) return null;
    const weight = present.reduce((a, c) => a + (c.weight || 0), 0);
    if (weight > 0) return (present.reduce((a, c) => a + c.scaled_score, 0) / weight) * 100;
    return present.reduce((a, c) => a + c.avg_percentage, 0) / present.length;
  };
  return { fa: pctOf(cats.FA ? ["FA"] : ["CW", "HW", "MD"]), ca: pctOf(cats.CA ? ["CA"] : ["EOT"]), ia: pctOf(["IA"]) };
}

/** One module in one term, in marks out of the module weight. */
export interface TvetTermCell {
  fa: number | null;
  ia: number | null;
  ca: number | null;
  /** Sum of the components assessed. */
  to: number | null;
  /** W x the number of components assessed. */
  max: number | null;
  pct: number | null;
}

export function tvetCell(g: Pick<SubjectGrade, "categories"> | null | undefined, weight: number): TvetTermCell | null {
  const p = componentPcts(g);
  const parts = [p.fa, p.ca, p.ia].filter((x): x is number => x != null);
  if (!parts.length) return null;
  const mark = (x: number | null) => (x == null ? null : r2((x * weight) / 100));
  const fa = mark(p.fa);
  const ca = mark(p.ca);
  const ia = mark(p.ia);
  const to = r2([fa, ca, ia].reduce<number>((a, x) => a + (x ?? 0), 0));
  const max = weight * parts.length;
  return { fa, ia, ca, to, max, pct: max > 0 ? r2((to / max) * 100) : null };
}

/** Column totals of a term over the modules assessed, and its weighted percentage. */
export function tvetTotals(cells: Array<TvetTermCell | null | undefined>) {
  const got = cells.filter((c): c is TvetTermCell => !!c);
  if (!got.length) return { fa: null, ia: null, ca: null, to: null, max: null, pct: null };
  const sum = (k: "fa" | "ia" | "ca") => {
    const v = got.map((c) => c[k]).filter((x): x is number => x != null);
    return v.length ? r2(v.reduce((a, b) => a + b, 0)) : null;
  };
  const to = r2(got.reduce((a, c) => a + (c.to ?? 0), 0));
  const max = r2(got.reduce((a, c) => a + (c.max ?? 0), 0));
  return { fa: sum("fa"), ia: sum("ia"), ca: sum("ca"), to, max, pct: max > 0 ? r2((to / max) * 100) : null };
}

export type TvetTotals = ReturnType<typeof tvetTotals>;

/** The CAMIS deliberation conditions, from the school's pass lines. */
export function deliberationConditions(th: Record<ModuleCategory, number>): string[] {
  const lines = ["Each module is independently deliberated"];
  if (th.general === th.complementary) lines.push(`The passing line for Complementary and General modules is ${th.general}%`);
  else {
    lines.push(`The passing line for Complementary modules is ${th.complementary}%`);
    lines.push(`The passing line for General modules is ${th.general}%`);
  }
  lines.push(`The passing line for Specific modules is ${th.specific}%`);
  return lines;
}

/** The final-term decision: every module competent -> Promoted (Graduated at Level 5); otherwise re-assessment. */
export function tvetDecision(competence: Array<boolean | null>, rqfLevel: string | null): string | null {
  const judged = competence.filter((c): c is boolean => c != null);
  if (!judged.length) return null;
  if (judged.every(Boolean)) return rqfLevel === "5" ? "Graduated" : "Promoted";
  return "Re-assessment required";
}

/**
 * "120", "120 hours", "12 credits" -> learning hours (credits x 10). A weekly
 * note ("5 (4 taught and 1 in self-study) per week", what MIS keeps in
 * learning_hours for the scheme of work) is not a module's hours: null.
 */
export function learningHours(raw: unknown): number | null {
  const t = String(raw ?? "").toLowerCase();
  if (/\b(per|a|each)\s+(week|day|month)\b|\/\s*(week|wk|day)\b|weekly|daily/.test(t)) return null;
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
  /** Module weight = learning hours (credits x 10). */
  weight?: number | null;
  /** RQF level of the module (MIS), e.g. "3". */
  rqf_level?: string | null;
  /** TVET builder: the module in CAMIS columns. */
  tvet?: {
    weight: number;
    /** Where the weight came from: the school's override, MIS learning hours, or the default. */
    weight_source: "school" | "mis" | "default";
    /** Aligned with ReportCardDocument.tvet.terms (null = no marks that term). */
    terms: Array<TvetTermCell | null>;
    /** Final-term card: the year. */
    annual: { at: number | null; max: number | null; pct: number | null; competent: boolean | null } | null;
  };
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
  /** Behaviour (conduct) out of 40, outside every total. */
  behaviour?: { mark: number | null; max: number };
  /** Which builder (template) the card was made with; absent on old snapshots = normal. */
  builder?: ReportCardBuilderKind;
  /** RTB qualification block (TVET). */
  qualification?: { rqf_level: string | null; trade: string | null; title: string | null; sector: string | null };
  /** TVET builder: everything the CAMIS layout needs besides the modules. */
  tvet?: {
    final: boolean;
    /** Term columns: Terms 1-3 on a final-term card, this term otherwise. */
    terms: Array<{
      term: string;
      current: boolean;
      totals: TvetTotals;
      position: number | null;
      position_of: number | null;
      conduct: number | null;
      comment: string | null;
    }>;
    annual: { total: number | null; max: number | null; pct: number | null; position: number | null; position_of: number | null; conduct: number | null } | null;
    school: { district: string; email: string; phone: string; headmaster: string };
    conditions: string[];
    decision: string | null;
    show_attendance: boolean;
    show_attributes: boolean;
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
              // The module weight: MIS's dedicated field, else credits / total hours.
              learning_hours: moduleWeightOf(s),
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

/** Every MIS subject (module) with its code, RTB category and learning hours, by name. */
export async function listSubjectInfo(
  req: Request,
): Promise<Array<{ id: number; name: string; code: string | null; category: ModuleCategory | null; learning_hours: number | null; rqf_level: string | null }>> {
  // Ask for a sentinel id so the catalogue is (re)fetched when it isn't cached.
  await resolveSubjectInfo(req, [-1]);
  const info = subjectInfoCache.get(tk("subject-info"))?.info ?? {};
  return Object.entries(info)
    .map(([id, v]) => ({
      id: Number(id),
      name: v.name,
      code: displayCode(v.code),
      category: categoryFromCode(v.code),
      learning_hours: v.learning_hours ?? null,
      rqf_level: v.rqf_level ?? null,
    }))
    .sort((a, b) => (a.code ?? a.name).localeCompare(b.code ?? b.name));
}

/** A MIS subject's report card weight: module_weight, else credits x 10, else total learning hours. */
export function moduleWeightOf(s: { module_weight?: unknown; credits?: unknown; learning_hours?: unknown }): number | null {
  const w = Number(s.module_weight);
  if (s.module_weight != null && s.module_weight !== "" && Number.isFinite(w) && w > 0) return w;
  if (s.credits != null && s.credits !== "") {
    const c = learningHours(`${s.credits} credits`);
    if (c) return c;
  }
  return learningHours(s.learning_hours);
}

/** Forget the cached MIS catalogue (after a weight is changed in MIS). */
export function forgetSubjectInfo() {
  subjectInfoCache.delete(tk("subject-info"));
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
export async function computeCardGrades(reportCard: ReportCard, grading?: Grading): Promise<CardGrades> {
  const [assessmentMappings, attributes, identity] = await Promise.all([
    ReportCardAssessment.findAll({ where: { report_card_id: reportCard.id } }),
    ReportCardAttribute.findAll({
      where: { report_card_id: reportCard.id },
      attributes: ["id", "attribute_name", "rating"],
    }),
    resolveCardStudent(reportCard.student_id),
  ]);
  const { builder, weights: w } = grading ?? gradingOf(await getReportCardScheme());
  const marks = await loadStudentMarks(identity, assessmentMappings);

  const subjectMap = new Map<number, AssessmentScore[]>();
  const missingBySubject = new Map<number, number>();
  const missingItems: CardGrades["missingItems"] = new Map();
  const mappedSubjects = new Set<number>();
  for (const mapping of assessmentMappings) {
    const type = mapping.assessment_type as AssessmentScore["assessment_type"];
    const key = `${type}:${mapping.assessment_id}` as ScoreKey;
    if (!marks.valid.has(key)) continue; // deleted quiz / "part of" assignment
    // The category this mapping counts under in the school's builder (a
    // mapping made under the other builder is read, never rewritten).
    const category = effectiveCategory(builder, mapping.category);
    if (!category) continue;
    mappedSubjects.add(mapping.subject_id);
    const score = resolveMark(key, marks, mapping.mark_status);
    if (!score) {
      const resolved = mapping.mark_status === "exempt" || marks.statuses.get(key) === "exempt";
      if (!resolved) {
        missingBySubject.set(mapping.subject_id, (missingBySubject.get(mapping.subject_id) ?? 0) + 1);
        const list = missingItems.get(mapping.subject_id) ?? [];
        list.push({ assessment_type: type, assessment_id: mapping.assessment_id, category });
        missingItems.set(mapping.subject_id, list);
      }
      continue;
    }
    const list = subjectMap.get(mapping.subject_id) ?? [];
    list.push({
      assessment_id: mapping.assessment_id,
      assessment_type: type,
      category,
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
  /** The class grade's RQF level from MIS (Grade.rqf_level). */
  grade_rqf_level?: number | null;
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
      grade_rqf_level: g?.grade_rqf_level ?? null,
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
  const grading = gradingOf(scheme);
  const tvet = grading.builder === "tvet";
  // The school's identity block from MIS (per tenant); the template's own fields fill any gaps.
  const misSchool = tvet ? (await getSchoolProfile(req)).profile : null;
  const pick = (mis: string | null | undefined, own: string) => (mis && mis.trim() ? mis.trim() : own);

  const cohort = new Map<number, ReportCard>();
  for (const c of [...(opts.cohort ?? []), ...cards]) cohort.set(c.id!, c);
  const computed = new Map(opts.computed ?? []);
  for (const c of cohort.values()) {
    if (!computed.has(c.id!)) computed.set(c.id!, await computeCardGrades(c, grading));
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

  // TVET: a final-term card shows the earlier terms of the year too. A frozen
  // earlier card counts with its snapshot's grades.
  const classOf = (c: ReportCard) => c.class_group_id ?? info.get(c.student_id)?.class_group_id ?? null;
  const cohortKey = (c: ReportCard) => `${classOf(c) ?? `solo-${c.id}`}|${c.term}|${c.academic_year}`;
  const byCohort = new Map<string, ReportCard[]>();
  for (const c of cohort.values()) {
    const k = cohortKey(c);
    byCohort.set(k, [...(byCohort.get(k) ?? []), c]);
  }
  type Earlier = { term: string; grades: SubjectGrade[]; behaviour: number | null; comment: string | null };
  const earlierByCard = new Map<number, Earlier[]>();
  if (tvet) {
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
      for (const c of earlier) if (!gradesOf.has(c.id!)) gradesOf.set(c.id!, (await computeCardGrades(c, grading)).grades);
      for (const m of finals) {
        const byTerm = new Map<number, ReportCard>();
        for (const c of earlier.filter((x) => x.student_id === m.student_id)) {
          const i = termIndex(c.term)!;
          if (!byTerm.has(i)) byTerm.set(i, c);
        }
        earlierByCard.set(
          m.id!,
          [...byTerm.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([, c]) => ({ term: c.term, grades: gradesOf.get(c.id!) ?? [], behaviour: c.behaviour_mark ?? null, comment: c.class_teacher_comment ?? null })),
        );
        for (const e of earlierByCard.get(m.id!)!) e.grades.forEach((x) => allSubjectIds.add(x.subject_id));
      }
    }
  }

  const subjectInfo = await resolveSubjectInfo(req, [...allSubjectIds]);
  const names = Object.fromEntries(Object.entries(subjectInfo).map(([id, v]) => [Number(id), v.name])) as Record<number, string>;

  // Module weight (TVET): the school's override, else MIS learning hours, else the default.
  const weightOf = (sid: number): { weight: number; source: "school" | "mis" | "default" } => {
    const own = scheme.tvet.module_weights[String(sid)];
    if (own != null && own > 0) return { weight: own, source: "school" };
    const mis = subjectInfo[sid]?.learning_hours;
    if (mis != null && mis > 0) return { weight: mis, source: "mis" };
    return { weight: scheme.tvet.default_module_weight, source: "default" };
  };
  const cellsOf = (grades: SubjectGrade[]) => grades.map((x) => tvetCell(x, weightOf(x.subject_id).weight));

  /** A card's overall percentage: the plain average of subject totals (Normal), or weighted by learning hours (TVET). */
  const averageOf = (g: CardGrades) => {
    if (tvet) return tvetTotals(cellsOf(g.grades)).pct;
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

  // TVET final-term cohorts: each earlier term's position, and the year's.
  const earlierRanks = new Map<string, Map<number, { ranks: Map<number, number>; of: number }>>();
  const annualRanks = new Map<string, { ranks: Map<number, number>; of: number }>();
  /** subject id -> the module over the year (sum of the term TOs over the sum of their maxima). */
  const yearOf = (card: ReportCard) => {
    const per = new Map<number, { at: number; max: number }>();
    const add = (grades: SubjectGrade[]) => {
      for (const x of grades) {
        const c = tvetCell(x, weightOf(x.subject_id).weight);
        if (!c) continue;
        const a = per.get(x.subject_id) ?? { at: 0, max: 0 };
        a.at += c.to ?? 0;
        a.max += c.max ?? 0;
        per.set(x.subject_id, a);
      }
    };
    for (const e of earlierByCard.get(card.id!) ?? []) add(e.grades);
    add(computed.get(card.id!)!.grades);
    return per;
  };
  const yearTotals = (card: ReportCard) => {
    const per = [...yearOf(card).values()];
    if (!per.length) return { total: null, max: null, pct: null };
    const total = round2(per.reduce((a, x) => a + x.at, 0));
    const max = round2(per.reduce((a, x) => a + x.max, 0));
    return { total, max, pct: max > 0 ? round2((total / max) * 100) : null };
  };
  if (tvet) {
    for (const [k, members] of byCohort) {
      const finals = members.filter((m) => isFinalTerm(m.term) && earlierByCard.has(m.id!));
      if (!finals.length) continue;
      const perTerm = new Map<number, { ranks: Map<number, number>; of: number }>();
      for (const idx of [1, 2]) {
        const avgs = finals.map((m) => {
          const e = (earlierByCard.get(m.id!) ?? []).find((x) => termIndex(x.term) === idx);
          return { id: m.id!, average: e ? tvetTotals(cellsOf(e.grades)).pct : null };
        });
        perTerm.set(idx, { ranks: rankAverages(avgs), of: avgs.filter((a) => a.average != null).length });
      }
      earlierRanks.set(k, perTerm);
      const yearAvgs = finals.map((m) => ({ id: m.id!, average: yearTotals(m).pct }));
      annualRanks.set(k, { ranks: rankAverages(yearAvgs), of: yearAvgs.filter((a) => a.average != null).length });
    }
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
    const final = tvet && isFinalTerm(card.term);
    const earlier = final ? (earlierByCard.get(card.id!) ?? []) : [];
    const year = final ? yearOf(card) : null;
    const subjectIds = [
      ...new Set([
        ...g.mappedSubjects,
        ...gradeBySubject.keys(),
        ...classSubjectsOf(cg),
        ...earlier.flatMap((e) => e.grades.map((x) => x.subject_id)),
      ]),
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
      const w = weightOf(sid);
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
        ...(tvet
          ? {
              tvet: {
                weight: w.weight,
                weight_source: w.source,
                terms: [
                  ...earlier.map((e) => tvetCell(e.grades.find((x) => x.subject_id === sid), w.weight)),
                  tvetCell(grade, w.weight),
                ],
                annual: final
                  ? (() => {
                      const a = year!.get(sid);
                      const pct = a && a.max > 0 ? round2((a.at / a.max) * 100) : null;
                      return { at: a ? round2(a.at) : null, max: a ? round2(a.max) : null, pct, competent: pct != null ? pct >= threshold : null };
                    })()
                  : null,
              },
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

    const qualification = tvet
      ? qualificationOf(subjects, s.program_name ?? misSchool?.trade ?? null, card.class_name ?? s.class_name, s.grade_name, s.grade_rqf_level ?? null)
      : undefined;
    if (qualification) {
      // Title: the template's own, else "Level <n>" from the class year, else the school's (MIS).
      if (scheme.tvet.qualification_title) qualification.title = scheme.tvet.qualification_title;
      else if (!qualification.title && misSchool?.qualification_title) qualification.title = misSchool.qualification_title;
      qualification.sector = pick(misSchool?.sector, scheme.tvet.sector) || null;
    }

    let tvetBlock: ReportCardDocument["tvet"];
    if (tvet) {
      const k = cohortKey(card);
      const allSubjects = subjects;
      const termEntries: NonNullable<ReportCardDocument["tvet"]>["terms"] = [
        ...earlier.map((e, i) => {
          const idx = termIndex(e.term) ?? i + 1;
          const rk = earlierRanks.get(k)?.get(idx);
          const p = rk?.ranks.get(card.id!) ?? null;
          return {
            term: e.term,
            current: false,
            totals: tvetTotals(allSubjects.map((x) => x.tvet!.terms[i])),
            position: p,
            position_of: p != null ? (rk?.of ?? null) : null,
            conduct: e.behaviour,
            comment: e.comment,
          };
        }),
        {
          term: card.term,
          current: true,
          totals: tvetTotals(allSubjects.map((x) => x.tvet!.terms[earlier.length])),
          position,
          position_of: position != null ? stats.size : null,
          conduct: card.behaviour_mark ?? null,
          comment: card.class_teacher_comment ?? null,
        },
      ];
      let annual: NonNullable<ReportCardDocument["tvet"]>["annual"] = null;
      if (final) {
        const yt = yearTotals(card);
        const rk = annualRanks.get(k);
        const p = rk?.ranks.get(card.id!) ?? null;
        const conducts = termEntries.map((t) => t.conduct).filter((c): c is number => c != null);
        annual = {
          total: yt.total,
          max: yt.max,
          pct: yt.pct,
          position: p,
          position_of: p != null ? (rk?.of ?? null) : null,
          conduct: conducts.length ? round2(conducts.reduce((a, b) => a + b, 0) / conducts.length) : null,
        };
      }
      tvetBlock = {
        final,
        terms: termEntries,
        annual,
        school: {
          district: pick(misSchool?.district, scheme.tvet.district),
          email: pick(misSchool?.contact_email, scheme.tvet.school_email),
          phone: pick(misSchool?.contact_phone, scheme.tvet.school_phone),
          headmaster: pick(misSchool?.head_teacher_name, scheme.tvet.headmaster_name),
        },
        conditions: deliberationConditions(scheme.competence_thresholds),
        decision: final ? tvetDecision(subjects.map((x) => x.tvet!.annual?.competent ?? null), qualification?.rqf_level ?? null) : null,
        show_attendance: scheme.tvet.show_attendance,
        show_attributes: scheme.tvet.show_attributes,
      };
    }

    out.set(card.id!, {
      schema: DOCUMENT_SCHEMA,
      builder: grading.builder,
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
      school: misSchool?.name && tvet ? { ...school, name: misSchool.name } : school,
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
        category_weights: grading.weights,
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
        total_marks: tvet ? (tvetBlock!.terms[tvetBlock!.terms.length - 1].totals.to ?? 0) : round2(counted.reduce((a, x) => a + (x.total as number), 0)),
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
      behaviour: { mark: card.behaviour_mark ?? null, max: BEHAVIOUR_MAX },
      ...(qualification ? { qualification } : {}),
      ...(tvetBlock ? { tvet: tvetBlock } : {}),
    });
  }
  return out;
}

/** "Year 1" / "SPES-Year1" / "Y2" / "Year Three" -> the year number (1-3); null otherwise. */
export function yearOf(...names: Array<string | null | undefined>): number | null {
  const words: Record<string, number> = { one: 1, two: 2, three: 3 };
  for (const n of names) {
    const m = String(n ?? "").toLowerCase().match(/(?:^|[^0-9a-z])(?:year|yr|y)[\s_-]*(1|2|3|one|two|three)(?![0-9])/);
    if (m) return words[m[1]] ?? Number(m[1]);
  }
  return null;
}

/** A TVET year's RQF level: Year 1 -> 3, Year 2 -> 4, Year 3 -> 5. */
export const levelForYear = (year: number | null) => (year != null && year >= 1 && year <= 3 ? year + 2 : null);

/**
 * The RTB qualification block. RQF level, first match wins: the class
 * grade's level in MIS (Grade.rqf_level); the year in the class or grade
 * name (Year 1 = Level 3, Year 2 = 4, Year 3 = 5); "L3"/"Level 3" in those
 * names; the modules' own level. Title: "Level <n>", as TSS cards print it.
 */
export function qualificationOf(
  subjects: Array<Pick<DocumentSubject, "rqf_level">>,
  program: string | null | undefined,
  className: string | null | undefined,
  gradeName: string | null | undefined,
  gradeLevel?: number | null,
): NonNullable<ReportCardDocument["qualification"]> {
  let level: string | null = gradeLevel != null && gradeLevel >= 1 && gradeLevel <= 8 ? String(gradeLevel) : null;
  if (!level) {
    const y = levelForYear(yearOf(className, gradeName));
    if (y) level = String(y);
  }
  if (!level) {
    const m = `${className ?? ""} ${gradeName ?? ""}`.match(/\b(?:l|level|rqf)\s*\.?\s*([1-8])\b/i);
    level = m ? m[1] : null;
  }
  if (!level) {
    const counts = new Map<string, number>();
    for (const s of subjects) {
      const m = String(s.rqf_level ?? "").match(/[1-8]/);
      if (m) counts.set(m[0], (counts.get(m[0]) ?? 0) + 1);
    }
    level = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }
  const trade = program?.trim() || null;
  return { rqf_level: level, trade, title: level ? `Level ${level}` : null, sector: null };
}

/** The cohort of a card: every card of its class group this term (itself when it has no class). */
export async function loadCohort(card: ReportCard): Promise<ReportCard[]> {
  if (card.class_group_id == null) return [card];
  return ReportCard.findAll({
    where: { class_group_id: card.class_group_id, term: card.term, academic_year: card.academic_year },
  });
}
