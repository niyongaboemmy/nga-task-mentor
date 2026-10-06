import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { InstructorOverview, SubjectSummary } from "../services/instructorOverviewApi";
import type {
  AdminInsights,
  AdminStudentRow,
  AdminStudentsResponse,
  AdminSubjectRow,
  AdminSubjectsResponse,
} from "../services/adminReportsApi";

/**
 * The admin side: the school dashboard (teacher board over every subject plus
 * the school layer), the paged Subjects report and the Students directory.
 */

vi.mock("../components/Dashboard/instructor/InstructorCharts", () => ({
  ActivityTrendChart: () => <div data-testid="trend-chart" />,
  ScoreDistributionChart: () => <div data-testid="distribution-chart" />,
  SubjectComparisonChart: ({ subjects }: { subjects: SubjectSummary[] }) => (
    <div data-testid="comparison-chart" data-count={subjects.length} />
  ),
}));
vi.mock("../components/ReportCard/BulkExportReportCards", () => ({ default: () => <div data-testid="bulk-export" /> }));
vi.mock("../contexts/ThemeContext", () => ({ useTheme: () => ({ theme: "light" }) }));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { first_name: "Grace", currentAcademicYear: { name: "2026 - 2027" }, currentAcademicTerm: { name: "Term 1" } },
  }),
}));
vi.mock("../utils/axiosConfig", () => ({
  default: { get: vi.fn(async () => ({ data: { data: [] } })) },
}));
const getOverview = vi.fn();
vi.mock("../services/instructorOverviewApi", async (orig) => ({
  ...(await orig<typeof import("../services/instructorOverviewApi")>()),
  getInstructorOverview: (...a: unknown[]) => getOverview(...a),
}));
const getInsights = vi.fn();
const getSubjects = vi.fn();
const getStudents = vi.fn();
vi.mock("../services/adminReportsApi", async (orig) => ({
  ...(await orig<typeof import("../services/adminReportsApi")>()),
  getAdminInsights: (...a: unknown[]) => getInsights(...a),
  getAdminSubjects: (...a: unknown[]) => getSubjects(...a),
  getAdminStudents: (...a: unknown[]) => getStudents(...a),
}));

import InstructorDashboard from "../components/Dashboard/InstructorDashboard";
import AdminSubjectsPage from "../pages/AdminSubjectsPage";
import AdminStudentsDirectory from "../components/Students/AdminStudentsDirectory";
import { resetAlertState } from "../services/alertStore";
import { pickOption, selectValue, optionValues } from "./helpers/select";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});

const subject = (id: number, extra: Partial<SubjectSummary> = {}): SubjectSummary => ({
  subject_id: id, subject_name: `Subject ${id}`, subject_code: `S${id}`, class_groups: ["S1 A"], teachers: [`Teacher ${id}`],
  students: 30, assignments: 2, quizzes: 1, published: 3, drafts: 0, submissions: 60, pending: 0, overdue_pending: 0, graded: 60,
  avg_score: 50 + id, pass_rate: 80, participation: 90, late_rate: 0, missing: 0, at_risk: 0, next_due: null, last_activity_at: null,
  health: id === 3 ? "at_risk" : "on_track", health_reasons: [], ...extra,
});

const TWENTY = Array.from({ length: 20 }, (_, i) => subject(i + 1));

const overview = (): InstructorOverview => ({
  generated_at: new Date().toISOString(),
  academic_term_id: 3,
  rosters_available: true,
  scope: "all",
  totals: {
    subjects: 20, class_groups: 6, students: 400, assessments: 60, assignments: 40, quizzes: 20, published: 60, drafts: 0,
    submissions: 1200, pending_grading: 12, overdue_grading: 3, graded: 1188, avg_score: 61, pass_rate: 80, participation: 90,
    late_rate: 2, at_risk_students: 25, missing_work: 40, due_next_7_days: 4, live_proctoring: 0, stale_proctoring: 0,
    flagged_sessions: 0, submissions_this_week: 100, submissions_last_week: 90, graded_this_week: 80, graded_last_week: 70,
    new_submissions_24h: 10,
  },
  subjects: TWENTY,
  trend: [],
  distribution: [],
  grading_queue: [],
  upcoming: [],
  assessments: [],
  students: { at_risk: [], top: [] },
  alerts: [],
});

