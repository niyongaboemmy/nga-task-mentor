import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

/**
 * Timing behaviour of the quiz-taking page:
 *  - overall duration → one countdown, free back/forward navigation, answers
 *    kept, whole quiz auto-submitted at 0 (retrying on network failure);
 *  - no overall duration → the existing per-question countdown + auto-advance.
 * The proctoring stack and the real question components are stubbed out.
 */

const axiosMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));
vi.mock("../utils/axiosConfig", () => ({ default: axiosMock }));

const quizApi = vi.hoisted(() => ({
  getQuiz: vi.fn(),
  submitQuestionAnswer: vi.fn(),
}));
vi.mock("../services/quizApi", () => ({ QuizApiService: quizApi }));
vi.mock("../services/proctoringApi", () => ({
  ProctoringApiService: {
    getProctoringSettings: vi.fn().mockResolvedValue({ data: { enabled: false } }),
  },
}));

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));
vi.mock("react-toastify", () => ({ toast: toastMock }));
vi.mock("html2canvas", () => ({ default: vi.fn() }));
vi.mock("../components/Proctoring", () => ({ ProctoringSetup: () => null }));
vi.mock("../components/Proctoring/ProctoringMonitorComponent", () => ({ default: () => null }));
vi.mock("../components/Proctoring/FloatingCameraComponent", () => ({ default: () => null }));
vi.mock("../components/Proctoring/WarningNotification", () => ({ default: () => null }));
vi.mock("../components/Proctoring/NoteNotification", () => ({ default: () => null }));
vi.mock("../components/Proctoring/PauseOverlay", () => ({ default: () => null }));
vi.mock("../components/Common/RichTextDisplay", () => ({
  default: ({ content }: { content: string }) => <div>{content}</div>,
}));
vi.mock("../components/Quizzes/QuestionRenderer", () => ({
  QuestionRenderer: ({ question, answer, onAnswerChange, disabled }: any) => (
    <input
      aria-label={`answer-${question.id}`}
      value={answer ?? ""}
      disabled={disabled}
      onChange={(e) => onAnswerChange(e.target.value)}
    />
  ),
}));

// Node's own (path-less) localStorage shadows jsdom's here; the page also
// walks keys (key()/length) when clearing an attempt, so stub a full Storage.
class MemoryStorage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  key(i: number) {
    return Array.from(this.store.keys())[i] ?? null;
  }
  getItem(k: string) {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, String(v));
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}
vi.stubGlobal("localStorage", new MemoryStorage());

import QuizTakingPage from "../pages/QuizTakingPage";

const QUIZ_ID = 5;
const SUBMISSION_ID = 77;

function makeQuiz(timeLimit: number | null) {
  return {
    id: QUIZ_ID,
    title: "Timed quiz",
    description: "",
    status: "published",
    type: "Quiz",
    time_limit: timeLimit,
    questions: [101, 102, 103].map((id, i) => ({
      id,
      quiz_id: QUIZ_ID,
      points: 1,
      order: i + 1,
      question_type: "single_choice",
      question_text: `Question text ${id}`,
      questionBank: {
        question_type: "single_choice",
        question_text: `Question text ${id}`,
        time_limit_seconds: 10,
      },
    })),
  };
}

function ResultsProbe() {
  const location = useLocation();
  return <div>results-page {(location.state as any)?.submissionId}</div>;
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={[`/quizzes/${QUIZ_ID}/take`]}>
      <Routes>
        <Route path="/quizzes/:id/take" element={<QuizTakingPage />} />
        <Route path="/quizzes/:id/results" element={<ResultsProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Let pending promises (mocked requests) settle under fake timers. */
async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await flush();
}

async function startQuiz() {
  renderPage();
  await flush();
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: /^Next/ }));
  fireEvent.click(screen.getByRole("button", { name: /Start Quiz|Resume Quiz/ }));
  await flush();
}

const submitCalls = () =>
  axiosMock.post.mock.calls.filter(([url]) => url === `/quizzes/${QUIZ_ID}/submit`);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T10:00:00Z"));
  localStorage.clear();
  vi.clearAllMocks();
  axiosMock.get.mockResolvedValue({ data: { data: [] } });
  quizApi.submitQuestionAnswer.mockResolvedValue({ success: true, data: {} });
});

afterEach(() => {
  vi.useRealTimers();
});

function mockStart(timeRemaining: number | null) {
  axiosMock.post.mockImplementation(async (url: string) => {
    if (url === "/quizzes/submissions") {
      return {
        data: {
          data: {
            id: SUBMISSION_ID,
            quiz_id: QUIZ_ID,
            status: "in_progress",
            started_at: new Date().toISOString(),
            time_remaining_seconds: timeRemaining,
          },
        },
      };
    }
    if (url === `/quizzes/${QUIZ_ID}/submit`) {
      return { data: { success: true, data: { submission_id: SUBMISSION_ID } } };
    }
    throw new Error(`unexpected POST ${url}`);
  });
}

