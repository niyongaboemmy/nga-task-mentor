/**
 * Pure timing helpers for the quiz-taking page and its timer display.
 *
 * Two modes, decided by the quiz:
 *  - "overall": `quiz.time_limit` (minutes) is set. One countdown for the
 *    whole attempt, anchored to the server's `end_time`; free navigation;
 *    auto-submit of the whole quiz at 0.
 *  - "per_question": no overall duration. Each question counts down its own
 *    `time_limit_seconds` and auto-advances (last one submits) at 0.
 */

export type QuizTimingMode = "overall" | "per_question";

export const quizTimingMode = (quiz?: { time_limit?: number | null } | null): QuizTimingMode =>
  Number(quiz?.time_limit) > 0 ? "overall" : "per_question";

/** 75 → "1:15", 3725 → "1:02:05". Negative/NaN clamp to 0. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export type TimerTone = "normal" | "warning" | "critical";

/**
 * Urgency of a countdown. The whole-quiz timer warns earlier (5 min / 1 min)
 * than a single question (60 s / 30 s); for short totals the thresholds
 * shrink so a 2-minute quiz doesn't start out "critical".
 */
export function timerTone(
  remaining: number,
  total: number,
  variant: "question" | "quiz" = "question",
): TimerTone {
  const [warnAt, critAt] = variant === "quiz" ? [300, 60] : [60, 30];
  const cap = total > 0 ? total / 2 : Infinity;
  if (remaining <= Math.min(critAt, cap / 2)) return "critical";
  if (remaining <= Math.min(warnAt, cap)) return "warning";
  return "normal";
}

/**
 * Seconds left until `deadlineMs`, computed from the wall clock rather than
 * by decrementing a counter, so a throttled background tab or a sleeping
 * laptop can't drift the timer away from the server deadline.
 */
export const secondsUntil = (deadlineMs: number, nowMs: number = Date.now()): number =>
  Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));

/**
 * Local deadline for an attempt. Prefers the server's remaining-seconds
 * figure (immune to client clock skew), then `end_time`, then
 * start + duration.
 */
export function resolveDeadline(opts: {
  timeRemainingSeconds?: number | null;
  endTime?: string | null;
  startedAt?: string | null;
  timeLimitMinutes?: number | null;
  nowMs?: number;
}): number | null {
  const now = opts.nowMs ?? Date.now();
  if (typeof opts.timeRemainingSeconds === "number" && opts.timeRemainingSeconds >= 0) {
    return now + opts.timeRemainingSeconds * 1000;
  }
  if (opts.endTime) {
    const t = new Date(opts.endTime).getTime();
    if (Number.isFinite(t)) return t;
  }
  if (opts.startedAt && Number(opts.timeLimitMinutes) > 0) {
    const t = new Date(opts.startedAt).getTime();
    if (Number.isFinite(t)) return t + Number(opts.timeLimitMinutes) * 60_000;
  }
  return null;
}

/**
 * Question types whose grading is cheap and deterministic, so their answers
 * can be saved to the server in the background while the student works
 * (nothing is lost if the browser dies). Open-ended/coding answers are saved
 * on navigation and on submit instead, to avoid AI/code-runner calls on every
 * keystroke.
 */
export const BACKGROUND_SAVE_TYPES = new Set([
  "single_choice",
  "multiple_choice",
  "true_false",
  "matching",
  "fill_blank",
  "dropdown",
  "ordering",
  "drag_drop",
  "logical_expression",
]);

/** A value the student actually entered (empty strings/arrays/objects don't count). */
export function hasAnswerValue(answer: unknown): boolean {
  if (answer === null || answer === undefined) return false;
  if (typeof answer === "string") return answer.trim() !== "";
  if (Array.isArray(answer)) return answer.length > 0;
  if (typeof answer === "object") {
    return Object.values(answer as Record<string, unknown>).some(hasAnswerValue);
  }
  return true;
}

/**
 * Merge answers restored from this browser with the ones saved on the server.
 * Local copies win (they can be newer than the last server save); the server
 * fills in anything this browser doesn't have, e.g. when resuming on another
 * device.
 */
export function mergeAnswers<T extends { question_id: number }>(local: T[], server: T[]): T[] {
  const byId = new Map<number, T>();
  for (const a of server) byId.set(Number(a.question_id), a);
  for (const a of local) byId.set(Number(a.question_id), a);
  return Array.from(byId.values());
}

// ─── Per-question timing: skip now, come back later ─────────────────────────

/**
 * Seconds left on each per-question clock, by question id. A question's clock
 * only runs while it is on screen: leaving it (skip, Next, Previous, the grid)
 * pauses it and coming back resumes it. A question whose clock reached 0 is
 * locked for good. Missing entries mean "not opened yet" (full time).
 */
export type QuestionTimeBank = Record<number, number>;

export const timeBankKey = (quizId: string | number) => `quiz_${quizId}_qtime`;

export function loadTimeBank(raw: string | null): QuestionTimeBank {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: QuestionTimeBank = {};
    for (const [k, v] of Object.entries(parsed)) {
      const id = Number(k);
      const left = Number(v);
      if (Number.isFinite(id) && Number.isFinite(left)) out[id] = Math.max(0, Math.floor(left));
    }
    return out;
  } catch {
    return {};
  }
}

/** Seconds still available on a question (its full limit if never opened). */
export const secondsLeftOn = (bank: QuestionTimeBank, questionId: number, limit: number): number =>
  Math.min(limit, Math.max(0, bank[questionId] ?? limit));

/** Time actually spent on a question, across every visit — never above its limit. */
export const secondsSpentOn = (bank: QuestionTimeBank, questionId: number, limit: number): number =>
  limit - secondsLeftOn(bank, questionId, limit);

export const isQuestionLocked = (bank: QuestionTimeBank, questionId: number, limit: number | null | undefined) =>
  !!limit && limit > 0 && secondsLeftOn(bank, questionId, limit) <= 0;

/**
 * Where to go when the current question's clock runs out: the next question
 * (wrapping round) that is still open and unanswered; failing that "review"
 * while any question can still be changed, or "submit" once every question is
 * locked.
 */
export function nextAfterTimeout(opts: {
  current: number;
  total: number;
  isLocked: (index: number) => boolean;
  isAnswered: (index: number) => boolean;
}): { kind: "goto"; index: number } | { kind: "review" } | { kind: "submit" } {
  const { current, total, isLocked, isAnswered } = opts;
  for (let step = 1; step < total; step++) {
    const i = (current + step) % total;
    if (!isLocked(i) && !isAnswered(i)) return { kind: "goto", index: i };
  }
  for (let i = 0; i < total; i++) {
    if (i !== current && !isLocked(i)) return { kind: "review" };
  }
  return { kind: "submit" };
}