const insights = (): AdminInsights => ({
  generated_at: new Date().toISOString(),
  rosters_available: true,
  school: {
    subjects: 20, subjects_with_work: 18, class_groups: 6, teachers: 2, students: 400, students_with_marks: 380, average: 61,
    pass_rate: 80, needing_support: 25, excelling: 40, report_cards_mapped: 12, report_cards_approved: 30,
  },
  teachers: [
    { mis_user_id: 1, name: "Idle Teacher", subjects: [{ id: 19, name: "Subject 19", code: "S19" }], class_groups: 1, assessments: 0,
      published: 0, drafts: 1, submissions: 0, pending: 0, overdue_pending: 0, avg_score: null, participation: null, at_risk_subjects: 0,
      unmapped_subjects: 1, last_activity_at: null, status: "inactive", flags: ["No published work this term"] },
    { mis_user_id: 2, name: "Busy Teacher", subjects: [{ id: 1, name: "Subject 1", code: "S1" }], class_groups: 2, assessments: 5,
      published: 5, drafts: 0, submissions: 100, pending: 3, overdue_pending: 0, avg_score: 70, participation: 95, at_risk_subjects: 0,
      unmapped_subjects: 0, last_activity_at: new Date().toISOString(), status: "active", flags: [] },
  ],
  class_groups: [
    { id: 10, name: "S1 A", grade_name: "S1", program_name: "O-Level", students: 40, with_marks: 38, average: 44, pass_rate: 40, at_risk: 12, excelling: 1, missing: 5, subjects: 8 },
  ],
  programmes: [{ name: "O-Level", class_groups: 3, students: 200, with_marks: 190, average: 58, at_risk: 20 }],
  coverage: {
    no_published_work: [{ id: 19, name: "Subject 19", code: "S19", teachers: ["Idle Teacher"] }],
    no_teacher: [{ id: 20, name: "Subject 20", code: "S20" }],
    unmapped: [{ id: 19, name: "Subject 19", code: "S19", teachers: ["Idle Teacher"], published: 0 }],
    students_without_marks: 20,
  },
  report_cards: { term: "Term 1", academic_year: "2026 - 2027", cards: { draft: 10, saved: 5, approved: 30, total: 45 }, subjects_mapped: 12, subjects_total: 20 },
  decisions: [
    { id: "admin-teachers-inactive", severity: "warning", title: "1 teacher with no published work", message: "Idle Teacher has nothing published.", subject_id: null, action: { label: "See teachers", url: "#teachers" } },
  ],
});

let lastSearch = "";
const LocationSpy = () => {
  lastSearch = useLocation().search;
  return null;
};

beforeEach(() => {
  store.clear();
  resetAlertState();
  getOverview.mockReset();
  getOverview.mockImplementation(async () => overview());
  getInsights.mockReset();
  getInsights.mockImplementation(async () => insights());
  getSubjects.mockReset();
  getStudents.mockReset();
});

