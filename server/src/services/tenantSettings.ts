import { AppSetting } from "../models";
import { tk } from "../tenancy/keys";
import { currentTenantOrNull } from "../vendor/nga-tenancy";
import { BUILDER_KINDS, type ReportCardBuilderKind } from "./reportCardBuilders";

/**
 * Per-school settings kept in each tenant database's app_settings (TM-12).
 *
 *  grading.bands    the letter-grade scale of report cards; default = the
 *                   scale NGA has always used (A>=90 B>=75 C>=60 D>=45 F).
 *  branding         report-card header: { name, address_line }. The primary
 *                   tenant keeps NGA's header; another school defaults to its
 *                   name from the tenant registry and no address line.
 */

export interface GradeBand {
  /** Lowest score (percent, inclusive) that earns this letter. */
  min: number;
  letter: string;
  remark: string;
}

export const DEFAULT_GRADING_BANDS: readonly GradeBand[] = Object.freeze([
  { min: 90, letter: "A", remark: "Distinction" },
  { min: 75, letter: "B", remark: "Merit" },
  { min: 60, letter: "C", remark: "Credit" },
  { min: 45, letter: "D", remark: "Pass" },
  { min: 0, letter: "F", remark: "Fail" },
]);

/**
 * The scale NGA's issued report cards use (the "Term 2 Performance" card:
 * A* 90-100 ... U 0-19). The primary tenant defaults to it; any other school
 * defaults to DEFAULT_GRADING_BANDS until it sets its own.
 */
export const NGA_GRADING_BANDS: readonly GradeBand[] = Object.freeze([
  { min: 90, letter: "A*", remark: "Outstanding" },
  { min: 80, letter: "A", remark: "Excellent" },
  { min: 70, letter: "B", remark: "Very good" },
  { min: 60, letter: "C", remark: "Good" },
  { min: 50, letter: "D", remark: "Satisfactory" },
  { min: 40, letter: "E", remark: "Fair" },
  { min: 30, letter: "F", remark: "Weak" },
  { min: 20, letter: "G", remark: "Poor" },
  { min: 0, letter: "U", remark: "Ungraded" },
]);

/** The default scale for the current tenant (NGA's own for the primary one). */
export function defaultGradingBands(): readonly GradeBand[] {
  const tenant = currentTenantOrNull();
  return !tenant || tenant.isPrimary ? NGA_GRADING_BANDS : DEFAULT_GRADING_BANDS;
}

export const GRADING_BANDS_KEY = "grading.bands";
export const BRANDING_KEY = "branding";

const TTL_MS = 60_000;
const bandCache = new Map<string, { at: number; bands: GradeBand[] }>();

/** Valid, sorted (highest first) bands with a 0 floor, or null. */
export function normalizeBands(raw: unknown): GradeBand[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) return null;
  const bands: GradeBand[] = [];
  for (const b of raw as any[]) {
    const min = Number(b?.min);
    const letter = String(b?.letter ?? "").trim();
    const remark = String(b?.remark ?? "").trim();
    if (!Number.isFinite(min) || min < 0 || min > 100 || !letter || letter.length > 4 || remark.length > 40) return null;
    bands.push({ min, letter, remark });
  }
  bands.sort((a, b) => b.min - a.min);
  if (new Set(bands.map((b) => b.min)).size !== bands.length) return null;
  if (bands[bands.length - 1].min !== 0) return null;
  return bands;
}

