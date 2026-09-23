import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const get = vi.fn();
vi.mock("../utils/axiosConfig", () => ({ default: { get: (...a: unknown[]) => get(...a) } }));
vi.mock("../services/courseApi", () => ({ CourseApiService: { getCourses: vi.fn() } }));
vi.mock("../hooks/usePermissions", () => ({
  usePermissions: () => ({ can: () => true }),
}));
vi.mock("../components/ReportCard/StudentReportCardDashboard", () => ({
  default: () => <div data-testid="report-cards" />,
}));

import StudentDetails from "../components/Students/StudentDetails";

const student = {
  user: { id: 52, first_name: "Axcel", last_name: "NTARUGERA", email: "a@nga.ac.rw", role: "student" },
  profile: { first_name: "Axcel", last_name: "NTARUGERA" },
};

const courses = [
  {
    enrollment_id: "e1",
    subject_id: "10",
    subject_name: "Web Application Development",
    subject_code: "SPEWJ302",
    subject_description: null,
    academic_term_id: "1",
    academic_term_name: "Term 1",
    academic_year_name: "2026-2027",
    enrolled_at: "2026-09-01",
  },
];

// One assignment, never submitted; no quizzes; two recorded marks, one entered.
const assignments = [
  {
    id: 1,
    title: "Lab 1",
    course_id: 10,
    max_score: 10,
    due_date: "2026-09-10",
    submissions: [],
    subject: { subject_name: "Web Application Development", subject_code: "SPEWJ302" },
  },
];

const recorded = [
  {
    course_id: 10,
    subject_name: "Web Application Development",
    subject_code: "SPEWJ302",
    recorded_count: 1,
    pending_count: 1,
    assessments: [
      {
        assessment_id: 5,
        title: "Midterm",
        assessment_type: "midterm",
        assessment_number: 1,
        assessment_date: "2026-09-18",
        counts_to_final: true,
        max_score: 100,
        recorded: true,
        score: 72,
        percentage: 72,
      },
      {
        assessment_id: 6,
        title: "CA End Of Term",
        assessment_type: "ca_end_of_term",
        assessment_number: null,
        assessment_date: "2026-09-22",
        counts_to_final: true,
        max_score: 100,
        recorded: false,
        score: null,
        percentage: null,
      },
    ],
  },
];

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/students/52"]}>
      <Routes>
        <Route path="/students/:studentId" element={<StudentDetails />} />
      </Routes>
    </MemoryRouter>,
  );

describe("StudentDetails", () => {
  beforeEach(() => {
    get.mockReset().mockImplementation((url: string) => {
      if (url.endsWith("/recorded-assessments")) return Promise.resolve({ data: { success: true, data: recorded } });
      if (url.endsWith("/courses")) return Promise.resolve({ data: { data: courses } });
      if (url.endsWith("/assignments")) return Promise.resolve({ data: { data: assignments } });
      if (url.endsWith("/quizzes")) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: student } });
    });
  });

  it("builds the average from recorded marks, not from assignments alone", async () => {
    renderPage();
    // Only the midterm is marked, so the average is its 72% — the unsubmitted
    // assignment and the un-entered CA exam are pending, not zeros. (The same
    // 72% also shows in the course row, hence the scoped query.)
    const tile = (await screen.findByText("Avg Grade")).closest("div")!.parentElement as HTMLElement;
    expect(within(tile).getByText("72%")).toBeInTheDocument();
    expect(within(tile).getByText("1 of 3 marked")).toBeInTheDocument();
    expect(screen.queryByText("N/A")).not.toBeInTheDocument();
  });

  it("counts recorded marks in their own KPI", async () => {
    renderPage();
    expect(await screen.findByText("Recorded Marks")).toBeInTheDocument();
    const tile = screen.getByText("Recorded Marks").closest("div")!.parentElement as HTMLElement;
    expect(within(tile).getByText("1/2")).toBeInTheDocument();
  });

  it("lists every recorded mark on its own tab, pending ones included", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Recorded Assessments/ }));

    expect(screen.getByText("Midterm 1")).toBeInTheDocument();
    expect(screen.getByText("CA End Of Term Exam")).toBeInTheDocument();
    expect(screen.getByText("Not marked")).toBeInTheDocument();
  });

  it("shows no average for a subject with nothing marked", async () => {
    get.mockImplementation((url: string) => {
      if (url.endsWith("/recorded-assessments"))
        return Promise.resolve({
          data: {
            success: true,
            data: [{ ...recorded[0], recorded_count: 0, assessments: [recorded[0].assessments[1]] }],
          },
        });
      if (url.endsWith("/courses")) return Promise.resolve({ data: { data: courses } });
      if (url.endsWith("/assignments")) return Promise.resolve({ data: { data: [] } });
      if (url.endsWith("/quizzes")) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: student } });
    });

    renderPage();
    expect(await screen.findByText("Nothing marked yet")).toBeInTheDocument();
    // The course row shows a dash rather than 0%.
    const row = screen.getByText("Web Application Development").closest("div")!.parentElement!;
    expect(within(row).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("still renders the profile when recorded marks fail to load", async () => {
    get.mockImplementation((url: string) => {
      if (url.endsWith("/recorded-assessments")) return Promise.reject(new Error("boom"));
      if (url.endsWith("/courses")) return Promise.resolve({ data: { data: courses } });
      if (url.endsWith("/assignments")) return Promise.resolve({ data: { data: assignments } });
      if (url.endsWith("/quizzes")) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: student } });
    });

    renderPage();
    expect(await screen.findByText("Axcel NTARUGERA")).toBeInTheDocument();
    expect(screen.getByText("Course Performance")).toBeInTheDocument();
  });
});
