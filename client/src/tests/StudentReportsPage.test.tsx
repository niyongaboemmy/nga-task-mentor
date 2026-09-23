import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { SubjectRow } from "../services/studentReportApi";

vi.mock("../components/Grades/SubjectReportCharts", () => ({
  SubjectAveragesChart: ({ subjects }: { subjects: Array<{ key: string }> }) => (
    <div data-testid="chart-subjects">{subjects.length}</div>
  ),
}));

const fetchMyGrades = vi.fn();
vi.mock("../services/studentReportApi", async () => {
  const actual = await vi.importActual<typeof import("../services/studentReportApi")>(
    "../services/studentReportApi",
  );
  return { ...actual, fetchMyGrades: (...a: unknown[]) => fetchMyGrades(...a) };
});

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      currentAcademicTerm: { name: "Term 1" },
      currentAcademicYear: { name: "2026-2027" },
    },
  }),
}));

import StudentReportsPage from "../pages/StudentReportsPage";

const rows: SubjectRow[] = [
  {
    courseId: 1,
    courseName: "Web Application Development",
    code: "SPEWJ302",
    totalMaxPoints: 100,
    totalPointsEarned: 38,
    percentage: 38,
    status: "Failing",
    items: [
      {
        kind: "manual",
        id: 5,
        title: "Midterm",
        assessmentType: "midterm",
        assessmentNumber: 1,
        maxScore: 100,
        score: 38,
        marked: true,
        submitted: true,
        date: "2026-09-18",
        overdue: false,
        countsToFinal: true,
      },
      {
        kind: "assignment",
        id: 2,
        title: "Late lab",
        maxScore: 10,
        score: null,
        marked: false,
        submitted: false,
        date: "2026-09-01",
        overdue: true,
        countsToFinal: true,
      },
    ],
    markedCount: 1,
    pendingCount: 1,
    overdueCount: 1,
    totalAssignments: 1,
    totalQuizzes: 0,
    totalAssessments: 1,
    assessmentsRecorded: 1,
  },
  {
    // Untouched subject: must stay out of the average and off the chart.
    courseId: 2,
    courseName: "Graphic User Interface Design",
    code: "GENAM302",
    totalMaxPoints: 0,
    totalPointsEarned: 0,
    percentage: 0,
    status: "No Grade",
    items: [],
    markedCount: 0,
    pendingCount: 0,
    overdueCount: 0,
    totalAssignments: 0,
    totalQuizzes: 0,
    totalAssessments: 0,
    assessmentsRecorded: 0,
  },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <StudentReportsPage />
    </MemoryRouter>,
  );

describe("StudentReportsPage", () => {
  beforeEach(() => {
    fetchMyGrades.mockReset().mockResolvedValue(rows);
  });

  it("averages only subjects that have marks", async () => {
    renderPage();
    expect(await screen.findByText("Academic Performance")).toBeInTheDocument();
    expect(screen.getByText("Across the 1 subject with marks")).toBeInTheDocument();
    // One subject has marks, so only one bar is plotted.
    expect(screen.getByTestId("chart-subjects")).toHaveTextContent("1");
  });

  it("tells the student which subject to improve, and why", async () => {
    renderPage();
    expect(
      await screen.findByText("Improve in Web Application Development — 38%"),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 piece of work past due/)).toBeInTheDocument();
    expect(screen.getByText(/1 subject have no marks yet/)).toBeInTheDocument();
  });

  it("lists the marks a teacher recorded, labelled by type", async () => {
    renderPage();
    expect(await screen.findByText("Midterm 1")).toBeInTheDocument();
    expect(screen.getByText("38%", { selector: "td" })).toBeInTheDocument();
  });

  it("shows an untouched subject as having no marks rather than 0%", async () => {
    renderPage();
    expect(await screen.findByText("Graphic User Interface Design")).toBeInTheDocument();
    expect(screen.getByText("No marks yet")).toBeInTheDocument();
  });
});
