import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GeneralAttributesForm, {
  GENERAL_ATTRIBUTES,
  attendancePct,
  attendanceTotal,
  dominantAttendance,
  type StudentRow,
} from "../components/ReportCard/GeneralAttributesForm";
import * as reportCardApi from "../services/reportCardApi";
import { ReportCardWorkflowApi } from "../services/reportCardWorkflowApi";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("../services/reportCardApi", () => ({
  ReportCardApiService: {
    saveAttributes: vi.fn(),
    draftComment: vi.fn(),
  },
}));

vi.mock("../services/reportCardWorkflowApi", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../services/reportCardWorkflowApi")>();
  return { ...orig, ReportCardWorkflowApi: { ...orig.ReportCardWorkflowApi, scheme: vi.fn() } };
});

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

const NGA_ATTRIBUTES = [
  "Punctuality",
  "Obedience",
  "Responsibility towards work",
  "Responsibility to school/personal property",
  "Devotion/Meditation",
  "Co-operation & Teamwork",
  "Ability to work independently",
  "Commitment to society",
];

const saved = (id = 1) => ({
  success: true,
  message: "Saved",
  data: {
    report_card_id: id,
    status: "draft" as const,
    class_teacher_comment: null,
    attendance: { present: 0, absent: 0, late: 0 },
    attributes: [],
  },
});

type SchemeResponse = Awaited<ReturnType<typeof ReportCardWorkflowApi.scheme>>;
const schemeWith = (attributes: string[]) =>
  ({ success: true, data: { scheme: { attributes }, bands: [] } }) as unknown as SchemeResponse;