describe("QuizTakingPage — overall quiz duration", () => {
  beforeEach(() => {
    quizApi.getQuiz.mockResolvedValue({ success: true, data: makeQuiz(1) });
  });

  it("explains the whole-quiz timer before starting", async () => {
    mockStart(60);
    renderPage();
    await flush();
    expect(screen.getByText(/1 min for the whole quiz/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Next/ }));
    expect(
      screen.getByText(/submitted automatically with the answers you have given/i),
    ).toBeInTheDocument();
  });

  it("uses one countdown, ignores per-question timeouts and lets the student go back and change answers", async () => {
    mockStart(60);
    await startQuiz();

    expect(screen.getByRole("timer")).toHaveAccessibleName("Quiz time left: 1:00");
    expect(screen.getByRole("button", { name: "Previous question" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("answer-101"), { target: { value: "A" } });
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("answer-102"), { target: { value: "B" } });

    // Well past the 10 s per-question limit: no auto-advance, no locking.
    await advance(15_000);
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveAccessibleName("Quiz time left: 0:45");

    // Go back and change the first answer.
    fireEvent.click(screen.getByRole("button", { name: "Previous question" }));
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
    const first = screen.getByLabelText("answer-101");
    expect(first).toHaveValue("A");
    expect(first).not.toBeDisabled();
    fireEvent.change(first, { target: { value: "C" } });

    // Jump straight to question 3 from the grid; the last step is Review & Submit.
    fireEvent.click(screen.getByRole("button", { name: /^Question 3, not answered/ }));
    expect(screen.getByText("Question 3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review & Submit/ })).toBeInTheDocument();

    // Background saves went to the server for the cheap-to-grade answers.
    expect(quizApi.submitQuestionAnswer).toHaveBeenCalledWith(
      SUBMISSION_ID,
      101,
      "C",
      expect.any(Number),
    );
    expect(submitCalls()).toHaveLength(0);
  });

  it("auto-submits the whole quiz with every answer when time runs out", async () => {
    const cameraTrack = { kind: "video", readyState: "live", stop: vi.fn() };
    (window as any).proctoringStream = {
      getTracks: () => [cameraTrack],
      getVideoTracks: () => [cameraTrack],
    };
    quizApi.getQuiz.mockResolvedValue({ success: true, data: makeQuiz(2) });
    mockStart(120);
    await startQuiz();

    fireEvent.change(screen.getByLabelText("answer-101"), { target: { value: "A" } });
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    fireEvent.change(screen.getByLabelText("answer-102"), { target: { value: "B" } });

    await advance(61_000);
    expect(toastMock.warn).toHaveBeenCalledWith(
      expect.stringMatching(/1 minute left/),
      expect.anything(),
    );
    await advance(55_000);
    expect(submitCalls()).toHaveLength(0);

    await advance(5_000);
    expect(submitCalls()).toHaveLength(1);
    const body = submitCalls()[0][1];
    expect(body.answers.map((a: any) => [a.question_id, a.answer])).toEqual([
      [101, "A"],
      [102, "B"],
    ]);
    expect(screen.getByText(`results-page ${SUBMISSION_ID}`)).toBeInTheDocument();
    expect(localStorage.getItem(`quiz_${QUIZ_ID}_answers`)).toBeNull();
    // The proctoring camera/mic is switched off once the quiz is submitted.
    expect(cameraTrack.stop).toHaveBeenCalled();
    expect((window as any).proctoringStream).toBeNull();
  });

  it("keeps the answers and offers a retry when the auto-submit can't reach the server", async () => {
    mockStart(5);
    await startQuiz();
    fireEvent.change(screen.getByLabelText("answer-101"), { target: { value: "A" } });

    axiosMock.post.mockRejectedValue(new Error("Network Error"));
    await advance(6_000);
    // Retries with back-off (1 s, 2 s, 4 s) before giving up.
    await advance(1_000);
    await advance(2_000);
    await advance(4_000);
    expect(submitCalls()).toHaveLength(4);

    expect(screen.getByText("Time's up!")).toBeInTheDocument();
    expect(screen.getByText(/answer is\s+kept on this device/i)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(`quiz_${QUIZ_ID}_answers`)!)).toEqual([
      expect.objectContaining({ question_id: 101, answer: "A" }),
    ]);
    expect(screen.getByLabelText("answer-101")).toBeDisabled();

    mockStart(0);
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    await flush();
    expect(submitCalls().at(-1)![1].answers).toEqual([
      expect.objectContaining({ question_id: 101, answer: "A" }),
    ]);
    expect(screen.getByText(`results-page ${SUBMISSION_ID}`)).toBeInTheDocument();
  });

  it("resumes with the server deadline and the answers saved on the server", async () => {
    axiosMock.get.mockResolvedValue({
      data: {
        data: [
          {
            id: SUBMISSION_ID,
            quiz_id: QUIZ_ID,
            status: "in_progress",
            started_at: new Date(Date.now() - 30_000).toISOString(),
            time_remaining_seconds: 30,
            answers: [{ question_id: 101, answer_data: "saved-on-server", time_taken: 4 }],
          },
        ],
      },
    });
    mockStart(30);
    renderPage();
    await flush();

    expect(screen.getByText(/attempt in progress with 1 of\s+3 answered/i)).toBeInTheDocument();
    expect(screen.getByText("0:30 left")).toBeInTheDocument();

    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: /^Next/ }));
    fireEvent.click(screen.getByRole("button", { name: /Resume Quiz/ }));
    await flush();
    // Starts at the first unanswered question; the saved answer is there on the way back.
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous question" }));
    expect(screen.getByLabelText("answer-101")).toHaveValue("saved-on-server");
  });
});