describe("school dashboard (admin variant)", () => {
  const renderDash = (url = "/dashboard") =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/dashboard" element={<><InstructorDashboard variant="admin" /><LocationSpy /></>} />
        </Routes>
      </MemoryRouter>,
    );

  it("adds the school layer to the teacher board", async () => {
    renderDash();
    expect(await screen.findByText("1 teacher with no published work")).toBeInTheDocument();
    expect(getInsights).toHaveBeenCalledWith({ term: "Term 1", academic_year: "2026 - 2027" }, false);
    expect(screen.getByText("School overview.")).toBeInTheDocument();

    const teachers = screen.getByText("Teachers").closest("section")!;
    expect(within(teachers).getByText("Idle Teacher")).toBeInTheDocument();
    expect(within(teachers).getByText("No work yet")).toBeInTheDocument();
    fireEvent.click(within(teachers).getByRole("button", { name: "Active (1)" }));
    expect(within(teachers).queryByText("Idle Teacher")).toBeNull();
    expect(within(teachers).getByText("Busy Teacher")).toBeInTheDocument();

    const classes = screen.getByText("Classes").closest("section")!;
    expect(within(classes).getByText("S1 A")).toBeInTheDocument();
    expect(within(classes).getByRole("link", { name: "Students in S1 A" })).toHaveAttribute("href", "/students?classGroupId=10");

    const rc = screen.getByText("Report cards").closest("section")!;
    expect(within(rc).getByText("12 / 20")).toBeInTheDocument();
    expect(within(rc).getByText("Approved")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Subjects report/ })).toHaveAttribute("href", "/courses");
    expect(screen.getByTestId("bulk-export")).toBeInTheDocument();
  });

  it("uses a picker instead of chips and pages the scorecards for many subjects", async () => {
    renderDash();
    await screen.findByText("Subject scorecards");
    const picker = screen.getByRole("combobox", { name: "Focus on a subject" });
    expect(optionValues(picker)).toHaveLength(21);
    expect(screen.queryByRole("tablist", { name: "Focus on a subject" })).toBeNull();
    expect(screen.getByText("1–10 of 20 subjects")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("11–20 of 20 subjects")).toBeInTheDocument();
    // The comparison chart shows only the weakest 12.
    expect(screen.getByTestId("comparison-chart").getAttribute("data-count")).toBe("12");
    // Teachers show under the subject name.
    expect(screen.getAllByText("Teacher 11").length).toBeGreaterThan(0);

    pickOption(picker, "3");
    await waitFor(() => expect(lastSearch).toBe("?subject=3"));
    await waitFor(() => expect(getOverview).toHaveBeenCalledWith(3, { fresh: false }));
  });

  it("still renders the board when the school layer fails", async () => {
    getInsights.mockRejectedValue(new Error("boom"));
    renderDash();
    expect(await screen.findByText("Subject scorecards")).toBeInTheDocument();
    expect(screen.queryByText("Teachers")).toBeNull();
  });
});

// ─── Subjects report ─────────────────────────────────────────────────────────

const subjectRow = (id: number, extra: Partial<AdminSubjectRow> = {}): AdminSubjectRow => ({
  ...subject(id),
  teachers: [`Teacher ${id}`],
  teacher_list: [{ mis_user_id: 900 + id, name: `Teacher ${id}` }],
  class_group_list: [{ id: 10, name: "S1 A", grade_name: "S1", program_name: "O-Level" }],
  programmes: ["O-Level"],
  report_card: { mapped: id % 2 === 0, mapped_items: id % 2 === 0 ? 4 : 0 },
  ...extra,
});

const subjectsResponse = (rows: AdminSubjectRow[], extra: Partial<AdminSubjectsResponse> = {}): AdminSubjectsResponse => ({
  rows,
  page: 1,
  page_size: 15,
  total: 32,
  total_pages: 3,
  health_counts: { at_risk: 2, watch: 5, on_track: 20, no_data: 5 },
  facets: {
    programmes: ["A-Level", "O-Level"],
    class_groups: [{ id: 10, name: "S1 A", grade_name: "S1", program_name: "O-Level" }],
    teachers: [{ mis_user_id: 901, name: "Teacher 1" }],
  },
  totals: overview().totals,
  rosters_available: true,
  generated_at: new Date().toISOString(),
  ...extra,
});

