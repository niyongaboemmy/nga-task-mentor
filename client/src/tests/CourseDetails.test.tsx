import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { SubjectGradesPayload } from "../services/subjectReportApi";
import { computeVisibleTabs } from "../components/Courses/courseTabsLayout";

// ─── Tab overflow layout ──────────────────────────────────────────────────────

describe("computeVisibleTabs", () => {
  const widths = [100, 100, 100, 100, 100];

  it("shows every tab when they all fit beside the ⋯ button", () => {
    expect(computeVisibleTabs(widths, 600, 0, 88)).toEqual([0, 1, 2, 3, 4]);
  });

  it("moves the tabs that don't fit into the menu", () => {
    expect(computeVisibleTabs(widths, 400, 0, 88)).toEqual([0, 1, 2]);
  });

  it("keeps an overflowing active tab on the bar", () => {
    expect(computeVisibleTabs(widths, 400, 4, 88)).toEqual([0, 1, 4]);
  });

  it("makes room for a wide active tab instead of overflowing", () => {
    expect(computeVisibleTabs([100, 100, 100, 250], 400, 3, 88)).toEqual([3]);
  });

  it("always shows at least the active tab, however narrow", () => {
    expect(computeVisibleTabs(widths, 50, 2, 88)).toEqual([2]);
  });
});

// ─── Course Details page ──────────────────────────────────────────────────────

vi.mock("../components/Assignments/Assignments", () => ({ default: () => <div /> }));
vi.mock("../components/Quizzes/QuizList", () => ({ QuizList: () => <div /> }));
vi.mock("../components/ReportCard/SubjectReportCardDashboard", () => ({
  default: (p: { term: string; academicYear: string }) => (
    <div data-testid="rc-dashboard">
      {p.academicYear}|{p.term}
    </div>
  ),
}));

const fetchSubjectGrades = vi.fn();
vi.mock("../services/subjectReportApi", async () => {
  const actual = await vi.importActual<typeof import("../services/subjectReportApi")>(
    "../services/subjectReportApi",
  );
  return { ...actual, fetchSubjectGrades: (...args: unknown[]) => fetchSubjectGrades(...args) };
});

const getSubjectOverview = vi.fn();
vi.mock("../services/reportCardApi", async () => {
  const actual = await vi.importActual<typeof import("../services/reportCardApi")>(
    "../services/reportCardApi",
  );
  return {
    ...actual,
    ReportCardApiService: { getSubjectOverview: (...a: unknown[]) => getSubjectOverview(...a) },
  };
});

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      currentAcademicYear: { name: "2026 - 2027" },
      currentAcademicTerm: { name: "Term 1" },
    },
  }),
}));

const can = vi.fn();
vi.mock("../hooks/usePermissions", () => ({ usePermissions: () => ({ can }) }));

const course = {
  id: 10,
  title: "Web Application Development Using JavaScript",
  code: "SPEWJ302",
  credits: 0,
  statistics: { assignments: { total: 0 }, quizzes: { total: 1 } },
  enrolledStudents: [
    { user: { id: 1, email: "ada@nga.ac.rw" }, profile: { first_name: "Ada", last_name: "Byron" } },
    { user: { id: 2, email: "grace@nga.ac.rw" }, profile: { first_name: "Grace", last_name: "Hopper" } },
  ],
};

// A stable dispatch, like the real store's — a new one per render would re-run
// the page's load effect forever.
const dispatch = () => ({ unwrap: () => Promise.resolve() });
vi.mock("react-redux", () => ({
  useDispatch: () => dispatch,
  useSelector: () => ({ courses: [course], currentCourse: course, loading: { course: false } }),
}));
vi.mock("../store/slices/courseSlice", () => ({
  fetchCourses: () => ({ type: "noop" }),
  fetchCourse: () => ({ type: "noop" }),
}));

const payload: SubjectGradesPayload = {
  course_id: 10,
  quizzes: [{ id: 1, title: "Unit quiz", max_score: 20, date: "2026-09-09" }],
  assignments: [],
  assessments: [],
  students: [
    {
      student: { id: 1, name: "Ada Byron", email: "ada@nga.ac.rw" },
      quizzes: [{ quiz_id: 1, score: 18, submitted: true, max_score: 20 }],
      assignments: [],
      summary: {
        total_points_earned: 18,
        total_max_points: 20,
        total_percentage: 90,
        assignment_percentage: 0,
        quiz_percentage: 90,
      },
    },
    {
      student: { id: 2, name: "Grace Hopper", email: "grace@nga.ac.rw" },
      quizzes: [{ quiz_id: 1, score: 6, submitted: true, max_score: 20 }],
      assignments: [],
      summary: {
        total_points_earned: 6,
        total_max_points: 20,
        total_percentage: 30,
        assignment_percentage: 0,
        quiz_percentage: 30,
      },
    },
  ],
};

const renderPage = async () => {
  const { default: CourseDetails } = await import("../components/Courses/CourseDetails");
  return render(
    <MemoryRouter initialEntries={["/courses/10"]}>
      <Routes>
        <Route path="/courses/:courseId" element={<CourseDetails />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("CourseDetails", () => {
  beforeEach(() => {
    sessionStorage.clear();
    can.mockReset().mockReturnValue(true);
    fetchSubjectGrades.mockReset().mockResolvedValue(payload);
    getSubjectOverview.mockReset().mockResolvedValue({
      success: true,
      data: { students: [{ student_id: 1, report_card_id: 5, status: "approved", total_score: 90 }] },
    });
  });

  it("opens on a decision board built from the subject's marks", async () => {
    await renderPage();
    expect(await screen.findByText(/Class average 60% \(fair\)/)).toBeInTheDocument();
    // …and the attention list names the at-risk count as an action.
    expect(screen.getByText("Needs your attention")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /List them/ })).toBeInTheDocument();
    // Grace (30%) is flagged for support and linked to her profile.
    const support = document.getElementById("overview-support")!;
    const grace = within(support).getByText("Grace Hopper").closest("a");
    expect(grace).toHaveAttribute("href", "/students/2");
    // Report-card readiness uses the app-bar period.
    await waitFor(() =>
      expect(getSubjectOverview).toHaveBeenCalledWith(
        expect.objectContaining({ term: "Term 1", academic_year: "2026 - 2027", student_ids: [1, 2] }),
      ),
    );
    expect(await screen.findByText("1/2")).toBeInTheDocument();
  });

  it("lists students without a local year/term picker", async () => {
    await renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: /Students/ }));
    expect(await screen.findByText("Enrolled Students")).toBeInTheDocument();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.getByText("Ada Byron")).toBeInTheDocument();
  });

  it("shows report cards for the app-bar period with no local picker", async () => {
    await renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: /Report Cards/ }));
    expect(await screen.findByTestId("rc-dashboard")).toHaveTextContent("2026 - 2027|Term 1");
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });

  it("offers quick actions behind the ⋯ menu", async () => {
    await renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /More options|More sections/ }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: /Subject report/ })).toHaveAttribute(
      "href",
      "/courses/10/reports",
    );
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("gives a student only their own standing", async () => {
    can.mockImplementation((p: string) => p !== "COURSES_VIEW_GRADES" && p !== "COURSES_VIEW_STUDENTS");
    fetchSubjectGrades.mockResolvedValue({ ...payload, students: [payload.students[0]] });
    await renderPage();
    expect(await screen.findByText("Your standing")).toBeInTheDocument();
    expect(screen.getAllByText("90%").length).toBeGreaterThan(0);
    expect(screen.queryByText("Needs your attention")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Students/ })).not.toBeInTheDocument();
  });
});
