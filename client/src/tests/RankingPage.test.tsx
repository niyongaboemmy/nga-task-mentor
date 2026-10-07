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
import { pickOption, optionValues } from "./helpers/select";

const SUBJECTS = [
  { course_id: "8", name: "Graphic User Interface Design", code: "SPEGI302" },
  { course_id: "9", name: "Web Development", code: "SPEWD302" },
];

const studentData = (over: Partial<StudentRanking> = {}): StudentRanking => ({
  view: "student",
  scope: { subject_id: null, kind: "all" },
  cohort: { type: "class_group", class_group_id: 1, class_group_name: "L5 SOD A", grade_name: "Level 5" },
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

const L5 = { grade_id: 5, grade_name: "Level 5" };
const L4 = { grade_id: 4, grade_name: "Level 4" };
const group = (id: number | null, name: string, ranked: number, average: number | null, gradeName: string | null) => ({
  id, name, grade_name: gradeName, ranked_count: ranked, unranked_count: 0, average, median: average,
  highest: average, lowest: average, distribution: { excelling: 0, on_track: ranked, needs_attention: 0, at_risk: 0 },
});
const staffData = (): StaffRanking => ({
  view: "staff",
  scope: { subject_id: null, kind: "all", class_group_id: null, grade_id: null },
  subjects: SUBJECTS.map((s) => ({ ...s, ranked_count: 3, average: 70 })),
  class_groups: [{ id: 1, name: "L5 SOD A", ...L5 }, { id: 2, name: "L5 SOD B", ...L5 }, { id: 3, name: "L4 SOD A", ...L4 }],
  grades: [{ id: 4, name: "Level 4" }, { id: 5, name: "Level 5" }],
  summary: {
    ranked_count: 3, average: 70, median: 70, highest: 90, lowest: 50,
    distribution: { excelling: 1, on_track: 1, needs_attention: 1, at_risk: 0 }, unranked_count: 1,
  },
  groups: {
    class_groups: [group(3, "L4 SOD A", 1, 70, "Level 4"), group(1, "L5 SOD A", 1, 90, "Level 5"), group(2, "L5 SOD B", 1, 50, "Level 5")],
    grades: [group(4, "Level 4", 1, 70, "Level 4"), group(5, "Level 5", 2, 70, "Level 5")],
  },
  rows: [
    { rank: 1, key: "m1", mis_user_id: 1, name: "Angelo IGIHOZO", class_group_id: 1, class_group_name: "L5 SOD A", ...L5, class_rank: 1, class_size: 1, grade_rank: 1, grade_size: 2, score: 90, status: "excelling", marked_items: 5, subjects_marked: 2, subject_scores: {}, by_kind: { quiz: 90 } },
    { rank: 2, key: "m4", mis_user_id: 4, name: "Cedric MUGISHA", class_group_id: 3, class_group_name: "L4 SOD A", ...L4, class_rank: 1, class_size: 1, grade_rank: 1, grade_size: 1, score: 70, status: "on_track", marked_items: 2, subjects_marked: 1, subject_scores: {}, by_kind: {} },
    { rank: 3, key: "m2", mis_user_id: 2, name: "Axel KUBAHO", class_group_id: 2, class_group_name: "L5 SOD B", ...L5, class_rank: 1, class_size: 1, grade_rank: 2, grade_size: 2, score: 50, status: "needs_attention", marked_items: 3, subjects_marked: 1, subject_scores: {}, by_kind: {} },
  ],
  unranked: [{ key: "m3", mis_user_id: 3, name: "Bella IRAKOZE", class_group_id: 1, class_group_name: "L5 SOD A", ...L5 }],
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

  it("says which class group the student is ranked in", async () => {
    get.mockResolvedValue(ok(studentData()));
    renderPage();
    expect(await screen.findByText("Ranked within L5 SOD A")).toBeInTheDocument();
    expect(screen.getByText("Place in L5 SOD A")).toBeInTheDocument();
    expect(screen.getByText(/Your overall position · L5 SOD A/)).toBeInTheDocument();
    // Class and grade pickers are staff-only.
    expect(screen.queryByLabelText("Grade")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Class")).not.toBeInTheDocument();
  });

  it("flags the fallback when the class couldn't be read", async () => {
    get.mockResolvedValue(ok(studentData({ cohort: { type: "subjects" } })));
    renderPage();
    expect(await screen.findByText("Ranked across your subjects")).toBeInTheDocument();
    expect(screen.queryByText(/Ranked within/)).not.toBeInTheDocument();
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

  it("filters by grade, narrowing the class list to that grade", async () => {
    get.mockResolvedValue(ok(staffData()));
    renderPage();
    await screen.findByText("Leaderboard");
    expect(optionValues(screen.getByLabelText("Class"))).toEqual(["", "1", "2", "3"]);
    pickOption(screen.getByLabelText("Grade"), "5");
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/rankings", { params: { gradeId: 5 } }));
    expect(screen.getByTestId("location").textContent).toBe("?grade=5");
    expect(optionValues(screen.getByLabelText("Class"))).toEqual(["", "1", "2"]);
  });

  it("drops a class outside a newly picked grade", async () => {
    get.mockResolvedValue(ok(staffData()));
    renderPage("/ranking?class=3");
    await screen.findByText("Leaderboard");
    expect(get).toHaveBeenCalledWith("/rankings", { params: { classGroupId: 3 } });
    pickOption(screen.getByLabelText("Grade"), "5");
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/rankings", { params: { gradeId: 5 } }));
  });

  it("groups the leaderboard by class with each student's place in class", async () => {
    get.mockResolvedValue(ok(staffData()));
    renderPage();
    await screen.findByText("Leaderboard");
    fireEvent.click(screen.getByRole("radio", { name: "By class" }));
    expect(screen.getByTestId("location").textContent).toBe("?group=class");
    expect(await screen.findByText("Classes compared")).toBeInTheDocument();
    const sections = screen.getAllByRole("rowheader").map((h) => h.querySelector("span")?.textContent);
    expect(sections).toEqual(["L4 SOD A", "L5 SOD A", "L5 SOD B"]);
    expect(screen.getByRole("columnheader", { name: "In class" })).toBeInTheDocument();
    expect(screen.getByText("#3 overall")).toBeInTheDocument();
    // Grouping is client-side: no refetch.
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("groups by grade and opens one grade from its card", async () => {
    get.mockResolvedValue(ok(staffData()));
    renderPage("/ranking?group=grade");
    expect(await screen.findByText("Grades compared")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "In grade" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Level 5/ }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/rankings", { params: { gradeId: 5 } }));
    expect(screen.getByTestId("location").textContent).toBe("?grade=5&group=grade");
  });

  it("shows each student's place in class and grade", async () => {
    get.mockResolvedValue(ok(staffData()));
    renderPage();
    await screen.findByText("Leaderboard");
    expect(screen.getByLabelText("2nd of 2 in Level 5")).toBeInTheDocument();
    expect(screen.getAllByLabelText(/1st of 1 in L5 SOD/)).toHaveLength(2);
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
