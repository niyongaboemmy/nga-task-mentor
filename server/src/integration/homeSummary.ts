import { Request } from "express";
import jwt from "jsonwebtoken";
import { QueryTypes } from "sequelize";
import { sequelize } from "../config/database";
import { accessMode } from "../access/mode";
import { decideAny, requestSnapshot, scopedFilter } from "../access/policy";
import { allowedStudentIds, misIdsForLocalUsers, reportCardStudentMisIds } from "../access/targets";
import { AccessSnapshot, scopeFor, scopeUnion, ScopeEntry } from "../vendor/nga-access";
import { getScopedSubjects, ScopedSubject, SubjectScope } from "../utils/scopedSubjects";
import { getCurrentTermId, getMisToken, resolveCurrentAcademicPeriodNames } from "../utils/misUtils";

/**
 * Task Mentor's answer to the MIS Home page (HOME_OVERVIEW_IMPLEMENTATION_PLAN
 * §6/§9.1): everything that needs the signed-in user here, as counted items,
 * glance tiles and recent updates. Served by POST /api/integration/home-summary.
 *
 * Read-only: plain SELECTs plus the existing scoping helpers (MIS calls,
 * in-memory caches). Access is decided only by those helpers --
 * getScopedSubjects for subjects, scopedFilter/allowedStudentIds for students
 * -- so off/shadow/enforce behave exactly like the rest of the app. The MIS's
 * `lenses` only choose each item's label.
 *
 * Signals: S-01, S-02, S-03 (learner) · T-07, T-14, T-15 (teaching) ·
 * C-06 (class-teacher comment) · P-05 (approve/publish). Not here (yet):
 * T-06 marks-not-entered and D-02 moderation (no closed-assessment/moderation
 * state in the data model).
 */

// ─── Contract ────────────────────────────────────────────────────────────────

export type Tier = "blocking" | "slipping" | "tidy";

export interface AttentionItem {
  id: string;
  source: "taskmentor";
  kind: string;
  tier: Tier;
  lens: string;
  via: number[];
  depth: "summary" | "detail" | "write";
  count: number;
  title: string;
  entities: string[];
  why: string;
  cta: { label: string; href: string; external: true };
  due_at?: string | null;
  waiting_since?: string | null;
}

export interface GlanceTile {
  id: string;
  source: string;
  lens: string;
  label: string;
  value: string | null;
  suppressed?: boolean;
  hint?: string;
  status?: "good" | "warning" | "critical";
  href?: string;
}

export interface UpdateItem {
  id: string;
  source: string;
  kind: string;
  title: string;
  body?: string | null;
  severity: "info" | "success" | "warning" | "critical";
  created_at: string;
  read: boolean;
  href?: string | null;
}

export interface HomeSummary {
  version: 1;
  source: "taskmentor";
  generated_at: string;
  provisioned: boolean;
  items: AttentionItem[];
  tiles: GlanceTile[];
  updates: UpdateItem[];
  app_url: string;
}