async function readSetting(key: string): Promise<unknown> {
  let row: any = null;
  try {
    row = await AppSetting.findByPk(key);
  } catch {
    // No database (scripts, unit tests) or the table is missing: the default.
    row = null;
  }
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

/** The current tenant's bands (cached 60 s). */
export async function getGradingBands(): Promise<GradeBand[]> {
  const key = tk("grading-bands");
  const hit = bandCache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.bands;
  const bands = normalizeBands(await readSetting(GRADING_BANDS_KEY)) ?? [...defaultGradingBands()];
  bandCache.set(key, { at: Date.now(), bands });
  return bands;
}

/** Synchronous read of what getGradingBands() last loaded for this tenant (default otherwise). */
export function cachedGradingBands(): readonly GradeBand[] {
  return bandCache.get(tk("grading-bands"))?.bands ?? defaultGradingBands();
}

export async function setGradingBands(raw: unknown, by: number | null): Promise<GradeBand[]> {
  const bands = normalizeBands(raw);
  if (!bands) throw new Error("Grade bands need a letter, a remark and a distinct minimum (0-100) each, including one at 0.");
  await AppSetting.upsert({ key: GRADING_BANDS_KEY, value: JSON.stringify(bands), updated_by: by, updated_at: new Date() } as any);
  bandCache.delete(tk("grading-bands"));
  return bands;
}

export function letterFor(score: number, bands: readonly GradeBand[] = cachedGradingBands()): { letter: string; remark: string } {
  for (const b of bands) if (score >= b.min) return { letter: b.letter, remark: b.remark };
  const last = bands[bands.length - 1] ?? DEFAULT_GRADING_BANDS[DEFAULT_GRADING_BANDS.length - 1];
  return { letter: last.letter, remark: last.remark };
}

export interface Branding {
  name: string;
  address_line: string;
  /** Contacts printed under the name (phone, email, website). */
  contact_line?: string;
  /** A built-in logo (assets/branding/<logo>-logo-horizontal.png); null = none. */
  logo?: "nga" | null;
}

/** NGA as its issued documents name it, with the official logo. */
export const NGA_BRANDING: Branding = {
  name: "New Generation Coding Academy",
  address_line: "Kigali, Rwanda",
  contact_line: "Tel: +250 789 552 671  ·  info@nga.ac.rw  ·  www.nga.ac.rw",
  logo: "nga",
};

/** Report-card header for the current tenant. */
export async function getBranding(): Promise<Branding> {
  const tenant = currentTenantOrNull();
  const stored = (await readSetting(BRANDING_KEY)) as Partial<Branding> | null;
  const primary = !tenant || tenant.isPrimary;
  const base: Branding = primary ? NGA_BRANDING : { name: tenant!.name, address_line: "", contact_line: "", logo: null };
  const text = (v: unknown, dflt: string | undefined) => (typeof v === "string" ? v.trim() : dflt ?? "");
  return {
    name: typeof stored?.name === "string" && stored.name.trim() ? stored.name.trim() : base.name,
    address_line: text(stored?.address_line, base.address_line),
    contact_line: text(stored?.contact_line, base.contact_line),
    logo: primary ? "nga" : null,
  };
}

// ─── Report card scheme ──────────────────────────────────────────────────────
// Everything about the card a school decides, besides the letter scale:
// category weights, the pass mark, the behaviour attributes, how subjects are
// grouped (core/specific modules), what the card shows, and the signatures.

/** The Normal builder's weighted categories (the TVET builder's FA/CA/IA count equally). */
export type SchemeCategory = "CW" | "HW" | "MD" | "EOT";
/** RTB module categories (TVET curricula group modules this way). */
export type ModuleCategory = "specific" | "general" | "complementary";
export const MODULE_CATEGORIES: ModuleCategory[] = ["specific", "general", "complementary"];

/**
 * TVET template options: the CAMIS header fields MIS doesn't hold, and the
 * module weights (learning hours) when MIS has none or the school differs.
 */
export interface TvetTemplateOptions {
  district: string;
  sector: string;
  school_email: string;
  school_phone: string;
  headmaster_name: string;
  /** Blank = "TVET Certificate <level> in <trade>" from MIS. */
  qualification_title: string;
  /** Weight of a module MIS gives no learning hours for. */
  default_module_weight: number;
  /** Subject id -> weight, overriding MIS. */
  module_weights: Record<string, number>;
  show_attendance: boolean;
  show_attributes: boolean;
}

export const DEFAULT_TVET_OPTIONS: Readonly<TvetTemplateOptions> = Object.freeze({
  district: "",
  sector: "",
  school_email: "",
  school_phone: "",
  headmaster_name: "",
  qualification_title: "",
  default_module_weight: 100,
  module_weights: {},
  show_attendance: false,
  show_attributes: false,
});

export interface ReportCardScheme {
  /** Which builder structure (and card template) the school uses. */
  builder: ReportCardBuilderKind;
  /** Normal builder category weights: CW+HW+MD+EOT sum to 100. */
  category_weights: Record<SchemeCategory, number>;
  /** A subject total at or above this passes. */
  pass_mark: number;
  /** The behaviour attributes the class teacher rates, in card order. */
  attributes: string[];
  /** Subject groups in card order, e.g. "Core modules" / "Specific modules". */
  subject_groups: Array<{ name: string; subject_ids: number[] }>;
  show_position: boolean;
  /** Each module's rank in the class. */
  show_subject_rank: boolean;
  show_class_average: boolean;
  show_subject_teacher: boolean;
  /** Competent / Not Yet Competent per module (RTB competence-based assessment). */
  show_competence: boolean;
  /**
   * The mark (out of 100) a module needs to be "Competent", by RTB module
   * category. RTB: competent at not less than 70% of the module score; TVET
   * curricula set 50% for general and complementary modules.
   */
  competence_thresholds: Record<ModuleCategory, number>;
  /** Title printed under the head of school's signature line. */
  head_title: string;
  /** The approver must be a different person from the reviewer. */
  require_distinct_approver: boolean;
  /** TVET template options (kept while the school uses Normal, so switching back loses nothing). */
  tvet: TvetTemplateOptions;
}

export const REPORT_CARD_SCHEME_KEY = "report_card.scheme";

export const NGA_ATTRIBUTES: readonly string[] = Object.freeze([
  "Punctuality",
  "Obedience",
  "Responsibility towards work",
  "Responsibility to school/personal property",
  "Interest in devotion/meditation",
  "Co-operation and teamwork",
  "Ability to work independently",
  "Commitment to society",
]);

export const DEFAULT_REPORT_CARD_SCHEME: Readonly<ReportCardScheme> = Object.freeze({
  builder: "normal" as ReportCardBuilderKind,
  category_weights: { CW: 15, HW: 10, MD: 25, EOT: 50 },
  pass_mark: 50,
  attributes: [...NGA_ATTRIBUTES],
  subject_groups: [],
  show_position: true,
  show_subject_rank: true,
  show_class_average: true,
  show_subject_teacher: true,
  show_competence: true,
  competence_thresholds: { specific: 70, general: 50, complementary: 50 },
  head_title: "Principal",
  require_distinct_approver: false,
  tvet: DEFAULT_TVET_OPTIONS,
});

/** Valid TVET options (missing fields take the default), or an error message. */
export function normalizeTvetOptions(raw: unknown): TvetTemplateOptions | string {
  const d = DEFAULT_TVET_OPTIONS;
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<TvetTemplateOptions>;
  const text = (v: unknown, max: number, label: string): string | { error: string } => {
    const t = typeof v === "string" ? v.trim() : "";
    return t.length > max ? { error: `${label} is at most ${max} characters.` } : t;
  };
  const fields: Array<[keyof TvetTemplateOptions, number, string]> = [
    ["district", 60, "The district"],
    ["sector", 80, "The sector"],
    ["school_email", 120, "The school email"],
    ["school_phone", 40, "The school phone"],
    ["headmaster_name", 80, "The headmaster's name"],
    ["qualification_title", 120, "The qualification title"],
  ];
  const out: Partial<TvetTemplateOptions> = {};
  for (const [k, max, label] of fields) {
    const v = text(r[k], max, label);
    if (typeof v !== "string") return v.error;
    (out as any)[k] = v;
  }
  const dw = r.default_module_weight == null ? d.default_module_weight : Number(r.default_module_weight);
  if (!Number.isFinite(dw) || dw <= 0 || dw > 1000) return "The default module weight must be between 1 and 1000.";
  const weights: Record<string, number> = {};
  const rawWeights = r.module_weights && typeof r.module_weights === "object" ? r.module_weights : {};
  const entries = Object.entries(rawWeights);
  if (entries.length > 300) return "Set at most 300 module weights.";
  for (const [id, v] of entries) {
    if (!/^\d+$/.test(id)) continue;
    if (v == null || (v as unknown) === "") continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || n > 1000) return "Module weights must be between 1 and 1000.";
    weights[id] = Math.round(n * 100) / 100;
  }
  const bool = (v: unknown, dflt: boolean) => (typeof v === "boolean" ? v : dflt);
  return {
    ...(out as TvetTemplateOptions),
    default_module_weight: dw,
    module_weights: weights,
    show_attendance: bool(r.show_attendance, d.show_attendance),
    show_attributes: bool(r.show_attributes, d.show_attributes),
  };
}