describe("QuizTakingPage — per-question durations (no overall duration)", () => {
  beforeEach(() => {
    quizApi.getQuiz.mockResolvedValue({ success: true, data: makeQuiz(null) });
  });

  it("keeps the per-question countdown and auto-advances when a question's time ends", async () => {
    mockStart(null);
    await startQuiz();

    expect(screen.getByRole("timer")).toHaveAccessibleName("Question: 0:10");
    expect(screen.queryByText(/Quiz time left/)).not.toBeInTheDocument();
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();

    for (let i = 0; i < 11; i++) await advance(1_000);
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
    expect(submitCalls()).toHaveLength(0);
  });

  const tick = async (seconds: number) => {
    for (let i = 0; i < seconds; i++) await advance(1_000);
  };

  it("skips an unanswered question and resumes it later with the time it had left", async () => {
    mockStart(null);
    await startQuiz();

    // Nothing answered: the forward button is a skip, never blocked.
    expect(screen.queryByText(/Please save your answer/)).not.toBeInTheDocument();
    await tick(4);
    fireEvent.click(screen.getByRole("button", { name: "Skip question" }));
    await flush();
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
    expect(quizApi.submitQuestionAnswer).not.toHaveBeenCalled();
    expect(screen.getByRole("timer")).toHaveAccessibleName("Question: 0:10");

    // Away from question 1 its clock is paused.
    await tick(3);
    expect(screen.getByRole("button", { name: /^Question 1, skipped, not answered/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Question 1, skipped/ }));
    await flush();
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveAccessibleName("Question: 0:06");

    // Answer it; moving on saves it with only the on-screen time (4 s + 2 s).
    await tick(2);
    fireEvent.change(screen.getByLabelText("answer-101"), { target: { value: "A" } });
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    await flush();
    expect(quizApi.submitQuestionAnswer).toHaveBeenCalledWith(SUBMISSION_ID, 101, "A", 6);
    // Question 2 kept the 7 s it had left.
    expect(screen.getByRole("timer")).toHaveAccessibleName("Question: 0:07");
  });

  it("locks a question whose own time ran out, but leaves the others open", async () => {
    mockStart(null);
    await startQuiz();
    await tick(11);
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Question 1, time's up, not answered/ }));
    await flush();
    expect(screen.getByLabelText("answer-101")).toBeDisabled();
    expect(screen.getByText(/Time ran out on this question/)).toBeInTheDocument();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    // Nothing to skip on a locked question: just move on.
    expect(screen.getByRole("button", { name: "Next question" })).toBeEnabled();
    expect(submitCalls()).toHaveLength(0);
  });

  it("warns about unanswered questions and needs an explicit confirmation to submit", async () => {
    mockStart(null);
    await startQuiz();
    fireEvent.change(screen.getByLabelText("answer-101"), { target: { value: "A" } });

    fireEvent.click(screen.getByRole("button", { name: "Submit quiz" }));
    await flush();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("2 questions not answered")).toBeInTheDocument();
    expect(within(dialog).getByText(/can't be undone/)).toBeInTheDocument();
    // The unanswered ones are one tap away.
    expect(within(dialog).getByRole("button", { name: "Go to question 2" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Go to question 3" })).toBeInTheDocument();

    const submit = within(dialog).getByRole("button", { name: /Submit anyway/ });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(submitCalls()).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await flush();
    expect(submitCalls()).toHaveLength(1);
    expect(submitCalls()[0][1].answers).toEqual([expect.objectContaining({ question_id: 101, answer: "A" })]);
  });

  it("goes back to an unanswered question from the review sheet", async () => {
    mockStart(null);
    await startQuiz();
    fireEvent.click(screen.getByRole("button", { name: "Submit quiz" }));
    await flush();
    // Nothing answered yet: the header button is disabled, so use the last step.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("answer-101"), { target: { value: "A" } });
    fireEvent.click(screen.getByRole("button", { name: /^Question 3/ }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /Review & Submit/ }));
    await flush();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Go to question 2" }));
    await flush();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
  });

  it("submits without the extra confirmation when every question is answered", async () => {
    mockStart(null);
    await startQuiz();
    for (const qid of [101, 102, 103]) {
      fireEvent.change(screen.getByLabelText(`answer-${qid}`), { target: { value: "x" } });
      if (qid !== 103) {
        fireEvent.click(screen.getByRole("button", { name: "Next question" }));
        await flush();
      }
    }
    fireEvent.click(screen.getByRole("button", { name: /Review & Submit/ }));
    await flush();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Ready to submit?")).toBeInTheDocument();
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Submit quiz/ }));
    await flush();
    expect(submitCalls()).toHaveLength(1);
  });
});

