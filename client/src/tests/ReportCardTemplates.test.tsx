import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "react-toastify";
import { ReportCardDocumentView } from "../components/ReportCard/ReportCardDocumentView";
import { sampleNormalDocument, sampleTvetDocument } from "../components/ReportCard/templates/sampleDocuments";
import ReportCardTemplatesPage, { validateTvetOptions } from "../pages/ReportCardTemplatesPage";
import { DEFAULT_TVET_OPTIONS, ReportCardWorkflowApi, type ReportCardScheme } from "../services/reportCardWorkflowApi";

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
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
    expect(d).toHaveTextContent("QUALIFICATION TITLE: TVET Certificate III in Software Programming and Embedded Systems");
    expect(d).toHaveTextContent("SECTOR: ICT and Multimedia");
    // Groups: complementary, then CORE (general, specific).
    const table = screen.getByTestId("tvet-table");
    const text = table.textContent ?? "";
    expect(text.indexOf("COMPLEMENTARY MODULES")).toBeLessThan(text.indexOf("CORE MODULES"));
    expect(text.indexOf("GENERAL MODULES")).toBeLessThan(text.indexOf("SPECIFIC MODULES"));
    // SPEWI302 (weight 80): 124.1 + 129.6 + 224.2 = 477.9 of 560 = 85.34%, competent.
    const row = screen.getByTestId("tvet-row-6");
    for (const t of ["SPEWI302", "80", "124.1", "129.6", "74.7", "75.9", "73.6", "224.2", "477.9", "85.34%", "C"]) expect(within(row).getByText(t)).toBeInTheDocument();
    expect(within(screen.getByTestId("tvet-row-1")).getAllByText("N/A")).toHaveLength(3); // no IA for complementary modules
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

  it("checks the TVET options like the server", () => {
    expect(validateTvetOptions(DEFAULT_TVET_OPTIONS, {})).toEqual([]);
    expect(validateTvetOptions({ ...DEFAULT_TVET_OPTIONS, district: "x".repeat(61) }, {})).toContain("The district is at most 60 characters.");
    expect(validateTvetOptions({ ...DEFAULT_TVET_OPTIONS, default_module_weight: 0 }, {})).toContain("The default module weight must be between 1 and 1000.");
    expect(validateTvetOptions(DEFAULT_TVET_OPTIONS, { "1": "2000", "2": "" })).toContain("1 module weight is not between 1 and 1000.");
  });
});
