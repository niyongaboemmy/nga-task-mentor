import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { SchoolReports, Stat } from "../services/reportCardWorkflowApi";

// /reports/school: the hub over GET /api/reports/school. The maths is the
// server's (reportAnalytics.service.ts); these tests pin what the page shows
// and that every tab can export.

const schoolReports = vi.fn();
vi.mock("../services/reportCardWorkflowApi", async () => {
  const actual = await vi.importActual<typeof import("../services/reportCardWorkflowApi")>("../services/reportCardWorkflowApi");
  return {
    ...actual,
    ReportCardWorkflowApi: { ...actual.ReportCardWorkflowApi, schoolReports: (...a: unknown[]) => schoolReports(...a) },
  };
});

const downloadCsv = vi.fn();
vi.mock("../utils/csvExport", async () => {
  const actual = await vi.importActual<typeof import("../utils/csvExport")>("../utils/csvExport");
  return { ...actual, downloadCsv: (...a: unknown[]) => downloadCsv(...a) };
});

vi.mock("../hooks/useTermYearSelector", () => ({
  useTermYearSelector: () => ({
    years: [{ academic_year_id: 1, name: "2026-2027", is_current: true }],
    terms: [{ academic_term_id: 2, name: "Term 2", is_current: true }],
    loading: false,
    academicYear: "2026-2027",
    term: "Term 2",
    academicYearId: 1,
    academicTermId: 2,
    setAcademicYear: vi.fn(),
    setTerm: vi.fn(),
  }),
}));

const toastError = vi.fn();
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) } }));

import SchoolReportsPage from "../pages/SchoolReportsPage";
import { NGA_BANDS } from "../services/reportCardWorkflowApi";

const stat = (mean: number | null, n = 2, pass_rate: number | null = 50): Stat => ({
  n,
  mean,
  median: mean,
  sd: mean == null ? null : 5,
  min: mean == null ? null : mean - 10,
  max: mean == null ? null : mean + 10,
  pass_rate,
});
const dist = (counts: Record<string, number> = {}) => NGA_BANDS.map((b) => ({ letter: b.letter, min: b.min, count: counts[b.letter] ?? 0 }));

