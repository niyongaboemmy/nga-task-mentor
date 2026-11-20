import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { WorkbenchData, WorkbenchStudent } from "../services/reportCardWorkflowApi";
import type { ReportCardDocument } from "../services/reportCardApi";

// The report card workflow UI: the class workbench (bulk review/approve/
// publish, reasons, partial results), the sign-off dialog and the document
// view. The rules themselves are the server's (reportCardWorkflow.ts).

const { api, toast } = vi.hoisted(() => ({
  api: {
    workbench: vi.fn(),
    transition: vi.fn(),
    cycles: vi.fn(),
    signoffPreview: vi.fn(),
    signoff: vi.fn(),
    importAttendance: vi.fn(),
    history: vi.fn(),
    diff: vi.fn(),
    classPdf: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("../services/reportCardWorkflowApi", async () => {
  const actual = await vi.importActual<typeof import("../services/reportCardWorkflowApi")>("../services/reportCardWorkflowApi");
  return { ...actual, ReportCardWorkflowApi: { ...actual.ReportCardWorkflowApi, ...api } };
});
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, currentAcademicTerm: { name: "Term 2" }, currentAcademicYear: { name: "2025-2026" } } }),
}));
vi.mock("../hooks/useTermYearSelector", () => ({
  useTermYearSelector: () => ({
    years: [{ academic_year_id: 1, name: "2025-2026" }],
    terms: [{ academic_term_id: 2, name: "Term 2" }],
    loading: false,
    academicYear: "2025-2026",
    term: "Term 2",
    setAcademicYear: vi.fn(),
    setTerm: vi.fn(),
  }),
}));
vi.mock("react-toastify", () => ({
  toast: { success: (...a: unknown[]) => toast.success(...a), error: (...a: unknown[]) => toast.error(...a), info: (...a: unknown[]) => toast.info(...a) },
}));
vi.mock("../components/ReportCard/ReportCardPreview", () => ({ default: () => <div data-testid="preview-modal" /> }));

import ReportCardWorkbenchPage from "../pages/ReportCardWorkbenchPage";
import ReportCardsPage from "../pages/ReportCardsPage";
import SubmitMarksDialog from "../components/ReportCard/SubmitMarksDialog";
import { ReportCardDocumentView } from "../components/ReportCard/ReportCardDocumentView";
import { pickOption } from "./helpers/select";
import MarkCell from "../components/ReportCard/MarkCell";

const student = (id: number, name: string, status: WorkbenchStudent["card"]["status"], over: Partial<WorkbenchStudent> = {}): WorkbenchStudent => ({
  student_id: id,
  name,
  registration_number: `REG-${id}`,
  gender: "F",
  card: {
    id: 100 + id,
    uuid: `u${id}`,
    status,
    version: status === "approved" || status === "published" ? 1 : 0,
    reviewed_at: null,
    approved_at: null,
    published_at: null,
    publish_at: null,
    returned_reason: null,
    editable: status === "draft",
  },
  subjects: { 9: { total: 72, missing: 0 } },
  average: 72,
  has_comment: true,
  attributes_rated: 8,
  attendance_days: 60,
  attendance_source: "imported",
  blockers: [],
  warnings: [],
  changed_since_approval: 0,
  actions: [],
  ...over,
});

const workbench = (students: WorkbenchStudent[]): WorkbenchData => ({
  class_group: { id: 5, name: "Grade 10 A", grade_name: "Grade 10", program_name: "SPES" },
  term: "Term 2",
  academic_year: "2025-2026",
  cycle: { id: 1, marks_due_at: null, review_due_at: null, publish_at: null, next_term_begins_on: "2026-04-20" },
  scheme: { attributes: Array.from({ length: 8 }, (_, i) => `A${i}`), pass_mark: 50, require_distinct_approver: false },
  subjects: [
    {
      subject_id: 9,
      name: "Maths",
      teachers: ["T. Uwase"],
      i_teach: true,
      mapped_cards: students.length,
      missing_marks: 0,
      signoff: { status: "open", submitted_by: null, submitted_at: null, returned_reason: null },
    },
  ],
  students,
  counts: { draft: 1, reviewed: 1, approved: 0, published: 1, scheduled: 0, ready: 1 },
  blockers: [{ code: "NO_COMMENT", students: 1, example: "Class teacher's comment is empty" }],
  can: { review: true, approve: true, publish: true, edit_settings: true },
  roster_complete: true,
});

