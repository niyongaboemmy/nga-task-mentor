import { bestBySubmissionScore, submissionBelongsTo } from "../gradeMatching";

// Roster rows as getCourseGrades builds them.
const misRow = (misId: number) => ({ id: misId, mis_user_id: misId });
const localRow = (userId: number) => ({ id: `local_${userId}`, user_id: userId, mis_user_id: null });

// A quiz submission as Sequelize returns it (student joined, DECIMAL as string).
const sub = (localId: number, misId: number | null, score: string) => ({
  student_id: localId,
  student: { id: localId, mis_user_id: misId },
  total_score: score,
});

describe("submissionBelongsTo", () => {
  it("matches an MIS roster row only to that student's own submission", () => {
    const alice = sub(10, 501, "9.00");
    const bob = sub(11, 502, "4.00");
    expect(submissionBelongsTo(alice, misRow(501))).toBe(true);
    expect(submissionBelongsTo(bob, misRow(501))).toBe(false);
    expect(submissionBelongsTo(alice, misRow(502))).toBe(false);
  });

  it("does not let a roster row without user_id match every submission (regression)", () => {
    // The old fallback compared sub.student_id to sub.student.id — always equal.
    const orphan = sub(12, null, "9.00");
    expect(submissionBelongsTo(orphan, misRow(501))).toBe(false);
  });

  it("matches local-only rows by users.id", () => {
    expect(submissionBelongsTo(sub(12, null, "7.00"), localRow(12))).toBe(true);
    expect(submissionBelongsTo(sub(13, null, "7.00"), localRow(12))).toBe(false);
  });

  it("matches the self-view row on either id", () => {
    const me = { id: 501, user_id: 10, mis_user_id: 501 };
    expect(submissionBelongsTo(sub(10, null, "1"), me)).toBe(true);
    expect(submissionBelongsTo(sub(99, 501, "1"), me)).toBe(true);
    expect(submissionBelongsTo(sub(11, 502, "1"), me)).toBe(false);
  });

  it("gives a class of different scorers different marks", () => {
    const subs = [sub(1, 101, "9.00"), sub(2, 102, "6.50"), sub(3, 103, "3.00")];
    const scores = [101, 102, 103].map((id) =>
      bestBySubmissionScore(subs.filter((s) => submissionBelongsTo(s, misRow(id))))?.total_score,
    );
    expect(scores).toEqual(["9.00", "6.50", "3.00"]);
    // A student with no submission gets nothing, not the class's best.
    expect(subs.filter((s) => submissionBelongsTo(s, misRow(104)))).toHaveLength(0);
  });
});

describe("bestBySubmissionScore", () => {
  it("compares DECIMAL strings numerically", () => {
    const best = bestBySubmissionScore([sub(1, 1, "9.00"), sub(1, 1, "10.00"), sub(1, 1, "2.50")]);
    expect(best?.total_score).toBe("10.00");
  });

  it("returns null for no attempts", () => {
    expect(bestBySubmissionScore([])).toBeNull();
  });
});
