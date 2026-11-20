import { AppSetting } from "../models";
import { tk } from "../tenancy/keys";
import type { ComponentWeights } from "./reportCardGrader.service";

/**
 * How much each kind of work weighs inside a report card category, e.g.
 * FA (formative) = class work 30, homework 20, quizzes 20, midterm 30. Kept
 * in this tenant's app_settings ("report_card.component_weights"):
 *
 *   default   the school's weights, per category
 *   subjects  a subject's own weights, per category (override the default)
 *
 * A category with no weights anywhere averages its assessments equally, as
 * before. Weights are relative: grading scales them over the kinds of work
 * that have marks.
 */

export const COMPONENT_KEYS = ["quiz", "assignment", "class_work", "group_work", "homework", "midterm", "participation", "ca_end_of_term", "manual"] as const;
export type ComponentKey = (typeof COMPONENT_KEYS)[number];
export const COMPONENT_LABEL: Record<ComponentKey, string> = {
  quiz: "Quizzes",
  assignment: "Assignments",
  class_work: "Class work",
  group_work: "Group work",
  homework: "Homework",
  midterm: "Midterm",
  participation: "Participation",
  ca_end_of_term: "End-of-term exam",
  manual: "Other marks",
};
const CATEGORY_KEYS = ["CW", "HW", "MD", "EOT", "FA", "CA", "IA"];

export interface ComponentWeightsConfig {
  default: ComponentWeights;
  subjects: Record<string, ComponentWeights>;
}

const KEY = "report_card.component_weights";
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; config: ComponentWeightsConfig }>();

/** Valid weights for some categories (unknown categories/kinds dropped), or an error message. */
export function normalizeWeights(raw: unknown): ComponentWeights | string {
  if (raw == null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return "Weights must be given per category.";
  const out: ComponentWeights = {};
  for (const [cat, comps] of Object.entries(raw as Record<string, unknown>)) {
    if (!CATEGORY_KEYS.includes(cat)) continue;
    if (comps == null) continue;
    if (typeof comps !== "object" || Array.isArray(comps)) return `Weights for ${cat} must be given per kind of work.`;
    const row: Record<string, number> = {};
    for (const [k, v] of Object.entries(comps as Record<string, unknown>)) {
      if (!(COMPONENT_KEYS as readonly string[]).includes(k)) continue;
      if (v === "" || v == null) continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 100) return `${COMPONENT_LABEL[k as ComponentKey]} in ${cat}: a weight is between 0 and 100.`;
      row[k] = Math.round(n * 100) / 100;
    }
    if (Object.values(row).some((n) => n > 0)) out[cat] = row;
  }
  return out;
}

async function read(): Promise<ComponentWeightsConfig> {
  let row: any = null;
  try {
    row = await AppSetting.findByPk(KEY);
  } catch {
    row = null;
  }
  let parsed: any = null;
  try {
    parsed = row?.value ? JSON.parse(row.value) : null;
  } catch {
    parsed = null;
  }
  const def = normalizeWeights(parsed?.default);
  const subjects: Record<string, ComponentWeights> = {};
  for (const [id, w] of Object.entries((parsed?.subjects ?? {}) as Record<string, unknown>)) {
    const n = normalizeWeights(w);
    if (typeof n !== "string" && Object.keys(n).length && /^\d+$/.test(id)) subjects[id] = n;
  }
  return { default: typeof def === "string" ? {} : def, subjects };
}

/** This tenant's component weights (cached 60 s). */
export async function getComponentWeights(): Promise<ComponentWeightsConfig> {
  const k = tk("component-weights");
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.config;
  const config = await read();
  cache.set(k, { at: Date.now(), config });
  return config;
}

async function write(config: ComponentWeightsConfig, by: number | null) {
  await AppSetting.upsert({ key: KEY, value: JSON.stringify(config), updated_by: by, updated_at: new Date() } as any);
  cache.delete(tk("component-weights"));
}

/** A subject's effective weights per category: its own, else the school's. */
export function weightsFor(config: ComponentWeightsConfig, subjectId: number): ComponentWeights {
  const own = config.subjects[String(subjectId)] ?? {};
  const cats = new Set([...Object.keys(config.default), ...Object.keys(own)]);
  const out: ComponentWeights = {};
  for (const c of cats) out[c] = own[c] ?? config.default[c];
  return out;
}

export async function setDefaultComponentWeights(raw: unknown, by: number | null): Promise<ComponentWeightsConfig> {
  const w = normalizeWeights(raw);
  if (typeof w === "string") throw Object.assign(new Error(w), { status: 400 });
  const config = await read();
  const next = { ...config, default: w };
  await write(next, by);
  return next;
}

/** Sets (or, with null / empty, clears) one category's weights for a subject. */
export async function setSubjectComponentWeights(subjectId: number, category: string, raw: unknown, by: number | null): Promise<ComponentWeightsConfig> {
  if (!CATEGORY_KEYS.includes(category)) throw Object.assign(new Error(`Unknown category ${category}.`), { status: 400 });
  const w = normalizeWeights(raw == null ? null : { [category]: raw });
  if (typeof w === "string") throw Object.assign(new Error(w), { status: 400 });
  const config = await read();
  const own = { ...(config.subjects[String(subjectId)] ?? {}) };
  if (w[category]) own[category] = w[category];
  else delete own[category];
  const subjects = { ...config.subjects };
  if (Object.keys(own).length) subjects[String(subjectId)] = own;
  else delete subjects[String(subjectId)];
  const next = { ...config, subjects };
  await write(next, by);
  return next;
}

/** Tests only. */
export function clearComponentWeightsCache() {
  cache.clear();
}