export interface Lens {
  key: string;
  type: string;
  class_group_ids: number[] | null;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MAX_ENTITIES = 8;
const MAX_UPDATES = 10;
/** Entity chips are short labels: longer record titles are cut. */
const MAX_CHIP = 60;
/**
 * The school's UTC offset (Africa/Kigali: UTC+2, no DST). Only used to read
 * date-only MIS dates ("2026-12-11") as the end of that school day.
 */
const SCHOOL_UTC_OFFSET = "+02:00";
/** Body caps: the MIS sends a handful of lenses; anything bigger is ignored. */
const MAX_LENSES = 50;
const MAX_LENS_CLASS_GROUPS = 1000;

/** This app's SPA base URL (FRONTEND_URL; dev: Vite serves under /taskmentor/). */
export function appUrl(): string {
  const raw = (process.env.FRONTEND_URL || "").split(",")[0].trim();
  return (raw || "http://localhost:5174/taskmentor").replace(/\/+$/, "");
}

export function emptySummary(provisioned: boolean): HomeSummary {
  return {
    version: 1,
    source: "taskmentor",
    generated_at: new Date().toISOString(),
    provisioned,
    items: [],
    tiles: [],
    updates: [],
    app_url: appUrl(),
  };
}

/** Lens keys are echoed into item ids/labels: plain "TYPE[:id]"-style strings only. */
const LENS_KEY = /^[A-Za-z0-9_:.-]{1,100}$/;
const LENS_TYPE = /^[A-Z_]{1,40}$/;

/** A positive integer id from a number or a digits-only string; anything else is null. */
function toId(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\s*\d+\s*$/.test(v) ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Lenient: malformed lens hints are dropped (they never grant anything). */
export function parseLenses(raw: unknown): Lens[] {
  if (!Array.isArray(raw)) return [];
  const out: Lens[] = [];
  for (const l of raw.slice(0, MAX_LENSES)) {
    if (!l || typeof l !== "object") continue;
    const key = (l as any).key;
    const type = typeof (l as any).type === "string" ? (l as any).type.toUpperCase() : "";
    if (typeof key !== "string" || !LENS_KEY.test(key) || !LENS_TYPE.test(type)) continue;
    const ids = (l as any).class_group_ids;
    const class_group_ids =
      ids === null || ids === undefined
        ? type === "SCHOOL"
          ? null
          : []
        : Array.isArray(ids)
          ? [
              ...new Set(
                ids
                  .slice(0, MAX_LENS_CLASS_GROUPS)
                  .map(toId)
                  .filter((n): n is number => n !== null),
              ),
            ]
          : [];
    out.push({ key, type, class_group_ids });
  }
  return out;
}

// ─── Lens tagging ────────────────────────────────────────────────────────────

const LEVEL_RANK: Record<string, number> = { CLASS_GROUP: 1, GRADE: 2, PROGRAM: 3, DEPARTMENT: 3, SCHOOL: 4 };

/** Most specific hinted lens containing every one of these class groups. */
export function lensForClassGroups(lenses: Lens[], classGroups: number[]): string | null {
  if (classGroups.length === 0) return null;
  let best: Lens | null = null;
  for (const l of lenses) {
    const rank = LEVEL_RANK[l.type];
    if (!rank) continue;
    const covers = l.class_group_ids === null || classGroups.every((c) => l.class_group_ids!.includes(c));
    if (covers && (!best || rank < LEVEL_RANK[best.type])) best = l;
  }
  return best?.key ?? null;
}

const schoolLens = (lenses: Lens[]) => lenses.find((l) => l.type === "SCHOOL")?.key ?? null;
const hinted = (lenses: Lens[], key: string) => (lenses.some((l) => l.key === key) ? key : null);

/**
 * The label for an item whose records come from a capability scope.
 * "global" = a legacy (school-wide) local permission.
 */
export function lensForScope(lenses: Lens[], scope: ScopeEntry | null | "global"): string {
  if (scope === "global" || scope?.all) return schoolLens(lenses) ?? "SELF";
  if (!scope) return "SELF";
  const one = (ids: number[] | undefined, type: string) =>
    ids && ids.length === 1 ? hinted(lenses, `${type}:${ids[0]}`) : null;
  if (scope.programs?.length) return one(scope.programs, "PROGRAM") ?? schoolLens(lenses) ?? "SELF";
  if (scope.departments?.length) return one(scope.departments, "DEPARTMENT") ?? schoolLens(lenses) ?? "SELF";
  if (scope.grades?.length) return one(scope.grades, "GRADE") ?? schoolLens(lenses) ?? "SELF";
  const classGroups = [...new Set([...(scope.class_groups ?? []), ...(scope.pairs ?? []).map(([, c]) => c)])];
  return lensForClassGroups(lenses, classGroups) ?? "SELF";
}

/** The viewer's own teaching work: the hinted TEACHING lens (by type, or the bare key), else SELF. */
export const teachingLens = (lenses: Lens[]) =>
  lenses.find((l) => l.type === "TEACHING")?.key ?? (lenses.some((l) => l.key === "TEACHING") ? "TEACHING" : "SELF");

// ─── Request context ─────────────────────────────────────────────────────────

interface Period {
  term: string | null;
  academicYear: string | null;
  termEnd: Date | null;
}

class Ctx {
  readonly perms: Set<string>;
  readonly userId: number;
  readonly misUserId: number | null;
  private subjectsP?: Promise<{ scope: SubjectScope; subjects: ScopedSubject[] }>;
  private termP?: Promise<number | null>;
  private periodP?: Promise<Period>;
  private snapP?: Promise<AccessSnapshot | null>;

  constructor(
    readonly req: Request,
    readonly lenses: Lens[],
    readonly now: Date,
    readonly base: string,
  ) {
    this.perms = req.user?.permissions ?? new Set();
    this.userId = Number(req.user.id);
    this.misUserId = req.user?.mis_user_id ?? null;
  }

  has = (...keys: string[]) => keys.some((k) => this.perms.has(k));
  href = (path: string) => `${this.base}${path}`;
  subjects = () => (this.subjectsP ??= getScopedSubjects(this.req));
  termId = () => (this.termP ??= getCurrentTermId(this.req));
  period = () => (this.periodP ??= currentPeriod(this.req, this.now));
  /** Only consulted under enforce (off must never ask MIS; shadow answers legacy). */
  snapshot = () => (this.snapP ??= accessMode() === "enforce" ? requestSnapshot(this.req) : Promise.resolve(null));

  /** Grant ids behind these capabilities (enforce only). */
  async via(caps: string[]): Promise<number[]> {
    const snap = await this.snapshot();
    return snap ? decideAny(snap, caps, null).via : [];
  }

  /** Where the records of a capability-scoped item come from, for its lens. */
  async scopeOf(caps: string[]): Promise<ScopeEntry | null | "global"> {
    if (accessMode() !== "enforce") return "global";
    const snap = await this.snapshot();
    return scopeUnion(caps.map((c) => scopeFor(snap, c)).filter((e): e is ScopeEntry => e !== null));
  }

  /** Depth of a READ capability: legacy permissions are all-or-nothing (detail). */
  async readDepth(cap: string): Promise<"summary" | "detail" | null> {
    if (!this.perms.has(cap)) return null;
    if (accessMode() !== "enforce") return "detail";
    const snap = await this.snapshot();
    if (scopeFor(snap, cap, "detail")) return "detail";
    return scopeFor(snap, cap, "summary") ? "summary" : null;
  }

  /** `AND (x.academic_term_id = ? OR IS NULL)` for the current term, like the list routes. */
  async termClause(alias: string): Promise<{ sql: string; params: any[] }> {
    const termId = await this.termId();
    return termId
      ? { sql: ` AND (${alias}.academic_term_id = ? OR ${alias}.academic_term_id IS NULL)`, params: [termId] }
      : { sql: "", params: [] };
  }
}

/**
 * The current term/year names (report cards are keyed by them) and the term's
 * end date, read from the MIS token's currentAcademicTerms/currentAcademicYear
 * (what the SPA's report-card builder uses); falls back to /users/me.
 */
async function currentPeriod(req: Request, now: Date): Promise<Period> {
  const token = getMisToken(req, { quiet: true });
  let decoded: any = null;
  try {
    decoded = token ? jwt.decode(token) : null;
  } catch {
    decoded = null;
  }
  const terms: any[] = Array.isArray(decoded?.currentAcademicTerms) ? decoded.currentAcademicTerms : [];
  const flagged = terms.find((t) => Number(t.is_current) === 1 || Number(t.status) === 1 || t.status === "ACTIVE");
  const containing = terms.find((t) => {
    const end = schoolDayEnd(t.end_date);
    return t.start_date && end && new Date(t.start_date) <= now && now <= end;
  });
  const term = flagged ?? containing ?? terms[0] ?? null;
  const yearName = decoded?.currentAcademicYear?.name ?? null;
  if (term?.name && yearName) {
    return { term: term.name, academicYear: yearName, termEnd: schoolDayEnd(term.end_date) };
  }
  const names = await resolveCurrentAcademicPeriodNames(req);
  return { term: names.term, academicYear: names.academicYear, termEnd: null };
}

/**
 * An MIS date as an instant. A date-only value ("2026-12-11", how MIS keeps
 * term dates) means the whole school day, so it ends at 23:59:59.999 school
 * time -- not UTC midnight at its start, which would be ~a day early.
 */
function schoolDayEnd(raw: unknown): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T23:59:59.999${SCHOOL_UTC_OFFSET}`) : new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Cut a chip to MAX_CHIP characters, keeping a short " · suffix" (subject / count) intact. */
function shortChip(chip: string): string {
  if (chip.length <= MAX_CHIP) return chip;
  const at = chip.lastIndexOf(" · ");
  const tail = at > 0 && chip.length - at <= 30 ? chip.slice(at) : "";
  return `${chip.slice(0, MAX_CHIP - tail.length - 1).trimEnd()}…${tail}`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const iso = (d: any): string | null => {
  if (!d) return null;
  const t = new Date(d);
  return isNaN(t.getTime()) ? null : t.toISOString();
};
const select = <T extends object = any>(sql: string, replacements: any[]): Promise<T[]> =>
  sequelize.query<T>(sql, { replacements, type: QueryTypes.SELECT });
const inList = (ids: number[]) => ids.map(() => "?").join(",");

/** "Title · n" chips, biggest first. */
function countChips(rows: Array<{ label: string }>): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.label, (counts.get(r.label) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_ENTITIES)
    .map(([label, n]) => `${label} · ${n}`);
}

/**
 * Keep the rows whose (local) student the caller may act on with `caps`
 * within the row's subject -- scopedFilter semantics (off/shadow: all rows;
 * enforce: v2 scope via class rosters). Students with no MIS id cannot be
 * placed in any scope and are dropped under enforce.
 */
async function filterRowsByStudentScope<R extends { student_id: number; course_id: number | null }>(
  ctx: Ctx,
  rows: R[],
  caps: string[],
  label: string,
  minDepth: "summary" | "detail" | null = null,
): Promise<R[]> {
  if (rows.length === 0) return rows;
  const bySubject = new Map<number | null, R[]>();
  for (const r of rows) {
    const k = r.course_id == null ? null : Number(r.course_id);
    bySubject.set(k, [...(bySubject.get(k) ?? []), r]);
  }
  const kept: R[] = [];
  for (const [subjectId, list] of bySubject) {
    const localIds = [...new Set(list.map((r) => Number(r.student_id)))];
    const visible = new Set(
      await scopedFilter(ctx.req, localIds, label, async (snap) => {
        const misOf = await misIdsForLocalUsers(localIds);
        const allowed = new Set(
          await allowedStudentIds(ctx.req, snap, caps, [...new Set(misOf.values())], { minDepth, subjectId }),
        );
        return localIds.filter((id) => misOf.has(id) && allowed.has(misOf.get(id)!));
      }),
    );
    for (const r of list) if (visible.has(Number(r.student_id))) kept.push(r);
  }
  return kept;
}

/** Report-card student ids (local or MIS) the caller may act on with every one of `caps`. */
async function filterCardStudents(ctx: Ctx, ids: number[], caps: string[], label: string): Promise<Set<number>> {
  return new Set(
    await scopedFilter(ctx.req, ids, label, async (snap) => {
      const misOf = await reportCardStudentMisIds(ids);
      const misIds = [...new Set(misOf.values())];
      let allowed = new Set<number>(misIds);
      for (const cap of caps) {
        const these = new Set(await allowedStudentIds(ctx.req, snap, [cap], misIds));
        allowed = new Set([...allowed].filter((id) => these.has(id)));
      }
      return ids.filter((id) => allowed.has(misOf.get(id) ?? id));
    }),
  );
}

// ─── Learner signals (S-01, S-02, S-03) + "Assignments done" tile ───────────

interface LearnerAssignment {
  id: number;
  title: string;
  due_date: Date | null;
  course_id: number | null;
  submitted: number;
}

/** Same set getEnrolledAssignments serves: published, enrolled subjects, current term. */
async function learnerAssignments(ctx: Ctx): Promise<{ rows: LearnerAssignment[]; names: Map<number, string> } | null> {
  if (!ctx.has("SUBMISSIONS_CREATE")) return null;
  const { scope, subjects } = await ctx.subjects();
  if (scope !== "enrolled") return null;
  const names = new Map(subjects.map((s) => [s.id, s.name]));
  if (subjects.length === 0) return { rows: [], names };
  const ids = subjects.map((s) => s.id);
  const term = await ctx.termClause("a");
  const rows = await select<LearnerAssignment>(
    `SELECT a.id, a.title, a.due_date, a.course_id,
            (SELECT COUNT(*) FROM submissions s
              WHERE s.assignment_id = a.id AND s.student_id = ? AND s.status <> 'draft') AS submitted
       FROM assignments a
      WHERE a.status = 'published' AND a.course_id IN (${inList(ids)})${term.sql}
      ORDER BY a.due_date ASC`,
    [ctx.userId, ...ids, ...term.params],
  );
  return { rows: rows.map((r) => ({ ...r, submitted: Number(r.submitted) })), names };
}

function learnerItems(ctx: Ctx, data: NonNullable<Awaited<ReturnType<typeof learnerAssignments>>>): AttentionItem[] {
  const now = ctx.now.getTime();
  const open = data.rows.filter((a) => a.submitted === 0 && a.due_date);
  const chip = (a: LearnerAssignment) =>
    a.course_id != null && data.names.has(a.course_id) ? `${a.title} · ${data.names.get(a.course_id)}` : a.title;
  const ctaFor = (list: LearnerAssignment[], label: string) => ({
    label,
    href: ctx.href(list.length === 1 ? `/assignments/${list[0].id}` : "/assignments"),
    external: true as const,
  });
  const items: AttentionItem[] = [];

  const overdue = open.filter((a) => new Date(a.due_date!).getTime() < now);
  if (overdue.length > 0) {
    items.push({
      id: "taskmentor:S-01:SELF",
      source: "taskmentor",
      kind: "S-01",
      tier: "blocking",
      lens: "SELF",
      via: [],
      depth: "detail",
      count: overdue.length,
      title: `${plural(overdue.length, "assignment")} overdue and not submitted`,
      entities: overdue.slice(0, MAX_ENTITIES).map(chip),
      why: "Overdue work counts against your results until you submit it.",
      cta: ctaFor(overdue, "Submit"),
      due_at: iso(overdue[0].due_date),
    });
  }

  const dueSoon = open.filter((a) => {
    const t = new Date(a.due_date!).getTime();
    return t >= now && t <= now + 48 * HOUR;
  });
  if (dueSoon.length > 0) {
    items.push({
      id: "taskmentor:S-02:SELF",
      source: "taskmentor",
      kind: "S-02",
      tier: "slipping",
      lens: "SELF",
      via: [],
      depth: "detail",
      count: dueSoon.length,
      title: `${plural(dueSoon.length, "assignment")} due in the next 48 hours`,
      entities: dueSoon.slice(0, MAX_ENTITIES).map(chip),
      why: "These close within two days and become overdue if they are not submitted.",
      cta: ctaFor(dueSoon, "Open"),
      due_at: iso(dueSoon[0].due_date),
    });
  }
  return items;
}

function learnerTile(ctx: Ctx, data: NonNullable<Awaited<ReturnType<typeof learnerAssignments>>>): GlanceTile | null {
  const total = data.rows.length;
  if (total === 0) return null;
  const done = data.rows.filter((a) => a.submitted > 0).length;
  const overdue = data.rows.some(
    (a) => a.submitted === 0 && a.due_date && new Date(a.due_date).getTime() < ctx.now.getTime(),
  );
  return {
    id: "taskmentor:tile:assignments-done:SELF",
    source: "taskmentor",
    lens: "SELF",
    label: "Assignments done",
    value: `${done}/${total}`,
    hint: "Published assignments this term that you have submitted",
    status: overdue ? "warning" : "good",
    href: ctx.href("/assignments"),
  };
}

/** S-03: an enrolled-subject quiz that is open, closes within 24 h and isn't finished. */
async function quizClosingItem(ctx: Ctx): Promise<AttentionItem | null> {
  if (!ctx.has("QUIZZES_ATTEMPT")) return null;
  const { scope, subjects } = await ctx.subjects();
  if (scope !== "enrolled" || subjects.length === 0) return null;
  const ids = subjects.map((s) => s.id);
  const term = await ctx.termClause("q");
  const now = ctx.now;
  const rows = await select<{ id: number; title: string; end_date: Date; course_id: number }>(
    `SELECT q.id, q.title, q.end_date, q.course_id
       FROM quizzes q
      WHERE q.status = 'published' AND q.course_id IN (${inList(ids)})${term.sql}
        AND (q.start_date IS NULL OR q.start_date <= ?)
        AND q.end_date > ? AND q.end_date <= ?
        AND NOT EXISTS (SELECT 1 FROM quiz_submissions qs
                         WHERE qs.quiz_id = q.id AND qs.student_id = ? AND qs.status = 'completed')
      ORDER BY q.end_date ASC`,
    [...ids, ...term.params, now, now, new Date(now.getTime() + DAY), ctx.userId],
  );
  if (rows.length === 0) return null;
  const names = new Map(subjects.map((s) => [s.id, s.name]));
  const soonest = new Date(rows[0].end_date).getTime();
  return {
    id: "taskmentor:S-03:SELF",
    source: "taskmentor",
    kind: "S-03",
    tier: soonest - now.getTime() <= 6 * HOUR ? "blocking" : "slipping",
    lens: "SELF",
    via: [],
    depth: "detail",
    count: rows.length,
    title: `${plural(rows.length, "quiz", "quizzes")} closing within 24 hours`,
    entities: rows.slice(0, MAX_ENTITIES).map((q) => (names.has(q.course_id) ? `${q.title} · ${names.get(q.course_id)}` : q.title)),
    why: "A quiz can't be taken after it closes.",
    cta: {
      label: "Start",
      href: ctx.href(rows.length === 1 ? `/quizzes/${rows[0].id}/take` : "/my-quizzes"),
      external: true,
    },
    due_at: iso(rows[0].end_date),
  };
}

// ─── Teaching signals (T-07, T-14, T-15) + "To grade" tile ──────────────────

/** Subjects a grader/supervisor may see; null = school-wide ("all"). */
async function teachingSubjects(ctx: Ctx): Promise<number[] | null | "none"> {
  const { scope, subjects } = await ctx.subjects();
  if (scope === "all") return null;
  if (scope === "assigned") return subjects.map((s) => s.id);
  return "none";
}

interface PendingRow {
  kind: "assignment" | "quiz";
  assessment_id: number;
  title: string;
  course_id: number | null;
  student_id: number;
  due: Date | null;
  waiting_since: Date | null;
}

/**
 * T-07: ungraded submissions on the viewer's OWN assessments (created_by),
 * within their subject scope, restricted to the students their grading
 * scope covers. Not /quizzes/submissions/pending (school-wide).
 */
async function toGradeItem(ctx: Ctx): Promise<AttentionItem | null> {
  const gradesAssignments = ctx.has("SUBMISSIONS_GRADE");
  const gradesQuizzes = ctx.has("QUIZZES_GRADE");
  if (!gradesAssignments && !gradesQuizzes) return null;
  const subjectIds = await teachingSubjects(ctx);
  if (subjectIds === "none" || (Array.isArray(subjectIds) && subjectIds.length === 0)) return null;

  const subjectSql = (alias: string) => (subjectIds ? ` AND ${alias}.course_id IN (${inList(subjectIds)})` : "");
  const subjectParams = subjectIds ?? [];
  let rows: PendingRow[] = [];

  if (gradesAssignments) {
    const term = await ctx.termClause("a");
    const found = await select<any>(
      `SELECT a.id AS assessment_id, a.title, a.course_id, a.due_date AS due,
              s.student_id, COALESCE(s.submitted_at, s.created_at) AS waiting_since
         FROM submissions s
         JOIN assignments a ON a.id = s.assignment_id
        WHERE a.created_by = ? AND a.status <> 'removed'
          AND s.status IN ('submitted', 'late', 'resubmitted')
          AND (s.grade IS NULL OR s.grade = '')${subjectSql("a")}${term.sql}`,
      [ctx.userId, ...subjectParams, ...term.params],
    );
    rows = rows.concat(found.map((r) => ({ ...r, kind: "assignment" as const })));
  }
  if (gradesQuizzes) {
    const term = await ctx.termClause("q");
    // One row per student per quiz (several attempts wait as one).
    const found = await select<any>(
      `SELECT q.id AS assessment_id, q.title, q.course_id, q.end_date AS due,
              qs.student_id, MIN(COALESCE(qs.completed_at, qs.created_at)) AS waiting_since
         FROM quiz_submissions qs
         JOIN quizzes q ON q.id = qs.quiz_id
        WHERE q.created_by = ? AND qs.status = 'completed' AND qs.grade_status = 'pending'${subjectSql("q")}${term.sql}
        GROUP BY q.id, q.title, q.course_id, q.end_date, qs.student_id`,
      [ctx.userId, ...subjectParams, ...term.params],
    );
    rows = rows.concat(found.map((r) => ({ ...r, kind: "quiz" as const })));
  }

  rows = await filterRowsByStudentScope(ctx, rows, ["SUBMISSIONS_GRADE", "QUIZZES_GRADE"], "home:T-07");
  if (rows.length === 0) return null;

  const staleBefore = ctx.now.getTime() - 7 * DAY;
  const blocking = rows.some((r) => r.due && new Date(r.due).getTime() < staleBefore);
  const assessments = new Map(rows.map((r) => [`${r.kind}:${r.assessment_id}`, r]));
  const only = assessments.size === 1 ? rows[0] : null;
  const oldest = rows
    .map((r) => (r.waiting_since ? new Date(r.waiting_since).getTime() : Infinity))
    .reduce((a, b) => Math.min(a, b), Infinity);

  return {
    id: `taskmentor:T-07:${teachingLens(ctx.lenses)}`,
    source: "taskmentor",
    kind: "T-07",
    tier: blocking ? "blocking" : "slipping",
    lens: teachingLens(ctx.lenses),
    via: await ctx.via(["SUBMISSIONS_GRADE", "QUIZZES_GRADE"]),
    depth: "write",
    count: rows.length,
    title: `${plural(rows.length, "submission")} waiting to be graded`,
    entities: countChips(rows.map((r) => ({ label: r.title }))),
    why: blocking
      ? "Some of this work was due over a week ago and students are still waiting for their marks."
      : "Students are waiting for feedback, and ungraded work holds back their results.",
    cta: {
      label: "Grade",
      href: ctx.href(
        only ? (only.kind === "quiz" ? `/quizzes/${only.assessment_id}/submissions` : `/assignments/${only.assessment_id}`) : "/submissions",
      ),
      external: true,
    },
    waiting_since: Number.isFinite(oldest) ? new Date(oldest).toISOString() : null,
  };
}

/**
 * T-14: proctoring sessions flagged in the last 7 days (status 'flagged' or
 * any flag raised -- ProctoringEvent.reviewed is never set, so "unreviewed"
 * can't be told apart). Own quizzes always count; other quizzes in the
 * viewer's subjects only for the students PROCTORING_VIEW_SESSIONS covers.
 */
async function flaggedSessionsItem(ctx: Ctx): Promise<AttentionItem | null> {
  if (!ctx.has("PROCTORING_VIEW_SESSIONS")) return null;
  const subjectIds = await teachingSubjects(ctx);
  const others =
    subjectIds === "none" ? "" : subjectIds === null ? " OR 1 = 1" : subjectIds.length ? ` OR q.course_id IN (${inList(subjectIds)})` : "";
  const found = await select<any>(
    `SELECT ps.id, ps.student_id, q.id AS quiz_id, q.title, q.course_id, q.created_by
       FROM proctoring_sessions ps
       JOIN quizzes q ON q.id = ps.quiz_id
      WHERE (ps.status = 'flagged' OR ps.flags_count > 0) AND ps.start_time >= ?
        AND (q.created_by = ?${others})`,
    [new Date(ctx.now.getTime() - 7 * DAY), ctx.userId, ...(Array.isArray(subjectIds) ? subjectIds : [])],
  );
  const own = found.filter((r) => Number(r.created_by) === ctx.userId);
  const scoped = await filterRowsByStudentScope(
    ctx,
    found.filter((r) => Number(r.created_by) !== ctx.userId),
    ["PROCTORING_VIEW_SESSIONS"],
    "home:T-14",
    "summary",
  );
  const rows = [...own, ...scoped];
  if (rows.length === 0) return null;

  const depth = scoped.length === 0 ? "detail" : ((await ctx.readDepth("PROCTORING_VIEW_SESSIONS")) ?? "summary");
  const quizzes = new Set(rows.map((r) => r.quiz_id));
  const lens = scoped.length === 0 ? teachingLens(ctx.lenses) : lensForScope(ctx.lenses, await ctx.scopeOf(["PROCTORING_VIEW_SESSIONS"]));
  return {
    id: `taskmentor:T-14:${lens}`,
    source: "taskmentor",
    kind: "T-14",
    tier: "slipping",
    lens,
    via: await ctx.via(["PROCTORING_VIEW_SESSIONS"]),
    depth,
    count: rows.length,
    title: `${plural(rows.length, "proctored session")} flagged in the last 7 days`,
    entities: depth === "summary" ? [] : countChips(rows.map((r) => ({ label: r.title }))),
    why: "Flagged sessions should be reviewed before those quiz results are trusted.",
    cta: {
      label: "Review",
      href: ctx.href(quizzes.size === 1 ? `/quizzes/${rows[0].quiz_id}/proctoring/monitoring` : "/quizzes"),
      external: true,
    },
  };
}

/** T-15: the viewer's own open quiz closes within 24 h and nobody has started it. */
async function unattemptedQuizItem(ctx: Ctx): Promise<AttentionItem | null> {
  if (!ctx.has("QUIZZES_EDIT")) return null;
  const now = ctx.now;
  const rows = await select<{ id: number; title: string; end_date: Date }>(
    `SELECT q.id, q.title, q.end_date
       FROM quizzes q
      WHERE q.created_by = ? AND q.status = 'published'
        AND (q.start_date IS NULL OR q.start_date <= ?)
        AND q.end_date > ? AND q.end_date <= ?
        AND NOT EXISTS (SELECT 1 FROM quiz_submissions qs
                         WHERE qs.quiz_id = q.id AND qs.status IN ('completed', 'in_progress'))
      ORDER BY q.end_date ASC`,
    [ctx.userId, now, now, new Date(now.getTime() + DAY)],
  );
  if (rows.length === 0) return null;
  const lens = teachingLens(ctx.lenses);
  return {
    id: `taskmentor:T-15:${lens}`,
    source: "taskmentor",
    kind: "T-15",
    tier: "tidy",
    lens,
    via: await ctx.via(["QUIZZES_EDIT"]),
    depth: "write",
    count: rows.length,
    title: `${plural(rows.length, "quiz", "quizzes")} closing within 24 hours with no submissions`,
    entities: rows.slice(0, MAX_ENTITIES).map((q) => q.title),
    why: "No student has started it yet -- check they can see it before it closes.",
    cta: { label: "Check", href: ctx.href(rows.length === 1 ? `/quizzes/${rows[0].id}` : "/quizzes"), external: true },
    due_at: iso(rows[0].end_date),
  };
}

// ─── Report-card pipeline (C-06, P-05) ──────────────────────────────────────

const daysUntil = (ctx: Ctx, d: Date | null) => (d ? (d.getTime() - ctx.now.getTime()) / DAY : Infinity);

/** C-06: this term's unapproved cards with no class-teacher comment, in REPORT_CARDS_COMMENT scope. */
async function commentItem(ctx: Ctx): Promise<AttentionItem | null> {
  if (!ctx.has("REPORT_CARDS_COMMENT")) return null;
  const period = await ctx.period();
  if (!period.term || !period.academicYear) return null;
  // student_id is a local id or (fan-out rows) an MIS id -- name it the way
  // reportCardStudentMisIds resolves it: a local user WITH an MIS link is that
  // user; otherwise the value is an MIS id, named by the user linked to it (if
  // any). Never join on users.id alone: that names an unrelated local user.
  const cards = await select<{ student_id: number; first_name: string | null; last_name: string | null }>(
    `SELECT rc.student_id,
            COALESCE(u.first_name, m.first_name) AS first_name,
            COALESCE(u.last_name, m.last_name) AS last_name
       FROM report_cards rc
       LEFT JOIN users u ON u.id = rc.student_id AND u.mis_user_id IS NOT NULL
       LEFT JOIN users m ON u.id IS NULL AND m.mis_user_id = rc.student_id
      WHERE rc.term = ? AND rc.academic_year = ? AND rc.status IN ('draft', 'saved')
        AND (rc.class_teacher_comment IS NULL OR TRIM(rc.class_teacher_comment) = '')`,
    [period.term, period.academicYear],
  );
  if (cards.length === 0) return null;
  const visible = await filterCardStudents(ctx, [...new Set(cards.map((c) => Number(c.student_id)))], ["REPORT_CARDS_COMMENT"], "home:C-06");
  const mine = cards.filter((c) => visible.has(Number(c.student_id)));
  if (mine.length === 0) return null;
  const lens = lensForScope(ctx.lenses, await ctx.scopeOf(["REPORT_CARDS_COMMENT"]));
  const blocking = daysUntil(ctx, period.termEnd) <= 7;
  return {
    id: `taskmentor:C-06:${lens}`,
    source: "taskmentor",
    kind: "C-06",
    tier: blocking ? "blocking" : "slipping",
    lens,
    via: await ctx.via(["REPORT_CARDS_COMMENT"]),
    depth: "write",
    count: mine.length,
    title: `${plural(mine.length, "report card")} needing your comment`,
    entities: mine
      .map((c) => `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim())
      .filter(Boolean)
      .slice(0, MAX_ENTITIES),
    why: "Report cards can't be approved and published without the class-teacher comment.",
    cta: { label: "Comment", href: ctx.href("/grades"), external: true },
    due_at: iso(period.termEnd),
  };
}

