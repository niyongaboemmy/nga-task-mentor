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
import { loadStudentOverview, LoadedStudentOverview } from "../services/studentOverview.loader";
import {
  DUE_SOON_DAYS,
  HANDED_IN,
  MISSED_REMINDER_DAYS,
  NEW_TASK_DAYS,
  OPENS_SOON_DAYS,
  reminderTargets,
  StudentTask,
} from "../services/studentOverview.service";
import { computeOverview } from "../controllers/instructorOverview.controller";
import {
  alertTargets,
  CLOSING_SOON_HOURS,
  GRADING_SLA_DAYS,
  LIVE_HEARTBEAT_MINUTES,
  LOW_PARTICIPATION,
  overviewAlertTargets,
  PASS_MARK,
} from "../services/instructorOverview.service";
import { buildAlerts as bankAlerts, emptyStats, THIN_BANK_THRESHOLD } from "../controllers/questionBankHub.controller";

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
 * Signals -- each one the same rule the app's own dashboard applies:
 *   learner (student dashboard, studentOverview.loader + reminderTargets):
 *     S-05 quiz in progress · S-01 missed this week · S-02 assignments due
 *     ≤ 24 h · S-03 quizzes closing ≤ 24 h · S-10 due ≤ 3 days · S-06 drafts ·
 *     S-04 new work · S-07 retake after failing · S-08 quiz opens ≤ 2 days ·
 *     S-09 TMCode project returned for changes
 *   teaching: T-07 grading queue (instructor dashboard rules) · T-14 flagged
 *     proctoring · T-15 own quiz closing with nobody started · T-16…T-23,
 *     T-25 instructor dashboard alerts (computeOverview + alertTargets) ·
 *     T-24 empty/thin question banks (Question Bank hub rules)
 *   report cards: C-06 class-teacher comment · P-05 approve/publish
 * Not here (yet): T-06 marks-not-entered and D-02 moderation (no
 * closed-assessment/moderation state in the data model).
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
/** S-09 looks back this far for a teacher's "returned for changes". */
const RETURNED_WINDOW_DAYS = 30;
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

// ─── Learner signals (S-01…S-10) + "Assignments done" tile ──────────────────
//
// Built from the student dashboard's own loader and rules
// (services/studentOverview.loader.ts → buildStudentOverview →
// reminderTargets), so Home shows exactly what the student dashboard's
// reminders show: public work only, late submissions refused (past due =
// missed), due today ≤ 24 h, due soon ≤ DUE_SOON_DAYS.

/** The student overview, for learners only (getScopedSubjects scope "enrolled"). */
async function learnerOverview(ctx: Ctx): Promise<LoadedStudentOverview | null> {
  if (!ctx.has("SUBMISSIONS_CREATE", "QUIZZES_ATTEMPT")) return null;
  const scoped = await ctx.subjects();
  if (scoped.scope !== "enrolled") return null;
  return loadStudentOverview(ctx.req, ctx.userId, { now: ctx.now, scoped, termId: await ctx.termId() });
}

const taskChip = (t: StudentTask) => `${t.title} · ${t.subject_name}`;
const earliest = (dates: Array<string | null | undefined>): string | null =>
  dates.filter((d): d is string => !!d).sort()[0] ?? null;

