import { Op, QueryTypes } from "sequelize";
import { sequelize } from "../config/database";
import { Assignment, Quiz, QuizSubmission, Submission, User } from "../models";
import { clientBasicAuth } from "../access/misClient";
import { isMisTransportInjected, misBase, misServiceCall } from "./reminderSync";
import {
  DUE_WINDOW_DAYS,
  MARKS_WINDOW_DAYS,
  RosterStudent,
  buildSignals,
  chunk,
  kigaliDate,
} from "./earlyWarning.service";

/**
 * Daily early-warning push to NGA MIS: PUT /early-warning/signals with this
 * app's SSO client credentials (HTTP Basic, same transport as the Reminder
 * Hub push in reminderSync.ts). MIS maps taskmentor_app -> source
 * "taskmentor" and turns the numbers into watch / at-risk levels.
 *
 * Who is "expected" to do a task: students with an ACTIVE MIS subject
 * enrolment (StudentSubjectEnrollment -- the same table behind the student
 * dashboard's /enrolled-subjects call), read with the same client credentials
 * from GET /integrations/sync/people. A background job has no user token,
 * so the dashboard's per-request getScopedSubjects can't be used here.
 *
 * Students are sent by MIS user id (from that roster); their Task Mentor
 * rows are found through users.mis_user_id, falling back to the email for
 * accounts not linked yet. Nothing is sent when the roster can't be read in
 * full -- partial data would look like "no concerns".
 *
 * Runs once a day (EARLY_WARNING_PUSH_AT, default 18:45 Africa/Kigali) and
 * ~2 minutes after boot when the last success is older than 20 hours. Off
 * with EARLY_WARNING_PUSH=0/false or without the MIS URL / client
 * credentials. Never throws.
 */

export const JOB_NAME = "early_warning_push";
const DAY = 24 * 60 * 60 * 1000;
const KIGALI_OFFSET_MS = 2 * 60 * 60 * 1000;
export const BOOT_DELAY_MS = 2 * 60 * 1000;
export const STALE_AFTER_MS = 20 * 60 * 60 * 1000;
const PEOPLE_PAGE = 2000;
const MAX_PEOPLE_PAGES = 200;

const log = (msg: string) => console.log(`[early-warning] ${msg}`);
const warn = (msg: string, err?: unknown) =>
  console.warn(`[early-warning] ${msg}${err ? `: ${(err as any)?.message ?? err}` : ""}`);

export function earlyWarningDisabledReason(env: NodeJS.ProcessEnv = process.env): string | null {
  const flag = (env.EARLY_WARNING_PUSH || "").trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return `EARLY_WARNING_PUSH=${env.EARLY_WARNING_PUSH}`;
  if (env.NODE_ENV === "test" && !isMisTransportInjected()) return "NODE_ENV=test";
  if (!misBase(env)) return "NGA_MIS_BASE_URL is not set";
  if (!clientBasicAuth(env)) return "SSO_CLIENT_ID/SSO_CLIENT_SECRET are not set";
  return null;
}

// ── MIS roster ───────────────────────────────────────────────────────────

export interface MisRosterStudent {
  mis_user_id: number;
  email: string | null;
  subject_ids: number[];
}

const upper = (v: unknown) => String(v ?? "").trim().toUpperCase();
const toMs = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const t = new Date(String(v)).getTime();
  return Number.isNaN(t) ? null : t;
};

/**
 * Academic years whose dates overlap the marks windows (the last 60 days).
 * null = no usable year dates, so enrolments of every year count.
 */
export function relevantYearIds(years: any[], now: Date): Set<number> | null {
  const from = now.getTime() - 2 * MARKS_WINDOW_DAYS * DAY;
  const ids = new Set<number>();
  let dated = 0;
  for (const y of years ?? []) {
    const id = Number(y?.id);
    const start = toMs(y?.startDate);
    const end = toMs(y?.endDate);
    if (!Number.isFinite(id) || start == null || end == null) continue;
    dated++;
    // end dates are calendar days: count the whole day
    if (start <= now.getTime() && end + DAY > from) ids.add(id);
  }
  return dated ? ids : null;
}

