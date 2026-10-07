import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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
  it("says what to do next, in order, with the action to start", async () => {
    renderDash();
    const hero = await screen.findByRole("region", { name: "What to do next" });
    expect(within(hero).getByRole("heading", { level: 2 })).toHaveTextContent("Finish your JS basics quiz, then Landing page.");
    expect(within(hero).getByText(/JS basics time left 1[45]:\d\d/)).toBeInTheDocument();
    fireEvent.click(within(hero).getByRole("link", { name: /Resume/ }));
    expect(await screen.findByText("quiz page")).toBeInTheDocument();
  });

  it("says all caught up when nothing needs doing", async () => {
    getOverview.mockResolvedValue(overview({ tasks: TASKS.filter((t) => ["graded", "submitted", "missed"].includes(t.state)) }));
    renderDash();
    const hero = await screen.findByRole("region", { name: "What to do next" });
    expect(within(hero).getByRole("heading", { level: 2 })).toHaveTextContent("You're all caught up.");
    expect(within(hero).queryByRole("link", { name: /Resume|Submit/ })).toBeNull();
  });

  it("shows the week's progress, the average and the class rank", async () => {
    renderDash();
    const hero = await screen.findByRole("region", { name: "What to do next" });
    expect(within(hero).getByRole("img", { name: /of \d+ done this week/ })).toBeInTheDocument();
    expect(within(hero).getByText("71%")).toBeInTheDocument();
    const rank = screen.getByRole("link", { name: "Open my ranking" });
    expect(within(rank).getByText("#4")).toBeInTheDocument();
    expect(within(rank).getByText("of 36 in class")).toBeInTheDocument();
  });

  it("gives each subject its own next step and opens it on click", async () => {
    renderDash();
    const web = await screen.findByRole("link", { name: "Open Web UI" });
    expect(within(web).getByText("78%")).toBeInTheDocument(); // the ranking's score wins over the online-only one
    expect(within(web).getByText("class 66%")).toBeInTheDocument();
    expect(within(web).getByText("Landing page")).toBeInTheDocument();
    const js = screen.getByRole("link", { name: "Open JavaScript" });
    expect(within(js).getByText(/in progress now/)).toBeInTheDocument();
    fireEvent.click(web);
    expect(await screen.findByText("course page")).toBeInTheDocument();
  });

  it("sorts every task by what it needs: the running quiz first under To do, the missed work under Missed", async () => {
    renderDash();
    const board = (await screen.findByRole("heading", { name: "My tasks" })).closest("section")!;
    const rows = () => within(board).getAllByRole("listitem").map((li) => li.textContent);
    expect(rows()[0]).toMatch(/In progress.*JS basics/);
    fireEvent.click(within(board).getByRole("tab", { name: /Missed/ }));
    expect(rows()).toEqual([expect.stringMatching(/Missed.*CSS lab/)]);
  });

  it("shows at a glance: tasks by state, work handed in, my average and my standing", async () => {
    renderDash();
    const glance = await screen.findByRole("region", { name: "At a glance" });
    expect(within(glance).getByText("My tasks")).toBeInTheDocument();
    expect(within(glance).getByText("Handed in")).toBeInTheDocument();
    const standing = within(glance).getByRole("link", { name: "Open my standing" });
    expect(within(standing).getByText("#4")).toBeInTheDocument();
  });

  it("lists reminders on the page and lets one be dismissed", async () => {
    renderDash();
    const box = (await screen.findByRole("heading", { name: "Reminders" })).closest("section")!;
    const first = within(box).getAllByRole("button", { name: /^Dismiss: / })[0]!;
    const title = first.getAttribute("aria-label")!.replace("Dismiss: ", "");
    fireEvent.click(first);
    expect(within(box).queryByRole("button", { name: `Dismiss: ${title}` })).toBeNull();
  });

  it("charts my marks over time and keeps the report card", async () => {
    renderDash();
    const marks = (await screen.findByRole("heading", { name: "My marks" })).closest("section")!;
    expect(within(marks).getByText("HTML basics")).toBeInTheDocument();
    expect(screen.getByTestId("report-card")).toBeInTheDocument();
  });

  it("sends reminders to the notification bell", async () => {
    renderDash();
    await screen.findByRole("region", { name: "What to do next" });
    expect(unreadImportant(latestAlerts()!).map((a) => a.id)).toEqual(
      expect.arrayContaining(["running-20", "due-today-assignment-10", "result-assignment-14", "opens-21"]),
    );
  });

  it("works without the ranking endpoint", async () => {
    getRanking.mockRejectedValue(new Error("down"));
    renderDash();
    const hero = await screen.findByRole("region", { name: "What to do next" });
    expect(within(hero).getByText("60%")).toBeInTheDocument(); // the online-only average
    expect(within(hero).getByText("ranked after first marks")).toBeInTheDocument();
  });

  it("neither asks for nor shows the ranking when the role has it switched off", async () => {
    auth.permissions = [];
    renderDash();
    const hero = await screen.findByRole("region", { name: "What to do next" });
    expect(within(hero).getByText("60%")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open my ranking" })).toBeNull();
    expect(screen.queryByText("ranked after first marks")).toBeNull();
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
