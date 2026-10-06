import { Op, Transaction } from "sequelize";
import { QuizSubmission } from "../models";

/**
 * What a student may see and do with a quiz, derived from the quiz's own
 * settings. Every student-facing endpoint (taking, submitting, results) goes
 * through these helpers so the settings mean the same thing everywhere.
 *
 * Settings → rules
 *  - status / start_date / end_date → `quizAvailability`
 *  - max_attempts (null = unlimited)  → `studentAttemptSummary`
 *  - randomize_questions              → `seededShuffle` (stable per attempt)
 *  - show_results_immediately, enable_automatic_grading,
 *    require_manual_grading, show_correct_answers → `resultVisibility`
 *  - passing_score (null = 60)        → `isPassed`
 */

export const DEFAULT_PASSING_SCORE = 60;

/** Submissions that used up an attempt. */
export const FINISHED_STATUSES = ["completed", "timed_out", "abandoned"] as const;

// ─── Availability ──────────────────────────────────────────────────────────

export type AvailabilityState = "open" | "not_open" | "closed" | "unpublished";

export interface Availability {
  state: AvailabilityState;
  opens_at: string | null;
  closes_at: string | null;
}

export function quizAvailability(quiz: any, now: Date = new Date()): Availability {
  const opens = quiz?.start_date ? new Date(quiz.start_date) : null;
  const closes = quiz?.end_date ? new Date(quiz.end_date) : null;
  let state: AvailabilityState = "open";
  if (quiz?.status !== "published") state = "unpublished";
  else if (opens && now < opens) state = "not_open";
  else if (closes && now > closes) state = "closed";
  return {
    state,
    opens_at: opens ? opens.toISOString() : null,
    closes_at: closes ? closes.toISOString() : null,
  };
}

export function availabilityMessage(a: Availability): string {
  switch (a.state) {
    case "not_open":
      return `This quiz opens on ${a.opens_at}.`;
    case "closed":
      return "This quiz is closed.";
    case "unpublished":
      return "This quiz is not published.";
    default:
      return "";
  }
}

// ─── Attempts ──────────────────────────────────────────────────────────────

export interface AttemptSummary {
  max_attempts: number | null;
  attempts_used: number;
  /** null = unlimited */
  attempts_left: number | null;
  in_progress_submission_id: number | null;
  /** Attempt number of the in-progress attempt, or of the next one. */
  current_attempt_number: number;
  can_start_new_attempt: boolean;
  last_finished_submission_id: number | null;
}

export const normalizeMaxAttempts = (v: unknown): number | null => {
  const n = Number(v);
  return v === null || v === undefined || !Number.isFinite(n) || n <= 0
    ? null
    : Math.floor(n);
};

export async function studentAttemptSummary(
  quiz: any,
  studentId: number,
  transaction?: Transaction,
): Promise<AttemptSummary> {
  const submissions = await QuizSubmission.findAll({
    where: { quiz_id: quiz.id, student_id: studentId },
    attributes: ["id", "status", "attempt_number", "completed_at", "started_at"],
    order: [["started_at", "DESC"]],
    transaction,
  });
  const finished = submissions.filter((s) =>
    (FINISHED_STATUSES as readonly string[]).includes(s.status),
  );
  const inProgress = submissions.find((s) => s.status === "in_progress");
  const max = normalizeMaxAttempts(quiz.max_attempts);
  const used = finished.length;
  return {
    max_attempts: max,
    attempts_used: used,
    attempts_left: max === null ? null : Math.max(0, max - used),
    in_progress_submission_id: inProgress?.id ?? null,
    current_attempt_number: inProgress?.attempt_number ?? used + 1,
    can_start_new_attempt: max === null || used < max,
    last_finished_submission_id: finished[0]?.id ?? null,
  };
}

// ─── Scoring & results visibility ──────────────────────────────────────────

export const passingScoreOf = (quiz: any): number => {
  const n = Number(quiz?.passing_score);
  return quiz?.passing_score === null || quiz?.passing_score === undefined || !Number.isFinite(n)
    ? DEFAULT_PASSING_SCORE
    : n;
};

