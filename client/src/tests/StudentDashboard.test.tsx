import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { StudentOverview, StudentTask } from "../services/studentOverviewApi";

// The student's role permissions; RANKINGS_VIEW_OWN is the ranking switch.
const auth = vi.hoisted(() => ({ permissions: ["RANKINGS_VIEW_OWN"] as string[] }));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "2",
      first_name: "Aline",
      last_name: "Uwase",
      currentAcademicYear: { name: "2026 - 2027" },
      currentAcademicTerm: { name: "Term 1" },
      localPermissions: auth.permissions,
    },
  }),
}));
vi.mock("../contexts/ThemeContext", () => ({ useTheme: () => ({ theme: "light" }) }));
vi.mock("../components/Dashboard/student/ReportCardPanel", () => ({ default: () => <div data-testid="report-card" /> }));
// Canvas charts (jsdom has no canvas): stand-ins that expose their data and
// clicks. RingGauge and RankTrack are SVG/DOM and are tested for real.
vi.mock("../components/Dashboard/student/StudentCharts", async (orig) => {
  const real = await orig<typeof import("../components/Dashboard/student/StudentCharts")>();
  return {
    ...real,
    StatusDonut: ({ counts, onSelect }: { counts: Record<string, number>; onSelect: (k: string) => void }) => (
      <div data-testid="donut">
        {Object.entries(counts).map(([k, n]) => (
          <button key={k} type="button" onClick={() => onSelect(k)}>{`donut ${k} ${n}`}</button>
        ))}
      </div>
    ),
    SubjectBars: ({ rows, onSelect }: { rows: Array<{ id: number; label: string; me: number | null; classAvg: number | null }>; onSelect: (id: number) => void }) => (
      <div data-testid="subject-bars">
        {rows.map((r) => (
          <button key={r.id} type="button" onClick={() => onSelect(r.id)}>{`bar ${r.label} ${r.me ?? "-"} vs ${r.classAvg ?? "-"}`}</button>
        ))}
      </div>
    ),
    MarksTrend: ({ points }: { points: unknown[] }) => <div data-testid="trend">{`trend ${points.length}`}</div>,
  };
});

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
  task({ id: 20, kind: "quiz", title: "JS basics", state: "in_progress", subject_code: "JS", subject_id: 2, countdown_to: inHours(0.25), countdown_label: "time_left", due_at: inHours(20), question_count: 10, duration_minutes: 20, max_attempts: 2, action: { label: "Resume", url: "/quizzes/20/take" } }),
  task({ id: 10, title: "Landing page", state: "due_today", due_at: inHours(5), countdown_to: inHours(5), has_draft: true, action: { label: "Finish & submit", url: "/assignments/10" } }),
  task({ id: 11, title: "Forms", state: "due_soon", due_at: inHours(50), countdown_to: inHours(50), is_new: true }),
  task({ id: 21, kind: "quiz", title: "Loops", state: "not_open", opens_at: inHours(30), countdown_to: inHours(30), countdown_label: "opens", due_at: inHours(60), quiz_type: "Exam" }),
  task({ id: 15, title: "Wireframe", state: "submitted", countdown_to: null, countdown_label: null, submitted_at: inHours(-24), is_late: true, action: { label: "View submission", url: "/assignments/15" } }),
  task({ id: 14, title: "HTML basics", state: "graded", countdown_to: null, countdown_label: null, score_pct: 80, score_display: "16/20", passed: true, has_feedback: true, graded_at: inHours(-30), action: { label: "View feedback", url: "/assignments/14" } }),
  task({ id: 16, title: "CSS basics", state: "graded", countdown_to: null, countdown_label: null, score_pct: 40, passed: false, graded_at: inHours(-60), action: { label: "View result", url: "/assignments/16" } }),
  task({ id: 13, title: "CSS lab", state: "missed", due_at: inHours(-48), countdown_to: null, countdown_label: null, action: { label: "View", url: "/assignments/13" } }),
];