/** The desktop row for a student (the mobile card is collapsed). */
const row = (id: number) => screen.getByTestId(`student-row-${id}`);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GeneralAttributesForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ReportCardWorkflowApi.scheme).mockResolvedValue(schemeWith([...GENERAL_ATTRIBUTES]));
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
    // Each name shows twice: the mobile card and the desktop row.
    STUDENTS.forEach(({ id, name }) => {
      expect(within(row(id)).getByText(name)).toBeInTheDocument();
      expect(within(screen.getByTestId(`student-card-${id}`)).getByText(name)).toBeInTheDocument();
    });
  });

  it("renders column headers for the fallback attributes while the scheme loads", () => {
    vi.mocked(ReportCardWorkflowApi.scheme).mockReturnValue(new Promise(() => {}));
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("scheme-loading")).toBeInTheDocument();
    const table = screen.getByTestId("attributes-table");
    GENERAL_ATTRIBUTES.forEach((attr) => {
      expect(within(table).getByText(attr)).toBeInTheDocument();
    });
  });

  it("takes the attribute list from the school's scheme", async () => {
    vi.mocked(ReportCardWorkflowApi.scheme).mockResolvedValue(schemeWith(NGA_ATTRIBUTES));
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);
    const table = screen.getByTestId("attributes-table");
    expect(await within(table).findByText("Commitment to society")).toBeInTheDocument();
    expect(within(table).queryByText("Neatness")).not.toBeInTheDocument();
    expect(within(row(1)).getAllByRole("radio")).toHaveLength(NGA_ATTRIBUTES.length * 3);
    expect(screen.getByText(`${NGA_ATTRIBUTES.length} attributes · 3 rating levels`)).toBeInTheDocument();
  });

  it("uses the attributes prop without loading the scheme", () => {
    render(<GeneralAttributesForm {...DEFAULT_PROPS} attributes={["Punctuality", "Kindness"]} />);
    expect(ReportCardWorkflowApi.scheme).not.toHaveBeenCalled();
    expect(within(screen.getByTestId("attributes-table")).getByText("Kindness")).toBeInTheDocument();
    expect(within(row(1)).getAllByRole("radio")).toHaveLength(6);
  });

  it("falls back to the default list when the scheme can't load", async () => {
    vi.mocked(ReportCardWorkflowApi.scheme).mockRejectedValue(new Error("down"));
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);
    expect(await screen.findByText(/showing the default one/i)).toBeInTheDocument();
    expect(within(screen.getByTestId("attributes-table")).getByText("Neatness")).toBeInTheDocument();
  });

  it("renders the attendance day-count columns", () => {
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);
    const table = screen.getByTestId("attributes-table");
    expect(within(table).getByText("Attendance")).toBeInTheDocument();
    for (const label of ["Present", "Absent", "Excused", "Late", "Sick"]) {
      expect(within(row(1)).getByLabelText(`${label} days for Alice Mutoni`)).toHaveValue(0);
    }
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

  it("typing day counts updates the row's total and attendance %", () => {
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);
    const r = row(1);
    fireEvent.change(within(r).getByLabelText("Present days for Alice Mutoni"), { target: { value: "45" } });
    fireEvent.change(within(r).getByLabelText("Late days for Alice Mutoni"), { target: { value: "3" } });
    fireEvent.change(within(r).getByLabelText("Absent days for Alice Mutoni"), { target: { value: "2" } });
    // 50 days, (45 + 3) / 50 = 96%
    const total = screen.getByTestId("attendance-total-1");
    expect(total).toHaveTextContent("50 days");
    expect(total).toHaveTextContent("96%");
    // Negative and junk input become 0.
    fireEvent.change(within(r).getByLabelText("Sick days for Alice Mutoni"), { target: { value: "-4" } });
    expect(within(r).getByLabelText("Sick days for Alice Mutoni")).toHaveValue(0);
  });

  it("prefills the five counts from initialData", () => {
    render(
      <GeneralAttributesForm
        {...DEFAULT_PROPS}
        initialData={{ 2: { present: 40, absent: 1, excused: 2, late: 3, sick: 4, attributes: {}, comment: "" } }}
      />,
    );
    const r = row(2);
    expect(within(r).getByLabelText("Present days for Bob Nkurunziza")).toHaveValue(40);
    expect(within(r).getByLabelText("Excused days for Bob Nkurunziza")).toHaveValue(2);
    expect(within(r).getByLabelText("Sick days for Bob Nkurunziza")).toHaveValue(4);
    expect(screen.getByTestId("attendance-total-2")).toHaveTextContent("50 days");
  });

  it("'All present' sets every visible student's counts", async () => {
    const user = userEvent.setup();
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);
    await user.type(screen.getByPlaceholderText("Days"), "60");
    await user.click(screen.getByRole("button", { name: /All present/ }));
    for (const s of STUDENTS) {
      expect(within(row(s.id)).getByLabelText(`Present days for ${s.name}`)).toHaveValue(60);
    }
  });

  it("copies the first row's count down a column", () => {
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);
    fireEvent.change(within(row(1)).getByLabelText("Late days for Alice Mutoni"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Copy the first row's Late days to all visible students" }));
    expect(within(row(3)).getByLabelText("Late days for Carol Uwase")).toHaveValue(2);
  });

  it("rating radio buttons are rendered for each attribute per student", () => {
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);
    const radios = screen.getAllByRole("radio", { name: /Excellent|V\.Good|Good/i });
    expect(radios.length).toBe(GENERAL_ATTRIBUTES.length * 3 * STUDENTS.length);
  });

  it("selecting a rating for one student does not affect other students", async () => {
    const user = userEvent.setup();
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);
    const excellentRadios = screen.getAllByRole("radio", { name: /Excellent/i });
    await user.click(excellentRadios[0]);
    expect(excellentRadios[0]).toBeChecked();
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
      expect(screen.getAllByText(/Please rate at least one attribute/i).length).toBeGreaterThan(0);
    });
  });

  it("saves every student's day counts and ratings", async () => {
    const user = userEvent.setup();
    const onAllSaved = vi.fn();
    vi.mocked(reportCardApi.ReportCardApiService.saveAttributes).mockResolvedValue(saved());

    render(<GeneralAttributesForm {...DEFAULT_PROPS} onAllSaved={onAllSaved} />);

    const r = row(1);
    fireEvent.change(within(r).getByLabelText("Present days for Alice Mutoni"), { target: { value: "50" } });
    fireEvent.change(within(r).getByLabelText("Absent days for Alice Mutoni"), { target: { value: "2" } });
    fireEvent.change(within(r).getByLabelText("Excused days for Alice Mutoni"), { target: { value: "1" } });
    fireEvent.change(within(r).getByLabelText("Late days for Alice Mutoni"), { target: { value: "4" } });
    fireEvent.change(within(r).getByLabelText("Sick days for Alice Mutoni"), { target: { value: "3" } });

    const excellentRadios = screen.getAllByRole("radio", { name: /Excellent/i });
    await user.click(excellentRadios[0]);
    await user.click(excellentRadios[GENERAL_ATTRIBUTES.length]);
    await user.click(excellentRadios[GENERAL_ATTRIBUTES.length * 2]);

    await user.click(screen.getByTestId("save-all-button"));

    await waitFor(() => {
      expect(reportCardApi.ReportCardApiService.saveAttributes).toHaveBeenCalledTimes(STUDENTS.length);
    });

    expect(reportCardApi.ReportCardApiService.saveAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        student_id: STUDENTS[0].id,
        term: "Term 2",
        academic_year: "2025-2026",
        attendance_present: 50,
        attendance_absent: 2,
        attendance_excused: 1,
        attendance_late: 4,
        attendance_sick: 3,
        attributes: expect.arrayContaining([expect.objectContaining({ attribute_name: "Punctuality", rating: "Excellent" })]),
      }),
    );
    expect(reportCardApi.ReportCardApiService.saveAttributes).toHaveBeenCalledWith(
      expect.objectContaining({ student_id: 2, attendance_present: 0, attendance_absent: 0, attendance_sick: 0 }),
    );

    await waitFor(() => expect(onAllSaved).toHaveBeenCalled());
  });

  it("marks student row as saved after successful save", async () => {
    const user = userEvent.setup();
    vi.mocked(reportCardApi.ReportCardApiService.saveAttributes).mockResolvedValue(saved());
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);

    const excellentRadios = screen.getAllByRole("radio", { name: /Excellent/i });
    await user.click(excellentRadios[0]);
    await user.click(excellentRadios[GENERAL_ATTRIBUTES.length]);
    await user.click(excellentRadios[GENERAL_ATTRIBUTES.length * 2]);

    await user.click(screen.getByTestId("save-all-button"));

    await waitFor(() => {
      expect(screen.getByText(/3\/3 saved/i)).toBeInTheDocument();
    });
  });

  it("handles partial API failure gracefully", async () => {
    const user = userEvent.setup();
    const { toast } = await import("react-toastify");

    vi.mocked(reportCardApi.ReportCardApiService.saveAttributes)
      .mockResolvedValueOnce(saved(1))
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(saved(3));

    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);

    const excellentRadios = screen.getAllByRole("radio", { name: /Excellent/i });
    await user.click(excellentRadios[0]);
    await user.click(excellentRadios[GENERAL_ATTRIBUTES.length]);
    await user.click(excellentRadios[GENERAL_ATTRIBUTES.length * 2]);

    await user.click(screen.getByTestId("save-all-button"));

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("2 of 3"));
    });
    await waitFor(() => {
      expect(screen.getByText(/Save failed. Try again./i)).toBeInTheDocument();
    });
  });

  // ── Locks ──

  it("locked students are read-only with a lock badge and are skipped on save", async () => {
    const user = userEvent.setup();
    const { toast } = await import("react-toastify");
    vi.mocked(reportCardApi.ReportCardApiService.saveAttributes).mockResolvedValue(saved());

    render(<GeneralAttributesForm {...DEFAULT_PROPS} lockedStudentIds={new Set([2])} />);

    const locked = row(2);
    expect(within(locked).getByTestId("row-locked")).toHaveAttribute("title", "Approved/Reviewed — reopen to draft to change");
    expect(within(locked).getByLabelText("Present days for Bob Nkurunziza")).toBeDisabled();
    within(locked).getAllByRole("radio").forEach((r) => expect(r).toBeDisabled());
    expect(within(locked).getByLabelText("Comment for Bob Nkurunziza")).toHaveAttribute("readonly");
    expect(within(locked).queryByRole("button", { name: /Draft a comment/ })).not.toBeInTheDocument();
    expect(screen.getByText(/1 locked/)).toBeInTheDocument();

    await user.click(within(row(1)).getAllByRole("radio", { name: "Excellent" })[0]);
    await user.click(within(row(3)).getAllByRole("radio", { name: "Excellent" })[0]);
    await user.click(screen.getByTestId("save-all-button"));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("1 locked card left unchanged")));
    expect(reportCardApi.ReportCardApiService.saveAttributes).toHaveBeenCalledTimes(2);
    expect(vi.mocked(reportCardApi.ReportCardApiService.saveAttributes).mock.calls.map((c) => c[0].student_id)).toEqual([1, 3]);
  });

  it("a 409 CARD_LOCKED marks the row locked and toasts the server's message", async () => {
    const user = userEvent.setup();
    const { toast } = await import("react-toastify");
    const message = "This report card is approved and can't be changed. Reopen it to draft first.";
    vi.mocked(reportCardApi.ReportCardApiService.saveAttributes).mockRejectedValue({
      response: { status: 409, data: { success: false, code: "CARD_LOCKED", message } },
    });

    render(<GeneralAttributesForm {...DEFAULT_PROPS} students={[STUDENTS[0]]} />);
    await user.click(within(row(1)).getAllByRole("radio", { name: "Excellent" })[0]);
    await user.click(screen.getByTestId("save-all-button"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(`Alice Mutoni: ${message}`));
    expect(within(row(1)).getByTestId("row-locked")).toBeInTheDocument();
    expect(within(row(1)).getByLabelText("Present days for Alice Mutoni")).toBeDisabled();
    expect(screen.getByTestId("save-all-button")).toBeDisabled();
  });

  // ── Import ──

  it("has no import button without onImportAttendance", () => {
    render(<GeneralAttributesForm {...DEFAULT_PROPS} />);
    expect(screen.queryByTestId("import-attendance")).not.toBeInTheDocument();
  });

  it("imports attendance with a spinner and a success toast", async () => {
    const { toast } = await import("react-toastify");
    let finish: (v: string) => void = () => {};
    const onImport = vi.fn(() => new Promise<string>((r) => (finish = r)));
    render(<GeneralAttributesForm {...DEFAULT_PROPS} onImportAttendance={onImport} />);

    fireEvent.click(screen.getByTestId("import-attendance"));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("import-attendance")).toBeDisabled();
    expect(screen.getByTestId("import-attendance")).toHaveTextContent("Importing…");

    finish("Attendance imported for 3 students.");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Attendance imported for 3 students."));
    expect(screen.getByTestId("import-attendance")).not.toBeDisabled();
  });

  it("toasts the server's message when the import fails", async () => {
    const { toast } = await import("react-toastify");
    const onImport = vi.fn().mockRejectedValue({ response: { data: { message: "The attendance app is offline." } } });
    render(<GeneralAttributesForm {...DEFAULT_PROPS} onImportAttendance={onImport} />);
    fireEvent.click(screen.getByTestId("import-attendance"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The attendance app is offline."));
  });

  it("unedited rows pick up refreshed initialData (after an import)", () => {
    const { rerender } = render(<GeneralAttributesForm {...DEFAULT_PROPS} initialData={{}} />);
    fireEvent.change(within(row(2)).getByLabelText("Present days for Bob Nkurunziza"), { target: { value: "7" } });
    rerender(
      <GeneralAttributesForm
        {...DEFAULT_PROPS}
        initialData={{
          1: { present: 58, absent: 2, attributes: {}, comment: "" },
          2: { present: 58, absent: 2, attributes: {}, comment: "" },
        }}
      />,
    );
    expect(within(row(1)).getByLabelText("Present days for Alice Mutoni")).toHaveValue(58);
    // Bob was edited here, so his count is kept.
    expect(within(row(2)).getByLabelText("Present days for Bob Nkurunziza")).toHaveValue(7);
  });

  // ── AI ──

  it("sends the dominant attendance status with an AI draft", async () => {
    vi.mocked(reportCardApi.ReportCardApiService.draftComment).mockResolvedValue({
      success: true,
      data: { comment: "[NAME] works hard.", provider_used: "groq" },
    });
    render(
      <GeneralAttributesForm
        {...DEFAULT_PROPS}
        initialData={{ 1: { present: 10, absent: 30, attributes: {}, comment: "" } }}
      />,
    );
    fireEvent.click(within(row(1)).getByRole("button", { name: "Draft a comment for Alice Mutoni with AI" }));
    await waitFor(() => expect(within(row(1)).getByLabelText("Comment for Alice Mutoni")).toHaveValue("Alice works hard."));
    expect(reportCardApi.ReportCardApiService.draftComment).toHaveBeenCalledWith(expect.objectContaining({ attendance: "absent" }));

    fireEvent.click(within(row(2)).getByRole("button", { name: "Draft a comment for Bob Nkurunziza with AI" }));
    await waitFor(() => expect(reportCardApi.ReportCardApiService.draftComment).toHaveBeenCalledTimes(2));
    expect(vi.mocked(reportCardApi.ReportCardApiService.draftComment).mock.calls[1][0].attendance).toBeNull();
  });
});

describe("attendance helpers", () => {
  const c = (present: number, absent = 0, excused = 0, late = 0, sick = 0) => ({ present, absent, excused, late, sick });

  it("totals every status and counts late as attended", () => {
    expect(attendanceTotal(c(45, 2, 1, 3, 1))).toBe(52);
    expect(attendancePct(c(45, 2, 1, 3, 1))).toBe(92);
    expect(attendancePct(c(0))).toBeNull();
  });

  it("picks the status covering most days, or null with none", () => {
    expect(dominantAttendance(c(0))).toBeNull();
    expect(dominantAttendance(c(50, 2, 0, 3))).toBe("present");
    expect(dominantAttendance(c(5, 10, 5, 0, 5))).toBe("absent");
    expect(dominantAttendance(c(5, 1, 0, 20))).toBe("late");
  });
});
