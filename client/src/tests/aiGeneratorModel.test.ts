import { describe, it, expect, vi } from "vitest";
import {
  BATCH_SIZE,
  buildPlan,
  groupByWeek,
  linkedSchemeEntry,
  planByDifficulty,
  planTotal,
  splitIntoBatches,
  suggestPrompts,
  toggleSuggestion,
  weekLabel,
} from "../components/QuestionBank/ai/aiGeneratorModel";
import { runGeneration, type BatchState } from "../components/QuestionBank/ai/runGeneration";
import { checkFile } from "../components/QuestionBank/ai/documentFile";
import type { AIPlanItem, AISourceItem } from "../services/aiQuestionGenerationApi";

const mix = (EASY: number, MEDIUM: number, DIFFICULT: number) => ({ EASY, MEDIUM, DIFFICULT });

describe("buildPlan", () => {
  it("applies one mix to every type in uniform mode and drops empty rows", () => {
    expect(buildPlan(["single_choice", "true_false"], "uniform", mix(2, 1, 0), {})).toEqual([
      { question_type: "single_choice", EASY: 2, MEDIUM: 1, DIFFICULT: 0 },
      { question_type: "true_false", EASY: 2, MEDIUM: 1, DIFFICULT: 0 },
    ]);
    expect(buildPlan(["single_choice"], "uniform", mix(0, 0, 0), {})).toEqual([]);
  });

  it("uses per-type rows in custom mode, falling back to the uniform mix", () => {
    const plan = buildPlan(["single_choice", "numerical", "matching"], "custom", mix(1, 0, 0), {
      numerical: mix(0, 2, 3),
      matching: mix(0, 0, 0),
    });
    expect(plan).toEqual([
      { question_type: "single_choice", EASY: 1, MEDIUM: 0, DIFFICULT: 0 },
      { question_type: "numerical", EASY: 0, MEDIUM: 2, DIFFICULT: 3 },
    ]);
    expect(planTotal(plan)).toBe(6);
    expect(planByDifficulty(plan)).toEqual(mix(1, 2, 3));
  });

  it("clamps cells to 0..10", () => {
    const [row] = buildPlan(["single_choice"], "uniform", mix(-3, 40, 2.6), {});
    expect(row).toMatchObject({ EASY: 0, MEDIUM: 10, DIFFICULT: 3 });
  });
});

describe("splitIntoBatches", () => {
  const sum = (bs: AIPlanItem[][]) => bs.reduce((n, b) => n + planTotal(b), 0);

  it("keeps a small plan in one request", () => {
    const plan = buildPlan(["single_choice", "true_false"], "uniform", mix(1, 1, 0), {});
    expect(planTotal(plan)).toBeLessThanOrEqual(BATCH_SIZE);
    expect(splitIntoBatches(plan)).toEqual([plan]);
  });

  it("never exceeds the batch size and never loses a question", () => {
    const plan = buildPlan(
      ["single_choice", "multiple_choice", "true_false", "numerical"],
      "custom",
      mix(0, 0, 0),
      { single_choice: mix(5, 4, 3), multiple_choice: mix(1, 2, 0), true_false: mix(3, 0, 0), numerical: mix(0, 0, 7) },
    );
    const batches = splitIntoBatches(plan);
    expect(sum(batches)).toBe(planTotal(plan));
    for (const b of batches) {
      expect(planTotal(b)).toBeLessThanOrEqual(BATCH_SIZE);
      expect(new Set(b.map((r) => r.question_type)).size).toBe(b.length); // one row per type
    }
    // Per type × difficulty totals survive the split.
    const back: Record<string, number> = {};
    for (const b of batches) for (const r of b) for (const d of ["EASY", "MEDIUM", "DIFFICULT"] as const) {
      back[`${r.question_type}:${d}`] = (back[`${r.question_type}:${d}`] || 0) + r[d];
    }
    expect(back["single_choice:EASY"]).toBe(5);
    expect(back["numerical:DIFFICULT"]).toBe(7);
  });

  it("starts a fresh batch rather than splitting a type that fits on its own", () => {
    const plan = buildPlan(["single_choice", "true_false"], "uniform", mix(3, 2, 0), {});
    expect(splitIntoBatches(plan, 8).map((b) => b.map((r) => r.question_type))).toEqual([["single_choice"], ["true_false"]]);
  });
});

