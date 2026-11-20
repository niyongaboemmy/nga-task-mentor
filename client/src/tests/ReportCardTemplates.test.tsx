import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "react-toastify";
import { ReportCardDocumentView } from "../components/ReportCard/ReportCardDocumentView";
import { sampleNormalDocument, sampleTvetDocument } from "../components/ReportCard/templates/sampleDocuments";
import ReportCardTemplatesPage, { validateTvetOptions } from "../pages/ReportCardTemplatesPage";
import { DEFAULT_TVET_OPTIONS, ReportCardWorkflowApi, type ReportCardScheme } from "../services/reportCardWorkflowApi";

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// The school's weights inside each category (its own panel; not under test here).
vi.mock("../services/reportCardApi", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../services/reportCardApi")>();
  return {
    ...orig,
    ReportCardApiService: {
      ...orig.ReportCardApiService,
      getComponentWeights: vi.fn(async () => ({ success: true, data: { components: [{ key: "class_work", label: "Class work" }], default: {}, subject: null, effective: {} } })),
      saveDefaultComponentWeights: vi.fn(async (weights: unknown) => ({ success: true, data: { default: weights } })),
    },
  };
});
vi.mock("../services/reportCardWorkflowApi", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../services/reportCardWorkflowApi")>();
  return {
    ...orig,
    ReportCardWorkflowApi: {
      scheme: vi.fn(),
      saveScheme: vi.fn(),
      templateModules: vi.fn(),
      structure: vi.fn(),
      templateSchool: vi.fn(),
      saveTemplateSchool: vi.fn(),
      saveModuleWeight: vi.fn(),
      mapFormative: vi.fn(),
    },
  };
});

