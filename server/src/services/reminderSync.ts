import { Op } from "sequelize";
import { Assignment, Quiz } from "../models";
import { clientBasicAuth } from "../access/misClient";
import { appUrl } from "../integration/homeSummary";

/**
 * Pushes quizzes and assignments into the NGA MIS Reminder Hub
 * (nga_central_mis Source API: PUT /reminders/sources[/batch],
 * DELETE /reminders/sources/taskmentor/:type/:externalId) so students get
 * reminders before a quiz opens, before it closes and before an assignment
 * is due. MIS resolves the audience (subject enrolment) and words the
 * reminder by source_type; we only send the title, instant and link.
 *
 * Everything here is fire-and-forget: a slow or down MIS must never block or
 * fail the teacher's request, so every public entry point swallows errors and
 * logs a warning. A 30-minute sweep re-sends everything due in the next 14
 * days as a backstop for pushes that were lost.
 */

export const SOURCE_APP = "taskmentor";
export type ReminderSourceType = "quiz_open" | "quiz_close" | "assignment_due";

export interface ReminderItem {
  source_app: typeof SOURCE_APP;
  source_type: ReminderSourceType;
  external_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  link: string;
  location: null;
  critical: boolean;
  audience_subject_id?: number;
  audience_user_ids?: number[];
}

export interface ReminderRef {
  source_type: ReminderSourceType;
  external_id: string;
}

/** What one quiz/assignment means for MIS right now: upsert these, cancel those. */
export interface ReminderPlan {
  send: ReminderItem[];
  cancel: ReminderRef[];
}

/** The fields the builders read (plain objects work, so tests need no DB). */
export interface QuizLike {
  id: number;
  title: string;
  status: string;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  course_id?: number | null;
}

export interface AssignmentLike {
  id: number;
  title: string;
  status: string;
  due_date?: Date | string | null;
  course_id?: number | null;
}

export const BATCH_SIZE = 200;
export const SWEEP_INTERVAL_MS = 30 * 60 * 1000;
export const SWEEP_FIRST_DELAY_MS = 30 * 1000;
export const SWEEP_HORIZON_DAYS = 14;
const TIMEOUT_MS = 10_000;
const MAX_TITLE = 191;

export const quizExternalId = (id: number, kind: "open" | "close") => `quiz-${id}-${kind}`;
export const assignmentExternalId = (id: number) => `assignment-${id}-due`;

const toDate = (v: Date | string | null | undefined): Date | null => {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Task Mentor course ids ARE MIS subject ids, and quizzes/assignments can't
 * be restricted to individual students, so the audience is always "every
 * active student enrolled in the subject". No course -> no audience.
 */
const subjectOf = (courseId: number | null | undefined): number | null => {
  const n = Number(courseId);
  return Number.isInteger(n) && n > 0 ? n : null;
};

function item(
  type: ReminderSourceType,
  externalId: string,
  title: string,
  at: Date,
  link: string,
  subjectId: number,
): ReminderItem {
  return {
    source_app: SOURCE_APP,
    source_type: type,
    external_id: externalId,
    title: (title || "").trim().slice(0, MAX_TITLE) || "Untitled",
    starts_at: at.toISOString(),
    ends_at: null,
    link,
    location: null,
    critical: type !== "quiz_open",
    audience_subject_id: subjectId,
  };
}

/**
 * quiz_open at start_date, quiz_close at end_date. Only a published quiz with
 * a subject is sent; a missing date, a draft/completed quiz or no subject
 * cancels that side. A time already past is left alone (neither sent nor
 * cancelled): MIS keeps what it already delivered.
 */
export function buildQuizPlan(quiz: QuizLike, now = new Date(), base = appUrl()): ReminderPlan {
  const plan: ReminderPlan = { send: [], cancel: [] };
  const subjectId = subjectOf(quiz.course_id);
  const live = quiz.status === "published" && subjectId !== null;
  // Students reach a quiz through the taking page (/quizzes/:id is teacher-only);
  // before it opens that page shows the "not open yet" state.
  const link = `${base}/quizzes/${quiz.id}/take`;
  const sides: Array<[ReminderSourceType, "open" | "close", Date | null]> = [
    ["quiz_open", "open", toDate(quiz.start_date)],
    ["quiz_close", "close", toDate(quiz.end_date)],
  ];
  for (const [type, kind, at] of sides) {
    const externalId = quizExternalId(quiz.id, kind);
    if (!live || !at) plan.cancel.push({ source_type: type, external_id: externalId });
    else if (at.getTime() > now.getTime())
      plan.send.push(item(type, externalId, quiz.title, at, link, subjectId!));
  }
  return plan;
}

/** assignment_due at due_date; same rules as quizzes ("published" only). */
export function buildAssignmentPlan(a: AssignmentLike, now = new Date(), base = appUrl()): ReminderPlan {
  const plan: ReminderPlan = { send: [], cancel: [] };
  const subjectId = subjectOf(a.course_id);
  const due = toDate(a.due_date);
  const externalId = assignmentExternalId(a.id);
  if (a.status !== "published" || subjectId === null || !due) {
    plan.cancel.push({ source_type: "assignment_due", external_id: externalId });
  } else if (due.getTime() > now.getTime()) {
    plan.send.push(item("assignment_due", externalId, a.title, due, `${base}/assignments/${a.id}`, subjectId));
  }
  return plan;
}

// ── Transport ────────────────────────────────────────────────────────────

export interface ReminderRequest {
  method: "PUT" | "DELETE";
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}
export interface ReminderResponse {
  status: number;
  body: any;
}
export type ReminderTransport = (req: ReminderRequest) => Promise<ReminderResponse>;

const fetchTransport: ReminderTransport = async (req) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
      signal: ctrl.signal,
    });
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      /* empty / non-JSON body */
    }
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
};