/** P-05: this term's saved cards awaiting approval (= publishing), in APPROVE (and, under enforce, PUBLISH) scope. */
async function approveItem(ctx: Ctx): Promise<AttentionItem | null> {
  if (!ctx.has("REPORT_CARDS_APPROVE")) return null;
  const enforce = accessMode() === "enforce";
  // updateStatus: "approved" is also the published state, so v2 needs both.
  const caps = enforce ? ["REPORT_CARDS_APPROVE", "REPORT_CARDS_PUBLISH"] : ["REPORT_CARDS_APPROVE"];
  if (!caps.every((c) => ctx.has(c))) return null;
  const period = await ctx.period();
  if (!period.term || !period.academicYear) return null;
  const cards = await select<{ student_id: number }>(
    `SELECT rc.student_id FROM report_cards rc
      WHERE rc.term = ? AND rc.academic_year = ? AND rc.status = 'saved'`,
    [period.term, period.academicYear],
  );
  if (cards.length === 0) return null;
  const visible = await filterCardStudents(ctx, [...new Set(cards.map((c) => Number(c.student_id)))], caps, "home:P-05");
  const count = cards.filter((c) => visible.has(Number(c.student_id))).length;
  if (count === 0) return null;
  const lens = lensForScope(ctx.lenses, await ctx.scopeOf(["REPORT_CARDS_APPROVE"]));
  const blocking = daysUntil(ctx, period.termEnd) <= 14;
  return {
    id: `taskmentor:P-05:${lens}`,
    source: "taskmentor",
    kind: "P-05",
    tier: blocking ? "blocking" : "slipping",
    lens,
    via: await ctx.via(caps),
    depth: "write",
    count,
    title: `${plural(count, "report card")} awaiting approval and publishing`,
    entities: [],
    why: "Students and parents can't see their report cards until they are approved.",
    cta: { label: "Review", href: ctx.href("/grades"), external: true },
    due_at: iso(period.termEnd),
  };
}