describe("TVET template (RTB / CAMIS)", () => {
  it("lays out the Term 3 card like the issued one: school and learner blocks, three terms, the year, conduct, decision", () => {
    render(<ReportCardDocumentView doc={sampleTvetDocument(true)} verificationUrl="https://x/verify?v=1" />);
    const d = screen.getByTestId("report-card-document");
    expect(d).toHaveAttribute("data-template", "tvet");
    expect(screen.getByTestId("tvet-header")).toHaveTextContent("REPUBLIC OF RWANDA");
    expect(screen.getByTestId("tvet-header")).toHaveTextContent("DISTRICT: Gasabo");
    expect(screen.getByTestId("tvet-header")).toHaveTextContent("SDMS ID No: 100000000001");
    expect(screen.getByTestId("report-title")).toHaveTextContent("LEARNER'S ASSESSMENT REPORT");
    expect(d).toHaveTextContent("QUALIFICATION TITLE: Level 3");
    expect(d).toHaveTextContent("SECTOR: ICT and Multimedia");
    // Groups: complementary, then CORE (general, specific).
    const table = screen.getByTestId("tvet-table");
    const text = table.textContent ?? "";
    expect(text.indexOf("COMPLEMENTARY MODULES")).toBeLessThan(text.indexOf("CORE MODULES"));
    expect(text.indexOf("GENERAL MODULES")).toBeLessThan(text.indexOf("SPECIFIC MODULES"));
    // SPEWI302 (weight 80): 124.1 + 129.6 + 224.2 = 477.9 of 560 = 85.34%, competent.
    const row = screen.getByTestId("tvet-row-6");
    for (const t of ["SPEWI302", "80", "124.1", "129.6", "74.7", "75.9", "73.6", "224.2", "477.9", "85.34%", "C"]) expect(within(row).getByText(t)).toBeInTheDocument();
    // No IA mark is "–", like FA and CA: IA can be given in any term, so it's never "N/A".
    expect(within(screen.getByTestId("tvet-row-1")).queryByText("N/A")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("tvet-row-1")).getAllByText("–").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByTestId("behaviour-row")).toHaveTextContent("35/40");
    expect(screen.getByTestId("summary-position")).toHaveTextContent("2 out of 10");
    expect(screen.getByTestId("summary-conduct")).toHaveTextContent("35/40");
    expect(screen.getByTestId("deliberation")).toHaveTextContent("Promoted");
    expect(screen.getByTestId("legend")).toHaveTextContent("NYC: Not Yet Competent");
    expect(d).toHaveTextContent("The passing line for Specific modules is 70%");
    expect(d).toHaveTextContent("Head Teacher's name");
  });

  it("opens a module to show how its marks are worked out against the pass line", () => {
    render(<ReportCardDocumentView doc={sampleTvetDocument(true)} />);
    fireEvent.click(screen.getByTestId("tvet-row-6"));
    const detail = screen.getByTestId("tvet-detail-6");
    expect(detail).toHaveTextContent("Weight 80 (learning hours in MIS)");
    expect(detail).toHaveTextContent("224.2/240");
    expect(detail).toHaveTextContent("477.9/560");
    expect(detail).toHaveTextContent("pass line 70%");
    expect(detail).toHaveTextContent("Competent");
  });

  it("prints an integrated assessment given in Term 2, not only on Term 3", () => {
    const doc = sampleTvetDocument(false);
    const s = doc.groups[0].subjects.find((x) => x.code === "SPEWI302")!;
    s.tvet!.terms[0] = { fa: 59.2, ia: 72, ca: 70.4, to: 201.6, max: 240, pct: 84 };
    render(<ReportCardDocumentView doc={doc} />);
    const row = screen.getByTestId("tvet-row-6");
    for (const t of ["59.2", "72", "70.4", "201.6", "84%"]) expect(within(row).getByText(t)).toBeInTheDocument();
  });

  it("prints a termly card with one term, no year, and Competent / NYC per module", () => {
    const doc = sampleTvetDocument(false);
    render(<ReportCardDocumentView doc={doc} />);
    expect(screen.getByTestId("report-title")).toHaveTextContent("LEARNER'S TERMLY ASSESSMENT REPORT");
    expect(screen.getByTestId("tvet-table")).not.toHaveTextContent("TERM 1");
    expect(screen.getByTestId("tvet-table")).toHaveTextContent("TERM 2");
    expect(screen.queryByText("AT")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("tvet-row-6")).getByText("Competent")).toBeInTheDocument();
  });

  it("guides staff on a draft: unmapped marks per module and the way to map them", () => {
    const doc = sampleTvetDocument(false);
    doc.card = { ...doc.card, status: "draft" };
    const onOpen = vi.fn();
    render(
      <ReportCardDocumentView
        doc={doc}
        onOpen={onOpen}
        unmapped={{ 6: [{ kind: "manual", id: 9, title: "Practical test", subject_id: 6, at: null, recorded: 12, student_mark: { raw: 18, max: 20 }, url: "/grades/9/marks", map_url: "/grades/subjects/6" }] }}
      />,
    );
    expect(screen.getByTestId("mapping-guide")).toHaveTextContent("1 assessment with marks isn't mapped");
    expect(screen.getByTestId("unmapped-chip-6")).toHaveTextContent("1 not mapped");
    fireEvent.click(screen.getByTestId("tvet-row-6"));
    expect(screen.getByTestId("unmapped-6")).toHaveTextContent("FA, CA or IA");
    fireEvent.click(screen.getByTestId("map-6"));
    expect(onOpen).toHaveBeenCalledWith("/grades/subjects/6");
  });

  it("keeps a snapshot without a builder on the Normal template", () => {
    const doc = sampleNormalDocument();
    delete (doc as { builder?: string }).builder;
    render(<ReportCardDocumentView doc={doc} />);
    expect(screen.getByTestId("report-card-document")).not.toHaveAttribute("data-template");
    expect(screen.getByTestId("report-card-document")).toHaveTextContent("STUDENT REPORT CARD");
  });
});

