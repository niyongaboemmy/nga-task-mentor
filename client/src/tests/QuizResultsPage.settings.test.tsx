import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const axiosMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../utils/axiosConfig", () => ({ default: axiosMock }));
vi.mock("../components/Quizzes/QuestionRenderer", () => ({ QuestionRenderer: () => null }));
vi.mock("../components/Common/RichTextDisplay", () => ({
  default: ({ content }: { content: string }) => <div>{content}</div>,
}));

import QuizResultsPage from "../pages/QuizResultsPage";

function renderAt() {
  render(
    <MemoryRouter initialEntries={["/quizzes/5/results"]}>
      <Routes>
        <Route path="/quizzes/:id/results" element={<QuizResultsPage />} />
        <Route path="/quizzes/:id/take" element={<div>take-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("QuizResultsPage — result settings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("says results are held back (no score) and offers the remaining attempts", async () => {
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url === "/quizzes/5") {
        return {
          data: {
            data: {
              id: 5,
              title: "Algebra",
              student_state: {
                can_start: true,
                availability: { state: "open", opens_at: null, closes_at: null },
                attempts: {
                  max_attempts: 2,
                  attempts_used: 1,
                  attempts_left: 1,
                  in_progress_submission_id: null,
                  current_attempt_number: 2,
                  can_start_new_attempt: true,
                  last_finished_submission_id: 1,
                },
              },
            },
          },
        };
      }
      return {
        data: {
          data: {
            results_available: false,
            message: "Results will be available after your instructor reviews it.",
          },
        },
      };
    });
    renderAt();

    expect(await screen.findByText("Quiz submitted")).toBeInTheDocument();
    expect(screen.getByText(/after your instructor reviews it/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Take again/ })).toHaveTextContent("1 try left");
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("offers clear next steps after released results", async () => {
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url === "/quizzes/5") {
        return {
          data: {
            data: {
              id: 5,
              title: "Algebra",
              student_state: {
                can_start: true,
                availability: { state: "open", opens_at: null, closes_at: null },
                attempts: {
                  max_attempts: 3,
                  attempts_used: 1,
                  attempts_left: 2,
                  in_progress_submission_id: null,
                  current_attempt_number: 2,
                  can_start_new_attempt: true,
                  last_finished_submission_id: 1,
                },
              },
            },
          },
        };
      }
      return {
        data: {
          data: {
            results_available: true,
            final_score: 1,
            max_score: 1,
            percentage: 100,
            grade: "A",
            passed: true,
            results: [],
            grading_settings: { show_grades: true, show_correct_answers: false },
          },
        },
      };
    });
    renderAt();

    const next = await screen.findByRole("region", { name: /What would you like to do next/ });
    const take = within(next).getByRole("button", { name: /Take again/ });
    expect(take).toHaveTextContent("2 tries left");
    expect(within(next).getByText("1 of 3 tries used")).toBeInTheDocument();
    expect(within(next).getByRole("link", { name: /Another quiz/ })).toHaveAttribute(
      "href",
      "/my-quizzes",
    );
    expect(within(next).getByRole("button", { name: /Print results/ })).toBeInTheDocument();
  });

  const attempts = (max: number | null, used: number) => ({
    max_attempts: max,
    attempts_used: used,
    attempts_left: max === null ? null : Math.max(0, max - used),
    in_progress_submission_id: null,
    current_attempt_number: used + 1,
    can_start_new_attempt: max === null || used < max,
    last_finished_submission_id: 1,
  });
  const quizWith = (max: number | null, used: number) => ({
    id: 5,
    title: "Algebra",
    student_state: {
      availability: { state: "open", opens_at: null, closes_at: null },
      attempts: attempts(max, used),
      enrolled: true,
      can_start: max === null || used < max,
      blocked_reason: null,
    },
  });
  const released = {
    results_available: true,
    final_score: 1,
    max_score: 1,
    percentage: 100,
    grade: "A",
    passed: true,
    results: [],
    grading_settings: { show_grades: true, show_correct_answers: false },
  };

  it("shows 'No tries left' (disabled) when every allowed try is used", async () => {
    axiosMock.get.mockImplementation(async (url: string) => ({
      data: { data: url === "/quizzes/5" ? quizWith(2, 2) : released },
    }));
    renderAt();
    const next = await screen.findByRole("region", { name: /What would you like to do next/ });
    expect(within(next).queryByRole("button", { name: /Take again/ })).not.toBeInTheDocument();
    expect(within(next).getByRole("group", { name: /No tries left/ })).toHaveTextContent(
      "All 2 tries used",
    );
    expect(within(next).getByText("2 of 2 tries used")).toBeInTheDocument();
  });

  it("re-checks tries with the server before starting another attempt", async () => {
    let calls = 0;
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url !== "/quizzes/5") return { data: { data: released } };
      calls += 1;
      // Page load: 1 of 3 used. On click: still allowed.
      return { data: { data: quizWith(3, 1) } };
    });
    renderAt();
    const take = await screen.findByRole("button", { name: /Take again/ });
    fireEvent.click(take);
    expect(await screen.findByText("take-page")).toBeInTheDocument();
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it("stays and explains when the last try was used elsewhere in the meantime", async () => {
    let calls = 0;
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url !== "/quizzes/5") return { data: { data: released } };
      calls += 1;
      return { data: { data: calls === 1 ? quizWith(2, 1) : quizWith(2, 2) } };
    });
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: /Take again/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/No tries left: all 2 tries used/);
    expect(screen.queryByText("take-page")).not.toBeInTheDocument();
    expect(screen.getByText("2 of 2 tries used")).toBeInTheDocument();
  });
});