const renderWorkbench = () =>
  render(
    <MemoryRouter initialEntries={["/report-cards/5?term=Term%202&year=2025-2026"]}>
      <Routes>
        <Route path="/report-cards/:classGroupId" element={<ReportCardWorkbenchPage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  toast.success.mockReset();
  toast.error.mockReset();
});

describe("report card workbench", () => {
  const rows = [
    student(1, "Aline Uwase", "draft"),
    student(2, "Bob Nkurunziza", "reviewed"),
    student(3, "Cara Ishimwe", "published", { changed_since_approval: 1 }),
    student(4, "Dan Mugabo", "draft", { has_comment: false, blockers: [{ code: "NO_COMMENT", message: "Class teacher's comment is empty" }] }),
  ];

  it("shows the class, its blockers, subject sign-off and every student's card", async () => {
    api.workbench.mockResolvedValue({ success: true, data: workbench(rows) });
    renderWorkbench();
    expect(await screen.findByRole("heading", { name: /Grade 10 A/ })).toBeInTheDocument();
    expect(api.workbench).toHaveBeenCalledWith({ class_group_id: 5, term: "Term 2", academic_year: "2025-2026" });
    expect(screen.getByText(/Class teacher's comment is empty/)).toBeInTheDocument();
    expect(screen.getByTestId("subject-9")).toHaveTextContent("Ready to submit");
    const matrix = screen.getByTestId("workbench-matrix");
    for (const r of rows) expect(within(matrix).getByText(r.name)).toBeInTheDocument();
    expect(within(matrix).getByText("1 changed")).toBeInTheDocument();
  });

  it("offers only the actions that fit the selection and approves in bulk", async () => {
    api.workbench.mockResolvedValue({ success: true, data: workbench(rows) });
    api.transition.mockResolvedValue({ success: true, message: "1 report card updated (approve)", data: { action: "approve", ok: 1, failed: 0, results: [{ report_card_id: 102, ok: true }] } });
    renderWorkbench();
    fireEvent.click(await screen.findByLabelText("Select Bob Nkurunziza"));
    const bar = screen.getByTestId("bulk-actions");
    expect(within(bar).getByRole("button", { name: /Approve \(1\)/ })).toBeEnabled();
    expect(within(bar).getByRole("button", { name: /Publish/ })).toBeDisabled();
    fireEvent.click(within(bar).getByRole("button", { name: /Approve \(1\)/ }));
    await waitFor(() => expect(api.transition).toHaveBeenCalledWith({ card_ids: [102], action: "approve" }));
    expect(toast.success).toHaveBeenCalledWith("1 report card updated (approve)");
  });

  it("asks for a reason before reopening and shows refused cards", async () => {
    api.workbench.mockResolvedValue({ success: true, data: workbench(rows) });
    api.transition.mockResolvedValue({
      success: false,
      message: "0 of 1 report cards updated",
      data: { action: "reopen", ok: 0, failed: 1, results: [{ report_card_id: 103, ok: false, code: "FORBIDDEN", message: "You can't reopen this student's report card" }] },
    });
    renderWorkbench();
    fireEvent.click(await screen.findByLabelText("Select Cara Ishimwe"));
    fireEvent.click(within(screen.getByTestId("bulk-actions")).getByRole("button", { name: /Reopen to draft/ }));
    const confirm = await screen.findAllByRole("button", { name: "Reopen to draft" });
    expect(confirm[confirm.length - 1]).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/wrong class/), { target: { value: "EOT mark corrected" } });
    fireEvent.click(confirm[confirm.length - 1]);
    await waitFor(() => expect(api.transition).toHaveBeenCalledWith({ card_ids: [103], action: "reopen", reason: "EOT mark corrected" }));
    expect(await screen.findByText("You can't reopen this student's report card")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalled();
  });

  it("says when a subject is mapped for only part of the class, and doesn't offer sign-off for unmapped ones", async () => {
    const wb = workbench(rows);
    wb.subjects = [
      { ...wb.subjects[0], mapped_cards: 1, total_cards: 4 },
      { ...wb.subjects[0], subject_id: 10, name: "Citizenship", i_teach: false, mapped_cards: 0, total_cards: 4, teachers: ["T. Mugisha"] },
    ];
    api.workbench.mockResolvedValue({ success: true, data: wb });
    renderWorkbench();
    expect(await screen.findByTestId("subject-9")).toHaveTextContent("Mapped for 1 of 4");
    const unmapped = screen.getByTestId("subject-10");
    expect(unmapped).toHaveTextContent("No assessments mapped · T. Mugisha");
    expect(unmapped.tagName).toBe("DIV");
  });

  it("explains the marks: a legend, and a click shows how a mark is worked out", async () => {
    const wb = workbench([
      student(1, "Aline Uwase", "draft", {
        subjects: { 9: { total: 74, missing: 1, covered: 50, points: 37, categories: { CW: 11, HW: 6, MD: 20, EOT: null }, competent: true,
            missing_items: [{ assessment_type: "assignment", assessment_id: 55, category: "HW", title: "Loops homework 3", href: "/assignments/55" }] } },
      }),
    ]);
    wb.subjects[0] = { ...wb.subjects[0], code: "SPEWI302", category: "specific", threshold: 70 };
    api.workbench.mockResolvedValue({ success: true, data: wb });
    renderWorkbench();
    expect(await screen.findByTestId("marks-legend")).toHaveTextContent("mark out of 100");
    const matrix = screen.getByTestId("workbench-matrix");
    expect(within(matrix).getByText("SPEWI302")).toBeInTheDocument();
    fireEvent.click(within(matrix).getByRole("button", { name: /Maths: 74% over 50% of the term assessed, 1 mark\(s\) missing/ }));
    const pop = await screen.findByRole("dialog", { name: /Maths — Aline Uwase/ });
    expect(pop).toHaveTextContent("Competent");
    expect(pop).toHaveTextContent("37 of the 50 points assessed so far = 74%");
    expect(pop).toHaveTextContent("not yet");
    const missing = within(pop).getByTestId("missing-marks");
    expect(missing).toHaveTextContent("1 mark not recorded yet");
    expect(missing).toHaveTextContent("Loops homework 3");
    expect(missing).toHaveTextContent("Assignment · HW (Homework)");
    expect(within(missing).getByRole("link", { name: /Loops homework 3/ })).toHaveAttribute("href", "/assignments/55");
  });

  it("previews the class's cards as one PDF in ranking order, and downloads it", async () => {
    const created = vi.fn(() => "blob:class-pdf");
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() });
    api.workbench.mockResolvedValue({ success: true, data: workbench(rows) });
    api.classPdf.mockResolvedValue(new Blob(["%PDF-1.3"], { type: "application/pdf" }));
    renderWorkbench();
    fireEvent.click(await screen.findByRole("button", { name: /Preview PDF/ }));
    await waitFor(() => expect(api.classPdf).toHaveBeenCalledWith({ class_group_id: 5, term: "Term 2", academic_year: "2025-2026" }));
    const dialog = await screen.findByText(/in ranking order/);
    expect(dialog).toBeInTheDocument();
    expect(await screen.findByTestId("class-pdf-frame")).toHaveAttribute("src", "blob:class-pdf");
    fireEvent.click(within(screen.getByTestId("class-pdf-toolbar")).getByRole("button", { name: /Download/ }));
    expect(toast.success).toHaveBeenCalledWith("Class report cards downloaded");
  });

  it("shows why the class PDF couldn't be built", async () => {
    api.workbench.mockResolvedValue({ success: true, data: workbench(rows) });
    api.classPdf.mockRejectedValue(new Error("No report cards for this class and term yet. Open the class to create them."));
    renderWorkbench();
    fireEvent.click(await screen.findByRole("button", { name: /Preview PDF/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No report cards for this class and term yet");
    expect(toast.error).toHaveBeenCalledWith("No report cards for this class and term yet. Open the class to create them.");
  });

  it("guides the approval flow: steps with progress, and reviewing the ready cards in one click after a confirm", async () => {
    api.workbench.mockResolvedValue({ success: true, data: workbench(rows) });
    api.transition.mockResolvedValue({ success: true, message: "1 report card updated (review)", data: { action: "review", ok: 1, failed: 0, results: [] } });
    renderWorkbench();
    const flow = await screen.findByTestId("approval-flow");
    for (const k of ["marks", "comments", "review", "approve", "publish"]) expect(within(flow).getByTestId(`flow-step-${k}`)).toBeInTheDocument();
    // Picking a step opens its panel, which carries the step's action.
    fireEvent.click(within(within(flow).getByTestId("flow-step-review")).getByRole("tab"));
    const panel = within(flow).getByTestId("flow-panel-review");
    fireEvent.click(within(panel).getByRole("button", { name: /Review \d+ ready/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Mark reviewed" }));
    await waitFor(() => expect(api.transition).toHaveBeenCalledWith(expect.objectContaining({ action: "review" })));
    expect(toast.success).toHaveBeenCalled();
  });

  it("filters to cards ready to review", async () => {
    api.workbench.mockResolvedValue({ success: true, data: workbench(rows) });
    renderWorkbench();
    await screen.findByTestId("workbench-matrix");
    fireEvent.click(screen.getByRole("tab", { name: /Ready to review/ }));
    const matrix = screen.getByTestId("workbench-matrix");
    expect(within(matrix).getByText("Aline Uwase")).toBeInTheDocument();
    expect(within(matrix).queryByText("Dan Mugabo")).toBeNull();
  });

  it("explains a failed load and retries", async () => {
    api.workbench.mockRejectedValueOnce({ response: { data: { message: "MIS is down" } } });
    api.workbench.mockResolvedValueOnce({ success: true, data: workbench(rows) });
    renderWorkbench();
    expect(await screen.findByText("MIS is down")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("workbench-matrix")).toBeInTheDocument();
  });
});

describe("report cards classes page", () => {
  it("lists classes with progress and links to their workbench", async () => {
    api.cycles.mockResolvedValue({
      success: true,
      data: {
        term: "Term 2",
        academic_year: "2025-2026",
        can: { review: true, approve: true, publish: true, edit_settings: true },
        classes: [
          { class_group_id: 5, name: "Grade 10 A", grade_name: "Grade 10", program_name: "SPES", students: 30, counts: { draft: 10, reviewed: 5, approved: 0, published: 15, not_started: 0 }, subjects_total: 12, subjects_submitted: 9, i_teach: true, cycle: null },
        ],
      },
    });
    render(
      <MemoryRouter>
        <ReportCardsPage />
      </MemoryRouter>,
    );
    const link = await screen.findByRole("link", { name: "Grade 10 A" });
    expect(link).toHaveAttribute("href", "/report-cards/5?term=Term%202&year=2025-2026");
    expect(screen.getByTestId("school-pipeline")).toHaveTextContent("15 of 30 cards published");
    // 9 of 12 subjects in: the class is still collecting marks, and that's the school's next step.
    const card = screen.getByTestId("class-5");
    expect(card).toHaveTextContent("Collecting marks");
    expect(card).toHaveTextContent("9/12");
    // The action is a real link to the class, landing on its subjects.
    const cta = within(card).getByTestId("cta-5");
    expect(cta).toHaveTextContent("Collect marks");
    expect(cta).toHaveTextContent("3 subjects to submit");
    expect(cta).toHaveAttribute("href", "/report-cards/5?term=Term%202&year=2025-2026&focus=subjects");
    expect(screen.getByTestId("next-step")).toHaveTextContent("Next: 1 class collecting marks");
    fireEvent.click(screen.getByRole("button", { name: /Ready to review/ }));
    expect(screen.queryByTestId("class-5")).toBeNull();
  });
});

describe("submit marks dialog", () => {
  const props = { open: true, onClose: vi.fn(), classGroupId: 5, className: "Grade 10 A", subjectId: 9, subjectName: "Maths", term: "Term 2", academicYear: "2025-2026" };

  it("makes every missing mark recorded or resolved before submitting", async () => {
    api.signoffPreview.mockResolvedValue({
      success: true,
      data: {
        status: "open",
        returned_reason: "Wrong EOT for two students",
        locked_cards: 0,
        missing: [{ student_id: 1, name: "Aline", report_card_id: 101, assessment_type: "manual", assessment_id: 7, title: "EOT exam", category: "EOT" }],
      },
    });
    api.signoff.mockResolvedValue({ success: true, message: "Marks submitted for review" });
    render(<SubmitMarksDialog {...props} />);
    expect(await screen.findByText(/Wrong EOT for two students/)).toBeInTheDocument();
    expect(screen.getByTestId("submit-marks")).toBeDisabled();
    pickOption(screen.getByRole("combobox", { name: "Aline: EOT exam" }), "absent");
    expect(screen.getByTestId("submit-marks")).toBeEnabled();
    fireEvent.click(screen.getByTestId("submit-marks"));
    await waitFor(() =>
      expect(api.signoff).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "submit",
          resolutions: [{ report_card_id: 101, assessment_type: "manual", assessment_id: 7, status: "absent" }],
        }),
      ),
    );
    expect(toast.success).toHaveBeenCalledWith("Marks submitted for review");
  });
});

describe("mark cell", () => {
  it("shows not-yet-competent marks and a dash without marks", () => {
    const { rerender } = render(
      <MarkCell cell={{ total: 48, missing: 0, covered: 100, points: 48, categories: { CW: 8, HW: 5, MD: 12, EOT: 23 }, competent: false }} studentName="A" moduleName="C" threshold={70} />,
    );
    expect(screen.getByRole("button", { name: /C: 48%/ })).toHaveTextContent("48%");
    rerender(<MarkCell cell={undefined} studentName="A" moduleName="C" />);
    expect(screen.getByLabelText("No marks")).toHaveTextContent("—");
  });
});

describe("report card document view", () => {
  const doc = (status: "draft" | "published"): ReportCardDocument => ({
    schema: 1,
    card: { id: 1, uuid: "u", version: status === "published" ? 2 : 0, status, term: "Term 2", academic_year: "2025-2026", approved_at: status === "published" ? "2026-04-01T00:00:00Z" : null, published_at: null },
    school: { name: "New Generation Coding Academy", address_line: "Kigali, Rwanda", contact_line: "info@nga.ac.rw", logo: "nga" },
    student: { id: 1, name: "Aline Uwase", registration_number: "1487250119", gender: "F", class_group_id: 5, class_name: "Grade10", grade_name: null, program_name: "SPES YEAR 1" },
    scheme: {
      category_weights: { CW: 15, HW: 10, MD: 25, EOT: 50 },
      pass_mark: 50,
      bands: [
        { min: 90, letter: "A*", remark: "" },
        { min: 80, letter: "A", remark: "" },
        { min: 0, letter: "U", remark: "" },
      ],
      show_position: true,
      show_class_average: true,
      show_subject_teacher: true,
      head_title: "Principal",
    },
    groups: [
      {
        name: "Core modules",
        subjects: [
          { subject_id: 1, name: "Networking Fundamentals", group: "Core modules", teacher: "Ntabomvura L.", categories: { CW: 13.33, HW: 9, MD: 21, EOT: 45 }, total: 88.33, grade: "A", remark: "", passed: true, class_average: 77.06, missing_marks: 0 },
        ],
      },
    ],
    summary: { average: 86.64, grade: "A", remark: "", total_marks: 89, subjects_counted: 1, subjects_passed: 1, subjects_failed: 0, position: 3, position_of: 40, class_average: 80 },
    attendance: { present: 3, absent: 0, excused: 0, late: 2, sick: 0, total: 5, source: "imported" },
    attributes: [{ attribute_name: "Punctuality", rating: "Excellent" }],
    comments: { class_teacher: "Keep it up.", head_teacher: null },
    next_term_begins_on: "2026-04-20",
    grades: [],
  });

  it("shows the official logo and the school's card layout: class, reg. no., groups, CA, teacher, summary, attendance %, next term, QR", () => {
    render(<ReportCardDocumentView doc={doc("published")} verificationUrl="https://x/verify?v=2" />);
    const d = screen.getByTestId("report-card-document");
    expect(within(d).getByAltText("New Generation Coding Academy")).toBeInTheDocument();
    for (const t of ["1487250119", "Core modules", "Networking Fundamentals", "Ntabomvura L.", "77.06", "13.33", "88.33", "Excused", "Principal"]) {
      expect(within(d).getByText(t)).toBeInTheDocument();
    }
    expect(d).toHaveTextContent("86.64%"); // exact, never rounded
    expect(d).toHaveTextContent("3rd");
    expect(d).toHaveTextContent("of 40");
    expect(d).toHaveTextContent("Next term begins on Monday, 20 April 2026");
    expect(d).toHaveTextContent("Version 2");
    expect(within(d).getByText("60%")).toBeInTheDocument(); // present 3 of 5 days
    expect(within(d).getByTestId("verify-qr")).toBeInTheDocument();
    expect(d).not.toHaveTextContent("PROVISIONAL");
  });

  it("shows RTB modules: code, decision, position in class, and expands a module's breakdown", () => {
    const d0 = doc("published");
    d0.groups[0] = {
      name: "Specific modules",
      subjects: [
        { ...d0.groups[0].subjects[0], code: "SPENF301", category: "specific", points: 89, weight_covered: 100, threshold: 70, competent: true, rank: 2, rank_of: 18 },
        { ...d0.groups[0].subjects[0], subject_id: 2, name: "Programming in C", code: "SFEPE301", category: "specific", total: 38, grade: "F", passed: false, points: 38, weight_covered: 100, threshold: 70, competent: false, rank: 17, rank_of: 18 },
      ],
    };
    d0.summary = { ...d0.summary, modules_competent: 1, modules_nyc: 1 };
    d0.scheme = { ...d0.scheme, show_subject_rank: true, show_competence: true, competence_thresholds: { specific: 70, general: 50, complementary: 50 } };
    render(<ReportCardDocumentView doc={d0} verificationUrl="https://x/verify?v=2" />);
    const d = screen.getByTestId("report-card-document");
    expect(within(d).getByText("SPENF301")).toBeInTheDocument();
    expect(within(d).getByText("Competent", { selector: "span" })).toBeInTheDocument();
    expect(within(d).getByText("NYC")).toBeInTheDocument();
    expect(within(d).getByText("2/18")).toBeInTheDocument();
    expect(d).toHaveTextContent("Position in class3rdof 40");
    expect(d).toHaveTextContent("Needs attention: Programming in C");
    fireEvent.click(within(d).getByTestId("module-2"));
    expect(d).toHaveTextContent("38 of 100 points = 38%");
    expect(d).toHaveTextContent("17th of 18 in the class");
  });

  it("watermarks a draft as provisional", () => {
    render(<ReportCardDocumentView doc={doc("draft")} />);
    expect(screen.getByTestId("report-card-document")).toHaveTextContent("PROVISIONAL");
  });
});