const SCHEME: ReportCardScheme = {
  builder: "normal",
  tvet: { ...DEFAULT_TVET_OPTIONS, district: "Gasabo", module_weights: { "2": 80 } },

  category_weights: { CW: 15, HW: 10, MD: 25, EOT: 50 },
  pass_mark: 50,
  attributes: ["Punctuality"],
  subject_groups: [],
  show_position: true,
  show_class_average: true,
  show_subject_teacher: true,
  head_title: "Principal",
  require_distinct_approver: false,
};
const PROFILE = {
  school_id: 1,
  name: "Sample Technical School",
  address: "Kigali",
  district: null,
  contact_email: "info@school.rw",
  contact_phone: "0788 000 000",
  sector: "ICT and Multimedia",
  trade: null,
  qualification_title: null,
  head_teacher_name: null,
  logo_url: null,
};
const MODULES = [
  { id: 1, name: "Develop web user interface", code: "SPEWI302", category: "specific" as const, learning_hours: 80, rqf_level: "3", override: null },
  { id: 2, name: "Entrepreneurship", code: "CCMBC302", category: "complementary" as const, learning_hours: null, rqf_level: "3", override: 80 },
  { id: 3, name: "Apply Computer Basics", code: "GENCB302", category: "general" as const, learning_hours: null, rqf_level: "3", override: null },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <ReportCardTemplatesPage />
    </MemoryRouter>,
  );

