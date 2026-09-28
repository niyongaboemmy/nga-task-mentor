import type { QuestionType, DifficultyLevel } from "../../../types/quiz.types";
import type {
  AIPlanItem,
  AISourceItem,
  AISourceKind,
} from "../../../services/aiQuestionGenerationApi";

// Pure state helpers for the AI Question Generator — no React, so they are
// unit-tested directly (see tests/aiGeneratorModel.test.ts).

export const QUESTION_TYPES: { value: QuestionType; label: string; complex?: boolean }[] = [
  { value: "single_choice", label: "Single Choice" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "true_false", label: "True / False" },
  { value: "fill_blank", label: "Fill in the Blank" },
  { value: "matching", label: "Matching" },
  { value: "numerical", label: "Numerical" },
  { value: "short_answer", label: "Short Answer" },
  { value: "ordering", label: "Ordering" },
  { value: "dropdown", label: "Dropdown" },
  { value: "coding", label: "Coding", complex: true },
  { value: "algorithmic", label: "Algorithmic", complex: true },
  { value: "drag_drop", label: "Drag & Drop", complex: true },
  { value: "logical_expression", label: "Logical Expression", complex: true },
];

export const typeLabel = (t: string) =>
  QUESTION_TYPES.find((q) => q.value === t)?.label ?? t.replace(/_/g, " ");

export const DIFFICULTIES: {
  value: DifficultyLevel;
  label: string;
  hint: string;
  dot: string;
  chip: string;
}[] = [
  {
    value: "EASY",
    label: "Easy",
    hint: "Bloom's L1–L2 · remember, understand",
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-300 dark:border-emerald-800",
  },
  {
    value: "MEDIUM",
    label: "Medium",
    hint: "Bloom's L3–L4 · apply, analyse",
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/25 dark:text-amber-300 dark:border-amber-800",
  },
  {
    value: "DIFFICULT",
    label: "Difficult",
    hint: "Bloom's L4–L6 · analyse, evaluate, create",
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/25 dark:text-rose-300 dark:border-rose-800",
  },
];