/** Pure: MIS /sync/people users -> active students with their active subject enrolments. */
export function rosterFromPeople(users: any[], years: Set<number> | null): MisRosterStudent[] {
  const out: MisRosterStudent[] = [];
  for (const u of users ?? []) {
    const id = Number(u?.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    if (u.status != null && upper(u.status) !== "ACTIVE") continue;
    const isStudent =
      upper(u.profile?.userType) === "STUDENT" ||
      (Array.isArray(u.roles) && u.roles.some((r: any) => upper(r?.name) === "STUDENT"));
    if (!isStudent) continue;
    const subjects = new Set<number>();
    for (const e of u.subjectEnrollments ?? []) {
      if (e?.status != null && upper(e.status) !== "ACTIVE") continue;
      const year = Number(e?.academicYearId);
      if (years && Number.isFinite(year) && !years.has(year)) continue;
      const sid = Number(e?.subjectId);
      if (Number.isInteger(sid) && sid > 0) subjects.add(sid);
    }
    if (!subjects.size) continue;
    out.push({ mis_user_id: id, email: u.email ? String(u.email).trim().toLowerCase() : null, subject_ids: [...subjects] });
  }
  return out;
}

/** Every active, enrolled student. Throws when any page fails (no partial pushes). */
export async function loadMisRoster(now: Date): Promise<MisRosterStudent[]> {
  const ref = await misServiceCall("GET", "/integrations/sync/reference");
  if (ref.status < 200 || ref.status >= 300) throw new Error(`MIS reference refused (HTTP ${ref.status})`);
  const years = relevantYearIds(ref.body?.data?.academicYears ?? [], now);

  const users: any[] = [];
  let cursor: number | null = 0;
  for (let page = 0; cursor !== null; page++) {
    if (page >= MAX_PEOPLE_PAGES) throw new Error("MIS people sync did not finish");
    const res = await misServiceCall("GET", `/integrations/sync/people?limit=${PEOPLE_PAGE}&cursor=${cursor}`);
    if (res.status < 200 || res.status >= 300) throw new Error(`MIS people refused (HTTP ${res.status})`);
    const data = res.body?.data ?? {};
    users.push(...(data.users ?? []));
    const next = data.pagination?.nextCursor;
    cursor = next == null ? null : Number(next);
    if (cursor !== null && !Number.isFinite(cursor)) cursor = null;
  }
  return rosterFromPeople(users, years);
}

// ── Task Mentor rows ─────────────────────────────────────────────────────

/** MIS id -> local users.id: mis_user_id first, then email for unlinked accounts. */
export async function linkLocalUsers(roster: MisRosterStudent[]): Promise<RosterStudent[]> {
  const misIds = roster.map((s) => s.mis_user_id);
  const byMis = new Map<number, number>();
  if (misIds.length) {
    const linked = (await User.findAll({
      where: { mis_user_id: { [Op.in]: misIds } } as any,
      attributes: ["id", "mis_user_id"],
      raw: true,
    })) as any[];
    for (const u of linked) if (!byMis.has(Number(u.mis_user_id))) byMis.set(Number(u.mis_user_id), Number(u.id));
  }
  const emails = roster.filter((s) => !byMis.has(s.mis_user_id) && s.email).map((s) => s.email!);
  const byEmail = new Map<string, number>();
  if (emails.length) {
    const unlinked = (await User.findAll({
      where: { email: { [Op.in]: emails }, mis_user_id: null } as any,
      attributes: ["id", "email"],
      raw: true,
    })) as any[];
    for (const u of unlinked) byEmail.set(String(u.email).trim().toLowerCase(), Number(u.id));
  }
  return roster.map((s) => ({
    mis_user_id: s.mis_user_id,
    local_user_id: byMis.get(s.mis_user_id) ?? (s.email ? byEmail.get(s.email) ?? null : null),
    subject_ids: s.subject_ids,
  }));
}

const ASSIGNMENT_FIELDS = ["id", "title", "course_id", "status", "due_date", "max_score", "submission_type", "created_at"];
const QUIZ_FIELDS = [
  "id", "title", "course_id", "status", "type", "start_date", "end_date",
  "time_limit", "max_attempts", "passing_score", "is_public", "created_at",
];
const SUBMISSION_FIELDS = ["id", "assignment_id", "student_id", "status", "grade", "feedback", "is_late", "submitted_at", "updated_at"];
const ATTEMPT_FIELDS = [
  "id", "quiz_id", "student_id", "status", "grade_status", "percentage", "total_score", "max_score", "passed",
  "started_at", "end_time", "completed_at", "graded_at", "feedback", "attempt_number",
];
const LIVE = { [Op.in]: ["published", "completed"] };

/**
 * The rows the windows need, in a fixed number of queries: tasks due in the
 * last 14 days in the roster's subjects, plus tasks whose mark landed in the
 * last 60 days, and every submission/attempt of the roster on those tasks.
 */
export async function loadWork(now: Date, roster: RosterStudent[]) {
  const subjectIds = [...new Set(roster.flatMap((s) => s.subject_ids))];
  const localIds = [...new Set(roster.map((s) => s.local_user_id).filter((id): id is number => id != null))];
  if (!subjectIds.length) return { assignments: [], quizzes: [], submissions: [], attempts: [] };

  const dueWindow = { [Op.gt]: new Date(now.getTime() - DUE_WINDOW_DAYS * DAY), [Op.lte]: now };
  const marksFrom = new Date(now.getTime() - 2 * MARKS_WINDOW_DAYS * DAY);
  const inSubjects = { [Op.in]: subjectIds };

  const [dueAssignments, dueQuizzes, markedSubs, markedAttempts] = await Promise.all([
    Assignment.findAll({ where: { course_id: inSubjects, status: LIVE, due_date: dueWindow } as any, attributes: ASSIGNMENT_FIELDS, raw: true }),
    Quiz.findAll({ where: { course_id: inSubjects, status: LIVE, end_date: dueWindow } as any, attributes: QUIZ_FIELDS, raw: true }),
    localIds.length
      ? Submission.findAll({
          where: { student_id: { [Op.in]: localIds }, status: "graded", updated_at: { [Op.gt]: marksFrom } } as any,
          attributes: ["assignment_id"],
          group: ["assignment_id"],
          raw: true,
        })
      : [],
    localIds.length
      ? QuizSubmission.findAll({
          where: {
            student_id: { [Op.in]: localIds },
            status: { [Op.in]: ["completed", "timed_out"] },
            [Op.or]: [{ graded_at: { [Op.gt]: marksFrom } }, { completed_at: { [Op.gt]: marksFrom } }],
          } as any,
          attributes: ["quiz_id"],
          group: ["quiz_id"],
          raw: true,
        })
      : [],
  ]);

  const haveA = new Set((dueAssignments as any[]).map((a) => a.id));
  const haveQ = new Set((dueQuizzes as any[]).map((q) => q.id));
  const moreA = [...new Set((markedSubs as any[]).map((s) => s.assignment_id))].filter((id) => !haveA.has(id));
  const moreQ = [...new Set((markedAttempts as any[]).map((a) => a.quiz_id))].filter((id) => !haveQ.has(id));

  const [extraAssignments, extraQuizzes] = await Promise.all([
    moreA.length
      ? Assignment.findAll({ where: { id: { [Op.in]: moreA }, course_id: inSubjects, status: LIVE } as any, attributes: ASSIGNMENT_FIELDS, raw: true })
      : [],
    moreQ.length
      ? Quiz.findAll({ where: { id: { [Op.in]: moreQ }, course_id: inSubjects, status: LIVE } as any, attributes: QUIZ_FIELDS, raw: true })
      : [],
  ]);
  const assignments = [...(dueAssignments as any[]), ...(extraAssignments as any[])];
  const quizzes = [...(dueQuizzes as any[]), ...(extraQuizzes as any[])];

  const [submissions, attempts] = await Promise.all([
    localIds.length && assignments.length
      ? Submission.findAll({
          where: { student_id: { [Op.in]: localIds }, assignment_id: { [Op.in]: assignments.map((a) => a.id) } } as any,
          attributes: SUBMISSION_FIELDS,
          raw: true,
        })
      : [],
    localIds.length && quizzes.length
      ? QuizSubmission.findAll({
          where: { student_id: { [Op.in]: localIds }, quiz_id: { [Op.in]: quizzes.map((q) => q.id) } } as any,
          attributes: ATTEMPT_FIELDS,
          raw: true,
        })
      : [],
  ]);
  return { assignments, quizzes, submissions: submissions as any[], attempts: attempts as any[] };
}

// ── Last-success bookkeeping (tiny table, created on first use) ───────────

let ensured: Promise<void> | null = null;
const ensureJobTable = () => {
  if (!ensured) {
    ensured = sequelize
      .query(
        `CREATE TABLE IF NOT EXISTS scheduled_job_runs (
           job VARCHAR(64) NOT NULL PRIMARY KEY,
           last_success_at BIGINT NULL,
           last_run_at BIGINT NULL,
           last_summary VARCHAR(255) NULL
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      )
      .then(() => undefined)
      .catch((e) => {
        ensured = null;
        throw e;
      });
  }
  return ensured;
};

/** Epoch ms of the last successful push, or null (never / table unreadable). */
export async function getLastSuccess(job = JOB_NAME): Promise<number | null> {
  try {
    await ensureJobTable();
    const rows = await sequelize.query<{ last_success_at: string | number | null }>(
      "SELECT last_success_at FROM scheduled_job_runs WHERE job = ? LIMIT 1",
      { replacements: [job], type: QueryTypes.SELECT },
    );
    const v = rows[0]?.last_success_at;
    return v == null ? null : Number(v);
  } catch (err) {
    warn("could not read the last run", err);
    return null;
  }
}

async function recordRun(ok: boolean, at: number, summary: string, job = JOB_NAME): Promise<void> {
  try {
    await ensureJobTable();
    await sequelize.query(
      `INSERT INTO scheduled_job_runs (job, last_success_at, last_run_at, last_summary)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         last_success_at = IF(?, VALUES(last_success_at), last_success_at),
         last_run_at = VALUES(last_run_at),
         last_summary = VALUES(last_summary)`,
      { replacements: [job, ok ? at : null, at, summary.slice(0, 255), ok ? 1 : 0] },
    );
  } catch (err) {
    warn("could not record the run", err);
  }
}

/** Test hook. */
export async function clearJobRun(job = JOB_NAME) {
  await ensureJobTable();
  await sequelize.query("DELETE FROM scheduled_job_runs WHERE job = ?", { replacements: [job] });
}

// ── The push ─────────────────────────────────────────────────────────────

export interface PushSummary {
  ok: boolean;
  skipped?: string;
  roster: number;
  linked: number;
  sent: number;
  batches: number;
  failed_batches: number;
  missed_14d: number;
}

let running = false;

/** Build and send today's signals. Never throws; logs one line (counts only). */
export async function runEarlyWarningPush(now = new Date()): Promise<PushSummary> {
  const empty: PushSummary = { ok: false, roster: 0, linked: 0, sent: 0, batches: 0, failed_batches: 0, missed_14d: 0 };
  const off = earlyWarningDisabledReason();
  if (off) return { ...empty, skipped: off };
  if (running) return { ...empty, skipped: "already running" };
  running = true;
  try {
    const misRoster = await loadMisRoster(now);
    const roster = await linkLocalUsers(misRoster);
    const rows = await loadWork(now, roster);
    const signals = buildSignals(now, roster, rows);
    const summary: PushSummary = {
      ...empty,
      roster: roster.length,
      linked: roster.filter((s) => s.local_user_id != null).length,
      sent: signals.length,
      missed_14d: signals.reduce((n, s) => n + s.metrics.missed_14d, 0),
    };
    const asOf = kigaliDate(now);
    for (const batch of chunk(signals)) {
      summary.batches++;
      try {
        const res = await misServiceCall("PUT", "/early-warning/signals", { as_of: asOf, students: batch });
        if (res.status < 200 || res.status >= 300) {
          summary.failed_batches++;
          warn(`batch of ${batch.length} refused (HTTP ${res.status})${res.body?.message ? `: ${res.body.message}` : ""}`);
        }
      } catch (err) {
        summary.failed_batches++;
        warn(`batch of ${batch.length} failed`, err);
      }
    }
    summary.ok = summary.failed_batches === 0;
    const line =
      `as_of ${asOf}: roster ${summary.roster} (${summary.linked} with a Task Mentor account), ` +
      `sent ${summary.sent} in ${summary.batches} batch(es), ${summary.failed_batches} failed, ` +
      `${summary.missed_14d} missed task(s) in 14 days`;
    log(line);
    await recordRun(summary.ok, now.getTime(), line);
    return summary;
  } catch (err) {
    warn("push failed", err);
    await recordRun(false, now.getTime(), `failed: ${(err as any)?.message ?? err}`);
    return { ...empty, skipped: "error" };
  } finally {
    running = false;
  }
}

// ── Schedule ─────────────────────────────────────────────────────────────

/** "HH:MM" Africa/Kigali; default 18:45. */
export function parseRunAt(raw: string | undefined): { h: number; m: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec((raw || "").trim());
  if (match) {
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h < 24 && m < 60) return { h, m };
  }
  return { h: 18, m: 45 };
}

/** The next instant strictly after `now` that is HH:MM in Kigali. */
export function nextRunAt(now: Date, at = parseRunAt(process.env.EARLY_WARNING_PUSH_AT)): Date {
  const local = new Date(now.getTime() + KIGALI_OFFSET_MS);
  const target = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), at.h, at.m) - KIGALI_OFFSET_MS;
  return new Date(target > now.getTime() ? target : target + DAY);
}

let timers: NodeJS.Timeout[] = [];

/** Called once from server start. */
export function startEarlyWarningSchedule(): void {
  const off = earlyWarningDisabledReason();
  if (off) {
    log(`MIS early-warning push off (${off})`);
    return;
  }
  stopEarlyWarningSchedule();

  const boot = setTimeout(() => {
    void (async () => {
      const last = await getLastSuccess();
      if (last == null || Date.now() - last > STALE_AFTER_MS) await runEarlyWarningPush();
    })().catch((err) => warn("boot run failed", err));
  }, BOOT_DELAY_MS);
  boot.unref?.();

  const scheduleDaily = () => {
    const wait = Math.max(1000, nextRunAt(new Date()).getTime() - Date.now());
    const t = setTimeout(() => {
      void runEarlyWarningPush()
        .catch((err) => warn("daily run failed", err))
        .finally(scheduleDaily);
    }, wait);
    t.unref?.();
    timers = [boot, t];
  };
  timers = [boot];
  scheduleDaily();
}

export function stopEarlyWarningSchedule(): void {
  for (const t of timers) clearTimeout(t);
  timers = [];
}
