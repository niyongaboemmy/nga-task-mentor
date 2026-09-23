import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { SubjectGradesPayload } from "../services/subjectReportApi";

// Canvas is out of jsdom's reach; the charts are covered by subjectReport.test.ts.
vi.mock("../components/Grades/SubjectReportCharts", () => ({
  AssessmentAveragesChart: () => <div data-testid="chart-averages" />,
  BandDistributionChart: () => <div data-testid="chart-bands" />,
  PerformanceTrendChart: () => <div data-testid="chart-trend" />,
}));

vi.mock("../components/Common/AcademicPeriodPicker", () => ({
  default: () => <div data-testid="period-picker" />,
}));

const fetchSubjectGrades = vi.fn();
vi.mock("../services/subjectReportApi", async () => {
  const actual = await vi.importActual<typeof import("../services/subjectReportApi")>(
    "../services/subjectReportApi",
  );
  return { ...actual, fetchSubjectGrades: (...args: unknown[]) => fetchSubjectGrades(...args) };
});

const can = vi.fn();
vi.mock("../hooks/usePermissions", () => ({ usePermissions: () => ({ can }) }));

vi.mock("react-redux", () => ({
  useDispatch: () => vi.fn(),
  useSelector: () => ({
    courses: [{ id: 9, title: "Development of Web User Interface", code: "SPEWI302" }],
    currentCourse: null,
  }),
}));

vi.mock("../store/slices/courseSlice", () => ({ fetchCourses: () => ({ type: "noop" }) }));

const payload: SubjectGradesPayload = {
  course_id: 9,
  quizzes: [{ id: 1, title: "Unit quiz", max_score: 20, date: "2026-09-09" }],
  assignments: [],
  assessments: [
    {
      id: 3,
      title: "Midterm",
      max_score: 100,
      assessment_type: "midterm",
      assessment_number: 1,
      assessment_date: "2026-09-18",
      counts_to_final: true,
    },
  ],
  students: [
    {
      student: { id: 1, name: "Ada Byron", email: "ada@nga.ac.rw" },
      quizzes: [{ quiz_id: 1, score: 18, submitted: true, max_score: 20 }],
      assignments: [],
      assessments: [{ assessment_id: 3, score: 88, recorded: true, max_score: 100 }],
      summary: {
        total_points_earned: 106,
        total_max_points: 120,
        total_percentage: 88,
        assignment_percentage: 0,
        quiz_percentage: 90,
        assessment_percentage: 88,
      },
    },
    {
      student: { id: 2, name: "Grace Hopper", email: "grace@nga.ac.rw" },
      quizzes: [{ quiz_id: 1, score: null, submitted: false, max_score: 20 }],
      assignments: [],
      assessments: [{ assessment_id: 3, score: 30, recorded: true, max_score: 100 }],
      summary: {
        total_points_earned: 30,
        total_max_points: 120,
        total_percentage: 30,
        assignment_percentage: 0,
        quiz_percentage: 0,
        assessment_percentage: 30,
      },
    },
  ],
};

import CourseReportsPage from "../pages/CourseReportsPage";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/courses/9/reports"]}>
      <Routes>
        <Route path="/courses/:courseId/reports" element={<CourseReportsPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("CourseReportsPage", () => {
  beforeEach(() => {
    fetchSubjectGrades.mockReset().mockResolvedValue(payload);
    can.mockReset().mockReturnValue(true); // teacher/admin by default
  });

  it("shows the class view with recorded assessments alongside quizzes", async () => {
    renderPage();
    expect(await screen.findByText("Development of Web User Interface")).toBeInTheDocument();
    // A hand-recorded mark is a column of the grade sheet, labelled by its type.
    expect(screen.getByText("Midterm 1")).toBeInTheDocument();
    expect(screen.getByText("Unit quiz")).toBeInTheDocument();
    expect(screen.getByTestId("chart-averages")).toBeInTheDocument();
    // Class average over the two marked students: (88 + 30) / 2.
    expect(screen.getByText(/Median 59% /)).toBeInTheDocument();
  });

  it("filters the grade sheet from the at-risk KPI", async () => {
    renderPage();
    expect(await screen.findAllByText("Ada Byron")).not.toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /Needs attention.*list them/ }));

    await waitFor(() => expect(screen.queryByText("Ada Byron")).not.toBeInTheDocument());
    expect(screen.getAllByText("Grace Hopper").length).toBeGreaterThan(0);
  });

  it("gives a student only their own marks, split by kind", async () => {
    can.mockReturnValue(false); // no COURSES_VIEW_GRADES → self view
    fetchSubjectGrades.mockResolvedValue({ ...payload, students: [payload.students[0]] });
    renderPage();

    expect(await screen.findByText("My performance")).toBeInTheDocument();
    expect(screen.getByText("Class assessments")).toBeInTheDocument();
    expect(screen.getByText("Quizzes")).toBeInTheDocument();
    // No class-wide analytics leak into the student view.
    expect(screen.queryByText("Grade sheet")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chart-averages")).not.toBeInTheDocument();
  });

  it("offers a way forward when the subject has no data", async () => {
    fetchSubjectGrades.mockResolvedValue({ ...payload, students: [] });
    renderPage();
    expect(await screen.findByText("No grade data yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeInTheDocument();
  });
});