const schemeCache = new Map<string, { at: number; scheme: ReportCardScheme }>();

/** A valid scheme from stored/posted JSON (missing fields take the default), or an error message. */
export function normalizeScheme(raw: unknown): ReportCardScheme | string {
  const d = DEFAULT_REPORT_CARD_SCHEME;
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<ReportCardScheme>;
  const weights = { ...d.category_weights, ...(r.category_weights ?? {}) };
  for (const k of ["CW", "HW", "MD", "EOT"] as SchemeCategory[]) {
    const w = Number(weights[k]);
    if (!Number.isFinite(w) || w < 0 || w > 100) return `Weight for ${k} must be between 0 and 100.`;
    weights[k] = w;
  }
  // Only the Normal categories are stored (an old IA weight is dropped).
  const category_weights = { CW: weights.CW, HW: weights.HW, MD: weights.MD, EOT: weights.EOT };
  const builder = r.builder == null ? d.builder : r.builder;
  if (!BUILDER_KINDS.includes(builder as ReportCardBuilderKind)) return `Unknown report card builder "${String(builder)}".`;
  const tvet = normalizeTvetOptions(r.tvet);
  if (typeof tvet === "string") return tvet;
  const sum = weights.CW + weights.HW + weights.MD + weights.EOT;
  if (Math.abs(sum - 100) > 0.001) return `Category weights must add up to 100 (they add up to ${sum}).`;
  const pass = r.pass_mark == null ? d.pass_mark : Number(r.pass_mark);
  if (!Number.isFinite(pass) || pass < 0 || pass > 100) return "Pass mark must be between 0 and 100.";
  const attributes = Array.isArray(r.attributes)
    ? r.attributes.map((a) => String(a ?? "").trim()).filter(Boolean)
    : [...d.attributes];
  if (attributes.length === 0 || attributes.length > 16) return "Give between 1 and 16 attributes.";
  if (attributes.some((a) => a.length > 100)) return "Attribute names are at most 100 characters.";
  if (new Set(attributes.map((a) => a.toLowerCase())).size !== attributes.length) return "Attribute names must be distinct.";
  const groups = Array.isArray(r.subject_groups) ? r.subject_groups : [];
  const subject_groups: ReportCardScheme["subject_groups"] = [];
  const seen = new Set<number>();
  for (const g of groups.slice(0, 10)) {
    const name = String((g as any)?.name ?? "").trim();
    if (!name || name.length > 60) return "Each subject group needs a name of at most 60 characters.";
    const ids = (Array.isArray((g as any)?.subject_ids) ? (g as any).subject_ids : [])
      .map(Number)
      .filter((n: number) => Number.isInteger(n) && n > 0 && !seen.has(n));
    ids.forEach((n: number) => seen.add(n));
    subject_groups.push({ name, subject_ids: ids });
  }
  const bool = (v: unknown, dflt: boolean) => (typeof v === "boolean" ? v : dflt);
  const thresholds = { ...d.competence_thresholds, ...((r.competence_thresholds as any) ?? {}) };
  for (const k of MODULE_CATEGORIES) {
    const t = Number(thresholds[k]);
    if (!Number.isFinite(t) || t < 0 || t > 100) return `Competence threshold for ${k} modules must be between 0 and 100.`;
    thresholds[k] = t;
  }
  const head = String(r.head_title ?? d.head_title).trim().slice(0, 60) || d.head_title;
  return {
    builder: builder as ReportCardBuilderKind,
    category_weights,
    pass_mark: pass,
    attributes,
    subject_groups,
    show_position: bool(r.show_position, d.show_position),
    show_subject_rank: bool(r.show_subject_rank, d.show_subject_rank),
    show_class_average: bool(r.show_class_average, d.show_class_average),
    show_subject_teacher: bool(r.show_subject_teacher, d.show_subject_teacher),
    show_competence: bool(r.show_competence, d.show_competence),
    competence_thresholds: thresholds,
    head_title: head,
    require_distinct_approver: bool(r.require_distinct_approver, d.require_distinct_approver),
    tvet,
  };
}

