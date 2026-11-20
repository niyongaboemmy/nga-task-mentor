import { builderStructure, effectiveCategory, gradingOf } from "../reportCardBuilders";
import { calculateSubjectGrade } from "../reportCardGrader.service";
import {
  componentPcts,
  deliberationConditions,
  isFinalTerm,
  learningHours,
  moduleWeightOf,
  qualificationOf,
  yearOf,
  levelForYear,
  termIndex,
  tvetCell,
  tvetDecision,
  tvetTotals,
} from "../reportCardDocument";
import { DEFAULT_REPORT_CARD_SCHEME, normalizeScheme, normalizeTvetOptions } from "../tenantSettings";

/** A TVET grade from component percentages, as computeCardGrades makes it. */
const tvetGrade = (fa: number | null, ca: number | null, ia: number | null = null) =>
  calculateSubjectGrade(
    1,
    [
      ...(fa != null ? [{ assessment_id: 1, assessment_type: "manual" as const, category: "FA" as const, raw_score: fa, max_score: 100 }] : []),
      ...(ca != null ? [{ assessment_id: 2, assessment_type: "manual" as const, category: "CA" as const, raw_score: ca, max_score: 100 }] : []),
      ...(ia != null ? [{ assessment_id: 3, assessment_type: "manual" as const, category: "IA" as const, raw_score: ia, max_score: 100 }] : []),
    ],
    gradingOf({ builder: "tvet", category_weights: { CW: 15, HW: 10, MD: 25, EOT: 50 } }).weights,
  );

describe("report card builders", () => {
  it("describes each builder's mapping categories", () => {
    expect(builderStructure("normal").categories.map((c) => [c.key, c.weight])).toEqual([
      ["CW", 15],
      ["HW", 10],
      ["MD", 25],
      ["EOT", 50],
    ]);
    expect(builderStructure("normal", { CW: 20, HW: 10, MD: 20, EOT: 50 }).categories[0].weight).toBe(20);
    expect(builderStructure("tvet").categories.map((c) => c.key)).toEqual(["FA", "CA", "IA"]);
  });

  it("reads a mapping from the other builder without rewriting it", () => {
    expect(["CW", "HW", "MD", "FA", "EOT", "CA", "IA"].map((c) => effectiveCategory("tvet", c))).toEqual(["FA", "FA", "FA", "FA", "CA", "CA", "IA"]);
    expect(["CW", "HW", "MD", "EOT", "FA", "CA", "IA"].map((c) => effectiveCategory("normal", c))).toEqual(["CW", "HW", "MD", "EOT", "MD", "EOT", null]);
  });

  it("grades TVET components equally and Normal by the school's weights", () => {
    const t = gradingOf({ builder: "tvet", category_weights: { CW: 15, HW: 10, MD: 25, EOT: 50 } });
    expect(t.builder).toBe("tvet");
    expect([t.weights.FA, t.weights.CA, t.weights.IA]).toEqual([100, 100, 100]);
    const n = gradingOf({ category_weights: { CW: 15, HW: 10, MD: 25, EOT: 50 } });
    expect(n.builder).toBe("normal");
    expect(n.weights.EOT).toBe(50);
    expect(tvetGrade(75, 91.67).total_score).toBe(83.34); // the average of the two components
  });
});

describe("scheme: builder and TVET options", () => {
  it("defaults to the Normal builder with the TVET defaults kept", () => {
    const s = normalizeScheme({}) as typeof DEFAULT_REPORT_CARD_SCHEME;
    expect(s.builder).toBe("normal");
    expect(s.tvet.default_module_weight).toBe(100);
    expect(s.category_weights).toEqual({ CW: 15, HW: 10, MD: 25, EOT: 50 });
  });

  it("accepts the TVET builder and validates its options", () => {
    const s = normalizeScheme({ builder: "tvet", tvet: { district: " Gasabo ", module_weights: { "12": "80", "13": "", x: 5 } } }) as typeof DEFAULT_REPORT_CARD_SCHEME;
    expect(s.builder).toBe("tvet");
    expect(s.tvet.district).toBe("Gasabo");
    expect(s.tvet.module_weights).toEqual({ "12": 80 });
    expect(normalizeScheme({ builder: "cbc" })).toMatch(/Unknown report card builder/);
    expect(normalizeTvetOptions({ default_module_weight: 0 })).toMatch(/default module weight/);
    expect(normalizeTvetOptions({ module_weights: { "4": 5000 } })).toMatch(/between 1 and 1000/);
    expect(normalizeTvetOptions({ district: "x".repeat(61) })).toMatch(/at most 60/);
  });
});

