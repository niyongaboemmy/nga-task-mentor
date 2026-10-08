import { QueryTypes } from "sequelize";
import { sequelize } from "../config/database";
import { clientBasicAuth } from "../access/misClient";
import { isMisTransportInjected, misBase, misServiceCall } from "./reminderSync";
import { gradePercentage } from "../utils/studentStanding";
import { QuizSubmission, Submission } from "../models";

/**
 * Learning outcomes on quizzes and assignments, and the evidence they feed
 * (competency map, MIS services/competencyMap.ts).
 *
 * A teacher tags a task with performance criteria from the subject's MIS
 * curriculum (GET /competency/curriculum/:subjectId, read with this app's SSO
 * client credentials). Each tagged task's graded results go to MIS as
 * PUT /competency/evidence: the task's whole result set every time, which MIS
 * uses to replace that task's evidence, so regrades and untagging are reflected.
 *
 * Results: a quiz counts each student's best graded attempt (graded or
 * auto_graded, as the student dashboard does); an assignment counts graded
 * submissions ("score/max"). Students are sent by MIS user id; accounts not
 * linked to MIS are skipped.
 *
 * When: a few seconds after tags change or a submission of a tagged task is
 * saved (model hooks, see registerCompetencyHooks), and a full resend of every
 * tagged task 3 minutes after boot and every 6 hours, which also covers bulk
 * updates the hooks don't see. Off with COMPETENCY_PUSH=0/false or without the
 * MIS URL / client credentials. Never throws from the background paths.
 */

export type TaskType = "quiz" | "assignment";
export interface TaskKey {
  type: TaskType;
  id: number;
}
export interface CriterionTag {
  criteria_id: number;
  competency_id: number;
  element_number: number;
  outcome_title: string;
  criteria_number: string;
  description: string;
}
export interface Outcome {
  competency_id: number;
  element_number: number;
  title: string;
  criteria: { criteria_id: number; criteria_number: string; description: string }[];
}

export class CompetencyError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const log = (msg: string) => console.log(`[competency] ${msg}`);
const warn = (msg: string, err?: unknown) => console.warn(`[competency] ${msg}${err ? `: ${(err as any)?.message ?? err}` : ""}`);

export function competencyPushDisabledReason(env: NodeJS.ProcessEnv = process.env): string | null {
  const flag = (env.COMPETENCY_PUSH || "").trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return `COMPETENCY_PUSH=${env.COMPETENCY_PUSH}`;
  if (env.NODE_ENV === "test" && !isMisTransportInjected()) return "NODE_ENV=test";
  if (!misBase(env)) return "NGA_MIS_BASE_URL is not set";
  if (!clientBasicAuth(env)) return "SSO_CLIENT_ID/SSO_CLIENT_SECRET are not set";
  return null;
}

// ── Curriculum (from MIS) ────────────────────────────────────────────────

const CURRICULUM_TTL_MS = 5 * 60 * 1000;
const curriculumCache = new Map<number, { at: number; outcomes: Outcome[] }>();
export const clearCurriculumCache = () => curriculumCache.clear();

export async function curriculum(subjectId: number): Promise<Outcome[]> {
  const hit = curriculumCache.get(subjectId);
  if (hit && Date.now() - hit.at < CURRICULUM_TTL_MS) return hit.outcomes;
  if (!misBase(process.env) || !clientBasicAuth(process.env)) throw new CompetencyError("MIS isn't connected, so learning outcomes can't be loaded", 503);
  let res;
  try {
    res = await misServiceCall("GET", `/competency/curriculum/${subjectId}`);
  } catch (e) {
    throw new CompetencyError("Couldn't reach MIS for the learning outcomes. Try again.", 502);
  }
  if (res.status !== 200 || !Array.isArray(res.body?.data?.outcomes)) throw new CompetencyError("MIS didn't return the learning outcomes. Try again.", 502);
  const outcomes: Outcome[] = res.body.data.outcomes;
  curriculumCache.set(subjectId, { at: Date.now(), outcomes });
  return outcomes;
}

// ── Tags ─────────────────────────────────────────────────────────────────

export async function getTaskCriteria(key: TaskKey): Promise<CriterionTag[]> {
  const rows = await sequelize.query<any>(
    `SELECT criteria_id, competency_id, element_number, outcome_title, criteria_number, description
     FROM task_criteria WHERE task_type = :type AND task_id = :id ORDER BY element_number, competency_id, id`,
    { replacements: { type: key.type, id: key.id }, type: QueryTypes.SELECT },
  );
  return rows.map((r) => ({ ...r, criteria_id: Number(r.criteria_id), competency_id: Number(r.competency_id), element_number: Number(r.element_number) }));
}

