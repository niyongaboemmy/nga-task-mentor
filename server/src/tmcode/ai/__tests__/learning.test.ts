import { generateKeyPairSync, verify as edVerify } from "node:crypto";
import evals from "../evals/learning-leaks.json";
import {
  allowanceOf,
  filterLearningText,
  identifiersOf,
  inlineIsStatement,
  LearningFilter,
  looksLikeCode,
  normalizeHelp,
  referenceLines,
  resetAllowances,
  resetSigningKey,
  signLayer,
  takeQuestion,
  tutorSystem,
} from "../learning";

const opts = { identifiers: identifiersOf(evals.student_file), reference: referenceLines([evals.reference.join("\n")]) };

/** Any line of the reference, or a statement, left in the text? */
function leaked(text: string): string[] {
  return text.split("\n").filter((l) => l.trim() && !l.includes("TMCode removed") && (looksLikeCode(l, opts.identifiers) || /```|~~~/.test(l)));
}

describe("the Learning filter: the eval set (I7)", () => {
  it.each(evals.leak)("removes the code in $id", ({ text }) => {
    const r = filterLearningText(text, opts);
    expect(r.removed).toBeGreaterThan(0);
    expect(leaked(r.text)).toEqual([]);
    expect(r.text).not.toMatch(/biggest = n\b|Math\.max\(\.\.\.|console\.log\(total|SELECT name|System\.out|<button/);
  });

  it.each(evals.keep)("keeps honest tutoring: $id", ({ text }) => {
    const r = filterLearningText(text, opts);
    expect(r.removed).toBe(0);
    expect(r.text).toBe(text);
  });

  it("leak rate 0 and over-block rate 0 on the whole set", () => {
    const leaks = evals.leak.filter((c) => leaked(filterLearningText(c.text, opts).text).length).length;
    const overBlocked = evals.keep.filter((c) => filterLearningText(c.text, opts).removed > 0).length;
    expect({ leaks, overBlocked }).toEqual({ leaks: 0, overBlocked: 0 });
  });
});

describe("the Learning filter streams", () => {
  it("gives the same text in any chunking, and never shows a fence before it closes", () => {
    const text = "Think about it.\n```python\nbiggest = n\n```\nWhat next?";
    const whole = filterLearningText(text, opts).text;
    for (const size of [1, 2, 3, 7, 50]) {
      const f = new LearningFilter(opts);
      let out = "";
      for (let i = 0; i < text.length; i += size) {
        const piece = f.push(text.slice(i, i + size));
        expect(piece).not.toMatch(/biggest = n/);
        out += piece;
      }
      out += f.end();
      expect(out.replace(/\n{3,}/g, "\n\n").trimEnd()).toBe(whole);
    }
    expect(whole).toMatch(/TMCode removed 1 line of code/);
    expect(whole).toMatch(/^Think about it\./);
    expect(whole).toMatch(/What next\?$/);
  });

  it("one note per run of cut lines", () => {
    const r = filterLearningText("a:\nx = 1;\ny = 2;\n\nz = 3;\nok", opts);
    expect(r.text.match(/TMCode removed/g)).toHaveLength(1);
    expect(r.removed).toBe(3);
  });

  it("the teacher's tiny generic syntax example survives; the student's names don't", () => {
    expect(filterLearningText("Generic:\n```\nfor item in things:\n```", { ...opts, syntax: true }).removed).toBe(0);
    expect(filterLearningText("```\nfor n in numbers:\n```", { ...opts, syntax: true }).removed).toBe(1);
    expect(filterLearningText("```\na\nb\nc\n```", { ...opts, syntax: true }).removed).toBe(3);
  });
});

describe("inline spans", () => {
  it("names stay, statements go", () => {
    for (const s of ["for", "len()", "fetch", "Array.map", "<div>", "print(x)"]) expect(inlineIsStatement(s)).toBe(false);
    for (const s of ["total += price * qty", "if n > biggest: biggest = n", "x = 1", "a => a + 1", "while (true) { go(); }"]) expect(inlineIsStatement(s)).toBe(true);
  });
});

describe("the tutor profile and knobs", () => {
  it("defaults: tutor strength, pseudo-code on, syntax off, 10 questions / 3 min", () => {
    expect(normalizeHelp(null)).toEqual({ strength: "tutor", pseudo: true, syntax: false, allowance: { max: 10, regain_minutes: 3 }, interpreter: "auto", show_prompts: false, prompt_problem: null });
    expect(normalizeHelp('{"strength":"hints","pseudo":false,"allowance":{"max":500}}')).toMatchObject({ strength: "hints", pseudo: false, allowance: { max: 100 } });
  });

  it("the prompt follows the knobs", () => {
    const p = tutorSystem(normalizeHelp({ strength: "hints", pseudo: false }));
    expect(p).toMatch(/Never write code/);
    expect(p).toMatch(/Give HINTS only/);
    expect(p).toMatch(/Do NOT give pseudo-code/);
    expect(tutorSystem(normalizeHelp({ syntax: true }))).toMatch(/one tiny GENERIC syntax example/);
  });
});

describe("the question allowance (hearts)", () => {
  beforeEach(() => resetAllowances());
  const help = normalizeHelp({ allowance: { max: 3, regain_minutes: 1 } });

  it("spends, runs out, and regains one per period", () => {
    const t0 = 1_000_000;
    expect(takeQuestion(1, "p", help, t0).allowance.left).toBe(2);
    takeQuestion(1, "p", help, t0);
    takeQuestion(1, "p", help, t0);
    const out = takeQuestion(1, "p", help, t0);
    expect(out.ok).toBe(false);
    expect(out.allowance.next_in_s).toBe(60);
    expect(allowanceOf(1, "p", help, t0 + 61_000).left).toBe(1);
    expect(allowanceOf(1, "p", help, t0 + 10 * 60_000).left).toBe(3);
    // Per user and scope.
    expect(allowanceOf(2, "p", help, t0).left).toBe(3);
  });
});

describe("the sticky signed layer (A9)", () => {
  afterEach(() => {
    delete process.env.TMCODE_LAYER_SIGNING_KEY;
    resetSigningKey();
  });

  it("no key, no token", () => {
    delete process.env.TMCODE_LAYER_SIGNING_KEY;
    resetSigningKey();
    expect(signLayer(5, "hints", false, null)).toBeNull();
  });

  it("signs claims TMCode can verify with the public key; exp = due + 14 days", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    process.env.TMCODE_LAYER_SIGNING_KEY = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
    resetSigningKey();
    const now = new Date("2026-11-01T00:00:00Z");
    const t = signLayer(5, "hints", true, new Date("2026-11-10T00:00:00Z"), now)!;
    const claims = JSON.parse(Buffer.from(t.claims, "base64url").toString("utf8"));
    expect(claims).toMatchObject({ v: 1, project_id: 5, ai_mode: "hints", own_tools: true, exp: "2026-11-24T00:00:00.000Z", kid: "k1" });
    expect(edVerify(null, Buffer.from(t.claims, "ascii"), publicKey, Buffer.from(t.sig, "base64url"))).toBe(true);
    expect(edVerify(null, Buffer.from(t.claims.replace(/^./, "x"), "ascii"), publicKey, Buffer.from(t.sig, "base64url"))).toBe(false);
  });
});

describe("tutor eval scoring and model admission (I7)", () => {
  it("scores raw leaks and what survives the filter", () => {
    const { score } = require("../evals/runTutorEval");
    expect(score(["What do you think `biggest` holds?", "```python\nbiggest = n\n```", ""])).toEqual({ raw_leak_rate: 0.5, filtered_leak_rate: 0, answered: 2 });
  });

  it("admits unmeasured models, refuses ones above the threshold", () => {
    const { admittedToLearning, resetEvalResults } = require("../privacy");
    resetEvalResults([{ provider: "groq", model: "leaky", raw_leak_rate: 0.9, filtered_leak_rate: 0, answered: 5, at: "" }]);
    expect(admittedToLearning("groq", "leaky")).toBe(false);
    expect(admittedToLearning("groq", "other")).toBe(true);
    resetEvalResults(null);
  });

  it("student routing: all by default; 'permitted' keeps only no-training, teen-allowed providers", () => {
    const { permittedForStudents, privacyOf } = require("../privacy");
    expect(permittedForStudents("groq")).toBe(true);
    process.env.TMCODE_AI_STUDENT_ROUTING = "permitted";
    expect(permittedForStudents("groq")).toBe(false);
    expect(permittedForStudents("openrouter")).toBe(false);
    expect(permittedForStudents("anthropic", "byok")).toBe(true);
    expect(permittedForStudents("gemini", "premium")).toBe(false);
    delete process.env.TMCODE_AI_STUDENT_ROUTING;
    expect(privacyOf("gemini", "free")?.label).toMatch(/may train/);
  });
});
