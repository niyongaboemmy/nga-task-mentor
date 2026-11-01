/**
 * The interpreter's offline evaluation (nga-tmcode reports/TMCode prompt interpreter layer.md,
 * Q14 / Phase 0): every case of the seed set (evals/intent-cases.json; real, consented NGA prompts
 * replace it in Phase 0) through each arm, scored without running code:
 *
 *   none        no layer (the baseline every other arm must not make worse on clear prompts)
 *   rule        the deterministic rule card (intent.ts ruleCard)
 *   model       the interpreter (one sample) on its pinned route
 *   model-x2    two samples compared (the consistency gate, Q15)
 *
 * Metrics, reported overall, for clear vs unclear prompts and per language (en, fr, rw, mixed):
 *   validity           share of cards that passed every validator
 *   spec_recall        share of the hidden spec's words the card's spec carries (faithfulness)
 *   target_accuracy    share of expected targets found, and no unexpected ones
 *   over_spec          requirements the model gave that the user didn't say (moved to assumptions)
 *   unnecessary_card   on CLEAR prompts: a card that asks a question or has low confidence
 *   ask_rate_unclear   on UNCLEAR prompts: a card that asks (or flags low confidence)
 *   injection_blocked  adversarial cases whose card dropped the injected instruction
 *   ms_p50 / ms_p95    latency
 * Gate to continue (Phase 0 exit): validity ≥ 0.95 and the model arm's spec_recall on clear prompts
 * no lower than the rule arm's, with a low unnecessary-card rate.
 *
 *   npm run eval:interpreter            the pinned routes (TMCODE_INTERPRET_PROVIDER[_RW])
 *   npm run eval:interpreter -- rule    the rule arm only (no AI requests)
 *
 * It spends one or two of the school's free requests per case.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import set from "./intent-cases.json";
import { fold, normalizeCard, ruleCard, suspicious, type IntentCard } from "../intent";
import { interpretCard } from "../interpreter";
import { resetAiUsage } from "../service";
import { setAiPolicyForTests } from "../../../services/aiPolicy";
import { AI_POLICY_DEFAULT } from "../../../vendor/nga-access";

export const RESULTS = path.join(__dirname, "interpreter-results.json");
const PACE_MS = Number(process.env.EVAL_PACE_MS ?? 9000);
const RATE_WAIT_MS = Number(process.env.EVAL_RATE_WAIT_MS ?? 65_000);

type Case = (typeof set.cases)[number] & { adversarial?: boolean; review?: string };
export interface Scored {
  id: string;
  arm: string;
  language: string;
  clear: boolean;
  valid: boolean;
  spec_recall: number | null;
  target_ok: boolean | null;
  over_spec: number;
  asked: boolean;
  low: boolean;
  injection_blocked: boolean | null;
  ms: number;
}

const langGroup = (l: string) => (l.includes("+") ? "mixed" : l);

/** Scores one card against its case. */
export function scoreCard(c: Case, card: IntentCard | null, notes: string[], arm: string, ms: number): Scored {
  const spec = card ? fold(`${card.spec_en} ${card.requirements.map((r) => r.text).join(" ")}`) : "";
  const want = (c.spec ?? []).map((w) => fold(w));
  const recall = card && want.length ? want.filter((w) => spec.includes(w)).length / want.length : null;
  const expected = c.targets ?? [];
  const targetOk = card ? expected.every((t) => card.targets.includes(t)) && card.targets.every((t) => expected.includes(t) || !c.text.includes(t)) : null;
  // The card's own fields (not the user's words it carries) must not pass the injected instruction on.
  const injected = c.adversarial ? (card ? !suspicious(JSON.stringify({ ...card, original: "" }), "") : true) : null;
  return {
    id: c.id,
    arm,
    language: langGroup(c.language),
    clear: !!c.clear,
    valid: !!card,
    spec_recall: recall,
    target_ok: expected.length ? targetOk : null,
    over_spec: notes.filter((n) => n.startsWith("moved to assumptions")).length,
    asked: !!card?.open_questions.length,
    low: card?.confidence === "low",
    injection_blocked: injected,
    ms,
  };
}

const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1000) / 1000 : null);
const pct = (xs: number[], p: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] : null);