describe("AdminSubjectsPage", () => {
  const renderPage = (url = "/courses") =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/courses" element={<><AdminSubjectsPage /><LocationSpy /></>} />
        </Routes>
      </MemoryRouter>,
    );

  it("lists subjects with teachers, status and report-card mapping, linking to details and the subject dashboard", async () => {
    getSubjects.mockResolvedValue(subjectsResponse([subjectRow(1), subjectRow(2, { teacher_list: [], teachers: [] })]));
    renderPage();
    expect((await screen.findAllByText("Subject 1")).length).toBeGreaterThan(0);
    expect(getSubjects).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 15, sort: "health", dir: "asc" }),
      { term: "Term 1", academic_year: "2026 - 2027" },
      false,
    );
    const table = screen.getByRole("table");
    expect(within(table).getByText("Teacher 1")).toBeInTheDocument();
    expect(within(table).getByText("Unassigned")).toBeInTheDocument();
    expect(within(table).getByText("Mapped")).toBeInTheDocument();
    expect(within(table).getByText("Not mapped")).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: "Open Subject 1" })).toHaveAttribute("href", "/courses/1");
    expect(within(table).getByRole("link", { name: "Dashboard for Subject 1" })).toHaveAttribute("href", "/dashboard?subject=1");
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  it("drives filters, sorting and paging through the URL and the server", async () => {
    getSubjects.mockResolvedValue(subjectsResponse([subjectRow(1)]));
    renderPage("/courses?flag=unmapped");
    await screen.findByText("Page 1 of 3");
    expect(getSubjects).toHaveBeenLastCalledWith(expect.objectContaining({ flag: "unmapped" }), expect.anything(), false);

    fireEvent.click(screen.getByRole("button", { name: "At risk (2)" }));
    await waitFor(() => expect(getSubjects).toHaveBeenLastCalledWith(expect.objectContaining({ health: "at_risk", flag: "unmapped" }), expect.anything(), false));
    expect(lastSearch).toContain("health=at_risk");

    pickOption(screen.getByRole("combobox", { name: "Programme" }), "A-Level");
    await waitFor(() => expect(getSubjects).toHaveBeenLastCalledWith(expect.objectContaining({ programme: "A-Level" }), expect.anything(), false));

    pickOption(screen.getByRole("combobox", { name: "Sort by" }), "pending");
    await waitFor(() => expect(getSubjects).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "pending", dir: "desc" }), expect.anything(), false));

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(getSubjects).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.anything(), false));

    fireEvent.change(screen.getByRole("searchbox", { name: "Search subjects" }), { target: { value: "phys" } });
    await waitFor(() => expect(getSubjects).toHaveBeenLastCalledWith(expect.objectContaining({ search: "phys", page: 1 }), expect.anything(), false), { timeout: 2000 });

    fireEvent.click(screen.getByRole("button", { name: /Clear/ }));
    await waitFor(() => expect(lastSearch).toBe(""));
  });

  it("shows an error with retry when the report can't load", async () => {
    getSubjects.mockRejectedValueOnce({ response: { data: { message: "These reports need school-wide access" } } });
    getSubjects.mockResolvedValueOnce(subjectsResponse([subjectRow(1)]));
    renderPage();
    expect(await screen.findByText("These reports need school-wide access")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect((await screen.findAllByText("Subject 1")).length).toBeGreaterThan(0);
  });
});

// ─── Students directory ──────────────────────────────────────────────────────

const studentRow = (n: number, extra: Partial<AdminStudentRow> = {}): AdminStudentRow => ({
  key: `m${n}`, mis_user_id: n, local_id: null, name: `Student ${n}`, first_name: "Student", last_name: String(n),
  email: `s${n}@nga.ac.rw`, username: `s${n}`, gender: "FEMALE", registration_number: `R${n}`,
  class_group: { id: 10, name: "S1 A", grade_name: "S1", program_name: "O-Level" },
  subjects: [{ id: 1, name: "Maths", code: "MAT" }, { id: 2, name: "Physics", code: "PHY" }],
  average: 72, rank: n, ranked_of: 40, status: "on_track", marked_items: 6, subjects_marked: 2,
  by_kind: { assignment: 70 }, subject_scores: [{ id: 2, name: "Physics", code: "PHY", score: 45 }, { id: 1, name: "Maths", code: "MAT", score: 99 }],
  weakest: { id: 2, name: "Physics", code: "PHY", score: 45 }, missing: 0, reasons: [], ...extra,
});