describe("QuizTakingPage — focus mode", () => {
  it("keeps floating extras (install prompts) away while the quiz page is open", async () => {
    quizApi.getQuiz.mockResolvedValue({ success: true, data: makeQuiz(null) });
    mockStart(null);
    const { HideInFocusMode } = await import("../utils/focusMode");
    const view = render(
      <HideInFocusMode>
        <button>Install Task Mentor</button>
      </HideInFocusMode>,
    );
    expect(screen.getByRole("button", { name: "Install Task Mentor" })).toBeVisible();

    renderPage();
    await flush();
    expect(document.documentElement).toHaveAttribute("data-focus-mode");
    expect(screen.getByText("Install Task Mentor")).not.toBeVisible();
    view.unmount();
  });
});

describe("QuizTakingPage — quiz settings on the instructions screen", () => {
  const state = (over: Record<string, any> = {}) => ({
    availability: { state: "open", opens_at: null, closes_at: null },
    attempts: {
      max_attempts: 3,
      attempts_used: 1,
      attempts_left: 2,
      in_progress_submission_id: null,
      current_attempt_number: 2,
      can_start_new_attempt: true,
      last_finished_submission_id: 900,
    },
    enrolled: true,
    can_start: true,
    blocked_reason: null,
    ...over,
  });

  const goToLastStep = () => {
    let next = screen.queryByRole("button", { name: /^Next/ });
    while (next) {
      fireEvent.click(next);
      next = screen.queryByRole("button", { name: /^Next/ });
    }
  };

  it("shows the teacher's instructions first and summarises the settings", async () => {
    quizApi.getQuiz.mockResolvedValue({
      success: true,
      data: {
        ...makeQuiz(null),
        instructions: "Show your working on paper.",
        passing_score: 70,
        question_count: 3,
        randomize_questions: true,
        student_state: state({
          availability: { state: "open", opens_at: null, closes_at: "2026-10-01T10:00:00Z" },
        }),
      },
    });
    renderPage();
    await flush();

    expect(screen.getByText("From your teacher")).toBeInTheDocument();
    expect(screen.getByText("Show your working on paper.")).toBeInTheDocument();
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getByText("Per question")).toBeInTheDocument();
    expect(screen.getByText(/questions are shuffled for you/)).toBeInTheDocument();

    goToLastStep();
    expect(screen.getByRole("button", { name: /Start Quiz/ })).toBeEnabled();
  });

  it("explains why it can't start and links to results when attempts are used up", async () => {
    quizApi.getQuiz.mockResolvedValue({
      success: true,
      data: {
        ...makeQuiz(null),
        student_state: state({
          can_start: false,
          blocked_reason: "You have used all 3 attempts for this quiz.",
        }),
      },
    });
    renderPage();
    await flush();

    expect(screen.getByRole("alert")).toHaveTextContent(/used all 3 attempts/);
    expect(screen.getByRole("link", { name: /View my results/ })).toHaveAttribute(
      "href",
      `/quizzes/${QUIZ_ID}/results`,
    );
    goToLastStep();
    expect(screen.getByRole("button", { name: /Start Quiz/ })).toBeDisabled();
  });

  it("shows when a not-yet-open quiz opens", async () => {
    quizApi.getQuiz.mockResolvedValue({
      success: true,
      data: {
        ...makeQuiz(null),
        student_state: state({
          can_start: false,
          blocked_reason: "This quiz opens on 2026-10-05T08:00:00.000Z.",
          availability: { state: "not_open", opens_at: "2026-10-05T08:00:00.000Z", closes_at: null },
          attempts: { ...state().attempts, last_finished_submission_id: null, attempts_used: 0 },
        }),
      },
    });
    renderPage();
    await flush();
    expect(screen.getByRole("alert")).toHaveTextContent(/This quiz opens on/);
    expect(screen.queryByRole("link", { name: /View my results/ })).not.toBeInTheDocument();
  });
});