const fixture = (over: Partial<SchoolReports> = {}): SchoolReports => ({
  term: "Term 2",
  academic_year: "2026-2027",
  class_group_id: null,
  basis: "issued",
  provisional: false,
  drafts_included: 0,
  truncated: false,
  pass_mark: 50,
  bands: NGA_BANDS,
  classes: [
    { id: 11, name: "S4 MPC", program_name: "Sciences" },
    { id: 12, name: "S4 SWD", program_name: null },
  ],
  students: 3,
  with_marks: 3,
  performance: {
    overall: { ...stat(62.5, 3, 66.7), distribution: dist({ A: 1, C: 1, E: 1 }) },
    subjects: [
      { ...stat(70), subject_id: 1, name: "Mathematics", distribution: dist({ A: 1, C: 1 }) },
      { ...stat(40, 2, 0), subject_id: 2, name: "Physics", distribution: dist({ E: 2 }) },
    ],
    classes: [{ ...stat(62.5, 3), class_group_id: 11, name: "S4 MPC", program_name: "Sciences", students: 3, at_risk: 1 }],
    hardest_subjects: [{ ...stat(40, 2, 0), subject_id: 2, name: "Physics" }],
  },
  gender: {
    overall: {
      female: { ...stat(66.2, 1, 100), students: 1, distribution: dist() },
      male: { ...stat(63, 1, 100), students: 1, distribution: dist() },
      unknown: { ...stat(45, 1, 0), students: 1, distribution: dist() },
    },
    gap: 3.2,
    pass_rate_gap: 0,
    subjects: [{ subject_id: 1, name: "Mathematics", female: stat(72, 1), male: stat(68, 1), unknown: stat(null, 0), gap: 4 }],
    classes: [
      {
        class_group_id: 11,
        name: "S4 MPC",
        female: { ...stat(66.2, 1), students: 1 },
        male: { ...stat(63, 1), students: 1 },
        unknown: { ...stat(45, 1), students: 1 },
        gap: 3.2,
      },
    ],
    unknown_count: 1,
  },
  trends: {
    terms: ["Term 2"],
    overall: [{ ...stat(62.5, 3), term: "Term 2" }],
    subjects: [],
    classes: [],
    improvement: [],
    previous_term: null,
  },
  at_risk: [
    {
      student_id: 3,
      name: "Claude Niyonzima",
      gender: "unknown",
      class_name: "S4 MPC",
      average: 38,
      failed_subjects: ["Physics", "Chemistry"],
      attendance_rate: 72,
      reasons: ["Average 38% is below the pass mark (50%)", "Failed 2 subjects", "Attendance 72%"],
      severity: "high",
    },
  ],
  broadsheet: {
    subjects: [
      { subject_id: 1, name: "Mathematics" },
      { subject_id: 2, name: "Physics" },
    ],
    students: [
      {
        student_id: 1,
        name: "Aline Uwase",
        registration_number: "NGA/001",
        gender: "female",
        class_name: "S4 MPC",
        status: "published",
        subjects: { 1: 82, 2: 50.4 },
        total: 132.4,
        average: 66.2,
        grade: "C",
        position: 1,
        position_of: 3,
        passed: 2,
        failed: 0,
        attendance_rate: 97.5,
      },
      {
        student_id: 2,
        name: "Eric Mugisha",
        registration_number: null,
        gender: "male",
        class_name: "S4 MPC",
        status: "approved",
        subjects: { 1: 78 },
        total: 78,
        average: 63,
        grade: "C",
        position: 2,
        position_of: 3,
        passed: 1,
        failed: 0,
        attendance_rate: null,
      },
    ],
    subject_stats: [
      { subject_id: 1, mean: 80, max: 82, min: 78, pass_rate: 100 },
      { subject_id: 2, mean: 50.4, max: 50.4, min: 50.4, pass_rate: 100 },
    ],
  },
  ...over,
});

const renderPage = (path = "/reports/school") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SchoolReportsPage />
    </MemoryRouter>,
  );

const openTab = (name: string) => fireEvent.click(screen.getByRole("tab", { name: new RegExp(name) }));