let transport: ReminderTransport = fetchTransport;
let transportInjected = false;

/** Tests swap the HTTP layer; pass null to restore fetch. */
export function setReminderTransport(t: ReminderTransport | null) {
  transport = t ?? fetchTransport;
  transportInjected = t !== null;
}

const misBase = (env: NodeJS.ProcessEnv) => (env.NGA_MIS_BASE_URL || "").replace(/\/+$/, "");

/**
 * Why syncing is off, or null when it's on. Off with REMINDERS_SYNC=false,
 * under NODE_ENV=test (unless a test injected a transport), or without the
 * MIS URL / SSO client credentials.
 */
export function reminderSyncDisabledReason(env: NodeJS.ProcessEnv = process.env): string | null {
  if ((env.REMINDERS_SYNC || "").trim().toLowerCase() === "false") return "REMINDERS_SYNC=false";
  if (env.NODE_ENV === "test" && !transportInjected) return "NODE_ENV=test";
  if (!misBase(env)) return "NGA_MIS_BASE_URL is not set";
  if (!clientBasicAuth(env)) return "SSO_CLIENT_ID/SSO_CLIENT_SECRET are not set";
  return null;
}

async function call(method: "PUT" | "DELETE", path: string, body?: unknown): Promise<ReminderResponse> {
  return transport({
    method,
    url: `${misBase(process.env)}${path}`,
    headers: {
      Authorization: clientBasicAuth(process.env)!,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body,
  });
}

const warn = (msg: string, err?: unknown) =>
  console.warn(`[reminders] ${msg}${err ? `: ${(err as any)?.message ?? err}` : ""}`);

/** PUT items in chunks of 200 via the batch endpoint. Returns how many MIS accepted. */
export async function sendItems(items: ReminderItem[]): Promise<number> {
  let accepted = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    try {
      const res = await call("PUT", "/reminders/sources/batch", { items: chunk });
      if (res.status < 200 || res.status >= 300) {
        warn(`batch of ${chunk.length} refused (HTTP ${res.status})${res.body?.message ? `: ${res.body.message}` : ""}`);
        continue;
      }
      const results: Array<{ external_id: string; ok: boolean; error?: string }> =
        res.body?.data?.results ?? [];
      for (const r of results) {
        if (r.ok) accepted++;
        else warn(`${r.external_id} rejected: ${r.error ?? "unknown error"}`);
      }
    } catch (err) {
      warn(`batch of ${chunk.length} failed`, err);
    }
  }
  return accepted;
}

/** DELETE each ref; 404 = MIS never had it, which is fine. */
export async function cancelItems(refs: ReminderRef[]): Promise<void> {
  for (const ref of refs) {
    try {
      const res = await call(
        "DELETE",
        `/reminders/sources/${SOURCE_APP}/${ref.source_type}/${encodeURIComponent(ref.external_id)}`,
      );
      if (res.status !== 404 && (res.status < 200 || res.status >= 300)) {
        warn(`cancel ${ref.external_id} refused (HTTP ${res.status})`);
      }
    } catch (err) {
      warn(`cancel ${ref.external_id} failed`, err);
    }
  }
}

async function applyPlan(plan: ReminderPlan) {
  if (plan.send.length) await sendItems(plan.send);
  if (plan.cancel.length) await cancelItems(plan.cancel);
}

