import { calculateSubjectGrade, categoryPercentage } from "../reportCardGrader.service";
import { normalizeWeights, weightsFor } from "../componentWeights";
import { gradingOf } from "../reportCardBuilders";

const tvet = gradingOf({ builder: "tvet", category_weights: { CW: 15, HW: 10, MD: 25, EOT: 50 } }).weights;

describe("kinds of work inside a category", () => {
  const items = [
    { raw_score: 9, max_score: 10, component: "class_work" }, // 90
    { raw_score: 7, max_score: 10, component: "class_work" }, // 70 -> class work 80
    { raw_score: 4, max_score: 10, component: "homework" }, // homework 40
    { raw_score: 60, max_score: 100, component: "midterm" }, // midterm 60
  ];

  it("without weights: the plain average of the assessments, as before", () => {
    expect(categoryPercentage(items).avg).toBe(65); // (90+70+40+60)/4
  });

  it("with weights: each kind averaged, then combined by weight (30/20/50 -> 24 + 8 + 30 = 62)", () => {
    const r = categoryPercentage(items, { class_work: 30, homework: 20, midterm: 50 });
    expect(r.avg).toBe(62);
    expect(r.components?.map((c) => [c.component, c.share, c.avg_percentage, c.count])).toEqual([
      ["midterm", 50, 60, 1],
      ["class_work", 30, 80, 2],
      ["homework", 20, 40, 1],
    ]);
  });

  it("scales weights over the kinds that have marks, reports unweighted kinds, and never drops everything", () => {
    // No midterm yet: class work 30 and homework 20 become 60% / 40%.
    expect(categoryPercentage(items.slice(0, 3), { class_work: 30, homework: 20, midterm: 50 }).avg).toBe(64); // 80*.6 + 40*.4
    const r = categoryPercentage(items, { class_work: 30, homework: 20 });
    expect(r.unweighted).toEqual(["midterm"]);
    expect(r.avg).toBe(64); // midterm left out
    expect(categoryPercentage(items, { quiz: 50 }).avg).toBe(65); // nothing with marks weighted: plain average
  });

  it("feeds the subject's FA in a TVET grade", () => {
    const g = calculateSubjectGrade(
      1,
      items.map((x, i) => ({ assessment_id: i + 1, assessment_type: "manual" as const, category: "FA" as const, ...x })),
      tvet,
      { FA: { class_work: 30, homework: 20, midterm: 50 } },
    );
    expect(g.categories.FA?.avg_percentage).toBe(62);
    expect(g.categories.FA?.components?.length).toBe(3);
    expect(g.total_score).toBe(62);
  });

  it("validates weights and resolves a subject's own over the school's", () => {
    expect(normalizeWeights({ FA: { homework: "20", class_work: 30, bogus: 5 }, XX: { quiz: 1 } })).toEqual({ FA: { homework: 20, class_work: 30 } });
    expect(normalizeWeights({ FA: { quiz: 120 } })).toMatch(/between 0 and 100/);
    expect(normalizeWeights({ FA: { quiz: 0 } })).toEqual({}); // all zero = not set
    const config = { default: { FA: { quiz: 50, homework: 50 }, CA: { ca_end_of_term: 100 } }, subjects: { "7": { FA: { quiz: 20, midterm: 80 } } } };
    expect(weightsFor(config, 7)).toEqual({ FA: { quiz: 20, midterm: 80 }, CA: { ca_end_of_term: 100 } });
    expect(weightsFor(config, 8)).toEqual(config.default);
  });
});
