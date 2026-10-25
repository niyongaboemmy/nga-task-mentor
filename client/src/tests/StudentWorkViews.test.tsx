import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { StudentOverview, StudentTask } from "../services/studentOverviewApi";

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

import StudentAssignments from "../components/Assignments/StudentAssignments";
import StudentSubmissions from "../components/Assignments/StudentSubmissions";
import { optionValues, pickOption } from "./helpers/select";

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
  task({ id: 10, title: "Landing page", state: "due_soon", due_at: inHours(30), countdown_to: inHours(30) }),
  task({ id: 11, title: "Forms", state: "upcoming", subject_id: 2, subject_code: "JS", subject_name: "JavaScript" }),
  task({ id: 12, title: "Wireframe", state: "submitted", countdown_to: null, submitted_at: inHours(-24), action: { label: "View submission", url: "/assignments/12" } }),
  task({ id: 13, title: "HTML basics", state: "graded", countdown_to: null, score_pct: 80, score_display: "16/20", graded_at: inHours(-30) }),
  task({ id: 14, title: "CSS lab", state: "missed", due_at: inHours(-48), countdown_to: null, action: { label: "View", url: "/assignments/14" } }),
  task({ id: 20, kind: "quiz", title: "Loops quiz", state: "graded", countdown_to: null, score_pct: 40, graded_at: inHours(-10), subject_id: 2, subject_code: "JS", subject_name: "JavaScript" }),
];

const overview = (tasks = TASKS): StudentOverview =>
  ({ generated_at: new Date().toISOString(), academic_term_id: 3, summary: {}, tasks, subjects: [], reminders: [] }) as unknown as StudentOverview;

function Location() {
  return <div data-testid="location">{useLocation().search}</div>;
}

const renderAt = (el: React.ReactElement, url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="*" element={<>{el}<Location /></>} />
      </Routes>
    </MemoryRouter>,
  );

const titles = () => within(screen.getByRole("list", { name: /Assignments|Submissions/ })).getAllByRole("heading").map((h) => h.textContent);

beforeEach(() => {
  store.clear();
  getOverview.mockReset();
  getOverview.mockResolvedValue(overview());
});

describe("Student assignments", () => {
  it("opens on what's to do, soonest first, as a grid", async () => {
    renderAt(<StudentAssignments />, "/assignments");
    expect(await screen.findByRole("button", { name: /To do 2/ })).toHaveAttribute("aria-pressed", "true");
    expect(titles()).toEqual(["Landing page", "Forms"]);
    expect(screen.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "true");
    // quizzes belong to My Quizzes, not here
    expect(screen.getByRole("button", { name: /All 5/ })).toBeInTheDocument();
  });

  it("filters by status and keeps it in the URL", async () => {
    renderAt(<StudentAssignments />, "/assignments");
    fireEvent.click(await screen.findByRole("button", { name: /Missed 1/ }));
    expect(titles()).toEqual(["CSS lab"]);
    expect(screen.getByTestId("location").textContent).toBe("?status=missed");
    expect(screen.getByText(/Ask your teacher about catching up/)).toBeInTheDocument();
  });

  it("lists only subjects that have work, and narrows to one", async () => {
    renderAt(<StudentAssignments />, "/assignments?status=all");
    const menu = await screen.findByRole("combobox", { name: "Subject" });
    // JavaScript (2) and Web UI (1), alphabetical; nothing for subjects without work.
    expect(optionValues(menu)).toEqual(["", "2", "1"]);
    pickOption(menu, "2");
    expect(titles()).toEqual(["Forms"]);
  });

  it("remembers the list view", async () => {
    renderAt(<StudentAssignments />, "/assignments");
    fireEvent.click(await screen.findByRole("button", { name: "List view" }));
    expect(store.get("tm.assignments.view")).toBe("list");
  });

  it("offers everything when nothing is to do", async () => {
    getOverview.mockResolvedValue(overview(TASKS.filter((t) => t.state === "graded")));
    renderAt(<StudentAssignments />, "/assignments");
    expect(await screen.findByText("Nothing to do right now.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all 1" }));
    expect(titles()).toEqual(["HTML basics"]);
  });

  it("says so when loading fails, with a retry", async () => {
    getOverview.mockRejectedValueOnce({ response: { data: { message: "Network error" } } });
    renderAt(<StudentAssignments />, "/assignments");
    expect(await screen.findByRole("alert")).toHaveTextContent("Network error");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: /To do 2/ })).toBeInTheDocument();
  });
});

describe("Student submissions", () => {
  it("shows only handed-in work, newest first, with marks", async () => {
    renderAt(<StudentSubmissions />, "/submissions");
    expect(await screen.findByText(/handed in this term/)).toHaveTextContent("3 handed in this term");
    expect(titles()).toEqual(["Loops quiz", "Wireframe", "HTML basics"]);
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.queryByText("Landing page")).not.toBeInTheDocument();
  });

  it("filters by kind and by marked state", async () => {
    renderAt(<StudentSubmissions />, "/submissions");
    fireEvent.click(await screen.findByRole("button", { name: "Quizzes" }));
    expect(titles()).toEqual(["Loops quiz"]);
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.click(screen.getByRole("button", { name: /Waiting for mark 1/ }));
    expect(titles()).toEqual(["Wireframe"]);
    expect(screen.getByTestId("location").textContent).toBe("?status=waiting");
  });

  it("explains an empty term", async () => {
    getOverview.mockResolvedValue(overview(TASKS.filter((t) => t.state === "upcoming")));
    renderAt(<StudentSubmissions />, "/submissions");
    expect(await screen.findByText("You haven't handed anything in this term yet.")).toBeInTheDocument();
  });
});