describe("Report card templates page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ReportCardWorkflowApi.scheme).mockResolvedValue({ success: true, data: { scheme: structuredClone(SCHEME), bands: [] } });
    vi.mocked(ReportCardWorkflowApi.templateModules).mockResolvedValue({ success: true, data: { modules: MODULES, default_module_weight: 100 } });
    vi.mocked(ReportCardWorkflowApi.templateSchool).mockResolvedValue({ success: true, data: { profile: { ...PROFILE }, can_edit: true, source: "mis" } });
    vi.mocked(ReportCardWorkflowApi.saveTemplateSchool).mockImplementation(async (patch) => ({ success: true, data: { profile: { ...PROFILE, ...patch } as never } }));
    vi.mocked(ReportCardWorkflowApi.mapFormative).mockImplementation(async (dryRun) => ({
      success: true,
      data: { term: "Term 1", academic_year: "2026 - 2027", scanned: 9, already_mapped: 4, mapped: 5, by_kind: { quiz: 3, assignment: 1, manual: 1 }, subjects: 2, cards_updated: dryRun ? 0 : 12, dry_run: !!dryRun },
    }));
    vi.mocked(ReportCardWorkflowApi.saveModuleWeight).mockImplementation(async (id, weight) => ({ success: true, data: { id, weight } }));
    vi.mocked(ReportCardWorkflowApi.saveScheme).mockImplementation(async (patch) => ({
      success: true,
      data: { scheme: { ...structuredClone(SCHEME), ...patch, tvet: { ...SCHEME.tvet!, ...(patch.tvet ?? {}) } } as ReportCardScheme },
    }));
  });

  it("shows both templates with the one in use, and switches builder after confirming", async () => {
    renderPage();
    expect(screen.getByTestId("templates-skeleton")).toBeInTheDocument();
    expect(await screen.findByTestId("in-use-normal")).toBeInTheDocument();
    expect(screen.getByTestId("template-tvet")).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByTestId("use-tvet"));
    expect(screen.getByText("Use the TVET builder?")).toBeInTheDocument();
    expect(screen.getByText(/Existing CW\/HW\/MD mappings count as FA and EOT as CA/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch builder" }));
    await waitFor(() => expect(ReportCardWorkflowApi.saveScheme).toHaveBeenCalledWith({ builder: "tvet" }));
    expect(await screen.findByTestId("in-use-tvet")).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("now uses the TVET builder"));
    // FA by default: this term's unmapped work is mapped straight away.
    await waitFor(() => expect(ReportCardWorkflowApi.mapFormative).toHaveBeenCalledWith(false));
    expect(toast.success).toHaveBeenCalledWith("Mapped 3 quizzes, 1 assignment and 1 recorded mark to FA.");
    expect(await screen.findByTestId("formative-default")).toBeInTheDocument();
  });

  it("keeps the school's details in MIS: offers the template's earlier district, saves to MIS, previews live", async () => {
    renderPage();
    const card = await screen.findByTestId("school-profile");
    expect(await within(card).findByLabelText("School email")).toHaveValue("info@school.rw");
    // MIS has no district; the template's earlier "Gasabo" is offered for MIS.
    expect(within(card).getByLabelText("District")).toHaveValue("Gasabo");
    expect(screen.getByTestId("school-profile-moved")).toHaveTextContent("1 value from this template isn't in MIS yet");
    fireEvent.change(within(card).getByLabelText("Head of school's name"), { target: { value: "Sample Head" } });
    expect(within(screen.getByTestId("live-preview")).getByText("Sample Head")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("save-school-profile"));
    await waitFor(() => expect(ReportCardWorkflowApi.saveTemplateSchool).toHaveBeenCalledWith({ district: "Gasabo", head_teacher_name: "Sample Head" }));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("saved in MIS"));
  });

  it("shows the school's details read-only without MIS Manage schools", async () => {
    vi.mocked(ReportCardWorkflowApi.templateSchool).mockResolvedValue({ success: true, data: { profile: { ...PROFILE }, can_edit: false, source: "mis" } });
    renderPage();
    expect(await screen.findByTestId("school-profile-readonly")).toHaveTextContent("Manage schools");
    expect(within(screen.getByTestId("school-profile")).getByLabelText("School name")).toBeDisabled();
    expect(screen.queryByTestId("save-school-profile")).not.toBeInTheDocument();
  });

  it("saves a module's weight on its MIS subject when the field is left, and removes a Task Mentor weight", async () => {
    renderPage();
    await screen.findByTestId("in-use-normal");
    expect(await screen.findByTestId("module-weights")).toBeInTheDocument();
    expect(screen.getByTestId("only-missing")).toHaveTextContent("No weight yet (1)");
    const input = screen.getByLabelText("Apply Computer Basics weight in MIS");
    fireEvent.change(input, { target: { value: "60" } });
    fireEvent.blur(input);
    await waitFor(() => expect(ReportCardWorkflowApi.saveModuleWeight).toHaveBeenCalledWith(3, 60));
    expect(toast.success).toHaveBeenCalled();
    expect(await screen.findByText("No weight yet (0)")).toBeInTheDocument();
    // Entrepreneurship's 80 was set in Task Mentor: remove it, then save the template.
    expect(within(screen.getByTestId("weight-row-2")).getByText("Task Mentor")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove the Task Mentor weight for Entrepreneurship" }));
    fireEvent.click(screen.getByTestId("save-tvet"));
    await waitFor(() => expect(ReportCardWorkflowApi.saveScheme).toHaveBeenCalledWith({ tvet: expect.objectContaining({ module_weights: {} }) }));
  });

  it("on a TVET school, shows what isn't mapped this term and maps it to FA after confirming", async () => {
    vi.mocked(ReportCardWorkflowApi.scheme).mockResolvedValue({ success: true, data: { scheme: { ...structuredClone(SCHEME), builder: "tvet" }, bands: [] } });
    renderPage();
    expect(await screen.findByTestId("formative-pending", {}, { timeout: 4000 })).toHaveTextContent("3 quizzes, 1 assignment and 1 recorded mark in 2 subjects aren't mapped yet");
    fireEvent.click(screen.getByTestId("map-formative"));
    expect(screen.getByText("Map 5 to FA?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Map to FA" }));
    await waitFor(() => expect(ReportCardWorkflowApi.mapFormative).toHaveBeenCalledWith(false));
    expect(toast.success).toHaveBeenCalledWith("Mapped 3 quizzes, 1 assignment and 1 recorded mark to FA (Term 1, 2026 - 2027).");
  });

  it("checks the TVET options like the server", () => {
    expect(validateTvetOptions(DEFAULT_TVET_OPTIONS, {})).toEqual([]);
    expect(validateTvetOptions({ ...DEFAULT_TVET_OPTIONS, district: "x".repeat(61) }, {})).toContain("The district is at most 60 characters.");
    expect(validateTvetOptions({ ...DEFAULT_TVET_OPTIONS, default_module_weight: 0 }, {})).toContain("The default module weight must be between 1 and 1000.");
    expect(validateTvetOptions(DEFAULT_TVET_OPTIONS, { "1": "2000", "2": "" })).toContain("1 module weight is not between 1 and 1000.");
  });
});