/** The current tenant's report card scheme (cached 60 s). */
export async function getReportCardScheme(): Promise<ReportCardScheme> {
  const key = tk("report-card-scheme");
  const hit = schemeCache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.scheme;
  const stored = await readSetting(REPORT_CARD_SCHEME_KEY);
  const parsed = normalizeScheme(stored ?? {});
  const scheme = typeof parsed === "string" ? normalizeScheme({}) as ReportCardScheme : parsed;
  schemeCache.set(key, { at: Date.now(), scheme });
  return scheme;
}

/**
 * Saves the scheme. A partial body updates only the fields it carries (the
 * settings page doesn't send the builder; the templates page sends only the
 * builder and its options), so neither page undoes the other's choices.
 */
export async function setReportCardScheme(raw: unknown, by: number | null): Promise<ReportCardScheme> {
  const stored = await readSetting(REPORT_CARD_SCHEME_KEY);
  const current = normalizeScheme(stored ?? {});
  const base = typeof current === "string" ? {} : current;
  const body = (raw && typeof raw === "object" ? raw : {}) as Partial<ReportCardScheme>;
  const merged = {
    ...base,
    ...body,
    ...(body.tvet ? { tvet: { ...(base as Partial<ReportCardScheme>).tvet, ...body.tvet } } : {}),
  };
  const parsed = normalizeScheme(merged);
  if (typeof parsed === "string") throw new Error(parsed);
  await AppSetting.upsert({
    key: REPORT_CARD_SCHEME_KEY,
    value: JSON.stringify(parsed),
    updated_by: by,
    updated_at: new Date(),
  } as any);
  schemeCache.delete(tk("report-card-scheme"));
  return parsed;
}

/** Tests only. */
export function clearTenantSettingsCache() {
  bandCache.clear();
  schemeCache.clear();
}
