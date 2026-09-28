import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { ReportCardPreviewData } from "../services/reportCardApi";

/**
 * Student profile -> Report Cards tab: a provisional preview before the card
 * exists and before every mark is recorded (GET /report-cards/preview).
 */

vi.mock("qrcode.react", () => ({ QRCodeSVG: () => <svg data-testid="qr" /> }));
vi.mock("react-toastify", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { currentAcademicYear: { name: "2026 - 2027" }, currentAcademicTerm: { name: "Term 1" } } }),
}));
const getCard = vi.fn();
const getPreview = vi.fn();
vi.mock("../services/reportCardApi", async (orig) => {
  const actual = await orig<typeof import("../services/reportCardApi")>();
  return {
    ...actual,
    ReportCardApiService: {
      ...actual.ReportCardApiService,
      getStudentReportCard: (...a: unknown[]) => getCard(...a),
      getReportCardPreview: (...a: unknown[]) => getPreview(...a),
    },
  };
});

import StudentReportCardDashboard from "../components/ReportCard/StudentReportCardDashboard";

const previewData = (): ReportCardPreviewData => ({
  report_card: {
    id: null, uuid: null, student_id: 48, term: "Term 1", academic_year: "2026 - 2027", status: null,
    class_teacher_comment: null, attendance: { present: 0, absent: 0, late: 0, total_days: 0 },
  },
  grades: [
    {
      subject_id: 1,
      total_score: 12,
      categories: { CW: { scaled_score: 12, weight: 15, avg_percentage: 80, assessments: [] } },
    },
  ],
  attributes: [],
  subject_names: { 1: "Mathematics", 2: "Art" },
  raw_assessments: [],
  preview: {
    is_provisional: true,
    card_exists: false,
    overall: { subjects: 2, subjects_with_marks: 1, expected: 3, recorded: 1, completeness: 33.3, average_so_far: 12, running_average: 80 },
    subjects: [
      {
        subject_id: 1, name: "Mathematics", source: "subject_mapping", expected: 3, recorded: 1, completeness: 33.3, weight_covered: 15,
        total_so_far: 12, running_percentage: 80,
        categories: { CW: { expected: 2, recorded: 1, weight: 15 }, EOT: { expected: 1, recorded: 0, weight: 50 } },
        pending: [
          { title: "Quiz 2", kind: "quiz", category: "CW" },
          { title: "Final exam", kind: "manual", category: "EOT" },
        ],
        pending_total: 2,
      },
      {
        subject_id: 2, name: "Art", source: "none", expected: 0, recorded: 0, completeness: null, weight_covered: 0,
        total_so_far: null, running_percentage: null, categories: {}, pending: [], pending_total: 0,
      },
    ],
  },
});

beforeEach(() => {
  getCard.mockReset();
  getPreview.mockReset();
  getPreview.mockResolvedValue({ success: true, data: previewData() });
});

describe("provisional report card", () => {
  it("offers a preview when the card doesn't exist yet, and shows what's still missing", async () => {
    getCard.mockRejectedValue({ response: { status: 404 } });
    render(<StudentReportCardDashboard studentId={48} studentName="Jane Doe" />);

    expect(await screen.findByText("No report card yet for Term 1 · 2026 - 2027")).toBeInTheDocument();
    expect(getPreview).toHaveBeenCalledWith(48, { term: "Term 1", academic_year: "2026 - 2027" });

    // Per-subject completeness, straight from the preview.
    const marks = (await screen.findByText("Marks recorded per subject")).closest("section")!;
    expect(within(marks).getByText("1/3")).toBeInTheDocument();
    expect(within(marks).getByText(/Waiting for Quiz 2 \(CW\), Final exam \(EOT\)/)).toBeInTheDocument();
    expect(within(marks).getByText("Nothing mapped")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Preview provisional card/ }));
    expect(await screen.findByText("Provisional Report Card")).toBeInTheDocument();
    const doc = document.getElementById("report-card-document")!;
    expect(within(doc).getByText(/Provisional preview, not an official report/)).toBeInTheDocument();
    expect(within(doc).getByText(/1 of 3 mapped marks recorded/)).toBeInTheDocument();
    // Recorded CW counts; the unrecorded EOT shows as pending, not zero.
    expect(within(doc).getByText("pending")).toBeInTheDocument();
    expect(within(doc).getAllByText("80.0%").length).toBeGreaterThan(0);
    expect(within(doc).getByText("No assessments mapped yet")).toBeInTheDocument();
    expect(within(doc).getByText("Provisional: not verifiable")).toBeInTheDocument();
    expect(screen.queryByTestId("qr")).toBeNull();
    expect(screen.queryByRole("button", { name: /Download PDF/ })).toBeNull();
  });

  it("keeps the official card and adds the provisional preview while marks are missing", async () => {
    getCard.mockResolvedValue({
      success: true,
      data: { ...previewData(), report_card: { ...previewData().report_card, id: 5, uuid: "abcdef12-0000", status: "draft" } },
    });
    render(<StudentReportCardDashboard studentId={48} studentName="Jane Doe" />);
    expect(await screen.findByRole("button", { name: /Preview Report Card/ })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Provisional preview/ })).toBeInTheDocument();
    expect(screen.getByText(/mapped marks recorded/)).toBeInTheDocument();
  });
});
