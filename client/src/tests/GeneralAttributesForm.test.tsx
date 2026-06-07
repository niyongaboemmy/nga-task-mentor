import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GeneralAttributesForm, {
  GENERAL_ATTRIBUTES,
  type StudentRow,
} from "../components/ReportCard/GeneralAttributesForm";
import * as reportCardApi from "../services/reportCardApi";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("../services/reportCardApi", () => ({
  ReportCardApiService: {
    saveAttributes: vi.fn(),
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STUDENTS: StudentRow[] = [
  { id: 1, name: "Alice Mutoni" },
  { id: 2, name: "Bob Nkurunziza" },
  { id: 3, name: "Carol Uwase" },
];

const DEFAULT_PROPS = {
  students: STUDENTS,
  term: "Term 2",
  academicYear: "2025-2026",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GeneralAttributesForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the heading and student count", () => {
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);
    expect(screen.getByText("General Attributes")).toBeInTheDocument();
    expect(screen.getAllByText(/3 students/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Term 2/)).toBeInTheDocument();
    expect(screen.getByText(/2025-2026/)).toBeInTheDocument();
  });

  it("renders a row for each student", () => {
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);
    STUDENTS.forEach(({ name }) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
  });

  it("renders column headers for all general attributes", () => {
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);
    GENERAL_ATTRIBUTES.forEach((attr) => {
      expect(screen.getByText(attr)).toBeInTheDocument();
    });
  });

  it("renders Attendance column header", () => {
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);
    expect(screen.getByText("Attendance")).toBeInTheDocument();
  });

  it("shows empty state when no students are provided", () => {
    render(<GeneralAttributesForm {...DEFAULT_PROPS} students={[]} />);
    expect(screen.getByText("No students in this class.")).toBeInTheDocument();
    expect(screen.queryByTestId("attributes-table")).not.toBeInTheDocument();
  });

  it("save all button is present and enabled with students", () => {
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);
    const btn = screen.getByTestId("save-all-button");
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it("selecting an attendance option updates that student's row", async () => {
    const user = userEvent.setup();
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);

    // Default is "Present" for all. Click "Absent" for student 1.
    const absentRadios = screen.getAllByRole("radio", { name: /Absent/i });
    await user.click(absentRadios[0]);
    expect(absentRadios[0]).toBeChecked();
  });

  it("rating radio buttons are rendered for each attribute per student", () => {
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);
    // Punctuality × 3 students = 3 groups × 3 ratings
    const punctualityRadios = screen.getAllByRole("radio", {
      name: /Excellent|V\.Good|Good/i,
    });
    // 6 attributes × 3 ratings × 3 students
    expect(punctualityRadios.length).toBe(
      GENERAL_ATTRIBUTES.length * 3 * STUDENTS.length,
    );
  });

  it("selecting a rating for one student does not affect other students", async () => {
    const user = userEvent.setup();
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);

    const excellentRadios = screen.getAllByRole("radio", { name: /Excellent/i });
    // First "Excellent" belongs to first student's first attribute
    await user.click(excellentRadios[0]);
    expect(excellentRadios[0]).toBeChecked();
    // Second student's corresponding radio remains unchecked
    expect(excellentRadios[GENERAL_ATTRIBUTES.length]).not.toBeChecked();
  });

  it("typing a comment updates the textarea value", async () => {
    const user = userEvent.setup();
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);

    const textareas = screen.getAllByRole("textbox", { name: /Comment for/i });
    await user.clear(textareas[0]);
    await user.type(textareas[0], "Excellent student");
    expect(textareas[0]).toHaveValue("Excellent student");
  });

  it("shows validation error when trying to save with no attributes rated", async () => {
    const user = userEvent.setup();
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);

    await user.click(screen.getByTestId("save-all-button"));

    await waitFor(() => {
      const errors = screen.getAllByText(/Please rate at least one attribute/i);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it("calls saveAttributes for each student when attributes are rated", async () => {
    const user = userEvent.setup();
    const onAllSaved = vi.fn();

    vi.mocked(reportCardApi.ReportCardApiService.saveAttributes).mockResolvedValue({
      success: true,
      message: "Saved",
      data: {
        report_card_id: 1,
        status: "draft" as const,
        class_teacher_comment: null,
        attendance: { present: 1, absent: 0, late: 0 },
        attributes: [],
      },
    });

    render(<GeneralAttributesForm {...DEFAULT_PROPS} onAllSaved={onAllSaved} />);

    // Rate the first attribute for every student
    const excellentRadios = screen.getAllByRole("radio", { name: /Excellent/i });
    // Click first attribute "Excellent" for each student (index 0, GENERAL_ATTRIBUTES.length, 2×)
    await user.click(excellentRadios[0]);
    await user.click(excellentRadios[GENERAL_ATTRIBUTES.length]);
    await user.click(excellentRadios[GENERAL_ATTRIBUTES.length * 2]);

    await user.click(screen.getByTestId("save-all-button"));

    await waitFor(() => {
      expect(reportCardApi.ReportCardApiService.saveAttributes).toHaveBeenCalledTimes(
        STUDENTS.length,
      );
    });

    expect(reportCardApi.ReportCardApiService.saveAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        student_id: STUDENTS[0].id,
        term: "Term 2",
        academic_year: "2025-2026",
        attendance_present: 1,
        attendance_absent: 0,
        attendance_late: 0,
        attributes: expect.arrayContaining([
          expect.objectContaining({ rating: "Excellent" }),
        ]),
      }),
    );

    await waitFor(() => expect(onAllSaved).toHaveBeenCalled());
  });

  it("marks student row as saved after successful save", async () => {
    const user = userEvent.setup();

    vi.mocked(reportCardApi.ReportCardApiService.saveAttributes).mockResolvedValue({
      success: true,
      message: "Saved",
      data: {
        report_card_id: 1,
        status: "draft" as const,
        class_teacher_comment: null,
        attendance: { present: 1, absent: 0, late: 0 },
        attributes: [],
      },
    });

    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);

    // Rate first attribute for all students
    const excellentRadios = screen.getAllByRole("radio", { name: /Excellent/i });
    await user.click(excellentRadios[0]);
    await user.click(excellentRadios[GENERAL_ATTRIBUTES.length]);
    await user.click(excellentRadios[GENERAL_ATTRIBUTES.length * 2]);

    await user.click(screen.getByTestId("save-all-button"));

    await waitFor(() => {
      // Saved indicator badge shows
      expect(screen.getByText(/3\/3 saved/i)).toBeInTheDocument();
    });
  });

  it("handles partial API failure gracefully", async () => {
    const user = userEvent.setup();
    const { toast } = await import("react-toastify");

    vi.mocked(reportCardApi.ReportCardApiService.saveAttributes)
      .mockResolvedValueOnce({
        success: true,
        message: "Saved",
        data: {
          report_card_id: 1,
          status: "draft" as const,
          class_teacher_comment: null,
          attendance: { present: 1, absent: 0, late: 0 },
          attributes: [],
        },
      })
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        success: true,
        message: "Saved",
        data: {
          report_card_id: 3,
          status: "draft" as const,
          class_teacher_comment: null,
          attendance: { present: 1, absent: 0, late: 0 },
          attributes: [],
        },
      });

    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);

    const excellentRadios = screen.getAllByRole("radio", { name: /Excellent/i });
    await user.click(excellentRadios[0]);
    await user.click(excellentRadios[GENERAL_ATTRIBUTES.length]);
    await user.click(excellentRadios[GENERAL_ATTRIBUTES.length * 2]);

    await user.click(screen.getByTestId("save-all-button"));

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringContaining("2 of 3"),
      );
    });

    // Second student row shows an error
    await waitFor(() => {
      expect(screen.getByText(/Save failed. Try again./i)).toBeInTheDocument();
    });
  });
});