const QUIZ_FIELDS = ["id", "title", "status", "start_date", "end_date", "course_id"];
const ASSIGNMENT_FIELDS = ["id", "title", "status", "due_date", "course_id"];

// ── Entry points for controllers (never throw) ───────────────────────────

/** Re-send (or cancel) a quiz's reminders from its current row. Deleted -> cancel. */
export async function syncQuiz(id: number): Promise<void> {
  if (reminderSyncDisabledReason()) return;
  try {
    const quiz = (await Quiz.findByPk(id, { attributes: QUIZ_FIELDS, raw: true })) as QuizLike | null;
    await applyPlan(quiz ? buildQuizPlan(quiz) : quizCancelPlan(id));
  } catch (err) {
    warn(`sync quiz ${id} failed`, err);
  }
}

export async function syncAssignment(id: number): Promise<void> {
  if (reminderSyncDisabledReason()) return;
  try {
    const a = (await Assignment.findByPk(id, { attributes: ASSIGNMENT_FIELDS, raw: true })) as AssignmentLike | null;
    await applyPlan(a ? buildAssignmentPlan(a) : assignmentCancelPlan(id));
  } catch (err) {
    warn(`sync assignment ${id} failed`, err);
  }
}

const quizCancelPlan = (id: number): ReminderPlan => ({
  send: [],
  cancel: [
    { source_type: "quiz_open", external_id: quizExternalId(id, "open") },
    { source_type: "quiz_close", external_id: quizExternalId(id, "close") },
  ],
});
const assignmentCancelPlan = (id: number): ReminderPlan => ({
  send: [],
  cancel: [{ source_type: "assignment_due", external_id: assignmentExternalId(id) }],
});

export async function cancelQuiz(id: number): Promise<void> {
  if (reminderSyncDisabledReason()) return;
  try {
    await applyPlan(quizCancelPlan(id));
  } catch (err) {
    warn(`cancel quiz ${id} failed`, err);
  }
}

export async function cancelAssignment(id: number): Promise<void> {
  if (reminderSyncDisabledReason()) return;
  try {
    await applyPlan(assignmentCancelPlan(id));
  } catch (err) {
    warn(`cancel assignment ${id} failed`, err);
  }
}

// ── Sweep backstop ───────────────────────────────────────────────────────

/**
 * Re-send every published quiz/assignment whose open/close/due time falls in
 * the next 14 days. Upserts only: cancellations ride on the controller hooks.
 * Returns how many items were sent.
 */
export async function sweepReminders(now = new Date()): Promise<number> {
  if (reminderSyncDisabledReason()) return 0;
  const until = new Date(now.getTime() + SWEEP_HORIZON_DAYS * 86_400_000);
  const window = { [Op.gt]: now, [Op.lte]: until };
  try {
    const [quizzes, assignments] = await Promise.all([
      Quiz.findAll({
        attributes: QUIZ_FIELDS,
        where: { status: "published", [Op.or]: [{ start_date: window }, { end_date: window }] },
        raw: true,
      }) as Promise<unknown> as Promise<QuizLike[]>,
      Assignment.findAll({
        attributes: ASSIGNMENT_FIELDS,
        where: { status: "published", due_date: window },
        raw: true,
      }) as Promise<unknown> as Promise<AssignmentLike[]>,
    ]);
    const items = [
      ...quizzes.flatMap((q) => buildQuizPlan(q, now).send),
      ...assignments.flatMap((a) => buildAssignmentPlan(a, now).send),
    ];
    if (!items.length) return 0;
    const accepted = await sendItems(items);
    console.log(`[reminders] sweep sent ${items.length} item(s), ${accepted} accepted`);
    return items.length;
  } catch (err) {
    warn("sweep failed", err);
    return 0;
  }
}

let sweepTimers: NodeJS.Timeout[] = [];

/** Called once from server start: first sweep ~30 s after boot, then every 30 min. */
export function startReminderSweep(): void {
  const off = reminderSyncDisabledReason();
  if (off) {
    console.log(`[reminders] MIS reminder sync off (${off})`);
    return;
  }
  stopReminderSweep();
  const run = () => void sweepReminders();
  const first = setTimeout(run, SWEEP_FIRST_DELAY_MS);
  const every = setInterval(run, SWEEP_INTERVAL_MS);
  first.unref?.();
  every.unref?.();
  sweepTimers = [first, every];
}

export function stopReminderSweep(): void {
  for (const t of sweepTimers) clearTimeout(t);
  sweepTimers = [];
}