describe("sources", () => {
  const item = (kind: AISourceItem["kind"], id: string, week?: string, title = `${kind} ${id}`): AISourceItem => ({
    kind,
    id,
    title,
    week,
    supported: true,
  });

  it("orders weeks numerically with unknown weeks last", () => {
    const g = groupByWeek([item("sow_entry", "1", "10"), item("sow_entry", "2"), item("sow_entry", "3", "2"), item("sow_entry", "4", "1-2")]);
    expect(g.map((x) => x.week)).toEqual(["1-2", "2", "10", ""]);
  });

  it("links to a scheme entry only when everything points at one topic", () => {
    const entries = [item("sow_entry", "5", "3", "HTTP basics"), item("sow_entry", "6", "4")];
    expect(linkedSchemeEntry([entries[0], item("lesson_plan", "5:9"), item("competency", "1")], entries)).toEqual({ id: 5, title: "HTTP basics" });
    expect(linkedSchemeEntry([entries[0], entries[1]], entries)).toBeNull();
    expect(linkedSchemeEntry([entries[0], item("material", "3")], entries)).toBeNull();
    expect(linkedSchemeEntry([item("competency", "1")], entries)).toBeNull();
  });

  it("checks uploads", () => {
    expect(checkFile(new File(["x"], "a.txt", { type: "text/plain" }))).toMatch(/Only PDF and DOCX/);
    expect(checkFile(new File(["x"], "a.pdf", { type: "application/pdf" }))).toBeNull();
    expect(checkFile(new File([], "a.docx"))).toMatch(/empty/);
  });
});

describe("prompts", () => {
  it("offers context-aware suggestions first", () => {
    const s = suggestPrompts({ origin: "resources", sourceTitles: ["HTTP basics"], weeks: ["3", "3"], types: ["numerical", "coding"], hasDifficult: true });
    const ids = s.map((x) => x.id);
    expect(ids.slice(0, 5)).toEqual(["week-focus", "title-focus", "multi-step", "python", "units"]);
    expect(ids).toContain("misconceptions");
    const spread = suggestPrompts({ origin: "resources", sourceTitles: [], weeks: ["10", "2"], types: [], hasDifficult: false });
    expect(spread[0].text).toBe("Spread the questions evenly across week 2, week 10.");
  });

  it("never doubles the word Week (MIS week_number can already contain it)", () => {
    expect(weekLabel("7")).toBe("Week 7");
    expect(weekLabel("Week 7")).toBe("Week 7");
    expect(weekLabel("week   1-2")).toBe("Week 1-2");
    expect(weekLabel("")).toBe("");
    const s = suggestPrompts({ origin: "resources", sourceTitles: [], weeks: ["Week 7"], types: [], hasDifficult: false });
    expect(s[0]).toMatchObject({ label: "Only week 7", text: "Only ask about what is taught in week 7." });
  });

  it("toggles a suggestion in and out of the instructions", () => {
    const t = "Use simple English.";
    const once = toggleSuggestion("Focus on HTTP.", t);
    expect(once).toBe("Focus on HTTP. Use simple English.");
    expect(toggleSuggestion(once, t)).toBe("Focus on HTTP.");
    expect(toggleSuggestion("", t)).toBe(t);
  });
});