function learnerItems(ctx: Ctx, data: LoadedStudentOverview): AttentionItem[] {
  // Reminders cover publicly accessible work only (buildStudentOverview), and
  // each kind of work only for a caller who may hand it in.
  const allowAssignments = ctx.has("SUBMISSIONS_CREATE");
  const allowQuizzes = ctx.has("QUIZZES_ATTEMPT");
  const tasks = data.overview.tasks.filter(
    (t) => t.is_public && (t.kind === "assignment" ? allowAssignments : allowQuizzes),
  );
  const r = reminderTargets(tasks, ctx.now);
  const items: AttentionItem[] = [];

  const push = (
    kind: string,
    tier: Tier,
    list: StudentTask[],
    title: string,
    why: string,
    cta: { label: string; one: (t: StudentTask) => string; many: string },
    due_at: string | null = null,
  ) => {
    if (list.length === 0) return;
    items.push({
      id: `taskmentor:${kind}:SELF`,
      source: "taskmentor",
      kind,
      tier,
      lens: "SELF",
      via: [],
      depth: "detail",
      count: list.length,
      title,
      entities: list.slice(0, MAX_ENTITIES).map(taskChip),
      why,
      cta: { label: cta.label, href: ctx.href(list.length === 1 ? cta.one(list[0]) : cta.many), external: true },
      due_at,
    });
  };
  const actionUrl = (t: StudentTask) => t.action?.url ?? (t.kind === "quiz" ? "/my-quizzes" : `/assignments/${t.id}`);
  const dueOf = (list: StudentTask[]) => earliest(list.map((t) => t.countdown_to ?? t.due_at));

  // S-05: a quiz attempt is running -- the most time-critical thing a student can have.
  push(
    "S-05",
    "blocking",
    r.running,
    `${plural(r.running.length, "quiz", "quizzes")} in progress`,
    "Your attempt is running. Answers not submitted before it ends may be lost.",
    { label: "Resume", one: (t) => `/quizzes/${t.id}/take`, many: "/my-quizzes" },
    dueOf(r.running),
  );

  // S-01: missed in the last week. Late submissions are refused, so this asks
  // for a conversation with the teacher, never a submission.
  push(
    "S-01",
    "blocking",
    r.recentlyMissed,
    `${plural(r.recentlyMissed.length, "task")} missed in the last ${MISSED_REMINDER_DAYS} days`,
    "The deadline has passed and late work isn't accepted. Talk to your teacher about catching up.",
    { label: "See work", one: actionUrl, many: "/dashboard" },
  );

  // S-02 / S-03: due within 24 hours (the dashboard's "due today").
  const dueTodayAssignments = r.dueToday.filter((t) => t.kind === "assignment");
  const dueTodayQuizzes = r.dueToday.filter((t) => t.kind === "quiz");
  push(
    "S-02",
    "blocking",
    dueTodayAssignments,
    `${plural(dueTodayAssignments.length, "assignment")} due within 24 hours`,
    "Late submissions aren't accepted, so submit before the deadline.",
    { label: "Submit", one: actionUrl, many: "/assignments" },
    dueOf(dueTodayAssignments),
  );
  push(
    "S-03",
    "blocking",
    dueTodayQuizzes,
    `${plural(dueTodayQuizzes.length, "quiz", "quizzes")} closing within 24 hours`,
    "A quiz can't be taken after it closes.",
    { label: "Start", one: (t) => `/quizzes/${t.id}/take`, many: "/my-quizzes" },
    dueOf(dueTodayQuizzes),
  );

  // S-10: due soon (after the next 24 hours, within DUE_SOON_DAYS).
  push(
    "S-10",
    "slipping",
    r.dueSoon,
    `${plural(r.dueSoon.length, "task")} due in the next ${DUE_SOON_DAYS} days`,
    "Plan time for these now. Work can't be handed in after its deadline.",
    { label: "Open", one: actionUrl, many: "/dashboard" },
    dueOf(r.dueSoon),
  );

  // S-06: saved drafts on work that is still open (due today is S-02 already).
  push(
    "S-06",
    "slipping",
    r.drafts,
    `${plural(r.drafts.length, "draft")} not submitted`,
    "A draft doesn't count until you submit it.",
    { label: "Finish & submit", one: actionUrl, many: "/assignments" },
    dueOf(r.drafts),
  );

  // S-04: new work posted in the last NEW_TASK_DAYS days, not handed in.
  push(
    "S-04",
    "tidy",
    r.newWork,
    `${plural(r.newWork.length, "new task")} posted`,
    `Posted in the last ${NEW_TASK_DAYS} days and not handed in yet.`,
    { label: "Open", one: actionUrl, many: "/dashboard" },
  );

  // S-07: failed a quiz that can still be retaken.
  push(
    "S-07",
    "tidy",
    r.retakes,
    `${plural(r.retakes.length, "quiz", "quizzes")} you can retake`,
    "Your best score is below the pass mark and the quiz is still open. Another attempt can raise it.",
    { label: "Retake", one: (t) => `/quizzes/${t.id}/take`, many: "/my-quizzes" },
    dueOf(r.retakes),
  );

  // S-08: a quiz opens within OPENS_SOON_DAYS.
  push(
    "S-08",
    "tidy",
    r.opening,
    `${plural(r.opening.length, "quiz", "quizzes")} opening within ${OPENS_SOON_DAYS} days`,
    "Be ready: check the time and how long it takes.",
    { label: "View", one: actionUrl, many: "/my-quizzes" },
  );
  return items;
}

