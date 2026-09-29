import { describe, it, expect } from "vitest";
import { describeRetake } from "../utils/retakeState";
import type { StudentQuizState } from "../types/quiz.types";

const state = (over: {
  max?: number | null;
  used?: number;
  inProgress?: number | null;
  availability?: StudentQuizState["availability"]["state"];
  canStart?: boolean;
  blocked?: string | null;
}): StudentQuizState => {
  const max = over.max === undefined ? 3 : over.max;
  const used = over.used ?? 1;
  const canNew = max === null || used < max;
  const avail = over.availability ?? "open";
  return {
    availability: { state: avail, opens_at: null, closes_at: null },
    attempts: {
      max_attempts: max,
      attempts_used: used,
      attempts_left: max === null ? null : Math.max(0, max - used),
      in_progress_submission_id: over.inProgress ?? null,
      current_attempt_number: over.inProgress ? used + 1 : used + 1,
      can_start_new_attempt: canNew,
      last_finished_submission_id: 9,
    },
    enrolled: true,
    can_start:
      over.canStart ?? (over.inProgress != null || (avail === "open" && canNew)),
    blocked_reason: over.blocked ?? null,
  };
};

describe("describeRetake", () => {
  it("is null without a student state (e.g. staff)", () => {
    expect(describeRetake(null)).toBeNull();
  });

  it("offers a retake with the tries left and used", () => {
    const r = describeRetake(state({ max: 3, used: 1 }))!;
    expect(r).toMatchObject({
      status: "available",
      enabled: true,
      title: "Take again",
      hint: "2 tries left",
      triesLabel: "1 of 3 tries used",
    });
    expect(describeRetake(state({ max: 3, used: 2 }))!.hint).toBe("1 try left");
  });

  it("says unlimited when max_attempts is empty", () => {
    const r = describeRetake(state({ max: null, used: 4 }))!;
    expect(r).toMatchObject({ enabled: true, hint: "Unlimited tries" });
    expect(r.triesLabel).toBe("4 tries used · unlimited");
  });

  it("is disabled once every try is used", () => {
    const r = describeRetake(state({ max: 2, used: 2 }))!;
    expect(r).toMatchObject({
      status: "used_up",
      enabled: false,
      title: "No tries left",
      hint: "All 2 tries used",
      triesLabel: "2 of 2 tries used",
    });
    expect(describeRetake(state({ max: 1, used: 1 }))!.hint).toBe("All 1 try used");
  });

  it("offers to resume an open attempt", () => {
    const r = describeRetake(state({ max: 3, used: 1, inProgress: 55 }))!;
    expect(r).toMatchObject({ status: "resume", enabled: true, title: "Resume attempt" });
    expect(r.hint).toBe("Attempt 2 of 3 is still open");
  });

  it("is disabled when the quiz is closed or not open, even with tries left", () => {
    expect(describeRetake(state({ availability: "closed" }))).toMatchObject({
      status: "closed",
      enabled: false,
    });
    expect(describeRetake(state({ availability: "not_open" }))).toMatchObject({
      status: "not_open",
      enabled: false,
    });
  });

  it("is disabled for other reasons (e.g. not enrolled) with the server's reason", () => {
    const r = describeRetake(
      state({ canStart: false, blocked: "You are not enrolled in this quiz's subject." }),
    )!;
    expect(r).toMatchObject({ status: "unavailable", enabled: false });
    expect(r.hint).toMatch(/not enrolled/);
  });
});
