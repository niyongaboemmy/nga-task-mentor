import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/** Assignment submission review dialog (teacher and student view). */

const post = vi.fn();
vi.mock("../utils/axiosConfig", () => ({ default: { post: (...a: unknown[]) => post(...a), get: vi.fn() } }));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../components/Submissions/FilePreviewModal", () => ({ default: () => null }));

import SubmissionDetailsModal from "../components/Assignments/SubmissionDetailsModal";
import type { SubmissionItemInterface } from "../components/Assignments/SubmissionMarking";
import type { AssignmentInterface } from "../components/Assignments/AssignmentCard";

const submission = (extra: Partial<SubmissionItemInterface> = {}): SubmissionItemInterface => ({
  id: "7",
  assignment_id: "1",
  student_id: "5",
  status: "submitted",
  submitted_at: "2026-09-20T10:00:00Z",
  text_submission: "Line one\nLine two",
  file_submissions: [],
  grade: null,
  feedback: null,
  resubmissions: [],
  is_late: true,
  comments: [],
  createdAt: "2026-09-20T10:00:00Z",
  updatedAt: "2026-09-20T10:00:00Z",
  student: { id: "5", first_name: "Levi", last_name: "Mugisha", email: "levi@nga.ac.rw" },
  ...extra,
});

const assignment = {
  id: "1",
  title: "Phonetics and phonology",
  max_score: 20,
  course_id: "29",
  course: { id: "29", title: "English Language", code: "ENG" },
  rubric: null,
} as unknown as AssignmentInterface;

const renderModal = (props: Partial<React.ComponentProps<typeof SubmissionDetailsModal>> = {}) => {
  const onClose = vi.fn();
  const onGrade = vi.fn(async () => undefined);
  render(
    <SubmissionDetailsModal
      isOpen
      onClose={onClose}
      submission={submission()}
      assignment={assignment}
      formatDate={() => "20 Sep 2026"}
      getSubmissionStatusColor={() => "bg-blue-50"}
      canManageAssignment
      onGradeSubmission={onGrade}
      {...props}
    />,
  );
  return { onClose, onGrade };
};

beforeEach(() => post.mockReset());

describe("SubmissionDetailsModal", () => {
  it("names the student, the assignment and its subject (not the raw course id)", () => {
    renderModal();
    expect(screen.getByRole("dialog", { name: "Levi Mugisha" })).toBeInTheDocument();
    expect(screen.getByText(/ENG · English Language/)).toBeInTheDocument();
    expect(screen.queryByText("29")).toBeNull();
    expect(screen.getByText("Submitted 20 Sep 2026")).toBeInTheDocument();
    expect(screen.getByText("Late")).toBeInTheDocument();
    expect(screen.getAllByText("Not graded").length).toBeGreaterThan(0);
    expect(screen.getByText("Awaiting a grade")).toBeInTheDocument();
    expect(screen.getByText(/Line one\s+Line two/)).toBeInTheDocument();
  });

  it("shows a readable empty comment state and sends a comment with Enter", async () => {
    post.mockResolvedValue({
      data: { success: true, data: { comments: [{ content: "Please check part 2", isInstructor: true, createdAt: "2026-09-21T10:00:00Z" }] } },
    });
    renderModal();
    expect(screen.getByText("No comments yet")).toBeInTheDocument();
    const box = screen.getByLabelText("Write a comment");
    expect(screen.getByRole("button", { name: "Send comment" })).toBeDisabled();
    fireEvent.change(box, { target: { value: "Please check part 2" } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(post).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(post).toHaveBeenCalledWith("/submissions/7/comments", { content: "Please check part 2" }));
    expect(await screen.findByText("Please check part 2")).toBeInTheDocument();
    expect(screen.getByText(/Teacher ·/)).toBeInTheDocument();
  });

  it("closes with Escape, the close button and the backdrop", () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close submission" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("shows the grading console to the creator, with a labelled Finalize button", () => {
    renderModal();
    expect(screen.getByRole("spinbutton", { name: /Marks awarded/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Finalize Grade/ })).toBeInTheDocument();
  });

  it("explains grading is locked for co-teachers and hides the console", () => {
    renderModal({ canManageAssignment: false, showGradingLockedNotice: true });
    expect(screen.queryByRole("button", { name: /Finalize Grade/ })).toBeNull();
    expect(screen.getByText(/Only a teacher of this subject, the assignment's creator or a super admin can grade/)).toBeInTheDocument();
  });

  it("says graded work is graded and shows the teacher's feedback", () => {
    renderModal({ submission: submission({ status: "graded", grade: "15/20", feedback: "Good transcription." }) });
    expect(screen.getByText("Graded")).toBeInTheDocument();
    expect(screen.getByText("Teacher's feedback")).toBeInTheDocument();
    // Shown in the feedback card (and pre-filled in the teacher's feedback box).
    expect(screen.getAllByText("Good transcription.").length).toBeGreaterThan(0);
  });
});