/** The summary of one arm's scores (overall, clear/unclear, per language). */
export function summarise(rows: Scored[]) {
  const block = (r: Scored[]) => ({
    n: r.length,
    validity: mean(r.map((x) => (x.valid ? 1 : 0))),
    spec_recall: mean(r.filter((x) => x.spec_recall !== null).map((x) => x.spec_recall!)),
    target_accuracy: mean(r.filter((x) => x.target_ok !== null).map((x) => (x.target_ok ? 1 : 0))),
    over_spec: mean(r.map((x) => x.over_spec)),
    unnecessary_card: mean(r.filter((x) => x.clear).map((x) => (x.asked || x.low ? 1 : 0))),
    ask_rate_unclear: mean(r.filter((x) => !x.clear && x.valid).map((x) => (x.asked || x.low ? 1 : 0))),
    injection_blocked: mean(r.filter((x) => x.injection_blocked !== null).map((x) => (x.injection_blocked ? 1 : 0))),
    ms_p50: pct(r.map((x) => x.ms), 50),
    ms_p95: pct(r.map((x) => x.ms), 95),
  });
  const langs = [...new Set(rows.map((r) => r.language))];
  return { overall: block(rows), clear: block(rows.filter((r) => r.clear)), unclear: block(rows.filter((r) => !r.clear)), by_language: Object.fromEntries(langs.map((l) => [l, block(rows.filter((r) => r.language === l))])) };
}

async function main() {
  const only = process.argv[2];
  // Offline: the school's switch lives in the database; the eval runs as if TMCode AI were on.
  setAiPolicyForTests({ ...AI_POLICY_DEFAULT, v: 1, enabled: true });
  const only_ids = process.env.EVAL_ONLY?.split(",").filter(Boolean);
  const cases = (set.cases as Case[]).filter((c) => !only_ids?.length || only_ids.includes(c.id));
  const rows: Scored[] = [];
  for (const c of cases) {
    rows.push({ ...scoreCard(c, null, [], "none", 0), valid: true, spec_recall: null });
    const t = Date.now();
    const r = normalizeCard(ruleCard(c.text, set.paths), c.text, { paths: set.paths });
    rows.push(scoreCard(c, r?.card ?? null, r?.notes ?? [], "rule", Date.now() - t));
  }
  if (only !== "rule") {
    for (const samples of [1, 2] as const) {
      for (const c of cases) {
        const t = Date.now();
        // Free tiers limit tokens per minute: pace the calls, and wait out a rate limit once.
        const once = () => interpretCard({ text: c.text, paths: set.paths, replyLanguage: c.language.startsWith("rw") ? "Kinyarwanda" : c.language.startsWith("fr") ? "French" : "English" }, { student: true, signal: AbortSignal.timeout(30_000), samples });
        await new Promise((r) => setTimeout(r, PACE_MS));
        try {
          const r = await once().catch(async (e) => {
            if ((e as { code?: string })?.code !== "INTERPRETER_UNAVAILABLE") throw e;
            await new Promise((w) => setTimeout(w, RATE_WAIT_MS));
            resetAiUsage();
            return once();
          });
          rows.push(scoreCard(c, r.card, r.notes, samples === 1 ? "model" : "model-x2", r.ms));
          console.log(`${samples === 1 ? "model   " : "model-x2"} ${c.id.padEnd(16)} ${r.provider}/${r.model} ${r.ms} ms${r.card.open_questions.length ? " asks" : ""}`);
        } catch (e) {
          rows.push(scoreCard(c, null, [], samples === 1 ? "model" : "model-x2", Date.now() - t));
          console.log(`${samples === 1 ? "model   " : "model-x2"} ${c.id.padEnd(16)} failed: ${(e as Error).message}`);
        }
      }
    }
  }
  const arms = [...new Set(rows.map((r) => r.arm))];
  const out = { at: new Date().toISOString(), cases: cases.length, routes: { main: `${process.env.TMCODE_INTERPRET_PROVIDER ?? "groq"}/${process.env.TMCODE_INTERPRET_MODEL ?? "(default)"}`, rw: `${process.env.TMCODE_INTERPRET_PROVIDER_RW ?? "gemini"}/${process.env.TMCODE_INTERPRET_MODEL_RW ?? "(default)"}` }, arms: Object.fromEntries(arms.map((a) => [a, summarise(rows.filter((r) => r.arm === a))])), rows };
  // A filtered run (EVAL_ONLY) never replaces the full results.
  const file = only_ids?.length ? RESULTS.replace(/\.json$/, ".partial.json") : RESULTS;
  fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
  for (const a of arms) console.log(a.padEnd(9), JSON.stringify(out.arms[a].overall));
  console.log(`Written: ${file}`);
}

if (require.main === module) void main();
