import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { StudentOverview, StudentTask } from "../services/studentOverviewApi";

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "2", first_name: "Aline", last_name: "Uwase", currentAcademicYear: { name: "2026 - 2027" }, currentAcademicTerm: { name: "Term 1" } },
  }),
}));
// The report card panel has its own flow (and e2e); stub it here.
vi.mock("../components/Dashboard/student/ReportCardPanel", () => ({ default: () => <div data-testid="report-card" /> }));

const getRanking = vi.fn();
vi.mock("../utils/axiosConfig", () => ({ default: { get: (...a: unknown[]) => getRanking(...a) } }));
const getOverview = vi.fn();
vi.mock("../services/studentOverviewApi", async (orig) => ({
  ...(await orig<typeof import("../services/studentOverviewApi")>()),
  getStudentOverview: () => getOverview(),
}));

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});

import StudentDashboard from "../components/Dashboard/StudentDashboard";
import { latestAlerts, resetAlertState, unreadImportant } from "../services/alertStore";

const H = 3600000;
const inHours = (h: number) => new Date(Date.now() + h * H).toISOString();

const task = (over: Partial<StudentTask>): StudentTask => ({
  id: 1, kind: "assignment", title: "Task", subject_id: 1, subject_code: "WEB", subject_name: "Web UI", state: "upcoming",
  quiz_type: null, opens_at: null, due_at: inHours(96), countdown_to: inHours(96), countdown_label: "due", max_score: 20,
  question_count: null, duration_minutes: null, attempts_used: 0, max_attempts: null, can_retake: false, has_draft: false,
  submitted_at: null, is_late: false, score_pct: null, score_display: null, passed: null, has_feedback: false, graded_at: null,
  is_new: false, action: { label: "Submit", url: "/assignments/1" }, ...over,
});

const TASKS: StudentTask[] = [
  task({ id: 20, kind: "quiz", title: "JS basics", state: "in_progress", subject_code: "JS", subject_id: 2, countdown_to: inHours(0.25), countdown_label: "time_left", due_at: inHours(20), question_count: 10, duration_minutes: 20, action: { label: "Resume", url: "/quizzes/20/take" } }),
  task({ id: 10, title: "Landing page", state: "due_today", due_at: inHours(5), countdown_to: inHours(5), has_draft: true, action: { label: "Finish & submit", url: "/assignments/10" } }),
  task({ id: 11, title: "Forms", state: "due_soon", due_at: inHours(50), countdown_to: inHours(50), is_new: true }),
  task({ id: 21, kind: "quiz", title: "Loops", state: "not_open", opens_at: inHours(30), countdown_to: inHours(30), countdown_label: "opens", due_at: inHours(60), quiz_type: "Exam" }),
  task({ id: 15, title: "Wireframe", state: "submitted", countdown_to: null, countdown_label: null, submitted_at: inHours(-24), is_late: true, action: { label: "View submission", url: "/assignments/15" } }),
  task({ id: 14, title: "HTML basics", state: "graded", countdown_to: null, countdown_label: null, score_pct: 80, score_display: "16/20", passed: true, has_feedback: true, graded_at: inHours(-30), action: { label: "View feedback", url: "/assignments/14" } }),
  task({ id: 13, title: "CSS lab", state: "missed", due_at: inHours(-48), countdown_to: null, countdown_label: null, action: { label: "View", url: "/assignments/13" } }),
];

