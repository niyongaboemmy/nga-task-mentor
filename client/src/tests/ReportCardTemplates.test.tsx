import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "react-toastify";
import { ReportCardDocumentView } from "../components/ReportCard/ReportCardDocumentView";
import { sampleNormalDocument, sampleTvetDocument } from "../components/ReportCard/templates/sampleDocuments";
import ReportCardTemplatesPage, { validateTvetOptions } from "../pages/ReportCardTemplatesPage";
import { DEFAULT_TVET_OPTIONS, ReportCardWorkflowApi, type ReportCardScheme } from "../services/reportCardWorkflowApi";

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../services/reportCardWorkflowApi", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../services/reportCardWorkflowApi")>();
  return {
    ...orig,
    ReportCardWorkflowApi: { scheme: vi.fn(), saveScheme: vi.fn(), templateModules: vi.fn(), structure: vi.fn() },
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

  it("edits the TVET template: school block, module weights (override and reset), live preview, then saves", async () => {
    renderPage();
    await screen.findByTestId("in-use-normal");
    expect(await screen.findByTestId("module-weights")).toBeInTheDocument();
    expect(screen.getByTestId("save-tvet")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Headmaster's name"), { target: { value: "Sample Head" } });
    expect(within(screen.getByTestId("live-preview")).getByText("Sample Head")).toBeInTheDocument();
    // MIS has no hours for two modules; one has the school's 80.
    expect(screen.getByTestId("only-missing")).toHaveTextContent("No hours in MIS (1)");
    fireEvent.change(screen.getByLabelText("Apply Computer Basics weight"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Use the MIS weight for Entrepreneurship" }));
    expect(screen.getByTestId("only-missing")).toHaveTextContent("No hours in MIS (1)");
    fireEvent.click(screen.getByTestId("save-tvet"));
    await waitFor(() =>
      expect(ReportCardWorkflowApi.saveScheme).toHaveBeenCalledWith({
        tvet: expect.objectContaining({ headmaster_name: "Sample Head", district: "Gasabo", module_weights: { "3": 60 } }),
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("TVET template saved.");
  });

  it("checks the TVET options like the server", () => {
    expect(validateTvetOptions(DEFAULT_TVET_OPTIONS, {})).toEqual([]);
    expect(validateTvetOptions({ ...DEFAULT_TVET_OPTIONS, district: "x".repeat(61) }, {})).toContain("The district is at most 60 characters.");
    expect(validateTvetOptions({ ...DEFAULT_TVET_OPTIONS, default_module_weight: 0 }, {})).toContain("The default module weight must be between 1 and 1000.");
    expect(validateTvetOptions(DEFAULT_TVET_OPTIONS, { "1": "2000", "2": "" })).toContain("1 module weight is not between 1 and 1000.");
  });
});