describe("Visual template editor (edit on the card)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ReportCardWorkflowApi.scheme).mockResolvedValue({ success: true, data: { scheme: { ...structuredClone(SCHEME), builder: "tvet" }, bands: [] } });
    vi.mocked(ReportCardWorkflowApi.templateModules).mockResolvedValue({ success: true, data: { modules: MODULES, default_module_weight: 100 } });
    vi.mocked(ReportCardWorkflowApi.templateSchool).mockResolvedValue({ success: true, data: { profile: { ...PROFILE }, can_edit: true, source: "mis" } });
    vi.mocked(ReportCardWorkflowApi.saveTemplateSchool).mockImplementation(async (patch) => ({ success: true, data: { profile: { ...PROFILE, ...patch } as never } }));
    vi.mocked(ReportCardWorkflowApi.saveScheme).mockImplementation(async (patch) => ({ success: true, data: { scheme: { ...structuredClone(SCHEME), ...patch } as ReportCardScheme } }));
    vi.mocked(ReportCardWorkflowApi.mapFormative).mockResolvedValue({
      success: true,
      data: { term: "Term 1", academic_year: "2026 - 2027", scanned: 0, already_mapped: 0, mapped: 0, by_kind: { quiz: 0, assignment: 0, manual: 0 }, subjects: 0, cards_updated: 0, dry_run: true },
    });
  });

  it("edits the school's details right on the card and saves them to MIS, with the display options", async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId("edit-visually"));
    expect(await screen.findByTestId("visual-edit-bar")).toBeInTheDocument();
    // MIS has no head of school yet: the card offers to add one.
    fireEvent.click(screen.getByTestId("field-head of school"));
    const input = screen.getByTestId("edit-head of school");
    fireEvent.change(input, { target: { value: "Sample Head" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    expect(screen.getAllByTestId("headmaster-name").some((e) => e.textContent?.includes("Sample Head"))).toBe(true);
    fireEvent.click(screen.getByTestId("field-district"));
    const d = screen.getByTestId("edit-district");
    fireEvent.change(d, { target: { value: "Gasabo" } });
    fireEvent.blur(d);
    fireEvent.click(screen.getByTestId("visual-show-attendance"));
    expect(screen.getByTestId("visual-edit-count")).toHaveTextContent("3 unsaved changes");
    fireEvent.click(screen.getByTestId("visual-edit-save"));
    await waitFor(() => expect(ReportCardWorkflowApi.saveTemplateSchool).toHaveBeenCalledWith({ district: "Gasabo", head_teacher_name: "Sample Head" }));
    await waitFor(() => expect(ReportCardWorkflowApi.saveScheme).toHaveBeenCalledWith({ tvet: { show_attendance: true, show_attributes: false } }));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Saved 3 changes to MIS"));
  });

  it("is read-only without MIS Manage schools, and asks before closing with unsaved changes", async () => {
    vi.mocked(ReportCardWorkflowApi.templateSchool).mockResolvedValue({ success: true, data: { profile: { ...PROFILE }, can_edit: false, source: "mis" } });
    renderPage();
    fireEvent.click(await screen.findByTestId("edit-visually"));
    expect(await screen.findByTestId("visual-edit-readonly")).toHaveTextContent("Manage schools");
    expect(screen.getByTestId("field-district")).not.toHaveAttribute("role", "button");
    fireEvent.click(screen.getByTestId("visual-show-attributes"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(await screen.findByText("Close without saving?")).toBeInTheDocument();
  });
});
