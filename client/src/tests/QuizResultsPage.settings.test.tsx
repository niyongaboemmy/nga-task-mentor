import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
                attempts: { attempts_left: 1, in_progress_submission_id: null },
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
    expect(screen.getByRole("link", { name: "Take again (1 left)" })).toHaveAttribute(
      "href",
      "/quizzes/5/take",
    );
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