export const isPassed = (percentage: number, quiz: any): boolean =>
  Number(percentage) >= passingScoreOf(quiz);

/** Grades need a person before students see them. */
export const needsManualReview = (quiz: any): boolean =>
  quiz?.require_manual_grading === true || quiz?.enable_automatic_grading === false;

/**
 * grade_status of a just-finished attempt. `needsReview`: some answer couldn't
 * be graded automatically (e.g. a code answer the judge couldn't run), so the
 * instructor has to look at it whatever the quiz settings say.
 */
export const gradeStatusOnSubmit = (
  quiz: any,
  needsReview = false,
): "pending" | "auto_graded" =>
  needsManualReview(quiz) || needsReview ? "pending" : "auto_graded";

export interface ResultVisibility {
  /** The student may open their results (their answers). */
  released: boolean;
  /** Score, grade, pass/fail and per-question points/correctness. */
  show_score: boolean;
  /** Correct answers and explanations. */
  show_correct_answers: boolean;
  /** Why something is hidden, for the student. */
  message: string | null;
}

/**
 *  - show_results_immediately: results open right after submitting;
 *    otherwise once the instructor has graded the attempt.
 *  - enable_automatic_grading ("show grades immediately") and
 *    require_manual_grading: the score waits for the instructor's grading.
 *  - show_correct_answers: correct answers + explanations, once released.
 */
export function resultVisibility(quiz: any, submission: any): ResultVisibility {
  const graded = submission?.grade_status === "graded";
  const released = graded || quiz?.show_results_immediately !== false;
  const show_score = graded || (released && !needsManualReview(quiz));
  const show_correct_answers = released && quiz?.show_correct_answers === true;
  let message: string | null = null;
  if (!released) {
    message = "Your quiz was submitted. Results will be available after your instructor reviews it.";
  } else if (!show_score) {
    message = "Your answers were submitted. Your grade will be shown after your instructor reviews it.";
  }
  return { released, show_score, show_correct_answers, message };
}

const letterGrade = (p: number): string => {
  if (p >= 90) return "A";
  if (p >= 80) return "B";
  if (p >= 70) return "C";
  if (p >= 60) return "D";
  return "F";
};

const parseJson = (v: any) => {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
};

/**
 * The student's results payload for one finished submission (loaded with
 * attempts → attemptQuestion → questionBank), with everything the quiz's
 * settings don't allow stripped out.
 */
export function buildStudentResults(submission: any, quiz: any) {
  const v = resultVisibility(quiz, submission);
  const base = {
    submission_id: submission.id,
    quiz_id: quiz?.id ?? submission.quiz_id,
    quiz_title: quiz?.title,
    attempt_number: submission.attempt_number,
    status: submission.status,
    grade_status: submission.grade_status,
    submitted_at: submission.completed_at,
    /** Seconds (the results page formats seconds). */
    time_taken: Number(submission.time_taken) || 0,
    results_available: v.released,
    message: v.message,
    grading_settings: {
      enable_automatic_grading: quiz?.enable_automatic_grading !== false,
      require_manual_grading: quiz?.require_manual_grading === true,
      show_grades: v.show_score,
      show_correct_answers: v.show_correct_answers,
    },
  };
  if (!v.released) return base;

  const percentage = Number(submission.percentage) || 0;
  const graded = submission.grade_status === "graded";
  const results = (submission.attempts || []).map((attempt: any) => {
    const bank = attempt.attemptQuestion?.questionBank;
    const qd = parseJson(bank?.question_data);
    // A code answer the judge couldn't grade shows as "pending", not 0.
    const awaitingReview =
      !graded && parseJson(attempt.grading_details)?.grade_status === "pending";
    const showPoints = v.show_score && !awaitingReview;
    return {
      question_id: attempt.question_id,
      question_text: bank?.question_text,
      question_type: bank?.question_type,
      question_data: v.show_correct_answers ? qd : stripAnswerFields(qd, bank?.question_type),
      user_answer: attempt.submitted_answer,
      correct_answer: v.show_correct_answers ? attempt.correct_answer : null,
      is_correct: showPoints ? attempt.is_correct : null,
      points_earned: showPoints ? Number(attempt.points_earned) || 0 : null,
      max_points: Number(attempt.attemptQuestion?.points) || 0,
      explanation: v.show_correct_answers ? bank?.explanation ?? null : null,
      time_taken: attempt.time_taken,
      // Per-test results of code questions; hidden tests only as pass/fail,
      // and only once the score is visible.
      grading_details: studentGradingDetails(attempt.grading_details, {
        includeHidden: v.show_score,
      }),
    };
  });

  return {
    ...base,
    final_score: v.show_score ? Number(submission.total_score) || 0 : null,
    max_score: Number(submission.max_score) || 0,
    percentage: v.show_score ? percentage : null,
    grade: v.show_score ? letterGrade(percentage) : "N/A",
    passed: v.show_score ? submission.passed : null,
    passing_score: passingScoreOf(quiz),
    feedback: submission.grade_status === "graded" ? submission.feedback : null,
    results,
  };
}

