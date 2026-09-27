import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const get = vi.fn();
vi.mock("../utils/axiosConfig", () => ({ default: { get: (...a: unknown[]) => get(...a) } }));
vi.mock("../services/courseApi", () => ({ CourseApiService: { getCourses: vi.fn() } }));
vi.mock("../hooks/usePermissions", () => ({
  usePermissions: () => ({ can: () => true }),
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { currentAcademicYear: { name: "2026-2027" }, currentAcademicTerm: { name: "Term 1" } },
  }),
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
  },
];

// One assignment, never submitted and past due; two recorded marks, one entered.
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

// The student (72) sits between two classmates (90, 40).
const standing = {
  me: "me",
  subjects: [
    { course_id: "10", subject_name: "Web Application Development", subject_code: "SPEWJ302", roster_size: 3, roster_available: true },
  ],
  members: [
    { key: "s1", scores: { "10": { recorded: [90, 1] } } },
    { key: "me", scores: { "10": { recorded: [72, 1] } } },
    { key: "s3", scores: { "10": { recorded: [40, 1] } } },
  ],
};

type Overrides = Partial<Record<"recorded" | "assignments" | "quizzes" | "standing", () => Promise<unknown>>>;

const mockApi = (over: Overrides = {}) =>
  get.mockReset().mockImplementation((url: string) => {
    if (url.endsWith("/recorded-assessments"))
      return over.recorded?.() ?? Promise.resolve({ data: { success: true, data: recorded } });
    if (url.endsWith("/standing"))
      return over.standing?.() ?? Promise.resolve({ data: { success: true, data: standing } });
    if (url.endsWith("/courses")) return Promise.resolve({ data: { data: courses } });
    if (url.endsWith("/assignments"))
      return over.assignments?.() ?? Promise.resolve({ data: { data: assignments } });
    if (url.endsWith("/quizzes")) return over.quizzes?.() ?? Promise.resolve({ data: { data: [] } });
    return Promise.resolve({ data: { data: student } });
  });

const renderPage = (path = "/students/52") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/students/:studentId" element={<StudentDetails />} />
      </Routes>
    </MemoryRouter>,
  );

describe("StudentDetails", () => {
  beforeEach(() => {
    mockApi();
  });

  it("builds the average from marked work only, recorded marks included", async () => {
    renderPage();
    // Only the midterm is marked: the overdue assignment and the un-entered CA
    // exam are pending, not zeros.
    expect(await screen.findByTestId("kpi-average")).toHaveTextContent("72%");
    expect(screen.getByText("1 of 3 marked")).toBeInTheDocument();
    expect(screen.getByTestId("header-average")).toHaveTextContent("72%");
  });

  it("ranks the student against classmates", async () => {
    renderPage();
    expect(await screen.findByTestId("standing-rank")).toHaveTextContent("#2of 3");
    expect(screen.getByText("Top 67%")).toBeInTheDocument();
  });

  it("keeps the profile usable when the ranking fails", async () => {
    mockApi({ standing: () => Promise.reject(new Error("MIS down")) });
    renderPage();
    expect(await screen.findByText(/Class ranking is unavailable/)).toBeInTheDocument();
    expect(screen.getByText("Subject performance")).toBeInTheDocument();
  });

  it("flags overdue work and deep-links into it", async () => {
    renderPage();
    const insight = await screen.findByRole("button", { name: /1 overdue assignment/ });
    fireEvent.click(insight);
    // Now on the Assignments tab, filtered to what needs attention.
    expect(screen.getByRole("tab", { name: /Assignments/, selected: true })).toBeInTheDocument();
    const row = screen.getByText("Lab 1").closest("a")!;
    expect(row).toHaveAttribute("href", "/assignments/1");
    expect(within(row).getAllByText("Overdue").length).toBeGreaterThan(0);
  });

  it("lists every recorded mark on its own tab, pending ones included", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: /Recorded Assessments/ }));
    expect(screen.getByText("Midterm 1")).toBeInTheDocument();
    expect(screen.getByText("CA End Of Term Exam")).toBeInTheDocument();
    expect(screen.getAllByText("Not marked").length).toBeGreaterThan(0);
  });

  it("does not count a draft submission or an unfinished quiz", async () => {
    mockApi({
      assignments: () =>
        Promise.resolve({
          data: {
            data: [{ ...assignments[0], submissions: [{ id: 9, grade: "10/10", status: "draft", submitted_at: null }] }],
          },
        }),
      quizzes: () =>
        Promise.resolve({
          data: {
            data: [
              {
                id: 3,
                title: "Quiz A",
                course_id: 10,
                passing_score: 50,
                quizSubmissions: [
                  { id: 4, total_score: 0, percentage: 0, passed: false, status: "in_progress", attempt_number: 1, completed_at: null },
                ],
                subject: null,
              },
            ],
          },
        }),
    });
    renderPage();
    // Still just the midterm.
    expect(await screen.findByTestId("kpi-average")).toHaveTextContent("72%");
    fireEvent.click(screen.getByRole("tab", { name: /Quizzes/ }));
    expect(screen.getAllByText("In progress").length).toBeGreaterThan(0);
  });

  it("shows no average for a subject with nothing marked", async () => {
    mockApi({
      recorded: () =>
        Promise.resolve({
          data: { success: true, data: [{ ...recorded[0], recorded_count: 0, assessments: [recorded[0].assessments[1]] }] },
        }),
      assignments: () => Promise.resolve({ data: { data: [] } }),
    });
    renderPage();
    expect(await screen.findByText("Nothing marked yet")).toBeInTheDocument();
    const row = screen.getByTestId("subject-row-10");
    expect(within(row).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("still renders the profile when recorded marks fail to load", async () => {
    mockApi({ recorded: () => Promise.reject(new Error("boom")) });
    renderPage();
    expect(await screen.findByText("Axcel NTARUGERA")).toBeInTheDocument();
    expect(screen.getByText("Subject performance")).toBeInTheDocument();
  });

  it("opens the report cards from the header", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Report card/ }));
    expect(screen.getByTestId("report-cards")).toBeInTheDocument();
  });

  it("restores the tab and subject from the URL", async () => {
    renderPage("/students/52?tab=recorded&subject=10");
    expect(await screen.findByRole("tab", { name: /Recorded Assessments/, selected: true })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Subject" })).toHaveValue("10");
  });
});