const overview = (over: Partial<StudentOverview> = {}): StudentOverview => ({
  generated_at: new Date().toISOString(),
  academic_term_id: 3,
  summary: {
    subjects: 2, todo: 3, in_progress: 1, due_today: 1, due_this_week: 3, not_open: 1, awaiting_grade: 1, graded: 2,
    missed: 1, drafts: 1, completion_rate: 75, on_time_rate: 50, recent_average: 60, new_results: 1, next_deadline: inHours(0.25),
  },
  tasks: TASKS,
  subjects: [
    { subject_id: 1, subject_name: "Web UI", subject_code: "WEB", total: 7, todo: 2, due_soon: 2, missed: 1, awaiting: 1, graded: 2, completion: 75, recent_average: 60, next_task: { title: "Landing page", kind: "assignment", due_at: inHours(5), url: "/assignments/10" } },
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
        <Route path="/courses/:id" element={<div>course page</div>} />
        <Route path="/assignments/:id" element={<div>assignment page</div>} />
      </Routes>
    </MemoryRouter>,
  );

const RANKING = {
  view: "student",
  overall: { rank: 4, ranked_count: 36, score: 71.2, band: "Top quarter", class_average: 64, status: "on_track" },
  subjects: [{ course_id: "1", score: 78, class_average: 66, status: "on_track" }],
  suggestions: [{ id: "s1", priority: "high", title: "Revise loops", detail: "Your weakest topic.", action: { label: "Practice", href: "/quizzes/22/take" } }],
};

const section = (heading: string) => screen.getByRole("heading", { name: heading }).closest("section")!;

beforeEach(() => {
  auth.permissions = ["RANKINGS_VIEW_OWN"];
  store.clear();
  resetAlertState();
  getOverview.mockReset();
  getOverview.mockResolvedValue(overview());
  getRanking.mockReset();
  getRanking.mockResolvedValue({ data: { data: RANKING } });
});

describe("StudentDashboard", () => {
  it("leads with the one thing to do first, with a live countdown", async () => {
    renderDash();
    const heading = await screen.findByRole("heading", { name: "JS basics" });
    const focus = heading.closest("#today")!;
    expect(within(focus as HTMLElement).getByText("In progress · finish first")).toBeInTheDocument();
    expect(within(focus as HTMLElement).getByRole("timer")).toHaveTextContent(/1[45]:\d\d left/);
    // icon chips instead of a sentence
    expect(within(focus as HTMLElement).getByLabelText("10 questions")).toBeInTheDocument();
    expect(within(focus as HTMLElement).getByLabelText("About 20 minutes")).toBeInTheDocument();
    fireEvent.click(within(focus as HTMLElement).getByRole("link", { name: /Resume/ }));
    expect(await screen.findByText("quiz page")).toBeInTheDocument();
  });

  it("uses blue for the focus card, even when all is calm", async () => {
    getOverview.mockResolvedValue(
      overview({
        tasks: [task({ id: 30, title: "Essay", state: "upcoming", due_at: inHours(200), countdown_to: inHours(200) })],
        summary: { ...overview().summary, in_progress: 0, due_today: 0, due_this_week: 0, new_results: 0, missed: 0, drafts: 0, next_deadline: inHours(200) },
        reminders: [{ id: "all-clear", severity: "success", title: "You're on top of things", message: "", countdown_to: null, subject_id: null }],
      }),
    );
    renderDash();
    const calm = (await screen.findByText("All caught up")).closest("#today")!.firstElementChild as HTMLElement;
    expect(calm.className).toMatch(/\bbg-blue-600\b/);
    expect(calm.className).not.toMatch(/gradient|indigo|violet|purple|emerald|teal|green/);
    expect(screen.getByText("Nothing to remind you about")).toBeInTheDocument();
  });

  it("summarises the day as clickable chips", async () => {
    renderDash();
    expect(await screen.findByRole("button", { name: "1 in progress" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 due today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3 this week" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 new mark" })).toBeInTheDocument();
  });

  it("shows progress as visuals: donut, rings and rank track", async () => {
    renderDash();
    expect(await screen.findByRole("button", { name: "donut todo 4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "donut missed 1" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Work handed in: 75%" })).toBeInTheDocument();
    // ranking average (with teacher-recorded marks) and its class tick
    expect(screen.getByRole("img", { name: "My average: 71%, class 64%" })).toBeInTheDocument();
    expect(screen.getByText("class 64%")).toBeInTheDocument();
    const rank = screen.getByRole("link", { name: "Open my ranking" });
    expect(within(rank).getByText("/ 36")).toBeInTheDocument();
    expect(within(rank).getByText("Top quarter")).toBeInTheDocument();
  });

  it("opens the matching task group from the donut and the missed link", async () => {
    renderDash();
    await screen.findByRole("heading", { name: "My tasks" });
    const board = section("My tasks");
    fireEvent.click(screen.getByRole("button", { name: "donut awaiting 1" }));
    expect(within(board).getByRole("tab", { name: /Awaiting marks/ })).toHaveAttribute("aria-selected", "true");
    expect(within(board).getByText("Wireframe")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "1 missed" }));
    expect(within(board).getByRole("tab", { name: /Missed/ })).toHaveAttribute("aria-selected", "true");
    expect(within(board).getByText("CSS lab")).toBeInTheDocument();
  });

  it("keeps reminders to one line and reveals the detail on tap", async () => {
    renderDash();
    const title = await screen.findByText("Assignment due in 5h: Landing page");
    const row = title.closest("li")!;
    expect(within(row).getByText("New")).toBeInTheDocument();
    expect(within(row).queryByText("Late submissions are not accepted.")).toBeNull();
    fireEvent.click(title);
    expect(await within(row).findByText("Late submissions are not accepted.")).toBeInTheDocument();
    expect(unreadImportant(latestAlerts()!).map((a) => a.id)).toEqual(
      expect.arrayContaining(["running-20", "due-today-assignment-10", "result-assignment-14", "opens-21"]),
    );
  });

  it("dismisses a reminder", async () => {
    renderDash();
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss: Exam opens in 1 day: Loops" }));
    await waitFor(() => expect(screen.queryByText("Exam opens in 1 day: Loops")).toBeNull());
  });

  it("lists the week's work and filters it by day", async () => {
    renderDash();
    await screen.findByRole("heading", { name: "This week" });
    const week = section("This week");
    expect(within(week).getAllByRole("tab")).toHaveLength(7);
    expect(within(week).getByText(/Next 7 days · 4/)).toBeInTheDocument();
    fireEvent.click(within(week).getAllByRole("tab")[6]);
    expect(within(week).getByText(/On this day · 0/)).toBeInTheDocument();
    fireEvent.click(within(week).getByRole("button", { name: "Whole week" }));
    expect(within(week).getByText(/Next 7 days · 4/)).toBeInTheDocument();
  });

  it("charts marks over time and subjects against the class", async () => {
    renderDash();
    expect(await screen.findByTestId("trend")).toHaveTextContent("trend 2");
    const results = section("My marks");
    expect(within(results).getByText("HTML basics")).toBeInTheDocument();
    expect(within(results).getByLabelText("Has feedback")).toBeInTheDocument();
    // the ranking's per-subject score wins over the online-only one
    fireEvent.click(screen.getByRole("button", { name: "bar WEB 78 vs 66" }));
    expect(await screen.findByText("course page")).toBeInTheDocument();
  });

  it("works without the ranking endpoint", async () => {
    getRanking.mockRejectedValue(new Error("down"));
    renderDash();
    expect(await screen.findByRole("img", { name: "Recent average: 60%" })).toBeInTheDocument();
    expect(screen.getByText("after your first marks")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "bar JS - vs -" })).toBeInTheDocument();
    expect(screen.queryByText("Tips for you")).toBeNull();
  });

  it("neither asks for nor shows the ranking when the role has it switched off", async () => {
    auth.permissions = [];
    renderDash();
    expect(await screen.findByRole("img", { name: "Recent average: 60%" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open my ranking" })).toBeNull();
    expect(screen.queryByText("Tips for you")).toBeNull();
    expect(getRanking).not.toHaveBeenCalled();
  });

  it("explains an empty enrolment but still offers the report card", async () => {
    getOverview.mockResolvedValue(overview({ subjects: [], tasks: [], reminders: [] }));
    renderDash();
    expect(await screen.findByText("You're not enrolled in any subject for this period")).toBeInTheDocument();
    expect(screen.getByTestId("report-card")).toBeInTheDocument();
  });

  it("keeps the last tasks when a refresh fails", async () => {
    renderDash();
    await screen.findByRole("heading", { name: "My tasks" });
    getOverview.mockRejectedValueOnce({ response: { data: { message: "Network error" } } });
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText(/Couldn't refresh \(Network error\)/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My tasks" })).toBeInTheDocument();
  });
});
