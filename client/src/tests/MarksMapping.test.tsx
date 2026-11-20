import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "react-toastify";
import ReportCardMappingStrip from "../components/ReportCard/ReportCardMappingStrip";
import SuggestMappingDialog from "../components/Grades/SuggestMappingDialog";
import { ReportCardApiService } from "../services/reportCardApi";
import { pickOption } from "./helpers/select";
import { NORMAL_STRUCTURE, TVET_STRUCTURE, refreshReportCardStructure } from "../hooks/useReportCardStructure";

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { currentAcademicTerm: { name: "Term 1" }, currentAcademicYear: { name: "2026 - 2027" } } }),
}));
vi.mock("../services/reportCardWorkflowApi", () => ({ ReportCardWorkflowApi: { structure: vi.fn().mockRejectedValue(new Error("offline")) } }));
vi.mock("../services/reportCardApi", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../services/reportCardApi")>();
  return { ...orig, ReportCardApiService: { getSubjectMapping: vi.fn(), saveSubjectMapping: vi.fn() } };
});

const renderStrip = () =>
  render(
    <MemoryRouter>
      <ReportCardMappingStrip subjectId={9} kind="manual" assessmentId={5} />
    </MemoryRouter>,
  );

describe("Report card mapping on the marks page", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await refreshReportCardStructure(NORMAL_STRUCTURE);
    vi.mocked(ReportCardApiService.saveSubjectMapping).mockResolvedValue({ success: true } as never);
  });

  it("warns when the marks count nowhere, and maps them with undo", async () => {
    vi.mocked(ReportCardApiService.getSubjectMapping).mockResolvedValue({ success: true, data: { assessments: [{ assessment_type: "quiz", assessment_id: 1, category: "CW" }] } } as never);
    renderStrip();
    expect(screen.getByTestId("mapping-strip-skeleton")).toBeInTheDocument();
    expect(await screen.findByText("Not on the report card yet")).toBeInTheDocument();
    expect(screen.getByTestId("mapping-strip-hint")).toHaveTextContent("Normal builder (CW, HW, MD, EOT)");
    pickOption(screen.getByRole("combobox", { name: "Report card category" }), "MD");
    await waitFor(() =>
      expect(ReportCardApiService.saveSubjectMapping).toHaveBeenCalledWith({
        subject_id: 9,
        term: "Term 1",
        academic_year: "2026 - 2027",
        assessments: [
          { assessment_type: "quiz", assessment_id: 1, category: "CW" },
          { assessment_type: "manual", assessment_id: 5, category: "MD" },
        ],
      }),
    );
    expect(await screen.findByText("On the report card as Mid-Term")).toBeInTheDocument();
    expect(screen.getByTestId("mapping-strip-hint")).toHaveTextContent("MD is 25% of the subject's total");
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows an old EOT mapping where it counts under the TVET builder", async () => {
    await refreshReportCardStructure(TVET_STRUCTURE);
    vi.mocked(ReportCardApiService.getSubjectMapping).mockResolvedValue({ success: true, data: { assessments: [{ assessment_type: "manual", assessment_id: 5, category: "EOT" }] } } as never);
    renderStrip();
    expect(await screen.findByText("On the report card as Comprehensive Assessment")).toBeInTheDocument();
    expect(screen.getByTestId("mapping-strip-hint")).toHaveTextContent("CA is scored out of the module weight");
    await refreshReportCardStructure(NORMAL_STRUCTURE);
  });
});

describe("Suggested mapping for a subject", () => {
  it("lists the unmapped work with suggestions, lets a teacher change or skip, and applies the rest", async () => {
    const onApply = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(
      <SuggestMappingDialog
        open
        subjectName="Web UI"
        structure={NORMAL_STRUCTURE}
        rows={[
          { key: "quiz-1", title: "Quiz 1", kindLabel: "Quiz", suggested: "CW" },
          { key: "manual-2", title: "Midterm 1", kindLabel: "Manual", suggested: "MD" },
          { key: "manual-3", title: "Project", kindLabel: "Manual", suggested: null },
        ]}
        onApply={onApply}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId("apply-suggestions")).toHaveTextContent("Map 2");
    expect(screen.getByText(/no suggestion/)).toBeInTheDocument();
    pickOption(screen.getByRole("combobox", { name: "Category for Project" }), "EOT");
    pickOption(screen.getByRole("combobox", { name: "Category for Quiz 1" }), "");
    fireEvent.click(screen.getByTestId("apply-suggestions"));
    await waitFor(() =>
      expect(onApply).toHaveBeenCalledWith([
        { key: "manual-2", category: "MD" },
        { key: "manual-3", category: "EOT" },
      ]),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
