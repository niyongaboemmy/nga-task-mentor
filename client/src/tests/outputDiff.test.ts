import { describe, expect, it } from "vitest";
import { firstDifference, outputDiff } from "../components/Projects/grading/outputDiff";

describe("expected vs actual output", () => {
  it("compares line by line, ignoring CRLF and trailing spaces/blank lines", () => {
    const rows = outputDiff("Sum: 5\nDone\n", "Sum: 5  \r\nDone\n\n");
    expect(rows.every((r) => r.same)).toBe(true);
    expect(firstDifference(rows)).toBeNull();
  });
  it("marks the lines that differ, and missing or extra lines", () => {
    const rows = outputDiff("a\nb\nc", "a\nB");
    expect(rows.map((r) => r.same)).toEqual([true, false, false]);
    expect(rows[2]).toEqual({ line: 3, expected: "c", actual: null, same: false });
    expect(firstDifference(rows)).toBe(2);
    expect(outputDiff("a", "a\nextra")[1]).toMatchObject({ expected: null, actual: "extra", same: false });
  });
});
