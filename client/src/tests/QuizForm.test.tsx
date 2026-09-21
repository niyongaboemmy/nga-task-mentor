import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuizForm from "../components/Quizzes/QuizForm";

const onSubmit = vi.fn();
const onCancel = vi.fn();

const fillRequired = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(/Quiz Title/i), "Algebra basics");
  await user.type(screen.getByLabelText(/^Description/i), "Linear equations");
};

describe("QuizForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders every capturable field and no quiz-level time limit", () => {
    render(<QuizForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />);

    for (const label of [
      /Quiz Title/i,
      /^Description/i,
      /Quiz Type/i,
      /Instructions/i,
      /Maximum Attempts/i,
      /Passing Score/i,
      /Available From/i,
      /Available Until/i,
      /Show results immediately/i,
      /Randomize question order/i,
      /Show correct answers/i,
      /Show grades to students immediately/i,
      /Require instructor manual grading/i,
      /publicly accessible/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.queryByLabelText(/Time Limit/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Quiz Status/i)).not.toBeInTheDocument();
  });

  it("offers only DB-valid quiz types (not practice/graded)", () => {
    render(<QuizForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />);
    const options = Array.from(
      (screen.getByLabelText(/Quiz Type/i) as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(options).toEqual(["Quiz", "Assessment", "Homework", "Exam"]);
  });

  it("shows the status select only in edit mode, without 'archived'", () => {
    render(<QuizForm mode="edit" onSubmit={onSubmit} onCancel={onCancel} />);
    const options = Array.from(
      (screen.getByLabelText(/Quiz Status/i) as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(options).toEqual(["draft", "published", "completed"]);
  });

  it("blocks submit and shows inline errors when required fields are empty", async () => {
    const user = userEvent.setup();
    render(<QuizForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: /Create Quiz/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText("Quiz title is required")).toBeInTheDocument();
    expect(screen.getByText("Description is required")).toBeInTheDocument();
    expect(screen.getByLabelText(/Quiz Title/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/fix the 2 highlighted fields/i)).toBeInTheDocument();
  });

  it("validates numeric ranges and the date window", async () => {
    const user = userEvent.setup();
    render(<QuizForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />);
    await fillRequired(user);
    await user.type(screen.getByLabelText(/Maximum Attempts/i), "99");
    await user.type(screen.getByLabelText(/Passing Score/i), "150");
    await user.type(screen.getByLabelText(/Available From/i), "2026-09-21T10:00");
    await user.type(screen.getByLabelText(/Available Until/i), "2026-09-21T09:00");

    await user.click(screen.getByRole("button", { name: /Create Quiz/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/cannot exceed 50/)).toBeInTheDocument();
    expect(screen.getByText(/cannot exceed 100%/)).toBeInTheDocument();
    expect(screen.getByText(/End date must be after the start date/)).toBeInTheDocument();
  });

  it("clears an inline error once the field is corrected", async () => {
    const user = userEvent.setup();
    render(<QuizForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: /Create Quiz/i }));
    expect(await screen.findByText("Quiz title is required")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Quiz Title/i), "Now valid");
    await waitFor(() =>
      expect(screen.queryByText("Quiz title is required")).not.toBeInTheDocument(),
    );
  });

  it("submits a fully-typed payload with every field captured", async () => {
    const user = userEvent.setup();
    render(<QuizForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />);
    await fillRequired(user);
    await user.selectOptions(screen.getByLabelText(/Quiz Type/i), "Exam");
    await user.type(screen.getByLabelText(/Instructions/i), "Read carefully");
    await user.type(screen.getByLabelText(/Maximum Attempts/i), "2");
    await user.type(screen.getByLabelText(/Passing Score/i), "65.5");
    await user.click(screen.getByLabelText(/Randomize question order/i));
    await user.click(screen.getByLabelText(/Require instructor manual grading/i));
    await user.click(screen.getByLabelText(/publicly accessible/i));

    await user.click(screen.getByRole("button", { name: /Create Quiz/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      title: "Algebra basics",
      description: "Linear equations",
      instructions: "Read carefully",
      type: "Exam",
      max_attempts: 2,
      passing_score: 65.5,
      show_results_immediately: true,
      randomize_questions: true,
      show_correct_answers: false,
      enable_automatic_grading: true,
      require_manual_grading: true,
      is_public: true,
      start_date: null,
      end_date: null,
    });
  });

  it("includes status when editing and pre-fills initial values", async () => {
    const user = userEvent.setup();
    render(
      <QuizForm
        mode="edit"
        initialValues={{ title: "Old", description: "Desc", status: "draft", type: "Homework" }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByLabelText(/Quiz Title/i)).toHaveValue("Old");
    expect(screen.getByLabelText(/Quiz Type/i)).toHaveValue("Homework");

    await user.selectOptions(screen.getByLabelText(/Quiz Status/i), "published");
    await user.click(screen.getByRole("button", { name: /Save Changes/i }));

    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: "Old",
      type: "Homework",
      status: "published",
    });
  });

  it("renders server-side field errors inline and a non-field server message", async () => {
    const { rerender } = render(
      <QuizForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />,
    );
    rerender(
      <QuizForm
        mode="create"
        onSubmit={onSubmit}
        onCancel={onCancel}
        serverErrors={[{ field: "type", message: "Quiz type must be one of: Quiz, Exam" }]}
      />,
    );
    expect(await screen.findByText("Quiz type must be one of: Quiz, Exam")).toBeInTheDocument();
    expect(screen.getByLabelText(/Quiz Type/i)).toHaveAttribute("aria-invalid", "true");

    rerender(
      <QuizForm
        mode="create"
        onSubmit={onSubmit}
        onCancel={onCancel}
        serverMessage="Could not verify the course with the MIS."
      />,
    );
    expect(
      screen.getAllByRole("alert").some((el) =>
        el.textContent?.includes("Could not verify the course"),
      ),
    ).toBe(true);
  });

  it("disables buttons and shows progress text while submitting", () => {
    render(<QuizForm mode="create" submitting onSubmit={onSubmit} onCancel={onCancel} />);
    expect(screen.getByRole("button", { name: /Creating/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeDisabled();
  });

  it("calls onCancel", async () => {
    const user = userEvent.setup();
    render(<QuizForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
