import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { SubjectGradesPayload } from "../services/subjectReportApi";

// Charts draw to a canvas, which jsdom can't do — they're covered by the
// derivation tests in subjectReport.test.ts, so here they're stubbed and the
// test is about the page's numbers, alerts and cross-filtering.
vi.mock("../components/Grades/SubjectReportCharts", () => ({
  AssessmentAveragesChart: () => <div data-testid="chart-averages" />,
  BandDistributionChart: () => <div data-testid="chart-bands" />,
  PerformanceTrendChart: () => <div data-testid="chart-trend" />,
}));

const payload: SubjectGradesPayload = {
  course_id: 101,
  quizzes: [],
  assignments: [],
  assessments: [
    {
      id: 5,
      title: "Mid-term",
      max_score: 100,
      assessment_type: "midterm",
      assessment_number: 1,
      assessment_date: "2026-09-20",
      counts_to_final: true,
    },
    {
      id: 6,
      title: "Homework 2",
      max_score: 20,
      assessment_type: "homework",
      assessment_number: 2,
      assessment_date: "2026-09-22",
      counts_to_final: true,
    },
  ],
  students: [
    {
      student: { id: 1, name: "Ada Byron", email: "ada@example.com" },
      quizzes: [],
      assignments: [],
      assessments: [
        { assessment_id: 5, score: 90, recorded: true, max_score: 100 },
        { assessment_id: 6, score: null, recorded: false, max_score: 20 },
      ],
      summary: {
        total_points_earned: 90,
        total_max_points: 100,
        total_percentage: 90,
        assignment_percentage: 0,
        quiz_percentage: 0,
        assessment_percentage: 90,
      },
    },
    {
      student: { id: 2, name: "Grace Hopper", email: "grace@example.com" },
      quizzes: [],
      assignments: [],
      assessments: [
        { assessment_id: 5, score: 30, recorded: true, max_score: 100 },
        { assessment_id: 6, score: null, recorded: false, max_score: 20 },
      ],
      summary: {
        total_points_earned: 30,
        total_max_points: 100,
        total_percentage: 30,
        assignment_percentage: 0,
        quiz_percentage: 0,
        assessment_percentage: 30,
      },
    },
  ],
};

const fetchSubjectGrades = vi.fn();
vi.mock("../services/subjectReportApi", async () => {
  const actual = await vi.importActual<typeof import("../services/subjectReportApi")>(
    "../services/subjectReportApi",
  );
  return { ...actual, fetchSubjectGrades: (...args: unknown[]) => fetchSubjectGrades(...args) };
});

vi.mock("../services/courseApi", () => ({
  CourseApiService: {
    getCourse: vi.fn().mockResolvedValue({ data: { id: 101, title: "Web3 Applications", code: "SP" } }),
  },
}));

vi.mock("../hooks/useTermYearSelector", () => ({
  useTermYearSelector: () => ({
    years: [],
    terms: [],
    loading: false,
    academicYear: "2026-2027",
    term: "Term 1",
    academicYearId: 1,
    academicTermId: 2,
    setAcademicYear: vi.fn(),
    setTerm: vi.fn(),
  }),
}));

vi.mock("../contexts/ThemeContext", () => ({ useTheme: () => ({ theme: "dark" }) }));

import SubjectAssessmentReportPage from "../pages/SubjectAssessmentReportPage";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/grades/subjects/101/report"]}>
      <Routes>
        <Route path="/grades/subjects/:courseId/report" element={<SubjectAssessmentReportPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("SubjectAssessmentReportPage", () => {
  beforeEach(() => {
    fetchSubjectGrades.mockReset().mockResolvedValue(payload);
  });

  it("renders the subject, its KPIs and every chart panel", async () => {
    renderPage();
    expect(await screen.findByText("Web3 Applications")).toBeInTheDocument();
    expect(screen.getByText(/2 assessments · 2 students/)).toBeInTheDocument();
    expect(screen.getByTestId("chart-averages")).toBeInTheDocument();
    expect(screen.getByTestId("chart-bands")).toBeInTheDocument();
    expect(screen.getByTestId("chart-trend")).toBeInTheDocument();
    // Class average of the two marked students: (90 + 30) / 2.
    expect(screen.getByText(/Median 60% /)).toBeInTheDocument();
  });

  it("raises an actionable alert for the unmarked assessment and the failing student", async () => {
    renderPage();
    expect(await screen.findByText("1 assessment with no marks at all")).toBeInTheDocument();
    expect(screen.getByText("1 student below 50%")).toBeInTheDocument();
    // The unmarked-assessment alert links straight to its marks entry screen
    // (the assessment table below repeats the same link, hence getAll).
    expect(screen.getAllByRole("link", { name: /Enter marks/ })[0]).toHaveAttribute(
      "href",
      "/grades/6/marks",
    );
  });

  it("filters the roster when the at-risk KPI is clicked", async () => {
    renderPage();
    expect(await screen.findByText("Ada Byron")).toBeInTheDocument();

    // The KPI card, not the band chip of the same name — its accessible name
    // carries the caption too.
    fireEvent.click(screen.getByRole("button", { name: /At risk.*list them/ }));

    await waitFor(() => expect(screen.queryByText("Ada Byron")).not.toBeInTheDocument());
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
  });

  it("shows a recoverable error when the grades call fails", async () => {
    fetchSubjectGrades.mockRejectedValue(new Error("boom"));
    renderPage();
    expect(
      await screen.findByText("Failed to load this subject's assessment report."),
    ).toBeInTheDocument();
  });
});