// ─── Updates: results released in the last 7 days (the viewer's own) ────────

async function resultUpdates(ctx: Ctx): Promise<UpdateItem[]> {
  const since = new Date(ctx.now.getTime() - 7 * DAY);
  const out: UpdateItem[] = [];

  if (ctx.has("SUBMISSIONS_VIEW_OWN")) {
    // Submission has no graded_at: a graded row's updated_at is when it was graded.
    const rows = await select<any>(
      `SELECT s.id, s.grade, s.updated_at, a.id AS assignment_id, a.title
         FROM submissions s JOIN assignments a ON a.id = s.assignment_id
        WHERE s.student_id = ? AND s.status = 'graded' AND s.updated_at >= ?
        ORDER BY s.updated_at DESC LIMIT ?`,
      [ctx.userId, since, MAX_UPDATES],
    );
    for (const r of rows) {
      out.push({
        id: `taskmentor:result:assignment:${r.id}`,
        source: "taskmentor",
        kind: "result_released",
        title: `Result released: ${r.title}`,
        body: r.grade ? `Grade: ${r.grade}` : null,
        severity: "success",
        created_at: iso(r.updated_at)!,
        read: false,
        href: ctx.href(`/assignments/${r.assignment_id}`),
      });
    }
  }

  if (ctx.has("QUIZZES_VIEW_RESULTS_OWN")) {
    // Manually graded quizzes only; auto-graded ones show their result at once.
    const rows = await select<any>(
      `SELECT qs.id, qs.percentage, qs.graded_at, q.id AS quiz_id, q.title
         FROM quiz_submissions qs JOIN quizzes q ON q.id = qs.quiz_id
        WHERE qs.student_id = ? AND qs.grade_status = 'graded' AND qs.graded_at >= ?
        ORDER BY qs.graded_at DESC LIMIT ?`,
      [ctx.userId, since, MAX_UPDATES],
    );
    for (const r of rows) {
      out.push({
        id: `taskmentor:result:quiz:${r.id}`,
        source: "taskmentor",
        kind: "result_released",
        title: `Quiz graded: ${r.title}`,
        body: r.percentage != null ? `Score: ${Math.round(Number(r.percentage))}%` : null,
        severity: "success",
        created_at: iso(r.graded_at)!,
        read: false,
        href: ctx.href(`/quizzes/${r.quiz_id}/results`),
      });
    }
  }

  if (ctx.has("REPORT_CARDS_VIEW_OWN") && ctx.misUserId) {
    // ReportCard.student_id may hold the local id or (fan-out rows) the MIS id.
    const rows = await select<any>(
      `SELECT rc.id, rc.student_id, rc.term, rc.academic_year, rc.updated_at
         FROM report_cards rc
        WHERE rc.student_id IN (?, ?) AND rc.status = 'approved' AND rc.updated_at >= ?
        ORDER BY rc.updated_at DESC LIMIT ?`,
      [ctx.userId, ctx.misUserId, since, MAX_UPDATES],
    );
    const misOf = await reportCardStudentMisIds(rows.map((r) => Number(r.student_id)));
    for (const r of rows) {
      if ((misOf.get(Number(r.student_id)) ?? r.student_id) !== ctx.misUserId) continue;
      out.push({
        id: `taskmentor:result:report-card:${r.id}`,
        source: "taskmentor",
        kind: "report_card_published",
        title: `Report card published: ${r.term} ${r.academic_year}`,
        body: null,
        severity: "success",
        created_at: iso(r.updated_at)!,
        read: false,
        href: ctx.href("/reports"),
      });
    }
  }

  return out.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, MAX_UPDATES);
}