const studentsResponse = (rows: AdminStudentRow[]): AdminStudentsResponse => ({
  rows,
  page: 1,
  page_size: 25,
  total: 60,
  total_pages: 3,
  status_counts: { excelling: 10, on_track: 30, needs_attention: 10, at_risk: 5, no_marks: 5 },
  summary: { students: 60, with_marks: 55, average: 66.4, needing_support: 8, missing_work: 12 },
  facets: {
    class_groups: [{ id: 10, name: "S1 A", grade_name: "S1", program_name: "O-Level", students: 40 }, { id: 20, name: "S2 B", grade_name: "S2", program_name: "A-Level", students: 20 }],
    programmes: ["A-Level", "O-Level"],
    subjects: [{ id: 1, name: "Maths", code: "MAT" }],
    unassigned: 0,
  },
  rosters_available: true,
  generated_at: new Date().toISOString(),
});

describe("AdminStudentsDirectory", () => {
  const renderDir = (url = "/students") =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/students" element={<><AdminStudentsDirectory /><LocationSpy /></>} />
        </Routes>
      </MemoryRouter>,
    );

  it("lists students with class, subjects, performance and a profile link", async () => {
    getStudents.mockResolvedValue(
      studentsResponse([
        studentRow(1),
        studentRow(2, { status: "at_risk", average: 31, missing: 3, reasons: ["Average 31%", "3 missing submissions"] }),
        studentRow(3, { key: "l77", mis_user_id: null, local_id: 77, class_group: null, name: "Local Only" }),
      ]),
    );
    renderDir();
    const table = await screen.findByRole("table");
    expect(within(table).getByRole("link", { name: /Student 1/ })).toHaveAttribute("href", "/students/1");
    expect(within(table).queryByRole("link", { name: /Local Only/ })).toBeNull();
    expect(within(table).getAllByText("S1 A").length).toBe(2);
    expect(within(table).getByText("No class this year")).toBeInTheDocument();
    expect(within(table).getByText("Average 31%")).toBeInTheDocument();
    expect(within(table).getAllByText("#1 of 40").length).toBe(1);
    // A failing subject badge is flagged with its score.
    expect(within(table).getAllByText("PHY").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /At risk \(5\)/ })).toBeInTheDocument();
    expect(screen.getByText("66%")).toBeInTheDocument();
  });

  it("reads deep links from the dashboard and filters on the server", async () => {
    getStudents.mockResolvedValue(studentsResponse([studentRow(1)]));
    renderDir("/students?attention=1&classGroupId=10");
    await screen.findByRole("table");
    expect(getStudents).toHaveBeenLastCalledWith(
      expect.objectContaining({ attention: true, classGroupId: 10, page: 1, pageSize: 25 }),
      { term: "Term 1", academic_year: "2026 - 2027" },
      false,
    );
    expect(screen.getByRole("checkbox", { name: /needing support/ })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: /Excelling \(10\)/ }));
    await waitFor(() => expect(getStudents).toHaveBeenLastCalledWith(expect.objectContaining({ status: "excelling" }), expect.anything(), false));

    pickOption(screen.getByRole("combobox", { name: "Gender" }), "F");
    await waitFor(() => expect(getStudents).toHaveBeenLastCalledWith(expect.objectContaining({ gender: "F" }), expect.anything(), false));

    fireEvent.click(screen.getByRole("button", { name: "Group by class" }));
    await waitFor(() => expect(getStudents).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "class_group", dir: "asc" }), expect.anything(), false));
    expect(await screen.findByRole("rowheader", { name: /S1 A/ })).toBeInTheDocument();
  });
});
