import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

/** AI marking assistant inside the grading form: drafts, the teacher applies, then saves. */
// A plain function per test (not a reused vi.fn): Vitest 4 turns a handled
// rejection from a re-programmed vi.fn into a test failure.
let reply: (url: string, body: unknown) => Promise<unknown> = async () => ({});
const calls: Array<[string, unknown]> = [];
vi.mock("../utils/axiosConfig", () => ({
  default: { post: (url: string, body: unknown) => (calls.push([url, body]), reply(url, body)), get: vi.fn(), patch: vi.fn() },
}));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import SubmissionMarking, { type SubmissionItemInterface } from "../components/Assignments/SubmissionMarking";
import type { AssignmentInterface } from "../components/Assignments/AssignmentCard";

const submission = {
  id: "7", assignment_id: "1", student_id: "5", status: "submitted", submitted_at: "2026-10-07T10:00:00Z",
  text_submission: "Plants make glucose.", file_submissions: [], grade: null, feedback: null, resubmissions: [], is_late: false,
  comments: [], createdAt: "", updatedAt: "", student: { id: "5", first_name: "Levi", last_name: "M", email: "l@x" },
} as SubmissionItemInterface;
const assignment = {
  id: "1", title: "Photosynthesis", max_score: 10,
  rubric: [{ criteria: "Understanding", description: "Correct process", max_score: 6 }, { criteria: "Clarity", max_score: 4 }],
} as unknown as AssignmentInterface;

const draft = {
  rubric_scores: { 0: 5, 1: 3.5 }, score: 8.5, max_score: 10, confidence: "low", provider_used: "groq",
  criteria: [
    { index: 0, criteria: "Understanding", score: 5, max_score: 6, comment: "Inputs right, no chlorophyll" },
    { index: 1, criteria: "Clarity", score: 3.5, max_score: 4, comment: "" },
  ],
  feedback: "You explained the inputs clearly.", strengths: ["Accurate"], next_steps: ["Mention chlorophyll"],
  warnings: ["Not read by the AI: photo.jpg. Check those files yourself."],
};

describe("AI marking assistant", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("drafts with the chosen tone, and the teacher applies marks and feedback before saving", async () => {
    reply = async () => ({ data: { success: true, data: draft } });
    const onGrade = vi.fn(async () => undefined);
    render(<SubmissionMarking submission={submission} assignment={assignment} onGradeSubmission={onGrade} />);
    const panel = screen.getByTestId("ai-marking");
    fireEvent.click(within(panel).getByRole("radio", { name: "Direct" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Draft marks & feedback" }));
    await waitFor(() => expect(calls).toEqual([["/submissions/7/ai-feedback", { tone: "direct" }]]));
    const result = await screen.findByTestId("ai-draft");
    expect(result).toHaveTextContent("8.5 / 10");
    expect(result).toHaveTextContent("Not sure: check carefully");
    expect(result).toHaveTextContent("photo.jpg");
    // The teacher-only note shows under its rubric row.
    expect(screen.getByText(/AI note:/).parentElement).toHaveTextContent("Inputs right, no chlorophyll");
    // Nothing is in the form until the teacher says so.
    expect((document.getElementById("marks-awarded") as HTMLInputElement).value).toBe("");

    fireEvent.click(within(result).getByRole("button", { name: "Use these marks" }));
    expect((document.getElementById("marks-awarded") as HTMLInputElement).value).toBe("8.5");
    fireEvent.click(within(result).getByRole("button", { name: "Use this feedback" }));
    const box = document.getElementById("grading-feedback") as HTMLTextAreaElement;
    expect(box.value).toContain("You explained the inputs clearly.");
    expect(box.value).toContain("- Mention chlorophyll");

    fireEvent.click(screen.getByRole("button", { name: /Finalize Grade/ }));
    await waitFor(() => expect(onGrade).toHaveBeenCalledWith("7", 8.5, box.value, { 0: 5, 1: 3.5 }));
  });

  it("explains a failure without touching the form", async () => {
    reply = async () => {
      throw { response: { data: { message: "This submission is empty: there is nothing for the AI to read." } } };
    };
    render(<SubmissionMarking submission={submission} assignment={assignment} onGradeSubmission={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Draft marks & feedback" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("nothing for the AI to read");
    expect(screen.queryByTestId("ai-draft")).toBeNull();
  });
});
