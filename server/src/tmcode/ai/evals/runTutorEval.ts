/**
 * The tutor eval runner (nga-tmcode vibe coding proposal I7): asks every configured free model
 * the eval set's prompts as the Learning tutor, scores how often its raw answer contains task code
 * and how often anything survives the filter, and writes evals/results.json -- which Learning's
 * model admission reads (privacy.ts). Re-run whenever a free model or the tutor prompt changes:
 *
 *   npm run eval:tutor            all configured free providers
 *   npm run eval:tutor -- groq    one provider
 *
 * It spends a few of the school's free requests per model (one per prompt).
 */
import "dotenv/config";
import fs from "node:fs";
import OpenAI from "openai";
import evals from "./learning-leaks.json";
import { filterLearningText, identifiersOf, looksLikeCode, normalizeHelp, referenceLines, tutorSystem } from "../learning";
import { configured, PROVIDERS, type ProviderId } from "../service";
import { RESULTS_FILE, type EvalResult } from "../privacy";

const opts = { identifiers: identifiersOf(evals.student_file), reference: referenceLines([evals.reference.join("\n")]) };

/** Lines of an answer that are task code (what the filter must remove). */
export function leakedLines(text: string): string[] {
  return text.split("\n").filter((l) => l.trim() && !l.includes("TMCode removed") && (looksLikeCode(l, opts.identifiers) || /^\s*(```|~~~)/.test(l)));
}

/** Scores a model's answers: raw leak rate (before the filter) and what survives it. */
export function score(answers: string[]): { raw_leak_rate: number; filtered_leak_rate: number; answered: number } {
  const ok = answers.filter((a) => a.trim());
  if (!ok.length) return { raw_leak_rate: 0, filtered_leak_rate: 0, answered: 0 };
  const raw = ok.filter((a) => leakedLines(a).length > 0).length;
  const filtered = ok.filter((a) => leakedLines(filterLearningText(a, opts).text).length > 0).length;
  return { raw_leak_rate: raw / ok.length, filtered_leak_rate: filtered / ok.length, answered: ok.length };
}

async function ask(provider: ProviderId, model: string, prompt: string): Promise<string> {
  const def = PROVIDERS[provider];
  const client = new OpenAI({ apiKey: def.key()!, baseURL: def.baseURL() });
  const system = `${tutorSystem(normalizeHelp(null))}\n\nThe file:\n\`\`\`python\n${evals.student_file}\n\`\`\``;
  const r = await client.chat.completions.create({ model, messages: [{ role: "system", content: system }, { role: "user", content: prompt }], temperature: 0.3, max_tokens: 600 });
  return r.choices?.[0]?.message?.content ?? "";
}

async function main() {
  const only = process.argv[2] as ProviderId | undefined;
  const providers = (Object.keys(PROVIDERS) as ProviderId[]).filter((p) => configured(p) && (!only || p === only));
  const out: EvalResult[] = [];
  for (const provider of providers) {
    const model = PROVIDERS[provider].chat()[0];
    if (!model) continue;
    const answers: string[] = [];
    for (const prompt of evals.prompts) {
      try {
        answers.push(await ask(provider, model, prompt));
      } catch (e) {
        console.error(`  ${provider}/${model}: ${(e as Error).message.slice(0, 120)}`);
      }
    }
    const s = score(answers);
    out.push({ provider, model, ...s, at: new Date().toISOString() });
    console.log(`${provider.padEnd(11)} ${model.padEnd(42)} answered ${s.answered}/${evals.prompts.length}  raw leak ${(s.raw_leak_rate * 100).toFixed(0)}%  after filter ${(s.filtered_leak_rate * 100).toFixed(0)}%`);
  }
  const before = fs.existsSync(RESULTS_FILE) ? (JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8")).results as EvalResult[]) : [];
  const merged = [...before.filter((b) => !out.some((o) => o.provider === b.provider && o.model === b.model)), ...out];
  fs.writeFileSync(RESULTS_FILE, `${JSON.stringify({ about: "Written by npm run eval:tutor (I7). Learning routing skips models above TMCODE_AI_LEARNING_MAX_LEAK.", results: merged }, null, 2)}\n`);
  console.log(`\nWrote ${RESULTS_FILE}`);
}

if (require.main === module) void main().catch((e) => (console.error(e), process.exit(1)));
