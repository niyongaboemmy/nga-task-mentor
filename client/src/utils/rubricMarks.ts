import type { RubricCriterion } from "../components/Assignments/AssignmentCard";

/**
 * Split `total` across criteria in proportion to `weights` — whole marks when
 * there are enough, half marks otherwise — so the parts add up to exactly
 * `total`. Same algorithm as server/src/services/ai/rubricGenerator.ts.
 */
export function distributeMarks(weights: number[], total: number): number[] {
  const n = weights.length;
  if (n === 0 || !(total > 0)) return weights.map(() => 0);

  const step = total >= n ? 1 : 0.5;
  const units = Math.floor(total / step + 1e-9);
  const leftover = Math.round((total - units * step) * 100) / 100;

  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const sum = clean.reduce((a, b) => a + b, 0);
  const shares = sum > 0 ? clean.map((w) => w / sum) : clean.map(() => 1 / n);

  const raw = shares.map((s) => s * units);
  const alloc = raw.map((r) => Math.floor(r));
  let remaining = units - alloc.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r), share: shares[i] }))
    .sort((a, b) => b.frac - a.frac || b.share - a.share || a.i - b.i);
  for (let k = 0; remaining > 0; k = (k + 1) % n, remaining--) alloc[order[k].i]++;

  if (units >= n) {
    for (let i = 0; i < n; i++) {
      if (alloc[i] > 0) continue;
      const donor = alloc.indexOf(Math.max(...alloc));
      alloc[donor]--;
      alloc[i]++;
    }
  }

  const marks = alloc.map((u) => Math.round(u * step * 100) / 100);
  if (leftover > 0) {
    const biggest = marks.indexOf(Math.max(...marks));
    marks[biggest] = Math.round((marks[biggest] + leftover) * 100) / 100;
  }
  return marks;
}

export const rubricTotal = (rubric: RubricCriterion[]) =>
  Math.round(rubric.reduce((acc, c) => acc + (Number(c.max_score) || 0), 0) * 100) / 100;

/** Keep the criteria's proportions but make them add up to `total`. */
export const scaleRubric = (rubric: RubricCriterion[], total: number): RubricCriterion[] => {
  const marks = distributeMarks(rubric.map((c) => Number(c.max_score) || 0), total);
  return rubric.map((c, i) => ({ ...c, max_score: marks[i] }));
};

/** Same total, split evenly. */
export const evenRubric = (rubric: RubricCriterion[], total: number): RubricCriterion[] => {
  const marks = distributeMarks(rubric.map(() => 1), total);
  return rubric.map((c, i) => ({ ...c, max_score: marks[i] }));
};
