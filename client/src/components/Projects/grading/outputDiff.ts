/**
 * Expected vs actual output, line by line, the way the runner compares them
 * (CRLF = LF, trailing spaces and blank lines at the end ignored), so a
 * grader sees exactly which lines differ.
 */
export interface DiffRow {
  line: number;
  expected: string | null;
  actual: string | null;
  same: boolean;
}

const lines = (s: string) => {
  const out = s.replace(/\r\n/g, "\n").split("\n").map((l) => l.replace(/\s+$/, ""));
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
};

export function outputDiff(expected: string, actual: string): DiffRow[] {
  const e = lines(expected);
  const a = lines(actual);
  const n = Math.max(e.length, a.length);
  const rows: DiffRow[] = [];
  for (let i = 0; i < n; i++) {
    const ex = i < e.length ? e[i]! : null;
    const ac = i < a.length ? a[i]! : null;
    rows.push({ line: i + 1, expected: ex, actual: ac, same: ex === ac });
  }
  return rows;
}

/** The first line that differs (1-based), or null when they match. */
export const firstDifference = (rows: DiffRow[]) => rows.find((r) => !r.same)?.line ?? null;
