import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import quizReducer from "../store/slices/quizSlice";
import CreateQuizPage from "../components/Quizzes/CreateQuizPage";
import { QuizApiService } from "../services/quizApi";
import { toast } from "react-toastify";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../components/Proctoring/ProctoringSettings", () => ({
  default: () => <div>proctoring-settings</div>,
}));

vi.mock("../services/quizApi", async () => {
  const actual = await vi.importActual<typeof import("../services/quizApi")>(
    "../services/quizApi",
  );
  return {
    ...actual,
    QuizApiService: { ...actual.QuizApiService, createQuiz: vi.fn() },
  };
});

const mockedCreate = QuizApiService.createQuiz as unknown as ReturnType<typeof vi.fn>;

function renderPage() {
  const store = configureStore({ reducer: { quiz: quizReducer } });
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/courses/12/quizzes/new"]}>
        <Routes>
          <Route path="/courses/:courseId/quizzes/new" element={<CreateQuizPage />} />
          <Route path="/courses/:courseId" element={<div>course-page</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  return store;
}

/** Mimic the axios → handleQuizApiCall error shape for a server response. */
const serverError = (status: number, data: Record<string, unknown>) => ({
  response: { status, data },
});

describe("CreateQuizPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts the full payload to the course endpoint, toasts and navigates", async () => {
    mockedCreate.mockResolvedValue({
      success: true,
      data: { id: 77, title: "Algebra" },
    });
    const user = userEvent.setup();
    const store = renderPage();

    await user.type(screen.getByLabelText(/Quiz Title/i), "Algebra");
    await user.type(screen.getByLabelText(/^Description/i), "Desc");
    await user.selectOptions(screen.getByLabelText(/Quiz Type/i), "Assessment");
    await user.click(screen.getByRole("button", { name: /Create Quiz/i }));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    const [courseId, payload] = mockedCreate.mock.calls[0];
    expect(courseId).toBe(12);
    expect(payload).toMatchObject({ title: "Algebra", type: "Assessment" });
    expect(payload).not.toHaveProperty("time_limit");

    expect(toast.success).toHaveBeenCalledWith('Quiz "Algebra" created successfully');
    expect(await screen.findByText("course-page")).toBeInTheDocument();
    expect(store.getState().quiz.quizzes.map((q) => q.id)).toContain(77);
  });

  it("does not call the API when client validation fails", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Quiz/i }));
    expect(await screen.findByText("Quiz title is required")).toBeInTheDocument();
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("surfaces server field errors inline and toasts", async () => {
    mockedCreate.mockRejectedValue(
      serverError(400, {
        success: false,
        message: "Validation failed: Passing score cannot exceed 100%",
        errors: [{ field: "passing_score", message: "Passing score cannot exceed 100%" }],
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/Quiz Title/i), "Algebra");
    await user.type(screen.getByLabelText(/^Description/i), "Desc");
    await user.click(screen.getByRole("button", { name: /Create Quiz/i }));

    expect(await screen.findByText("Passing score cannot exceed 100%")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/Some fields need attention/),
    );
    expect(screen.queryByText("course-page")).not.toBeInTheDocument();
  });

  it("shows the server's message for non-field failures instead of a silent 500", async () => {
    mockedCreate.mockRejectedValue(
      serverError(502, {
        success: false,
        message: "Could not verify the course with the MIS. Please try again in a moment.",
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/Quiz Title/i), "Algebra");
    await user.type(screen.getByLabelText(/^Description/i), "Desc");
    await user.click(screen.getByRole("button", { name: /Create Quiz/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Could not verify the course/);
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/Could not verify the course/),
    );
  });

  it("goes to proctoring setup after creation when proctoring is enabled", async () => {
    mockedCreate.mockResolvedValue({ success: true, data: { id: 5, title: "P" } });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/Quiz Title/i), "P");
    await user.type(screen.getByLabelText(/^Description/i), "D");
    await user.click(screen.getByLabelText(/Enable online proctoring/i));
    await user.click(screen.getByRole("button", { name: /Create Quiz/i }));

    expect(await screen.findByText("proctoring-settings")).toBeInTheDocument();
  });
});
