import fs from "node:fs";
import path from "node:path";

/**
 * Privacy tiers and model admission for TMCode AI (nga-tmcode reports/TMCode vibe coding
 * proposal 2026.md J4, I7; the 11 Oct "AI era features" report on provider terms).
 *
 * Every provider is tagged with what its published terms say: whether prompts may be used for
 * training, zero data retention, the minimum user age, where it processes. Two school decisions
 * read them:
 *
 * - TMCODE_AI_STUDENT_ROUTING (proposal D1): "all" (the owner's standing decision: students may use
 *   every provider) or "permitted" (Learning and Guided student traffic only reaches providers whose
 *   terms allow teenagers and don't train on prompts). Staff are never filtered.
 * - Model admission (I7): `npm run eval:tutor` measures each model's code-leak rate on the school's
 *   prompt set and writes evals/results.json; Learning never routes to a model whose raw leak rate
 *   is above TMCODE_AI_LEARNING_MAX_LEAK (default 0.6 -- the server filter still cuts what leaks;
 *   admission keeps the worst models from wasting a student's question).
 *
 * The tags are a summary of terms read on 11 Oct / 1 Nov 2026; check them before relying on them.
 */

export interface PrivacyTag {
  /** Prompts aren't used to train models (by default, for this kind of account). */
  noTraining: boolean;
  /** Zero data retention is available/applies. */
  zdr: boolean;
  /** The minimum user age in the provider's terms. */
  minAge: 13 | 16 | 18;
  /** Where prompts are processed. */
  region: string;
  /** One line for the badge on each answer. */
  label: string;
}

/** Free school providers (TMCode AI's Free/Auto) and the paid ones (premium, own keys). */
export const PRIVACY: Record<string, PrivacyTag> = {
  openrouter: { noTraining: false, zdr: false, minAge: 18, region: "US (routes to many hosts)", label: "Free · terms 18+ · may train" },
  gemini: { noTraining: false, zdr: false, minAge: 18, region: "US", label: "Free tier · terms 18+ · may train, human review" },
  groq: { noTraining: true, zdr: false, minAge: 18, region: "US", label: "Free tier · terms 18+ · no training" },
  glm: { noTraining: false, zdr: false, minAge: 18, region: "CN", label: "Free · terms 18+ · China" },
  deepseek: { noTraining: false, zdr: false, minAge: 18, region: "CN", label: "Terms 18+ (guardian consent) · China" },
  // Paid APIs: no training on API data by default.
  openai: { noTraining: true, zdr: false, minAge: 13, region: "US", label: "Paid API · no training · 13+ with consent" },
  anthropic: { noTraining: true, zdr: false, minAge: 13, region: "US", label: "Paid API · no training · minors with safeguards" },
  "gemini-paid": { noTraining: true, zdr: false, minAge: 18, region: "US", label: "Paid API · no training · terms 18+" },
  local: { noTraining: true, zdr: true, minAge: 13, region: "this computer", label: "On this computer · nothing leaves it" },
};

export function privacyOf(provider: string, tier: "free" | "premium" | "byok" = "free"): PrivacyTag | null {
  if (provider === "gemini" && tier !== "free") return PRIVACY["gemini-paid"];
  return PRIVACY[provider] ?? null;
}

export type StudentRouting = "all" | "permitted";

export function studentRouting(): StudentRouting {
  return (process.env.TMCODE_AI_STUDENT_ROUTING ?? "").trim().toLowerCase() === "permitted" ? "permitted" : "all";
}

/** May a student's Learning/Guided request reach this provider under the school's routing? */
export function permittedForStudents(provider: string, tier: "free" | "premium" | "byok" = "free"): boolean {
  if (studentRouting() === "all") return true;
  const t = privacyOf(provider, tier);
  return !!t && t.noTraining && t.minAge <= 16;
}

// ── model admission (I7) ──

export interface EvalResult {
  provider: string;
  model: string;
  /** Share of answers with task code BEFORE the filter (how hard the model pushes code). */
  raw_leak_rate: number;
  /** Share of answers with task code AFTER the filter (should be 0). */
  filtered_leak_rate: number;
  answered: number;
  at: string;
}

let results: EvalResult[] | null = null;

export const RESULTS_FILE = path.join(__dirname, "evals", "results.json");

export function evalResults(file = RESULTS_FILE): EvalResult[] {
  if (results) return results;
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8")) as { results?: EvalResult[] };
    results = Array.isArray(j.results) ? j.results : [];
  } catch {
    results = [];
  }
  return results;
}

/** Tests and the runner: forget the cached results. */
export function resetEvalResults(next: EvalResult[] | null = null) {
  results = next;
}

const maxLeak = () => {
  const n = Number(process.env.TMCODE_AI_LEARNING_MAX_LEAK);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.6;
};

/** Is this model admitted to Learning? Unmeasured models are (the filter still applies). */
export function admittedToLearning(provider: string, model: string): boolean {
  const r = evalResults().find((x) => x.provider === provider && x.model === model);
  return !r || r.raw_leak_rate <= maxLeak();
}
