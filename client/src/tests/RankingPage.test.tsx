import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { StaffRanking, StudentRanking } from "../services/rankingApi";

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { currentAcademicYear: { name: "2026 - 2027" }, currentAcademicTerm: { name: "Term 1" } },
  }),
}));
vi.mock("../hooks/usePermissions", () => ({
  usePermissions: () => ({ can: () => false }),
}));
const get = vi.fn();
vi.mock("../utils/axiosConfig", () => ({ default: { get: (...a: unknown[]) => get(...a) } }));

import RankingPage from "../pages/RankingPage";
import CourseRankingPanel from "../components/Courses/CourseRankingPanel";
import { pickOption, selectValue, optionValues } from "./helpers/select";

const SUBJECTS = [
  { course_id: "8", name: "Graphic User Interface Design", code: "SPEGI302" },
  { course_id: "9", name: "Web Development", code: "SPEWD302" },
];

const studentData = (over: Partial<StudentRanking> = {}): StudentRanking => ({
  view: "student",
  scope: { subject_id: null, kind: "all" },
  overall: {
    rank: 4, ranked_count: 19, score: 68.5, band: "Upper half", top_percent: 21,
    class_average: 62.1, points_to_next: 1.5, marked_items: 7, status: "on_track",
  },
  subjects: [
    {
      ...SUBJECTS[0], score: 48, rank: 15, ranked_count: 19, class_average: 60, gap: -12, status: "at_risk",
      by_kind: { quiz: { score: 40, count: 2 }, assignment: { score: 64, count: 1 } }, marked_items: 3, pending_count: 1,
      weakest: [{ kind: "quiz", item_id: 3, title: "Colour theory quiz", pct: 35 }],
    },
    {
      ...SUBJECTS[1], score: 89, rank: 1, ranked_count: 18, class_average: 70, gap: 19, status: "excelling",
      by_kind: { assignment: { score: 89, count: 4 } }, marked_items: 4, pending_count: 0, weakest: [],
    },
  ],
  pending: [{ kind: "assignment", course_id: "8", item_id: 12, title: "Wireframes", due_date: "2026-09-20T00:00:00Z", status: "overdue" }],
  suggestions: [
    {
      id: "overdue-12", priority: "high", category: "deadline", title: 'Submit "Wireframes"',
      detail: "Past its due date.", course_id: "8", action: { label: "Open assignment", href: "/assignments/12" },
    },
    { id: "risk-8", priority: "high", category: "subject", title: "Graphic User Interface Design needs urgent attention", detail: "Your average is 48%." },
  ],
  privacy: { aggregates_hidden: false, min_cohort: 5 },
  available_subjects: SUBJECTS,
  ...over,
});

const staffData = (): StaffRanking => ({
  view: "staff",
  scope: { subject_id: null, kind: "all", class_group_id: null },
  subjects: SUBJECTS.map((s) => ({ ...s, ranked_count: 2, average: 70 })),
  class_groups: [{ id: 1, name: "L5 SOD A" }, { id: 2, name: "L5 SOD B" }],
  summary: {
    ranked_count: 2, average: 70, median: 70, highest: 90, lowest: 50,
    distribution: { excelling: 1, on_track: 0, needs_attention: 1, at_risk: 0 }, unranked_count: 1,
  },
  rows: [
    { rank: 1, key: "m1", mis_user_id: 1, name: "Angelo IGIHOZO", class_group_name: "L5 SOD A", score: 90, status: "excelling", marked_items: 5, subjects_marked: 2, subject_scores: {}, by_kind: { quiz: 90 } },
    { rank: 2, key: "m2", mis_user_id: 2, name: "Axel KUBAHO", class_group_name: "L5 SOD B", score: 50, status: "needs_attention", marked_items: 3, subjects_marked: 1, subject_scores: {}, by_kind: {} },
  ],
  unranked: [{ key: "m3", mis_user_id: 3, name: "Bella IRAKOZE", class_group_name: "L5 SOD A" }],
  available_subjects: SUBJECTS,
  subject_scope: "assigned",
});

const ok = (data: unknown) => ({ data: { success: true, data } });

function Location() {
  const loc = useLocation();
  return <div data-testid="location">{loc.search}</div>;
}

const renderPage = (url = "/ranking") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/ranking" element={<><RankingPage /><Location /></>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  get.mockReset();
});

