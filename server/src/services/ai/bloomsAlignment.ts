import BloomsTaxonomyLevel from "../../models/BloomsTaxonomyLevel.model";
import type { AIDifficulty } from "./types";

/**
 * Bloom's taxonomy for AI-generated questions: what each level means (fed to
 * the prompt), which levels fit each difficulty, and how an AI answer is
 * turned into a real blooms_taxonomy_levels row.
 *
 * Levels are matched by level_order (1 = Remembering … 6 = Creating), not by
 * name or id, so a school that renamed a level still lines up.
 */

export interface BloomLevelGuide {
  order: number;
  name: string;
  meaning: string;
  verbs: string;
  looksLike: string;
}

export const BLOOM_GUIDE: BloomLevelGuide[] = [
  { order: 1, name: "Remembering", meaning: "recall facts, terms and basic concepts exactly as taught", verbs: "define, list, name, identify, recall, state", looksLike: "Which tag creates a hyperlink?" },
  { order: 2, name: "Understanding", meaning: "explain ideas in own words, classify, compare, give examples", verbs: "explain, describe, classify, summarise, interpret", looksLike: "Why does a browser need DNS before sending an HTTP request?" },
  { order: 3, name: "Applying", meaning: "use knowledge or a procedure in a concrete, familiar situation", verbs: "apply, use, calculate, solve, demonstrate, implement", looksLike: "Which CSS rule centres this 300px box inside its parent?" },
  { order: 4, name: "Analyzing", meaning: "break information into parts, find causes, relationships or errors", verbs: "analyse, compare, differentiate, debug, organise, infer", looksLike: "The page renders unstyled on mobile only. Which line of this stylesheet causes it?" },
  { order: 5, name: "Evaluating", meaning: "judge, justify or critique against criteria; choose the best option and defend it", verbs: "evaluate, justify, assess, critique, recommend, prioritise", looksLike: "Which of these two layouts better meets accessibility guidelines, and why?" },
  { order: 6, name: "Creating", meaning: "combine ideas into a new plan, design or product", verbs: "design, construct, formulate, compose, propose, develop", looksLike: "Design the component structure for a responsive product card." },
];

/** Levels that genuinely fit each difficulty. The first entry is the default. */
export const DIFFICULTY_BLOOM_BANDS: Record<AIDifficulty, number[]> = {
  EASY: [1, 2],
  MEDIUM: [3, 4],
  DIFFICULT: [4, 5, 6],
};

export function bloomPromptSection(): string {
  const levels = BLOOM_GUIDE.map(
    (l) => `- L${l.order} ${l.name}: ${l.meaning}. Verbs: ${l.verbs}. e.g. "${l.looksLike}"`,
  ).join("\n");
  const band = (d: AIDifficulty) => DIFFICULTY_BLOOM_BANDS[d].map((n) => `L${n}`).join("–");
  return `BLOOM'S TAXONOMY (classify every question):
${levels}

Each question must genuinely require the thinking of its Bloom level — write the question for the level, don't just label it.
Allowed levels per difficulty:
- EASY → ${band("EASY")}
- MEDIUM → ${band("MEDIUM")}
- DIFFICULT → ${band("DIFFICULT")}
Set "blooms_level" to the level number (1-6) that the question actually demands. Recognising a fact is L1 even if the topic is advanced; a scenario the learner must diagnose is L4 even if the facts are simple.`;
}

/** Accepts 3, "3", "L3", "Applying", "apply"… → 1-6, or null. */
export function parseBloomLevel(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return raw >= 1 && raw <= 6 ? Math.round(raw) : null;
  const s = String(raw).trim().toLowerCase();
  const n = s.match(/[1-6]/);
  if (n && /^(l|level)?\s*[1-6]\b/.test(s)) return Number(n[0]);
  const stems = ["remember", "understand", "appl", "analy", "evaluat", "creat"];
  const idx = stems.findIndex((stem) => s.includes(stem));
  return idx >= 0 ? idx + 1 : null;
}

/**
 * Keep the AI's level when it fits the difficulty; otherwise take the nearest
 * level inside the band (an "EASY" question tagged L5 is almost always a
 * labelling slip, not a real evaluation question).
 */
export function alignBloomLevel(
  level: number | null,
  difficulty: AIDifficulty,
): { level: number; adjusted: boolean } {
  const band = DIFFICULTY_BLOOM_BANDS[difficulty] ?? DIFFICULTY_BLOOM_BANDS.MEDIUM;
  if (level !== null && band.includes(level)) return { level, adjusted: false };
  if (level === null) return { level: band[0], adjusted: true };
  const nearest = band.reduce((best, b) => (Math.abs(b - level) < Math.abs(best - level) ? b : best), band[0]);
  return { level: nearest, adjusted: true };
}

export interface BloomLevelRow {
  id: number;
  name: string;
  level_order: number;
}

let cache: { at: number; rows: BloomLevelRow[] } | null = null;
const CACHE_MS = 5 * 60 * 1000;

/** The school's Bloom levels, one per level_order (lowest id wins), cached briefly. */
export async function loadBloomLevels(): Promise<BloomLevelRow[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const rows = (await BloomsTaxonomyLevel.findAll({
    attributes: ["id", "name", "level_order"],
    order: [
      ["level_order", "ASC"],
      ["id", "ASC"],
    ],
    raw: true,
  })) as unknown as BloomLevelRow[];
  const byOrder = new Map<number, BloomLevelRow>();
  for (const r of rows) if (!byOrder.has(r.level_order)) byOrder.set(r.level_order, r);
  const out = [...byOrder.values()];
  cache = { at: Date.now(), rows: out };
  return out;
}

export function clearBloomCacheForTests() {
  cache = null;
}