const overview = (over: Partial<StudentOverview> = {}): StudentOverview => ({
  generated_at: new Date().toISOString(),
  academic_term_id: 3,
  summary: {
    subjects: 2, todo: 3, in_progress: 1, due_today: 1, due_this_week: 3, not_open: 1, awaiting_grade: 1, graded: 1,
    missed: 1, drafts: 1, completion_rate: 66.7, on_time_rate: 50, recent_average: 80, new_results: 1, next_deadline: inHours(0.25),
  },
  tasks: TASKS,
  subjects: [
    { subject_id: 1, subject_name: "Web UI", subject_code: "WEB", total: 6, todo: 2, due_soon: 2, missed: 1, awaiting: 1, graded: 1, completion: 66.7, recent_average: 80, next_task: { title: "Landing page", kind: "assignment", due_at: inHours(5), url: "/assignments/10" } },
    { subject_id: 2, subject_name: "JavaScript", subject_code: "JS", total: 1, todo: 1, due_soon: 1, missed: 0, awaiting: 0, graded: 0, completion: null, recent_average: null, next_task: null },
  ],
  reminders: [
    { id: "running-20", severity: "critical", title: '"JS basics" is in progress', message: "Your attempt ends in 15 min.", countdown_to: inHours(0.25), subject_id: 2, action: { label: "Resume", url: "/quizzes/20/take" } },
    { id: "due-today-assignment-10", severity: "critical", title: "Assignment due in 5h: Landing page", message: "Late submissions are not accepted.", countdown_to: inHours(5), subject_id: 1, action: { label: "Finish & submit", url: "/assignments/10" } },
    { id: "result-assignment-14", severity: "success", title: "New result: 16/20 on HTML basics", message: "WEB · 80% · your teacher left feedback.", countdown_to: null, subject_id: 1, action: { label: "View feedback", url: "/assignments/14" } },
    { id: "opens-21", severity: "info", title: "Exam opens in 1 day: Loops", message: "Be ready.", countdown_to: inHours(30), subject_id: 2 },
  ],
  ...over,
});

const renderDash = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<StudentDashboard />} />
        <Route path="/quizzes/:id/take" element={<div>quiz page</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  store.clear();
  resetAlertState();
  getOverview.mockReset();
  getOverview.mockResolvedValue(overview());
  getRanking.mockReset();
  getRanking.mockResolvedValue({
    data: {
      data: {
        view: "student",
        overall: { rank: 4, ranked_count: 36, score: 71.2, band: "Top quarter", class_average: 64, points_to_next: 1.3, status: "on_track" },
        subjects: [{ course_id: "1", score: 78, class_average: 66, status: "on_track" }],
        suggestions: [{ id: "s1", priority: "high", title: "Revise loops", detail: "Your weakest topic.", action: { label: "Practice", href: "/quizzes/22/take" } }],
      },
    },
  });
});
afterEach(() => vi.useRealTimers());

