import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import QuestionTimer from "../components/ui/QuestionTimer";
import {
  formatClock,
  hasAnswerValue,
  mergeAnswers,
  quizTimingMode,
  resolveDeadline,
  secondsUntil,
  timerTone,
  isQuestionLocked,
  loadTimeBank,
  nextAfterTimeout,
  secondsLeftOn,
  secondsSpentOn,
} from "../utils/quizTimer";

describe("quizTimer utils", () => {
  it("picks the timing mode from the quiz's overall duration", () => {
    expect(quizTimingMode({ time_limit: 30 })).toBe("overall");
    expect(quizTimingMode({ time_limit: null })).toBe("per_question");
    expect(quizTimingMode({ time_limit: 0 })).toBe("per_question");
    expect(quizTimingMode(null)).toBe("per_question");
  });

  it("formats clocks", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(75)).toBe("1:15");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-4)).toBe("0:00");
    expect(formatClock(NaN)).toBe("0:00");
  });

  it("warns earlier for the whole quiz than for one question", () => {
    expect(timerTone(600, 1800, "quiz")).toBe("normal");
    expect(timerTone(300, 1800, "quiz")).toBe("warning");
    expect(timerTone(60, 1800, "quiz")).toBe("critical");
    expect(timerTone(90, 300, "question")).toBe("normal");
    expect(timerTone(60, 300, "question")).toBe("warning");
    expect(timerTone(30, 300, "question")).toBe("critical");
    // A short total doesn't start out red.
    expect(timerTone(60, 60, "question")).toBe("normal");
  });

  it("counts down from a wall-clock deadline (no drift)", () => {
    expect(secondsUntil(10_500, 0)).toBe(11);
    expect(secondsUntil(10_000, 10_000)).toBe(0);
    expect(secondsUntil(5_000, 9_000)).toBe(0);
  });

  it("prefers the server's remaining seconds, then end_time, then start + duration", () => {
    const now = 1_000_000;
    expect(resolveDeadline({ timeRemainingSeconds: 90, endTime: "2000-01-01T00:00:00Z", nowMs: now })).toBe(now + 90_000);
    expect(resolveDeadline({ endTime: "2026-09-29T10:00:00.000Z", nowMs: now })).toBe(
      Date.parse("2026-09-29T10:00:00.000Z"),
    );
    expect(
      resolveDeadline({ startedAt: "2026-09-29T10:00:00.000Z", timeLimitMinutes: 30, nowMs: now }),
    ).toBe(Date.parse("2026-09-29T10:30:00.000Z"));
    expect(resolveDeadline({ nowMs: now })).toBeNull();
  });

  it("recognises real answers (false and 0 count, blanks don't)", () => {
    for (const v of [false, 0, "x", [1], { answer: false }, { a: ["b"] }]) {
      expect(hasAnswerValue(v)).toBe(true);
    }
    for (const v of [null, undefined, "", "  ", [], {}, { a: "" }]) {
      expect(hasAnswerValue(v)).toBe(false);
    }
  });

  it("merges answers: this device wins, the server fills the gaps", () => {
    const merged = mergeAnswers(
      [{ question_id: 1, answer: "local" }],
      [
        { question_id: 1, answer: "server" },
        { question_id: 2, answer: "server-only" },
      ],
    );
    expect(Object.fromEntries(merged.map((a) => [a.question_id, a.answer]))).toEqual({
      1: "local",
      2: "server-only",
    });
  });
});

describe("QuestionTimer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("controlled: only displays the parent's value and never fires onTimeout itself", () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const { rerender } = render(
      <QuestionTimer timeLeft={60} currentTime={3} onTimeout={onTimeout} label="Quiz time left" />,
    );
    expect(screen.getByRole("timer")).toHaveAccessibleName("Quiz time left: 0:03");
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    // Still what the parent said — no internal countdown.
    expect(screen.getByRole("timer")).toHaveAccessibleName("Quiz time left: 0:03");

    rerender(<QuestionTimer timeLeft={60} currentTime={0} onTimeout={onTimeout} label="Quiz time left" />);
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("controlled: 0 is shown as 0, not treated as 'no value'", () => {
    render(<QuestionTimer timeLeft={30} currentTime={0} />);
    expect(screen.getByText("0:00")).toBeInTheDocument();
  });

  it("uncontrolled: counts down and fires onTimeout exactly once", () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    render(<QuestionTimer timeLeft={3} onTimeout={onTimeout} />);
    expect(screen.getByText("0:03")).toBeInTheDocument();
    for (let i = 0; i < 6; i++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("uncontrolled: holds still while paused", () => {
    vi.useFakeTimers();
    render(<QuestionTimer timeLeft={10} paused />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("timer")).toHaveAccessibleName("Time left: 0:10 (paused)");
  });

  it("switches to the critical style near the end", () => {
    const { rerender } = render(<QuestionTimer variant="quiz" timeLeft={1800} currentTime={900} />);
    expect(screen.getByRole("timer").className).toContain("bg-blue-50");
    rerender(<QuestionTimer variant="quiz" timeLeft={1800} currentTime={45} />);
    expect(screen.getByRole("timer").className).toContain("bg-red-50");
  });
});

describe("per-question time bank (skip and come back)", () => {
  it("reads a stored bank defensively", () => {
    expect(loadTimeBank(null)).toEqual({});
    expect(loadTimeBank("not json")).toEqual({});
    expect(loadTimeBank("[1,2]")).toEqual({});
    expect(loadTimeBank('{"101": 7.9, "102": -3, "x": "nope"}')).toEqual({ 101: 7, 102: 0 });
  });

  it("gives an unopened question its full time and never reports more than the limit", () => {
    expect(secondsLeftOn({}, 101, 30)).toBe(30);
    expect(secondsLeftOn({ 101: 12 }, 101, 30)).toBe(12);
    expect(secondsLeftOn({ 101: 99 }, 101, 30)).toBe(30);
    expect(secondsSpentOn({ 101: 12 }, 101, 30)).toBe(18);
    expect(secondsSpentOn({}, 101, 30)).toBe(0);
  });

  it("locks only a timed question whose clock reached 0", () => {
    expect(isQuestionLocked({ 101: 0 }, 101, 30)).toBe(true);
    expect(isQuestionLocked({ 101: 1 }, 101, 30)).toBe(false);
    expect(isQuestionLocked({ 101: 0 }, 101, null)).toBe(false);
  });

  it("after a timeout goes to the next open, unanswered question, wrapping round", () => {
    const locked = new Set([1]);
    const answered = new Set([2]);
    const go = (current: number) =>
      nextAfterTimeout({ current, total: 5, isLocked: (i) => locked.has(i), isAnswered: (i) => answered.has(i) });
    expect(go(0)).toEqual({ kind: "goto", index: 3 });
    expect(go(4)).toEqual({ kind: "goto", index: 0 });
  });

  it("opens the review when only answered questions are left, and submits when all are locked", () => {
    expect(
      nextAfterTimeout({ current: 2, total: 3, isLocked: (i) => i === 2, isAnswered: () => true }),
    ).toEqual({ kind: "review" });
    expect(
      nextAfterTimeout({ current: 2, total: 3, isLocked: () => true, isAnswered: () => false }),
    ).toEqual({ kind: "submit" });
  });
});