describe("SchoolReportsPage", () => {
  beforeEach(() => {
    schoolReports.mockReset().mockResolvedValue({ success: true, data: fixture() });
    downloadCsv.mockReset();
    toastError.mockReset();
  });

  it("asks for the selected period, issued cards only by default", async () => {
    renderPage();
    expect(await screen.findByRole("row", { name: /Aline Uwase/ })).toBeInTheDocument();
    expect(schoolReports).toHaveBeenCalledWith({
      term: "Term 2",
      academic_year: "2026-2027",
      class_group_id: null,
      include_drafts: false,
      fresh: false,
    });
    expect(screen.getByText(/Showing issued \(approved\/published\) cards only/)).toBeInTheDocument();
    expect(screen.queryByText("Provisional — includes draft cards.")).not.toBeInTheDocument();
  });

  it("renders all five tabs", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Aline Uwase/ });
    for (const name of ["Broadsheet", "Performance", "Gender", "Trends", "At risk"]) {
      expect(screen.getByRole("tab", { name: new RegExp(name) })).toBeInTheDocument();
    }
  });

  it("shows the broadsheet with positions, grades and the subject footer", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Aline Uwase/ });
    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.getByText("97.5%")).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Subject mean" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Pass rate" })).toBeInTheDocument();
    // Eric has no Physics mark: a dash, not a 0.
    const eric = screen.getByRole("row", { name: /Eric Mugisha/ });
    expect(within(eric).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("exports the open tab through the Excel-safe CSV writer", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Aline Uwase/ });
    fireEvent.click(screen.getByRole("button", { name: "Export the broadsheet as CSV" }));
    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const [filename, rows] = downloadCsv.mock.calls[0] as [string, unknown[][]];
    expect(filename).toBe("broadsheet-all-classes-term-2-2026-2027.csv");
    const header = rows.find((r) => r[1] === "Student")!;
    expect(header).toContain("Mathematics");
    expect(rows.find((r) => r[1] === "Aline Uwase")).toEqual(
      expect.arrayContaining(["1/3", "NGA/001", "female", 82, 50.4, 66.2, "C", 97.5]),
    );
    expect(screen.getByRole("button", { name: /Print the broadsheet/ })).toBeInTheDocument();
  });

  it("shows the gender gap and flags students with no gender in MIS", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Aline Uwase/ });
    openTab("Gender");
    expect(await screen.findByTestId("gender-gap")).toHaveTextContent("Girls +3.2 vs boys");
    expect(screen.getByText(/Gender is missing in MIS for 1 student\b/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export the gender report as CSV/ })).toBeInTheDocument();
  });

  it("compares subjects with the hardest first in its own list", async () => {
    renderPage("/reports/school?tab=performance");
    expect(await screen.findByText("Subject comparison")).toBeInTheDocument();
    expect(screen.getByText("Hardest subjects")).toBeInTheDocument();
    expect(screen.getByText("Grade distribution")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export performance as CSV/ })).toBeInTheDocument();
  });

  it("explains that trends need a second term", async () => {
    renderPage("/reports/school?tab=trends");
    expect(await screen.findByText("Only one term so far")).toBeInTheDocument();
  });

  it("lists most improved and biggest drops when there is a previous term", async () => {
    schoolReports.mockResolvedValue({
      success: true,
      data: fixture({
        trends: {
          terms: ["Term 1", "Term 2"],
          overall: [
            { ...stat(58), term: "Term 1" },
            { ...stat(62.5), term: "Term 2" },
          ],
          subjects: [{ subject_id: 1, name: "Mathematics", terms: [{ term: "Term 1", mean: 70, n: 2 }, { term: "Term 2", mean: 80, n: 2 }] }],
          classes: [],
          improvement: [
            { student_id: 1, name: "Aline Uwase", class_name: "S4 MPC", previous: 55, current: 66.2, change: 11.2 },
            { student_id: 3, name: "Claude Niyonzima", class_name: "S4 MPC", previous: 52, current: 38, change: -14 },
          ],
          previous_term: "Term 1",
        },
      }),
    });
    renderPage("/reports/school?tab=trends");
    expect(await screen.findByText("Most improved since Term 1")).toBeInTheDocument();
    expect(screen.getByText("Biggest drops since Term 1")).toBeInTheDocument();
    expect(screen.getByText("+11.2")).toBeInTheDocument();
    expect(screen.getByText("-14")).toBeInTheDocument();
  });

  it("lists at-risk students with severity, reasons and attendance", async () => {
    renderPage("/reports/school?tab=at-risk");
    expect(await screen.findByText("Claude Niyonzima")).toBeInTheDocument();
    expect(screen.getByText("Failed 2 subjects")).toBeInTheDocument();
    expect(screen.getByText("Chemistry")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();
  });

  it("asks again with include_drafts and labels the numbers provisional", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Aline Uwase/ });
    schoolReports.mockResolvedValue({ success: true, data: fixture({ provisional: true, basis: "issued_and_drafts", drafts_included: 4 }) });
    fireEvent.click(screen.getByRole("checkbox", { name: /Include drafts \(provisional\)/ }));
    expect(await screen.findByText("Provisional — includes draft cards.")).toBeInTheDocument();
    expect(screen.getByText(/4 draft cards not yet approved/)).toBeInTheDocument();
    expect(schoolReports).toHaveBeenLastCalledWith(expect.objectContaining({ include_drafts: true }));
  });

  it("refreshes with fresh=1 and warns when the data was truncated", async () => {
    schoolReports.mockResolvedValue({ success: true, data: fixture({ truncated: true }) });
    renderPage();
    expect(await screen.findByText(/only part of the school is shown/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh reports" }));
    await waitFor(() => expect(schoolReports).toHaveBeenLastCalledWith(expect.objectContaining({ fresh: true })));
  });

  it("toasts the error and offers a retry", async () => {
    schoolReports.mockRejectedValueOnce({ response: { data: { message: "Server is busy" } } });
    renderPage();
    expect(await screen.findByText("Server is busy")).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith("Server is busy");
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(await screen.findByRole("row", { name: /Aline Uwase/ })).toBeInTheDocument();
  });

  describe("interactive broadsheet", () => {
    it("filters by gender from the filter panel, shows the chip and a live summary", async () => {
      renderPage();
      await screen.findByRole("row", { name: /Aline Uwase/ });
      fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
      fireEvent.click(screen.getByRole("button", { name: "Boys" }));
      await waitFor(() => expect(screen.queryByRole("row", { name: /Aline Uwase/ })).not.toBeInTheDocument());
      expect(screen.getByRole("row", { name: /Eric Mugisha/ })).toBeInTheDocument();
      expect(screen.getByTestId("active-filters")).toHaveTextContent("Showing 1 of 2");
      expect(screen.getByTestId("broadsheet-summary")).toHaveTextContent("of 2");
      fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
      expect(await screen.findByRole("row", { name: /Aline Uwase/ })).toBeInTheDocument();
    });

    it("reads filters from the URL so a view can be shared", async () => {
      renderPage("/reports/school?fs=2");
      // Failing Physics (below 50): nobody, Aline has 50.4.
      expect(await screen.findByText("No student matches these filters.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove filter Failing Physics" })).toBeInTheDocument();
    });

    it("sorts by a subject column and toggles the direction", async () => {
      renderPage();
      await screen.findByRole("row", { name: /Aline Uwase/ });
      const names = () => screen.getAllByRole("row", { name: /^Open / }).map((r) => r.getAttribute("aria-label"));
      fireEvent.click(screen.getByRole("button", { name: "Physics" }));
      expect(names()[0]).toMatch(/Aline/); // best first; Eric has no Physics mark (always last)
      fireEvent.click(screen.getByRole("button", { name: "Student" }));
      expect(screen.getByRole("columnheader", { name: "Student" })).toHaveAttribute("aria-sort", "ascending");
      expect(names()).toEqual(["Open Aline Uwase's details", "Open Eric Mugisha's details"]);
      fireEvent.click(screen.getByRole("button", { name: "Student" }));
      expect(names()[0]).toMatch(/Eric/);
    });

    it("opens a student's drawer and steps to the next one", async () => {
      renderPage();
      fireEvent.click(await screen.findByRole("row", { name: /Aline Uwase/ }));
      const drawer = await screen.findByTestId("student-drawer");
      expect(within(within(drawer).getByRole("region", { name: "Subject marks" })).getByText("Mathematics")).toBeInTheDocument();
      expect(within(drawer).getByText("NGA/001 · S4 MPC · Girl · Published")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Next student" }));
      expect(await screen.findByRole("dialog", { name: "Eric Mugisha" })).toBeInTheDocument();
    });

    it("exports only what the filters show", async () => {
      renderPage("/reports/school?g=male");
      await screen.findByRole("row", { name: /Eric Mugisha/ });
      fireEvent.click(screen.getByRole("button", { name: "Export the broadsheet as CSV" }));
      const [filename, rows] = downloadCsv.mock.calls.at(-1) as [string, unknown[][]];
      expect(filename).toBe("broadsheet-all-classes-term-2-2026-2027-filtered.csv");
      expect(rows.some((r) => r[1] === "Eric Mugisha")).toBe(true);
      expect(rows.some((r) => r[1] === "Aline Uwase")).toBe(false);
    });
  });
});