describe("StudentDashboard", () => {
  it("leads with the one thing to do first: the running quiz", async () => {
    renderDash();
    const focus = (await screen.findByText("Finish this first · quiz in progress")).parentElement!;
    expect(within(focus).getByText("JS basics")).toBeInTheDocument();
    expect(within(focus).getByRole("timer")).toHaveTextContent(/1[45]:\d\d left/);
    fireEvent.click(within(focus).getByRole("link", { name: /Resume/ }));
    expect(await screen.findByText("quiz page")).toBeInTheDocument();
  });

  it("summarises the day and shows standing from the ranking", async () => {
    renderDash();
    expect(await screen.findByText(/1 quiz in progress · 1 due today · 1 more this week · 1 new mark/)).toBeInTheDocument();
    expect(screen.getByText("4th")).toBeInTheDocument();
    expect(screen.getByText("of 36 · Top quarter")).toBeInTheDocument();
    expect(screen.getByText("71%")).toBeInTheDocument(); // ranking average wins over the online-only one
    expect(screen.getByText("Revise loops")).toBeInTheDocument();
    expect(screen.getByTestId("report-card")).toBeInTheDocument();
  });

  it("lists reminders with live countdowns and marks new ones", async () => {
    renderDash();
    const r = (await screen.findByText("Assignment due in 5h: Landing page")).closest("p")!;
    expect(within(r).getByText("New")).toBeInTheDocument();
    const rem = r.parentElement!;
    expect(within(rem).getByRole("timer")).toHaveTextContent(/Due in 4h|Due in 5h/);
    // a new mark is badge-worthy for a student
    expect(unreadImportant(latestAlerts()!).map((a) => a.id)).toEqual(
      expect.arrayContaining(["running-20", "due-today-assignment-10", "result-assignment-14", "opens-21"]),
    );
  });

  it("groups tasks by what they need, with timing on each", async () => {
    renderDash();
    const board = (await screen.findByText("My tasks")).closest("section")!;
    expect(within(board).getByText("Landing page")).toBeInTheDocument();
    expect(within(board).getByText("Draft saved")).toBeInTheDocument();
    expect(within(board).getByText(/10 questions · ~20 min/)).toBeInTheDocument();
    fireEvent.click(within(board).getByRole("tab", { name: /Opening later \(1\)/ }));
    expect(within(board).getByText("Loops")).toBeInTheDocument();
    expect(within(board).getByText(/Opens in/)).toBeInTheDocument();
    fireEvent.click(within(board).getByRole("tab", { name: /Awaiting marks \(1\)/ }));
    expect(within(board).getByText(/Handed in .* · late/)).toBeInTheDocument();
    fireEvent.click(within(board).getByRole("tab", { name: /Missed \(1\)/ }));
    expect(within(board).getByText(/Ask your teacher/)).toBeInTheDocument();
  });

  it("lists the week's work and filters it by day", async () => {
    renderDash();
    const week = (await screen.findByText("This week")).closest("section")!;
    const days = within(week).getAllByRole("tab");
    expect(days).toHaveLength(7);
    // whole week by default: running quiz, landing page, forms (50h), Loops opening (30h)
    expect(within(week).getByText(/Next 7 days · 4/)).toBeInTheDocument();
    fireEvent.click(days[6]);
    expect(within(week).getByText(/On this day · 0/)).toBeInTheDocument();
    expect(within(week).getByText("Nothing due that day.")).toBeInTheDocument();
    fireEvent.click(within(week).getByRole("button", { name: "Whole week" }));
    expect(within(week).getByText(/Next 7 days · 4/)).toBeInTheDocument();
  });

  it("shows marks with feedback and subject progress", async () => {
    renderDash();
    const results = (await screen.findByText("Recent results")).closest("section")!;
    expect(within(results).getByText("HTML basics")).toBeInTheDocument();
    expect(within(results).getByLabelText("Has feedback")).toBeInTheDocument();
    const subjects = screen.getByText("My subjects").closest("section")!;
    expect(within(subjects).getByText("78%")).toBeInTheDocument(); // from ranking
    expect(within(subjects).getByText("class 66%")).toBeInTheDocument();
    expect(within(subjects).getByText("1 missed")).toBeInTheDocument();
  });

  it("works without the ranking endpoint", async () => {
    getRanking.mockRejectedValue(new Error("down"));
    renderDash();
    const tile = (await screen.findByText("Recent average")).closest("div")!.parentElement!;
    expect(within(tile).getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("no ranked marks yet")).toBeInTheDocument();
  });

  it("is calm when nothing is urgent", async () => {
    getOverview.mockResolvedValue(
      overview({
        tasks: [task({ id: 30, title: "Essay", state: "upcoming", due_at: inHours(200), countdown_to: inHours(200) })],
        summary: { ...overview().summary, todo: 1, in_progress: 0, due_today: 0, due_this_week: 0, new_results: 0, missed: 0, drafts: 0 },
        reminders: [{ id: "all-clear", severity: "success", title: "You're on top of things", message: "Nothing due soon.", countdown_to: null, subject_id: null }],
      }),
    );
    renderDash();
    expect(await screen.findByText("Nothing urgent right now")).toBeInTheDocument();
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });

  it("explains an empty enrolment but still offers the report card", async () => {
    getOverview.mockResolvedValue(overview({ subjects: [], tasks: [], reminders: [] }));
    renderDash();
    expect(await screen.findByText("You're not enrolled in any subject for this period")).toBeInTheDocument();
    expect(screen.getByTestId("report-card")).toBeInTheDocument();
  });

  it("keeps the last tasks when a refresh fails", async () => {
    renderDash();
    await screen.findByText("My tasks");
    getOverview.mockRejectedValueOnce({ response: { data: { message: "Network error" } } });
    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    expect(await screen.findByText(/Couldn't refresh \(Network error\)/)).toBeInTheDocument();
    expect(screen.getByText("My tasks")).toBeInTheDocument();
  });

  it("dismisses a reminder", async () => {
    renderDash();
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss: Exam opens in 1 day: Loops" }));
    await waitFor(() => expect(screen.queryByText("Exam opens in 1 day: Loops")).toBeNull());
  });
});