/** Replaces a task's tags with the given criteria (validated against the subject's curriculum). */
export async function setTaskCriteria(key: TaskKey, subjectId: number, criteriaIds: number[], userId: number | null): Promise<CriterionTag[]> {
  const wanted = new Set(criteriaIds.map((x) => Math.trunc(Number(x))).filter((x) => x > 0));
  const tags: CriterionTag[] = [];
  if (wanted.size) {
    for (const o of await curriculum(subjectId)) {
      for (const c of o.criteria) {
        if (wanted.has(c.criteria_id)) {
          tags.push({ criteria_id: c.criteria_id, competency_id: o.competency_id, element_number: o.element_number, outcome_title: o.title.slice(0, 255), criteria_number: c.criteria_number, description: c.description });
        }
      }
    }
    if (tags.length !== wanted.size) throw new CompetencyError("Some of those criteria aren't in this subject's curriculum. Reload and try again.");
  }
  await sequelize.transaction(async (transaction) => {
    await sequelize.query("DELETE FROM task_criteria WHERE task_type = :type AND task_id = :id", { replacements: { type: key.type, id: key.id }, transaction });
    for (const t of tags) {
      await sequelize.query(
        `INSERT INTO task_criteria (task_type, task_id, subject_id, criteria_id, competency_id, element_number, outcome_title, criteria_number, description, created_by, created_at)
         VALUES (:type, :id, :subjectId, :criteria_id, :competency_id, :element_number, :outcome_title, :criteria_number, :description, :userId, NOW())`,
        { replacements: { type: key.type, id: key.id, subjectId, userId, ...t }, transaction },
      );
    }
  });
  forgetTaggedCache();
  queueCompetencyPush(key);
  return getTaskCriteria(key);
}

// ── Results → evidence ───────────────────────────────────────────────────

export interface EvidenceTask {
  source_type: TaskType;
  source_ref: number;
  subject_id: number;
  title: string;
  criteria_ids: number[];
  results: { student_id: number; score_pct: number; assessed_at: string }[];
}

const iso = (v: unknown) => {
  const d = v instanceof Date ? v : new Date(String(v ?? ""));
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

/** The body MIS gets for one task, or null when the task no longer exists. */
export async function buildEvidenceTask(key: TaskKey): Promise<EvidenceTask | null> {
  const criteria = (await sequelize.query<any>("SELECT criteria_id FROM task_criteria WHERE task_type = :type AND task_id = :id", { replacements: { type: key.type, id: key.id }, type: QueryTypes.SELECT })).map((r) => Number(r.criteria_id));
  const best = new Map<number, { pct: number; at: string }>();
  let task: any;
  if (key.type === "quiz") {
    [task] = await sequelize.query<any>("SELECT id, title, course_id FROM quizzes WHERE id = :id", { replacements: { id: key.id }, type: QueryTypes.SELECT });
    if (!task) return null;
    const subs = await sequelize.query<any>(
      `SELECT u.mis_user_id AS mis, s.percentage AS pct, COALESCE(s.graded_at, s.completed_at, s.updated_at) AS at
       FROM quiz_submissions s JOIN users u ON u.id = s.student_id
       WHERE s.quiz_id = :id AND s.status = 'completed' AND s.grade_status IN ('graded', 'auto_graded') AND u.mis_user_id IS NOT NULL`,
      { replacements: { id: key.id }, type: QueryTypes.SELECT },
    );
    for (const s of subs) {
      const pct = Number(s.pct);
      if (!Number.isFinite(pct)) continue;
      const prev = best.get(Number(s.mis));
      if (!prev || pct > prev.pct) best.set(Number(s.mis), { pct, at: iso(s.at) });
    }
  } else {
    [task] = await sequelize.query<any>("SELECT id, title, course_id, max_score FROM assignments WHERE id = :id", { replacements: { id: key.id }, type: QueryTypes.SELECT });
    if (!task) return null;
    const subs = await sequelize.query<any>(
      `SELECT u.mis_user_id AS mis, s.grade, COALESCE(s.updated_at, s.submitted_at) AS at
       FROM submissions s JOIN users u ON u.id = s.student_id
       WHERE s.assignment_id = :id AND s.status = 'graded' AND u.mis_user_id IS NOT NULL`,
      { replacements: { id: key.id }, type: QueryTypes.SELECT },
    );
    for (const s of subs) {
      const pct = gradePercentage(s.grade, task.max_score);
      if (pct === null) continue;
      const prev = best.get(Number(s.mis));
      if (!prev || pct > prev.pct) best.set(Number(s.mis), { pct, at: iso(s.at) });
    }
  }
  return {
    source_type: key.type,
    source_ref: key.id,
    subject_id: Number(task.course_id) || 0,
    title: String(task.title || `${key.type} ${key.id}`),
    criteria_ids: criteria,
    results: [...best].map(([student_id, b]) => ({ student_id, score_pct: Math.round(b.pct * 100) / 100, assessed_at: b.at })),
  };
}

/** Sends these tasks to MIS (20 per call). Tasks without a subject are skipped. Returns how many MIS stored. */
export async function pushTasks(keys: TaskKey[]): Promise<{ sent: number; failed: number }> {
  const tasks: EvidenceTask[] = [];
  for (const k of keys) {
    const t = await buildEvidenceTask(k);
    if (t && t.subject_id > 0) tasks.push(t);
  }
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < tasks.length; i += 20) {
    const batch = tasks.slice(i, i + 20);
    try {
      const res = await misServiceCall("PUT", "/competency/evidence", { tasks: batch });
      if (res.status === 200) sent += batch.length;
      else {
        failed += batch.length;
        warn(`MIS refused ${batch.length} task(s): HTTP ${res.status} ${res.body?.message ?? ""}`);
      }
    } catch (e) {
      failed += batch.length;
      warn(`couldn't send ${batch.length} task(s)`, e);
    }
  }
  return { sent, failed };
}