// ─── Per-test results of code questions ───────────────────────────────────

/** Grader fields that reveal the score; students get them with the score only. */
const SCORE_DETAIL_KEYS = [
  "strategy_used",
  "breakdown",
  "penalties_applied",
  "quality_score",
  "efficiency_score",
  "correctness_score",
] as const;

/**
 * quiz_attempts.grading_details as a student may see it. Visible tests come
 * back in full (input, expected, actual output, error). Hidden tests never
 * show their input, expected output, actual output or error: with
 * `includeHidden` they are reduced to {testCaseId, is_hidden, passed, points};
 * without it they are left out, and the pass counts cover visible tests only
 * (so a student can't learn their hidden-test score while it isn't released).
 * Staff (QUIZZES_VIEW_RESULTS_ALL) get the stored record as is.
 */
export function studentGradingDetails(
  details: any,
  opts: { includeHidden: boolean },
): Record<string, any> | null {
  const d = parseJson(details);
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;

  const out: Record<string, any> = {};
  if (typeof d.grade_status === "string") out.grade_status = d.grade_status;
  if (typeof d.pending_reason === "string") out.pending_reason = d.pending_reason;

  const raw = Array.isArray(d.testResults)
    ? d.testResults
    : Array.isArray(d.test_results)
      ? d.test_results
      : null;
  if (raw) {
    const tests: any[] = [];
    for (const r of raw) {
      if (!r || typeof r !== "object") continue;
      if (r.is_hidden) {
        if (opts.includeHidden) {
          tests.push({
            testCaseId: r.testCaseId ?? r.id ?? null,
            is_hidden: true,
            passed: r.passed === true,
            points: r.points ?? null,
          });
        }
        continue;
      }
      tests.push({
        testCaseId: r.testCaseId ?? r.id ?? null,
        is_hidden: false,
        passed: r.passed === true,
        points: r.points ?? null,
        input: r.input ?? null,
        expected: r.expected ?? null,
        actual: r.actual ?? null,
        error: r.error ?? null,
        status: r.status ?? null,
        executionTime: r.executionTime ?? null,
        memoryUsed: r.memoryUsed ?? null,
      });
    }
    out.testResults = tests;
    if (opts.includeHidden) {
      out.passedTests = Number(d.passedTests ?? tests.filter((t) => t.passed).length);
      out.totalTests = Number(d.totalTests ?? raw.length);
    } else {
      out.passedTests = tests.filter((t) => t.passed).length;
      out.totalTests = tests.length;
    }
  }

  if (opts.includeHidden) {
    for (const k of SCORE_DETAIL_KEYS) if (d[k] !== undefined) out[k] = d[k];
  }
  return Object.keys(out).length ? out : null;
}