describe("runGeneration", () => {
  const plan = (n: number): AIPlanItem[] => [{ question_type: "true_false", EASY: n, MEDIUM: 0, DIFFICULT: 0 }];
  const ok = (texts: string[], provider = "gemini", fell_back = false) => ({
    data: texts.map((t) => ({ question_type: "true_false" as const, question_text: t, question_data: {}, difficulty_level: "EASY" as const })),
    meta: { requested: texts.length, returned: texts.length, skipped: [], provider_used: provider, provider_requested: null, fell_back, duration_ms: 1, context_id: "c" },
  });
  const httpErr = (status: number, message = "boom") => Object.assign(new Error(message), { response: { status, data: { message } } });

  it("runs every batch, passing earlier questions on so they aren't repeated", async () => {
    const generate = vi.fn().mockResolvedValueOnce(ok(["A", "B"])).mockResolvedValueOnce(ok(["C"], "groq", true));
    const got: string[] = [];
    const res = await runGeneration(
      { batches: [plan(2), plan(1)], contextId: "c1", signal: new AbortController().signal, generate, reprepare: vi.fn() },
      { onBatch: () => {}, onQuestions: (qs) => got.push(...qs.map((q) => q.question_text)) },
    );
    expect(got).toEqual(["A", "B", "C"]);
    expect(generate.mock.calls[1][0].avoid_questions).toEqual(["A", "B"]);
    expect(res.states.map((s) => s.status)).toEqual(["done", "done"]);
    expect(res.states[1]).toMatchObject({ provider: "groq", fellBack: true });
  });

  it("re-prepares once when the server forgot the context", async () => {
    const generate = vi.fn().mockRejectedValueOnce(httpErr(410)).mockResolvedValueOnce(ok(["A"])).mockResolvedValueOnce(ok(["B"]));
    const reprepare = vi.fn().mockResolvedValue("c2");
    const onContextRefreshed = vi.fn();
    const res = await runGeneration(
      { batches: [plan(1), plan(1)], contextId: "c1", signal: new AbortController().signal, generate, reprepare },
      { onBatch: () => {}, onQuestions: () => {}, onContextRefreshed },
    );
    expect(reprepare).toHaveBeenCalledTimes(1);
    expect(onContextRefreshed).toHaveBeenCalledWith("c2");
    expect(generate.mock.calls.map((c) => c[0].context_id)).toEqual(["c1", "c2", "c2"]);
    expect(res.produced).toBe(2);
  });

  it("keeps going after an ordinary failure but stops on one every batch would hit", async () => {
    const soft = vi.fn().mockRejectedValueOnce(httpErr(502, "AI generation failed")).mockResolvedValueOnce(ok(["B"]));
    const r1 = await runGeneration(
      { batches: [plan(1), plan(1)], contextId: "c", signal: new AbortController().signal, generate: soft, reprepare: vi.fn() },
      { onBatch: () => {}, onQuestions: () => {} },
    );
    expect(r1.states.map((s) => s.status)).toEqual(["failed", "done"]);
    expect(r1.states[0].error).toBe("AI generation failed");

    const hard = vi.fn().mockRejectedValueOnce(httpErr(503, "AI generation is not configured"));
    const r2 = await runGeneration(
      { batches: [plan(1), plan(1), plan(1)], contextId: "c", signal: new AbortController().signal, generate: hard, reprepare: vi.fn() },
      { onBatch: () => {}, onQuestions: () => {} },
    );
    expect(hard).toHaveBeenCalledTimes(1);
    expect(r2.states.map((s) => s.status)).toEqual(["failed", "cancelled", "cancelled"]);
  });

  it("stops after cancel, keeping what already came back", async () => {
    const ctrl = new AbortController();
    const generate = vi.fn().mockImplementationOnce(async () => {
      ctrl.abort();
      return ok(["A"]);
    });
    const seen: BatchState[] = [];
    const res = await runGeneration(
      { batches: [plan(1), plan(1)], contextId: "c", signal: ctrl.signal, generate, reprepare: vi.fn() },
      { onBatch: (b) => seen.push(b), onQuestions: () => {} },
    );
    expect(generate).toHaveBeenCalledTimes(1);
    expect(res.produced).toBe(1);
    expect(res.states.map((s) => s.status)).toEqual(["done", "cancelled"]);
  });
});