/** Published (or completed) assignments this term vs those handed in -- the student dashboard's rows. */
function learnerTile(ctx: Ctx, data: LoadedStudentOverview): GlanceTile | null {
  if (!ctx.has("SUBMISSIONS_CREATE")) return null;
  const total = data.input.assignments.length;
  if (total === 0) return null;
  const handedIn = new Set(
    data.input.submissions.filter((s) => HANDED_IN.has(s.status)).map((s) => Number(s.assignment_id)),
  );
  const done = data.input.assignments.filter((a) => handedIn.has(Number(a.id))).length;
  const missed = data.overview.tasks.some((t) => t.kind === "assignment" && t.state === "missed");
  return {
    id: "taskmentor:tile:assignments-done:SELF",
    source: "taskmentor",
    lens: "SELF",
    label: "Assignments done",
    value: `${done}/${total}`,
    hint: "Assignments this term that you have handed in",
    status: missed ? "warning" : "good",
    href: ctx.href("/assignments"),
  };
}

/**
 * S-09: the caller's own TMCode project a teacher returned for changes
 * (project_events type 'returned') and that is still a draft -- the return is
 * the latest status change, so neither a resubmit nor the student's own
 * withdraw has happened since.
 */
async function returnedProjectsItem(ctx: Ctx): Promise<AttentionItem | null> {
  if (!ctx.has("PROJECTS_USE")) return null;
  const rows = await select<{ id: number; name: string; returned_at: Date }>(
    `SELECT p.id, p.name, MAX(pe.created_at) AS returned_at
       FROM projects p
       JOIN project_events pe ON pe.project_id = p.id AND pe.type = 'returned'
      WHERE p.owner_id = ? AND p.status = 'draft' AND p.archived_at IS NULL
        AND pe.created_at >= COALESCE(p.status_changed_at, p.created_at)
        AND pe.created_at >= ?
      GROUP BY p.id, p.name
      ORDER BY returned_at DESC`,
    [ctx.userId, new Date(ctx.now.getTime() - RETURNED_WINDOW_DAYS * DAY)],
  );
  if (rows.length === 0) return null;
  return {
    id: "taskmentor:S-09:SELF",
    source: "taskmentor",
    kind: "S-09",
    tier: "slipping",
    lens: "SELF",
    via: [],
    depth: "detail",
    count: rows.length,
    title: `${plural(rows.length, "project")} returned for changes`,
    entities: rows.slice(0, MAX_ENTITIES).map((p) => p.name),
    why: "Your teacher sent it back. Make the changes and submit it again.",
    cta: { label: "Open", href: ctx.href(rows.length === 1 ? `/projects/${rows[0].id}` : "/projects"), external: true },
    waiting_since: iso(rows[rows.length - 1].returned_at),
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
  waiting_since: Date | null;
}

/**
 * T-07: the instructor dashboard's grading queue (computeOverview): every
 * handed-in, ungraded assignment submission and finished (completed or timed
 * out) quiz attempt without a grade, on any assessment in the teacher's
 * assigned subjects -- co-teachers' included -- this term; blocking once one
 * has waited over GRADING_SLA_DAYS. Restricted to the students the caller's
 * grading scope covers. A school-wide (scope "all") caller isn't a subject
 * teacher: they keep only their own assessments, so Home isn't the whole
 * school's queue.
 */
async function toGradeItem(ctx: Ctx): Promise<AttentionItem | null> {
  const gradesAssignments = ctx.has("SUBMISSIONS_GRADE");
  const gradesQuizzes = ctx.has("QUIZZES_GRADE");
  if (!gradesAssignments && !gradesQuizzes) return null;
  const subjectIds = await teachingSubjects(ctx);
  if (subjectIds === "none" || (Array.isArray(subjectIds) && subjectIds.length === 0)) return null;

  const whose = (alias: string) =>
    subjectIds
      ? { sql: ` AND ${alias}.course_id IN (${inList(subjectIds)})`, params: subjectIds as any[] }
      : { sql: ` AND ${alias}.created_by = ?`, params: [ctx.userId] as any[] };
  let rows: PendingRow[] = [];

  if (gradesAssignments) {
    const term = await ctx.termClause("a");
    const scope = whose("a");
    const found = await select<any>(
      `SELECT a.id AS assessment_id, a.title, a.course_id,
              s.student_id, COALESCE(s.submitted_at, s.updated_at) AS waiting_since
         FROM submissions s
         JOIN assignments a ON a.id = s.assignment_id
        WHERE a.status <> 'removed'
          AND s.status IN ('submitted', 'late', 'resubmitted')${scope.sql}${term.sql}`,
      [...scope.params, ...term.params],
    );
    rows = rows.concat(found.map((r) => ({ ...r, kind: "assignment" as const })));
  }
  if (gradesQuizzes) {
    const term = await ctx.termClause("q");
    const scope = whose("q");
    // One row per finished attempt, as the dashboard counts them.
    const found = await select<any>(
      `SELECT q.id AS assessment_id, q.title, q.course_id,
              qs.student_id, COALESCE(qs.completed_at, qs.updated_at) AS waiting_since
         FROM quiz_submissions qs
         JOIN quizzes q ON q.id = qs.quiz_id
        WHERE qs.status IN ('completed', 'timed_out')
          AND (qs.grade_status IS NULL OR qs.grade_status NOT IN ('graded', 'auto_graded'))${scope.sql}${term.sql}`,
      [...scope.params, ...term.params],
    );
    rows = rows.concat(found.map((r) => ({ ...r, kind: "quiz" as const })));
  }

  rows = await filterRowsByStudentScope(ctx, rows, ["SUBMISSIONS_GRADE", "QUIZZES_GRADE"], "home:T-07");
  if (rows.length === 0) return null;

  const oldest = rows
    .map((r) => (r.waiting_since ? new Date(r.waiting_since).getTime() : Infinity))
    .reduce((a, b) => Math.min(a, b), Infinity);
  const blocking = oldest < ctx.now.getTime() - GRADING_SLA_DAYS * DAY;
  const assessments = new Map(rows.map((r) => [`${r.kind}:${r.assessment_id}`, r]));
  const only = assessments.size === 1 ? rows[0] : null;
  const lens = teachingLens(ctx.lenses);

  return {
    id: `taskmentor:T-07:${lens}`,
    source: "taskmentor",
    kind: "T-07",
    tier: blocking ? "blocking" : "slipping",
    lens,
    via: await ctx.via(["SUBMISSIONS_GRADE", "QUIZZES_GRADE"]),
    depth: "write",
    count: rows.length,
    title: `${plural(rows.length, "submission")} waiting to be graded`,
    entities: countChips(rows.map((r) => ({ label: r.title }))),
    why: blocking
      ? `Some of this work has waited over ${GRADING_SLA_DAYS} days and students are still waiting for their marks.`
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

// ─── Instructor dashboard alerts (T-16…T-25) ─────────────────────────────────
//
// The instructor dashboard's own decision board (computeOverview, 60 s cache
// shared with the dashboard and the notification bell) mapped item by item
// through alertTargets -- the rule set behind its alerts. Only for subject
// teachers (scope "assigned") holding DASHBOARD_VIEW_INSTRUCTOR: a school-wide
// caller's computeOverview loads every class roster in the school from MIS,
// which is too heavy for a login-time summary, so admins get none of these.

const subjectLabel = (s: { subject_code: string | null; subject_name: string }) => s.subject_code || s.subject_name;

async function instructorItems(ctx: Ctx): Promise<AttentionItem[]> {
  if (!ctx.has("DASHBOARD_VIEW_INSTRUCTOR")) return [];
  const { scope, subjects } = await ctx.subjects();
  if (scope !== "assigned" || subjects.length === 0) return [];
  const { overview } = await computeOverview(ctx.req);
  const nowMs = Date.parse(overview.generated_at);
  const t = overviewAlertTargets(overview) ?? alertTargets({ ...overview, nowMs });
  const totals = overview.totals;
  const lens = teachingLens(ctx.lenses);
  const via = await ctx.via(["DASHBOARD_VIEW_INSTRUCTOR"]);
  const items: AttentionItem[] = [];

  const push = (
    kind: string,
    tier: Tier,
    count: number,
    title: string,
    why: string,
    entities: string[],
    cta: { label: string; path: string },
    extra: Partial<AttentionItem> = {},
  ) => {
    if (count <= 0) return;
    items.push({
      id: `taskmentor:${kind}:${lens}`,
      source: "taskmentor",
      kind,
      tier,
      lens,
      via,
      depth: "detail",
      count,
      title,
      entities: entities.slice(0, MAX_ENTITIES),
      why,
      cta: { label: cta.label, href: ctx.href(cta.path), external: true },
      ...extra,
    });
  };
  const one = <T>(list: T[], path: (x: T) => string, many = "/dashboard") => (list.length === 1 ? path(list[0]) : many);

  // T-16: subjects at risk (low class average or participation).
  push(
    "T-16",
    "slipping",
    t.atRiskSubjects.length,
    `${plural(t.atRiskSubjects.length, "subject")} at risk`,
    t.atRiskSubjects.length === 1
      ? `${t.atRiskSubjects[0].health_reasons.join(". ")}.`
      : "Class averages or participation are below where they should be.",
    t.atRiskSubjects.map(subjectLabel),
    { label: "Open subject", path: one(t.atRiskSubjects, (s) => `/courses/${s.subject_id}`) },
  );

  // T-17: closing within 48 h with under half the class submitted.
  const closingIn24h = t.lowClosing.some((u) => new Date(u.due_at!).getTime() <= nowMs + DAY);
  push(
    "T-17",
    closingIn24h ? "blocking" : "slipping",
    t.lowClosing.length,
    `${plural(t.lowClosing.length, "assessment")} closing within ${CLOSING_SOON_HOURS} hours with low submissions`,
    "Fewer than half of the class has submitted. Consider a reminder before it closes.",
    t.lowClosing.map((u) => `${u.title} · ${u.participation}%`),
    { label: "View", path: one(t.lowClosing, (u) => u.url) },
    { due_at: earliest(t.lowClosing.map((u) => u.due_at)) },
  );

  // T-18: closed in the last week with missing work.
  push(
    "T-18",
    "slipping",
    t.closedMissing.length,
    `${plural(t.closedMissing.length, "assessment")} closed with missing work`,
    `Under ${LOW_PARTICIPATION}% of the class submitted before it closed. Follow up or reopen it.`,
    t.closedMissing.map((a) => `${a.title} · ${a.expected! - Math.min(a.submitted, a.expected!)} missing`),
    { label: "View", path: one(t.closedMissing, (a) => a.url) },
  );

  // T-19: the class struggled on a graded assessment.
  push(
    "T-19",
    "tidy",
    t.lowScores.length,
    `${plural(t.lowScores.length, "assessment")} with a class average below ${PASS_MARK}%`,
    "Consider reteaching the topic or a remedial activity.",
    t.lowScores.map((a) => `${a.title} · ${a.avg_score}%`),
    { label: "See results", path: one(t.lowScores, (a) => a.url) },
  );

  // T-20: students needing support -- names only at detail depth.
  const depth = (await ctx.readDepth("DASHBOARD_VIEW_INSTRUCTOR")) ?? "summary";
  const atRisk = overview.students.at_risk;
  push(
    "T-20",
    "slipping",
    totals.at_risk_students,
    `${plural(totals.at_risk_students, "student")} needing support`,
    `Below ${PASS_MARK}% or with 2+ missing submissions across your subjects.`,
    depth === "detail" ? atRisk.map((s) => s.name) : [],
    {
      label: "See students",
      path: totals.at_risk_students === 1 && atRisk[0]?.url ? atRisk[0].url : "/dashboard",
    },
    { depth },
  );

  // T-21 / T-22: proctoring sessions running now / left open.
  const proctoringPath = ctx.has("PROCTORING_JOIN_LIVE_STREAM") ? "/proctoring/live" : "/dashboard";
  push(
    "T-21",
    "slipping",
    totals.live_proctoring,
    `${plural(totals.live_proctoring, "student")} taking a proctored quiz now`,
    "Watch the live sessions for integrity events.",
    [],
    { label: "Watch live", path: proctoringPath },
  );
  push(
    "T-22",
    "tidy",
    totals.stale_proctoring,
    `${plural(totals.stale_proctoring, "proctoring session")} left open`,
    `Marked active but with no heartbeat in the last ${LIVE_HEARTBEAT_MINUTES} minutes. Review and close them.`,
    [],
    { label: "Review", path: proctoringPath },
  );

  // T-23: drafts students can't see yet.
  push(
    "T-23",
    "tidy",
    totals.drafts,
    `${plural(totals.drafts, "draft")} not yet published`,
    "Students can't see drafts. Publish them when they're ready.",
    [],
    { label: "Assignments", path: "/assignments" },
  );

  // T-25: subjects with nothing published this term.
  push(
    "T-25",
    "tidy",
    t.emptySubjects.length,
    `${plural(t.emptySubjects.length, "subject")} with no published assessment`,
    "Nothing students can work on yet this term.",
    t.emptySubjects.map(subjectLabel),
    { label: "Create assignment", path: ctx.has("ASSIGNMENTS_CREATE") ? "/assignments/create" : "/dashboard" },
  );
  return items;
}

/**
 * T-24: the Question Bank hub's "empty" and "thin" alerts (buildAlerts, same
 * thresholds) for the teacher's assigned subjects: one COUNT per subject, no
 * term filter (the bank is reusable, as in the hub).
 */
async function questionBankItem(ctx: Ctx): Promise<AttentionItem | null> {
  if (!ctx.has("QUESTION_BANK_HUB_VIEW")) return null;
  const { scope, subjects } = await ctx.subjects();
  if (scope !== "assigned" || subjects.length === 0) return null;
  const counts = await select<{ course_id: number; total: number }>(
    `SELECT qb.course_id, COUNT(*) AS total FROM question_bank qb
      WHERE qb.course_id IN (${inList(subjects.map((s) => s.id))}) GROUP BY qb.course_id`,
    subjects.map((s) => s.id),
  );
  const totals = new Map(counts.map((r) => [Number(r.course_id), Number(r.total)]));
  const stats = subjects.map((s) => ({ ...emptyStats(s), total: totals.get(s.id) ?? 0 }));
  const flagged = new Set(
    bankAlerts(stats)
      .filter((a) => a.subject_id != null && (a.id.startsWith("empty:") || a.id.startsWith("thin:")))
      .map((a) => a.subject_id as number),
  );
  const list = stats.filter((s) => flagged.has(s.subject_id)).sort((a, b) => a.total - b.total);
  if (list.length === 0) return null;
  const lens = teachingLens(ctx.lenses);
  return {
    id: `taskmentor:T-24:${lens}`,
    source: "taskmentor",
    kind: "T-24",
    tier: "tidy",
    lens,
    via: await ctx.via(["QUESTION_BANK_HUB_VIEW"]),
    depth: "detail",
    count: list.length,
    title: `${plural(list.length, "subject")} with an empty or thin question bank`,
    entities: list.slice(0, MAX_ENTITIES).map((s) => `${s.subject_code || s.subject_name} · ${plural(s.total, "question")}`),
    why: `Aim for at least ${THIN_BANK_THRESHOLD} questions per subject so quizzes can draw varied questions.`,
    cta: { label: "Question bank", href: ctx.href("/question-bank"), external: true },
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

  const [learner, s09, t07, t14, t15, dashboardAlerts, t24, c06, p05, updates] = await Promise.all([
    safe("learner overview", () => learnerOverview(ctx), null),
    safe("S-09", () => returnedProjectsItem(ctx), null),
    safe("T-07", () => toGradeItem(ctx), null),
    safe("T-14", () => flaggedSessionsItem(ctx), null),
    safe("T-15", () => unattemptedQuizItem(ctx), null),
    safe("instructor alerts", () => instructorItems(ctx), [] as AttentionItem[]),
    safe("T-24", () => questionBankItem(ctx), null),
    safe("C-06", () => commentItem(ctx), null),
    safe("P-05", () => approveItem(ctx), null),
    safe("updates", () => resultUpdates(ctx), [] as UpdateItem[]),
  ]);
  const learnerSignals = learner
    ? await safe("learner items", async () => learnerItems(ctx, learner), [] as AttentionItem[])
    : [];

  const items = [...learnerSignals, s09, t07, t14, t15, ...dashboardAlerts, t24, c06, p05]
    .filter((i): i is AttentionItem => i !== null)
    // Contract: summary depth never carries entity chips; chips are short.
    .map((i) => ({ ...i, entities: i.depth === "summary" ? [] : i.entities.slice(0, MAX_ENTITIES).map(shortChip) }))
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);

  const tiles: GlanceTile[] = [];
  const done = learner ? await safe("assignments tile", async () => learnerTile(ctx, learner), null) : null;
  if (done) tiles.push(done);
  if (ctx.has("SUBMISSIONS_GRADE", "QUIZZES_GRADE") && (await safe("to-grade tile", () => teachingSubjects(ctx), "none" as const)) !== "none") {
    const lens = teachingLens(ctx.lenses);
    tiles.push({
      id: `taskmentor:tile:to-grade:${lens}`,
      source: "taskmentor",
      lens,
      label: "To grade",
      value: String(t07?.count ?? 0),
      hint: "Submissions in your subjects waiting for a grade",
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