describe("Overall Ranking — student", () => {
  it("shows the student's own position, suggestions and outstanding work", async () => {
    get.mockResolvedValue(ok(studentData()));
    renderPage();
    expect(await screen.findByText("4th")).toBeInTheDocument();
    expect(screen.getByText("of 19")).toBeInTheDocument();
    expect(screen.getByText("Upper half")).toBeInTheDocument();
    expect(screen.getByText('Submit "Wireframes"')).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open assignment/ })).toHaveAttribute("href", "/assignments/12");
    expect(screen.getByText("Colour theory quiz")).toBeInTheDocument();
    expect(screen.getAllByText(/Private to you|Only you can see your position/).length).toBeGreaterThan(0);
    // No leaderboard for a student.
    expect(screen.queryByText("Leaderboard")).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/rankings", { params: {} });
  });

  it("filters by subject from the chips and keeps it in the URL", async () => {
    get.mockResolvedValue(ok(studentData()));
    renderPage();
    await screen.findByText("4th");
    fireEvent.click(screen.getByRole("radio", { name: /Web Development/ }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/rankings", { params: { subjectId: "9" } }));
    expect(screen.getByTestId("location").textContent).toBe("?subject=9");
  });

  it("filters by kind of work", async () => {
    get.mockResolvedValue(ok(studentData()));
    renderPage("/ranking?subject=8");
    await screen.findByText("4th");
    expect(get).toHaveBeenCalledWith("/rankings", { params: { subjectId: "8" } });
    fireEvent.click(screen.getByRole("radio", { name: "Quizzes" }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/rankings", { params: { subjectId: "8", kind: "quiz" } }));
  });

  it("explains an unranked student instead of showing a zero", async () => {
    get.mockResolvedValue(
      ok(studentData({
        overall: { rank: null, ranked_count: 12, score: null, band: null, top_percent: null, class_average: null, points_to_next: null, marked_items: 0, status: "no_marks" },
      })),
    );
    renderPage();
    expect(await screen.findByText("Not ranked yet")).toBeInTheDocument();
    expect(screen.getByText("Get your first marks to be ranked")).toBeInTheDocument();
  });

  it("shows an access message on 403 without a retry", async () => {
    const denied = Object.assign(new Error("Request failed with status code 403"), {
      response: { status: 403, data: { message: "You don't have access to this subject's ranking" } },
    });
    get.mockImplementation(() => Promise.reject(denied));
    renderPage("/ranking?subject=77");
    expect(await screen.findByText("You don't have access to this ranking")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Try again/ })).not.toBeInTheDocument();
  });
});

describe("Overall Ranking — staff", () => {
  it("renders a named leaderboard with a class filter and the unranked list", async () => {
    get.mockResolvedValue(ok(staffData()));
    renderPage();
    expect(await screen.findByText("Leaderboard")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Angelo IGIHOZO" })).toHaveAttribute("href", "/students/1");
    pickOption(screen.getByLabelText("Class"), "2");
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/rankings", { params: { classGroupId: 2 } }));
    fireEvent.click(screen.getByRole("button", { name: /Not ranked yet/ }));
    expect(screen.getByRole("link", { name: "Bella IRAKOZE" })).toBeInTheDocument();
  });

  it("searches the leaderboard", async () => {
    get.mockResolvedValue(ok(staffData()));
    renderPage();
    await screen.findByText("Leaderboard");
    fireEvent.change(screen.getByLabelText("Search students"), { target: { value: "axel" } });
    expect(screen.queryByRole("link", { name: "Angelo IGIHOZO" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Axel KUBAHO" })).toBeInTheDocument();
  });
});

describe("Course Ranking tab", () => {
  it("locks the ranking to the course's subject and hides the subject picker", async () => {
    get.mockResolvedValue(ok(studentData({ subjects: [studentData().subjects[0]], scope: { subject_id: "8", kind: "all" } })));
    render(
      <MemoryRouter>
        <CourseRankingPanel courseId="8" />
      </MemoryRouter>,
    );
    expect(await screen.findByText("4th")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/rankings", { params: { subjectId: "8" } });
    expect(screen.queryByRole("radiogroup", { name: "Subject" })).not.toBeInTheDocument();
    expect(screen.getByText(/Your position in Graphic User Interface Design/)).toBeInTheDocument();
  });
});