// ─── Hiding answers from the student while they take the quiz ─────────────

/** Keys that are the answer itself, wherever they appear in question_data. */
const ANSWER_KEYS = new Set([
  "correct_option_index",
  "correct_option_indices",
  "correct_answer",
  "correct_answers",
  "correct_order",
  "correct_expression",
  "correct_option",
  "correct_value",
  "acceptable_range",
  "sample_answer",
  "model_answer",
  "expected_answer",
  "expected_code",
  "solution",
  "solution_code",
  "reference_solution",
  // Algorithmic questions are now answered with code; an imported
  // algorithm's code is the reference solution.
  "algorithm_code",
  "explanation",
]);

/**
 * question_data without anything that gives the answer away. Structures the
 * renderers index into are kept (as empty values) so nothing crashes.
 */
export function stripAnswerFields(questionData: any, _type?: string, seed?: string): any {
  const qd = parseJson(questionData);
  if (!qd || typeof qd !== "object" || Array.isArray(qd)) return qd ?? null;

  const out: any = {};
  for (const [k, val] of Object.entries(qd)) {
    if (ANSWER_KEYS.has(k)) continue;
    out[k] = val;
  }

  if ("correct_matches" in qd) out.correct_matches = {};
  if (Array.isArray(qd.drop_zones)) {
    out.drop_zones = qd.drop_zones.map((z: any) => ({ ...z, correct_items: [] }));
  }
  if (Array.isArray(qd.acceptable_answers)) {
    out.acceptable_answers = qd.acceptable_answers.map((b: any) => ({
      blank_index: b?.blank_index,
      case_sensitive: b?.case_sensitive,
      answers: [],
    }));
  }
  if (Array.isArray(qd.dropdown_options)) {
    out.dropdown_options = qd.dropdown_options.map((d: any) => {
      const copy: any = {};
      for (const [k, val] of Object.entries(d || {})) {
        if (!ANSWER_KEYS.has(k) && !/^correct/.test(k)) copy[k] = val;
      }
      return copy;
    });
  }
  // Ordering items are stored in their correct order with their position:
  // shuffle them and drop the position.
  if (Array.isArray(qd.items) && qd.items.some((i: any) => i && "order" in i)) {
    const items = qd.items.map(({ order: _o, ...rest }: any) => rest);
    out.items = seededShuffle(items, `${seed ?? "items"}:order`);
  }
  // Hidden test cases stay hidden.
  if (Array.isArray(qd.test_cases)) {
    out.test_cases = qd.test_cases.map((tc: any) =>
      tc?.is_hidden
        ? { id: tc.id, is_hidden: true, points: tc.points, input: "", expected_output: "" }
        : tc,
    );
  }
  return out;
}

/** A QuizQuestion (JSON, with questionBank) as the student may see it. */
export function sanitizeQuestionForStudent(question: any, seed: string): any {
  const bank = question.questionBank || {};
  const qd = stripAnswerFields(bank.question_data, bank.question_type, `${seed}:${question.id}`);
  const { correct_answer: _ca, explanation: _ex, ...safeBank } = bank;
  const { QuizAttempts: _a, attempts: _b, correct_answer: _c, explanation: _d, ...safeQ } = question;
  return {
    ...safeQ,
    question_data: question.question_data ? qd : undefined,
    questionBank: { ...safeBank, question_data: qd },
  };
}

// ─── Stable shuffle ────────────────────────────────────────────────────────

function hashSeed(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/**
 * Deterministic Fisher–Yates: the same seed gives the same order, so a
 * randomized quiz keeps its order across reloads and devices within one
 * attempt, and a new attempt gets a new order.
 */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let a = hashSeed(seed);
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const attemptSeed = (quizId: number, studentId: number, attemptNumber: number) =>
  `quiz:${quizId}:student:${studentId}:attempt:${attemptNumber}`;

// Re-exported for callers that only need the operator set.
export const finishedStatusWhere = { [Op.in]: [...FINISHED_STATUSES] };