/** Every task that has (or had, this boot) tags. */
export async function taggedTasks(): Promise<TaskKey[]> {
  const rows = await sequelize.query<any>("SELECT DISTINCT task_type, task_id FROM task_criteria", { type: QueryTypes.SELECT });
  return rows.map((r) => ({ type: r.task_type as TaskType, id: Number(r.task_id) }));
}

// ── Background ───────────────────────────────────────────────────────────

const DEBOUNCE_MS = 3000;
const pending = new Map<string, TaskKey>();
let timer: NodeJS.Timeout | null = null;

/** Push this task soon (coalesced). Cheap no-op when pushing is off. */
export function queueCompetencyPush(key: TaskKey) {
  if (competencyPushDisabledReason()) return;
  pending.set(`${key.type}:${key.id}`, key);
  if (timer) return;
  timer = setTimeout(() => void flushCompetencyQueue(), DEBOUNCE_MS);
  timer.unref?.();
}

export async function flushCompetencyQueue() {
  if (timer) clearTimeout(timer);
  timer = null;
  const keys = [...pending.values()];
  pending.clear();
  if (!keys.length) return { sent: 0, failed: 0 };
  // Only tasks that are tagged now, or were just untagged (then MIS clears them).
  try {
    return await pushTasks(keys);
  } catch (e) {
    warn("push failed", e);
    return { sent: 0, failed: keys.length };
  }
}

/** Submissions of tagged tasks are pushed when they change. */
const taggedIds = { quiz: new Set<number>(), assignment: new Set<number>(), loadedAt: 0 };
async function isTagged(key: TaskKey) {
  if (Date.now() - taggedIds.loadedAt > 60_000) {
    taggedIds.quiz.clear();
    taggedIds.assignment.clear();
    for (const t of await taggedTasks()) taggedIds[t.type].add(t.id);
    taggedIds.loadedAt = Date.now();
  }
  return taggedIds[key.type].has(key.id);
}
export const forgetTaggedCache = () => (taggedIds.loadedAt = 0);

export function onSubmissionSaved(type: TaskType, taskId: unknown) {
  const id = Math.trunc(Number(taskId));
  if (!id || competencyPushDisabledReason()) return;
  void isTagged({ type, id })
    .then((yes) => yes && queueCompetencyPush({ type, id }))
    .catch((e) => warn("tag lookup failed", e));
}

let hooked = false;
/** Pushes a tagged task when one of its submissions is saved (create or update). */
export function registerCompetencyHooks() {
  if (hooked) return;
  hooked = true;
  QuizSubmission.addHook("afterSave", "competencyEvidence", (row: any) => onSubmissionSaved("quiz", row?.quiz_id));
  Submission.addHook("afterSave", "competencyEvidence", (row: any) => onSubmissionSaved("assignment", row?.assignment_id));
}

const SWEEP_EVERY_MS = 6 * 60 * 60 * 1000;
const BOOT_DELAY_MS = 3 * 60 * 1000;
export function startCompetencyPush() {
  const why = competencyPushDisabledReason();
  if (why) return log(`push off (${why})`);
  registerCompetencyHooks();
  const sweep = async () => {
    try {
      const keys = await taggedTasks();
      if (!keys.length) return;
      const r = await pushTasks(keys);
      log(`resent ${r.sent} tagged task(s)${r.failed ? `, ${r.failed} failed` : ""}`);
    } catch (e) {
      warn("sweep failed", e);
    }
  };
  setTimeout(() => void sweep(), BOOT_DELAY_MS).unref?.();
  setInterval(() => void sweep(), SWEEP_EVERY_MS).unref?.();
}