describe("TVET (CAMIS) maths, checked against an issued card", () => {
  it("scales each component to the module weight (weight 30: FA 75% + CA 91.67% = 22.5 + 27.5 = 50)", () => {
    expect(tvetCell(tvetGrade(75, 91.666667), 30)).toEqual({ fa: 22.5, ia: null, ca: 27.5, to: 50, max: 60, pct: 83.33 });
  });

  it("adds IA on Term 3 (SPEWI302, weight 80: 74.7 + 75.9 + 73.6 = 224.2 of 240)", () => {
    const c = tvetCell(tvetGrade((74.7 / 80) * 100, (73.6 / 80) * 100, (75.9 / 80) * 100), 80)!;
    expect([c.fa, c.ia, c.ca, c.to, c.max]).toEqual([74.7, 75.9, 73.6, 224.2, 240]);
  });

  it("sums the year over the term maxima (SPEWI302: 124.1 + 129.6 + 224.2 = 477.9 of 560 = 85.34%)", () => {
    const t1 = tvetCell(tvetGrade((61.7 / 80) * 100, (62.4 / 80) * 100), 80)!;
    const t2 = tvetCell(tvetGrade((59.2 / 80) * 100, (70.4 / 80) * 100), 80)!;
    const t3 = tvetCell(tvetGrade((74.7 / 80) * 100, (73.6 / 80) * 100, (75.9 / 80) * 100), 80)!;
    expect([t1.to, t2.to, t3.to]).toEqual([124.1, 129.6, 224.2]);
    const at = t1.to! + t2.to! + t3.to!;
    const max = t1.max! + t2.max! + t3.max!;
    expect(Math.round(at * 10) / 10).toBe(477.9);
    expect(max).toBe(560);
    expect(Math.round((at / max) * 1000) / 10).toBe(85.3);
  });

  it("weights the class totals by learning hours", () => {
    const totals = tvetTotals([tvetCell(tvetGrade(100, 100), 30), tvetCell(tvetGrade(50, 50), 90), null]);
    expect(totals).toEqual({ fa: 75, ia: null, ca: 75, to: 150, max: 240, pct: 62.5 }); // not the plain average (75%)
    expect(tvetTotals([null]).pct).toBeNull();
  });

  it("reads a Normal-builder snapshot as FA (CW+HW+MD) and CA (EOT)", () => {
    const g = { categories: { CW: { scaled_score: 12, weight: 15, avg_percentage: 80 }, MD: { scaled_score: 20, weight: 25, avg_percentage: 80 }, EOT: { scaled_score: 45, weight: 50, avg_percentage: 90 } } } as any;
    expect(componentPcts(g)).toEqual({ fa: 80, ca: 90, ia: null });
  });

  it("prints the deliberation conditions and decision", () => {
    expect(deliberationConditions({ specific: 70, general: 50, complementary: 50 })).toEqual([
      "Each module is independently deliberated",
      "The passing line for Complementary and General modules is 50%",
      "The passing line for Specific modules is 70%",
    ]);
    expect(deliberationConditions({ specific: 70, general: 60, complementary: 50 })).toHaveLength(4);
    expect(tvetDecision([true, true, null], "3")).toBe("Promoted");
    expect(tvetDecision([true, true], "5")).toBe("Graduated");
    expect(tvetDecision([true, false], "3")).toBe("Re-assessment required");
    expect(tvetDecision([null], "3")).toBeNull();
  });

  it("reads terms, learning hours and the qualification", () => {
    expect([termIndex("Term 1"), termIndex("TERM III"), termIndex("Third term"), termIndex("Holiday")]).toEqual([1, 3, 3, null]);
    expect([isFinalTerm("Term 3"), isFinalTerm("Term 2")]).toEqual([true, false]);
    expect([learningHours("120"), learningHours("12 credits"), learningHours(null)]).toEqual([120, 120, null]);
    // MIS keeps a weekly note in learning_hours: not a module's weight.
    expect(learningHours("5 (4 taught and 1 in self-study) per week")).toBeNull();
    expect(learningHours("3 hours weekly")).toBeNull();
    expect(qualificationOf([{ rqf_level: "3" }, { rqf_level: "3" }], "Software Development", null, null)).toEqual({
      rqf_level: "3",
      trade: "Software Development",
      title: "Level 3",
      sector: null,
    });
  });
});

describe("module weight from MIS", () => {
  it("takes the subject's module_weight, else credits x 10, else total hours, never a weekly note", () => {
    expect(moduleWeightOf({ module_weight: 80, learning_hours: "5 per week" })).toBe(80);
    expect(moduleWeightOf({ module_weight: null, credits: 12 })).toBe(120);
    expect(moduleWeightOf({ learning_hours: "100 hours" })).toBe(100);
    expect(moduleWeightOf({ learning_hours: "5 (4 taught and 1 in self-study) per week" })).toBeNull();
    expect(moduleWeightOf({})).toBeNull();
  });
});

describe("qualification level from the class year", () => {
  it("reads the year from class or grade names, and maps Year 1/2/3 to Levels 3/4/5", () => {
    expect([yearOf("SPES-Year1"), yearOf("Year 2"), yearOf(null, "Y3"), yearOf("Year Three"), yearOf("Year 10"), yearOf("Grade 1")]).toEqual([1, 2, 3, 3, null, null]);
    expect([levelForYear(1), levelForYear(2), levelForYear(3), levelForYear(4), levelForYear(null)]).toEqual([3, 4, 5, null, null]);
  });

  it("prefers the grade's level in MIS, then the class year, then the modules' level", () => {
    expect(qualificationOf([{ rqf_level: "3" }], "SPE", "SPES-Year2", null, 5).title).toBe("Level 5"); // MIS grade wins
    expect(qualificationOf([{ rqf_level: "3" }], "SPE", "SPES-Year2", null).title).toBe("Level 4"); // Year 2
    expect(qualificationOf([], "SPE", "L3 SOD A", null).title).toBe("Level 3");
    expect(qualificationOf([{ rqf_level: "Level 4" }], "SPE", "Class A", null).title).toBe("Level 4");
    expect(qualificationOf([], "SPE", "Class A", null)).toMatchObject({ rqf_level: null, title: null });
  });
});