// ─── Assembly ────────────────────────────────────────────────────────────────

const TIER_ORDER: Record<Tier, number> = { blocking: 0, slipping: 1, tidy: 2 };

/** One signal failing (e.g. MIS blip) must not blank the whole summary. */
async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    console.warn(`home-summary: ${label} failed:`, error?.message ?? error);
    return fallback;
  }
}

export async function buildHomeSummary(
  req: Request,
  opts: { lenses?: unknown; now?: Date } = {},
): Promise<HomeSummary> {
  const ctx = new Ctx(req, parseLenses(opts.lenses), opts.now ?? new Date(), appUrl());

  const learner = await safe("learner assignments", () => learnerAssignments(ctx), null);
  const [s03, t07, t14, t15, c06, p05, updates] = await Promise.all([
    safe("S-03", () => quizClosingItem(ctx), null),
    safe("T-07", () => toGradeItem(ctx), null),
    safe("T-14", () => flaggedSessionsItem(ctx), null),
    safe("T-15", () => unattemptedQuizItem(ctx), null),
    safe("C-06", () => commentItem(ctx), null),
    safe("P-05", () => approveItem(ctx), null),
    safe("updates", () => resultUpdates(ctx), [] as UpdateItem[]),
  ]);

  const items = [...(learner ? learnerItems(ctx, learner) : []), s03, t07, t14, t15, c06, p05]
    .filter((i): i is AttentionItem => i !== null)
    // Contract: summary depth never carries entity chips; chips are short.
    .map((i) => ({ ...i, entities: i.depth === "summary" ? [] : i.entities.slice(0, MAX_ENTITIES).map(shortChip) }))
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);

  const tiles: GlanceTile[] = [];
  const done = learner ? learnerTile(ctx, learner) : null;
  if (done) tiles.push(done);
  if (ctx.has("SUBMISSIONS_GRADE", "QUIZZES_GRADE") && (await safe("to-grade tile", () => teachingSubjects(ctx), "none" as const)) !== "none") {
    const lens = teachingLens(ctx.lenses);
    tiles.push({
      id: `taskmentor:tile:to-grade:${lens}`,
      source: "taskmentor",
      lens,
      label: "To grade",
      value: String(t07?.count ?? 0),
      hint: "Submissions on your assessments waiting for a grade",
      status: !t07 ? "good" : t07.tier === "blocking" ? "critical" : "warning",
      href: ctx.href("/submissions"),
    });
  }

  return {
    ...emptySummary(true),
    items,
    tiles: tiles.slice(0, 3),
    updates,
  };
}