// Keep in sync with server/src/services/ai/bloomsAlignment.ts.
export const BLOOM_LEVELS: { order: number; name: string; short: string; chip: string }[] = [
  { order: 1, name: "Remembering", short: "Remember", chip: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/25 dark:text-sky-300 dark:border-sky-800" },
  { order: 2, name: "Understanding", short: "Understand", chip: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/25 dark:text-sky-300 dark:border-sky-800" },
  { order: 3, name: "Applying", short: "Apply", chip: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/25 dark:text-blue-300 dark:border-blue-800" },
  { order: 4, name: "Analyzing", short: "Analyse", chip: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/25 dark:text-blue-300 dark:border-blue-800" },
  { order: 5, name: "Evaluating", short: "Evaluate", chip: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/25 dark:text-indigo-300 dark:border-indigo-800" },
  { order: 6, name: "Creating", short: "Create", chip: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/25 dark:text-indigo-300 dark:border-indigo-800" },
];

/** Bloom's levels that fit each difficulty (same bands the server enforces). */
export const DIFFICULTY_BLOOM_BANDS: Record<DifficultyLevel, number[]> = {
  EASY: [1, 2],
  MEDIUM: [3, 4],
  DIFFICULT: [4, 5, 6],
};

export const isBloomAligned = (level: number | null | undefined, difficulty: DifficultyLevel) =>
  !!level && DIFFICULTY_BLOOM_BANDS[difficulty].includes(level);

/** Nearest level inside the difficulty's band (used when the teacher changes difficulty). */
export function nearestBloomInBand(level: number | null | undefined, difficulty: DifficultyLevel): number {
  const band = DIFFICULTY_BLOOM_BANDS[difficulty];
  if (!level) return band[0];
  return band.reduce((best, b) => (Math.abs(b - level) < Math.abs(best - level) ? b : best), band[0]);
}

export type Mix = Record<DifficultyLevel, number>;
export const EMPTY_MIX: Mix = { EASY: 0, MEDIUM: 0, DIFFICULT: 0 };
export const mixTotal = (m: Mix) => m.EASY + m.MEDIUM + m.DIFFICULT;

/** Per cell (type × difficulty) and per run — keeps a run to a few minutes. */
export const MAX_PER_CELL = 10;
export const MAX_TOTAL = 60;
/** Questions per request (server allows 12). Small batches answer faster and rarely get truncated. */
export const BATCH_SIZE = 5;

export const MIX_PRESETS: { id: string; label: string; description: string; mix: Mix }[] = [
  { id: "quick", label: "Quick check", description: "2 easy per type", mix: { EASY: 2, MEDIUM: 0, DIFFICULT: 0 } },
  { id: "balanced", label: "Balanced", description: "1 of each level", mix: { EASY: 1, MEDIUM: 1, DIFFICULT: 1 } },
  { id: "practice", label: "Practice", description: "2 easy · 2 medium", mix: { EASY: 2, MEDIUM: 2, DIFFICULT: 0 } },
  { id: "exam", label: "Exam-ready", description: "1 · 2 · 1", mix: { EASY: 1, MEDIUM: 2, DIFFICULT: 1 } },
  { id: "challenge", label: "Challenge", description: "1 medium · 2 difficult", mix: { EASY: 0, MEDIUM: 1, DIFFICULT: 2 } },
];

export const clampCell = (n: number) =>
  Math.max(0, Math.min(MAX_PER_CELL, Math.round(Number.isFinite(n) ? n : 0)));

/**
 * The plan sent to the server. In "uniform" mode every selected type gets the
 * same mix; in "custom" mode each type has its own row (falling back to the
 * uniform mix for a type that has no row yet). Rows adding up to 0 are dropped.
 */
export function buildPlan(
  types: QuestionType[],
  mode: "uniform" | "custom",
  uniform: Mix,
  perType: Partial<Record<QuestionType, Mix>>,
): AIPlanItem[] {
  return types
    .map((t) => {
      const m = mode === "custom" ? perType[t] ?? uniform : uniform;
      return { question_type: t, EASY: clampCell(m.EASY), MEDIUM: clampCell(m.MEDIUM), DIFFICULT: clampCell(m.DIFFICULT) };
    })
    .filter((p) => p.EASY + p.MEDIUM + p.DIFFICULT > 0);
}

export const planTotal = (plan: AIPlanItem[]) =>
  plan.reduce((n, p) => n + p.EASY + p.MEDIUM + p.DIFFICULT, 0);

export function planByDifficulty(plan: AIPlanItem[]): Mix {
  return plan.reduce(
    (m, p) => ({ EASY: m.EASY + p.EASY, MEDIUM: m.MEDIUM + p.MEDIUM, DIFFICULT: m.DIFFICULT + p.DIFFICULT }),
    { ...EMPTY_MIX },
  );
}

/**
 * Split a plan into requests of at most `size` questions, keeping a type's
 * questions together where possible so each prompt stays focused.
 */
export function splitIntoBatches(plan: AIPlanItem[], size = BATCH_SIZE): AIPlanItem[][] {
  const batches: AIPlanItem[][] = [];
  let current: AIPlanItem[] = [];
  let room = size;
  const push = () => {
    if (current.length) batches.push(current);
    current = [];
    room = size;
  };
  const add = (type: QuestionType, level: DifficultyLevel, n: number) => {
    let row = current.find((r) => r.question_type === type);
    if (!row) {
      row = { question_type: type, EASY: 0, MEDIUM: 0, DIFFICULT: 0 };
      current.push(row);
    }
    row[level] += n;
    room -= n;
  };

  for (const p of plan) {
    // A type that won't fit in what's left of this batch starts a fresh one.
    const total = p.EASY + p.MEDIUM + p.DIFFICULT;
    if (total <= size && total > room) push();
    for (const level of ["EASY", "MEDIUM", "DIFFICULT"] as DifficultyLevel[]) {
      let left = p[level];
      while (left > 0) {
        if (room === 0) push();
        const n = Math.min(left, room);
        add(p.question_type, level, n);
        left -= n;
      }
    }
  }
  push();
  return batches;
}

/** Rough wall-clock guess for the progress screen: ~5 s per question, 8 s per request. */
export const estimateSeconds = (total: number, batches: number) =>
  Math.round(total * 5 + batches * 8);

export function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}

// ---------------------------------------------------------------- sources

export const sourceKey = (s: { kind: string; id: string }) => `${s.kind}:${s.id}`;

export const KIND_LABELS: Record<AISourceKind, string> = {
  competency: "Learning outcome",
  sow_entry: "Scheme of work",
  lesson_plan: "Lesson plan",
  lesson_note: "Lesson note",
  material: "Material",
  elearning_item: "E-learning",
};

/** MIS week_number is free text: "7", "1-2" or already "Week 7". */
export function weekLabel(week?: string | null) {
  const w = String(week ?? "").trim();
  if (!w) return "";
  return /^week\b/i.test(w) ? w.replace(/^week\s*/i, "Week ") : `Week ${w}`;
}

/** "3" < "10" < "1-2"-style ranges sort by their first number; unknown weeks last. */
export function weekSortValue(week?: string | null) {
  const m = String(week ?? "").match(/\d+/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
}

export function groupByWeek(items: AISourceItem[]) {
  const map = new Map<string, AISourceItem[]>();
  for (const it of items) {
    const k = it.week ? String(it.week) : "";
    map.set(k, [...(map.get(k) || []), it]);
  }
  return [...map]
    .sort(([a], [b]) => weekSortValue(a) - weekSortValue(b))
    .map(([week, items]) => ({ week, items }));
}

export function matchesQuery(item: AISourceItem, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [item.title, item.subtitle, item.week ? `week ${item.week}` : "", ...(item.meta || [])]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

/**
 * When everything selected comes from one scheme-of-work topic (the entry
 * itself and/or its lesson plans), saved questions can be linked to it.
 */
export function linkedSchemeEntry(selected: AISourceItem[], allEntries: AISourceItem[]) {
  const entryIds = new Set<string>();
  for (const s of selected) {
    if (s.kind === "sow_entry") entryIds.add(s.id);
    else if (s.kind === "lesson_plan") entryIds.add(s.id.split(":")[0]);
    else if (s.kind !== "competency") return null;
  }
  if (entryIds.size !== 1) return null;
  const [id] = [...entryIds];
  const entry = allEntries.find((e) => e.kind === "sow_entry" && e.id === id);
  return entry ? { id: Number(id), title: entry.title } : null;
}

// ---------------------------------------------------------------- prompts

export interface PromptSuggestion {
  id: string;
  category: "Focus" | "Level" | "Style" | "Quality";
  label: string;
  text: string;
}

const BASE_SUGGESTIONS: PromptSuggestion[] = [
  { id: "real-world", category: "Style", label: "Real-world scenarios", text: "Frame questions around realistic workplace or everyday scenarios rather than definitions." },
  { id: "misconceptions", category: "Quality", label: "Target misconceptions", text: "Use common learner misconceptions as the wrong options (distractors)." },
  { id: "plausible", category: "Quality", label: "Plausible distractors", text: "Make every wrong option plausible, similar in length and style to the correct one; avoid 'all of the above'." },
  { id: "simple-english", category: "Level", label: "Simple English", text: "Use clear, simple English suitable for learners whose first language is not English; avoid idioms." },
  { id: "secondary", category: "Level", label: "TVET / secondary level", text: "Pitch the questions at TVET secondary-school level (RQF level 3–5)." },
  { id: "key-terms", category: "Focus", label: "Key terminology", text: "Make sure the key terms and definitions of the material are covered." },
  { id: "application", category: "Focus", label: "Emphasise application", text: "Prefer questions where learners apply a concept to a new situation over pure recall." },
  { id: "explain", category: "Quality", label: "Teaching explanations", text: "Write explanations that teach: say why the right answer is right and why the most tempting wrong option is wrong." },
  { id: "no-negatives", category: "Style", label: "No trick wording", text: "Avoid negatively worded stems (e.g. 'Which is NOT…') and trick questions." },
  { id: "rwanda", category: "Style", label: "Local context", text: "Where examples are needed, use contexts familiar to learners in Rwanda." },
];

/** Suggestions that react to what's been chosen, followed by the general ones. */
export function suggestPrompts(ctx: {
  sourceTitles: string[];
  weeks: string[];
  types: QuestionType[];
  hasDifficult: boolean;
  origin: "document" | "resources";
}): PromptSuggestion[] {
  const out: PromptSuggestion[] = [];
  const weeks = [...new Set(ctx.weeks.filter(Boolean))].sort((a, b) => weekSortValue(a) - weekSortValue(b));
  if (weeks.length === 1) {
    const w = weekLabel(weeks[0]);
    out.push({ id: "week-focus", category: "Focus", label: `Only ${w.toLowerCase()}`, text: `Only ask about what is taught in ${w.toLowerCase()}.` });
  } else if (weeks.length > 1) {
    out.push({ id: "spread-weeks", category: "Focus", label: `Spread across ${weeks.length} weeks`, text: `Spread the questions evenly across ${weeks.map((w) => weekLabel(w).toLowerCase()).join(", ")}.` });
  }
  if (ctx.sourceTitles.length === 1) {
    const t = ctx.sourceTitles[0].slice(0, 60);
    out.push({ id: "title-focus", category: "Focus", label: `Focus on “${t.length > 28 ? `${t.slice(0, 27)}…` : t}”`, text: `Focus on the core ideas of “${t}”.` });
  }
  if (ctx.origin === "document") {
    out.push({ id: "chapter", category: "Focus", label: "Specific chapter", text: "Focus only on Chapter __ of the document." });
  }
  if (ctx.hasDifficult) {
    out.push({ id: "multi-step", category: "Level", label: "Multi-step reasoning", text: "Difficult questions should need two or more reasoning steps, not just harder vocabulary." });
  }
  if (ctx.types.some((t) => t === "coding" || t === "algorithmic")) {
    out.push({ id: "python", category: "Style", label: "Use Python", text: "Coding questions should use Python with short, beginner-friendly starter code." });
  }
  if (ctx.types.includes("numerical")) {
    out.push({ id: "units", category: "Quality", label: "Units & tolerance", text: "Numerical questions must state units and use a sensible tolerance." });
  }
  if (ctx.types.includes("short_answer")) {
    out.push({ id: "rubric", category: "Quality", label: "Clear marking keywords", text: "For short answers, give 3–5 precise marking keywords and a model answer of two sentences." });
  }
  return [...out, ...BASE_SUGGESTIONS];
}

/** Toggle a suggestion's sentence in/out of the instructions text. */
export function toggleSuggestion(current: string, text: string): string {
  if (current.includes(text)) {
    return current.replace(text, "").replace(/\s{2,}/g, " ").replace(/^\s+|\s+$/g, "");
  }
  return current.trim() ? `${current.trim()} ${text}` : text;
}
