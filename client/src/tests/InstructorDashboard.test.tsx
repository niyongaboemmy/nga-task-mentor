import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { InstructorOverview, SubjectSummary } from "../services/instructorOverviewApi";

// Charts render to canvas, which jsdom lacks; the panels around them are what we test.
vi.mock("../components/Dashboard/instructor/InstructorCharts", () => ({
  ActivityTrendChart: () => <div data-testid="trend-chart" />,
  ScoreDistributionChart: () => <div data-testid="distribution-chart" />,
  SubjectComparisonChart: ({ onSelect }: { onSelect: (id: number) => void }) => (
    <button type="button" data-testid="comparison-chart" onClick={() => onSelect(2)} />
  ),
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { first_name: "Niyongabo", currentAcademicYear: { name: "2026 - 2027" }, currentAcademicTerm: { name: "Term 1" } },
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

import InstructorDashboard from "../components/Dashboard/InstructorDashboard";
import { latestAlerts, resetAlertState, unreadImportant } from "../services/alertStore";

const subject = (id: number, code: string, extra: Partial<SubjectSummary> = {}): SubjectSummary => ({
  subject_id: id, subject_name: `${code} name`, subject_code: code, class_groups: ["L5 SOD A"], students: 20,
  assignments: 2, quizzes: 1, published: 3, drafts: 0, submissions: 30, pending: 0, overdue_pending: 0, graded: 30,
  avg_score: 72, pass_rate: 90, participation: 85, late_rate: 5, missing: 3, at_risk: 1, next_due: null,
  last_activity_at: null, health: "on_track", health_reasons: ["Scores, participation and grading are on track"], ...extra,
});

const WEB = subject(1, "SPEWI302", { pending: 4, overdue_pending: 2, health: "watch", health_reasons: ["2 waiting"] });
const JS = subject(2, "SPEWJ302", { avg_score: 41, health: "at_risk", health_reasons: ["Class average 41% is below the 50% pass mark"] });

const overview = (subjectId: number | null = null): InstructorOverview => ({
  generated_at: new Date().toISOString(),
  academic_term_id: 3,
  rosters_available: true,
  totals: {
    subjects: subjectId ? 1 : 2, class_groups: 1, students: 20, assessments: 6, assignments: 4, quizzes: 2, published: 6,
    drafts: 1, submissions: 60, pending_grading: 4, overdue_grading: 2, graded: 56, avg_score: 56.5, pass_rate: 70,
    participation: 85, late_rate: 5, at_risk_students: 3, missing_work: 6, due_next_7_days: 1, live_proctoring: 2,
    stale_proctoring: 15, flagged_sessions: 0, submissions_this_week: 8, submissions_last_week: 5, graded_this_week: 3,
    graded_last_week: 6, new_submissions_24h: 4,
  },
  subjects: subjectId === 2 ? [JS] : [WEB, JS],
  trend: Array.from({ length: 10 }, (_, i) => ({ week_start: `2026-07-${String(i + 1).padStart(2, "0")}T00:00:00Z`, submissions: i, graded: i, avg_score: 60 })),
  distribution: [{ band: "0-39", count: 2 }, { band: "90-100", count: 5 }],
  grading_queue: [
    { id: 11, kind: "assignment", title: "Landing page", subject_id: 1, subject_code: "SPEWI302", subject_name: "Web", pending: 4, oldest_at: null, waiting_days: 9, url: "/assignments/11" },
  ],
  upcoming: [
    { id: 20, kind: "quiz", title: "JS basics", subject_id: 2, subject_code: "SPEWJ302", subject_name: "JS", status: "published", quiz_type: "Quiz",
      due_at: new Date(Date.now() + 86400000).toISOString(), is_closed: false, submitted: 5, expected: 20, participation: 25, pending: 0,
      graded: 5, late: 0, avg_score: 80, pass_rate: 100, url: "/quizzes/20/submissions" },
  ],
  assessments: [],
  students: {
    at_risk: [{ mis_user_id: 48, local_id: 2, name: "Bo Two", class_group_name: "L5 SOD A", avg_score: 30, graded_count: 3, missing: 2, subjects: ["SPEWI302"], reasons: ["Average 30%", "2 missing submissions"], url: "/students/48" }],
    top: [],
  },
  alerts: [
    { id: "grading-overdue", severity: "critical", title: "2 submissions waiting over 7 days", message: "Oldest: Landing page", subject_id: 1, action: { label: "Grade now", url: "/assignments/11" } },
    { id: "proctoring-stale", severity: "info", title: "15 proctoring sessions left open", message: "No heartbeat.", subject_id: null },
  ],
});

let lastSearch = "";
const LocationSpy = () => {
  lastSearch = useLocation().search;
  return null;
};

const renderAt = (url = "/dashboard") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/dashboard" element={<><InstructorDashboard /><LocationSpy /></>} />
        <Route path="/assignments/:id" element={<div>assignment page</div>} />
      </Routes>
    </MemoryRouter>,
  );

// Node's own (path-less) localStorage shadows jsdom's here, so use a plain one.
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});

beforeEach(() => {
  store.clear();
  resetAlertState();
  getOverview.mockReset();
  getOverview.mockImplementation(async (id?: number | null) => overview(id ?? null));
});

describe("InstructorDashboard", () => {
  it("summarises every assigned subject with KPIs, notifications and queues", async () => {
    renderAt();
    expect(await screen.findByText("2 submissions waiting over 7 days")).toBeInTheDocument();
    expect(getOverview).toHaveBeenCalledWith(null, { fresh: false });
    expect(screen.getByText(/Today: 4 submissions to grade · 1 deadline in the next 7 days · 3 students needing support/)).toBeInTheDocument();
    expect(screen.getByText("2026 - 2027 · Term 1", { exact: false })).toBeInTheDocument();
    // KPIs
    expect(screen.getByText("57%")).toBeInTheDocument(); // class average rounded
    expect(screen.getByText("15 stale")).toBeInTheDocument();
    // queues
    expect(screen.getByText("Landing page")).toBeInTheDocument();
    expect(screen.getByText("JS basics")).toBeInTheDocument();
    expect(screen.getByText("Bo Two")).toBeInTheDocument();
    // charts are present
    expect(screen.getByTestId("trend-chart")).toBeInTheDocument();
    expect(screen.getByTestId("distribution-chart")).toBeInTheDocument();
  });

  it("focuses one subject through the URL from the chips", async () => {
    renderAt();
    await screen.findByText("Subject scorecards");
    const chips = screen.getByRole("tablist", { name: "Focus on a subject" });
    fireEvent.click(within(chips).getByRole("tab", { name: /SPEWJ302/ }));
    await waitFor(() => expect(getOverview).toHaveBeenLastCalledWith(2, { fresh: false }));
    expect(lastSearch).toContain("subject=2");
    // focused subject summary panel
    expect(await screen.findByText(/Class average 41% is below the 50% pass mark/)).toBeInTheDocument();
    // chips keep listing every subject while focused
    expect(within(chips).getByRole("tab", { name: /SPEWI302/ })).toBeInTheDocument();
  });

  it("focuses a subject from its scorecard row", async () => {
    renderAt();
    const table = (await screen.findByText("Subject scorecards")).closest("section")!;
    fireEvent.click(within(table).getByText("SPEWJ302"));
    await waitFor(() => expect(lastSearch).toContain("subject=2"));
  });

  it("dismisses a notification and remembers it for the day", async () => {
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss: 15 proctoring sessions left open" }));
    expect(screen.queryByText("15 proctoring sessions left open")).not.toBeInTheDocument();
    expect(localStorage.getItem("tm.alerts.dismissed")).toContain("proctoring-stale");
  });

  it("runs a notification's action", async () => {
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: "Grade now" }));
    expect(await screen.findByText("assignment page")).toBeInTheDocument();
  });

  it("drops a stale ?subject= that the teacher no longer teaches", async () => {
    getOverview.mockImplementation(async (id?: number | null) => {
      if (id === 77) throw { response: { status: 404 } };
      return overview(null);
    });
    renderAt("/dashboard?subject=77");
    await screen.findByText("Subject scorecards");
    expect(lastSearch).not.toContain("subject=");
  });

  it("shows an empty state when no subject is assigned this period", async () => {
    getOverview.mockResolvedValue({ ...overview(null), subjects: [], alerts: [] });
    renderAt();
    expect(await screen.findByText("No subjects assigned for this period")).toBeInTheDocument();
  });

  it("offers a retry when the overview fails", async () => {
    getOverview.mockRejectedValueOnce({ response: { status: 502, data: { message: "MIS unavailable" } } });
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Subject scorecards")).toBeInTheDocument();
  });

  it("marks unseen important notifications as New and shares them with the bell", async () => {
    renderAt();
    const alert = (await screen.findByText("2 submissions waiting over 7 days")).closest("p")!;
    expect(within(alert).getByText("New")).toBeInTheDocument();
    // FYI items never get the chip
    expect(within(screen.getByText("15 proctoring sessions left open").closest("p")!).queryByText("New")).toBeNull();
    expect(latestAlerts()).toHaveLength(2);
    expect(unreadImportant(latestAlerts()!)).toHaveLength(1);
    // having been shown on the dashboard, it counts as read after a moment
    await waitFor(() => expect(unreadImportant(latestAlerts()!)).toHaveLength(0), { timeout: 6000 });
  }, 10000);

  it("brings a dismissed alert back when it changes", async () => {
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss: 2 submissions waiting over 7 days" }));
    expect(screen.queryByText("2 submissions waiting over 7 days")).toBeNull();
    const worse = overview(null);
    worse.alerts[0] = { ...worse.alerts[0], title: "5 submissions waiting over 7 days" };
    getOverview.mockResolvedValue(worse);
    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    expect(await screen.findByText("5 submissions waiting over 7 days")).toBeInTheDocument();
    expect(getOverview).toHaveBeenLastCalledWith(null, { fresh: true });
  });

  it("keeps the last good data when a refresh fails", async () => {
    renderAt();
    await screen.findByText("Subject scorecards");
    getOverview.mockRejectedValueOnce({ response: { status: 502, data: { message: "MIS unavailable" } } });
    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    expect(await screen.findByText(/Couldn't refresh \(MIS unavailable\)/)).toBeInTheDocument();
    expect(screen.getByText("Subject scorecards")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("ignores a slow response that arrives after a newer subject choice", async () => {
    renderAt();
    await screen.findByText("Subject scorecards");
    let resolveSlow!: (v: InstructorOverview) => void;
    getOverview.mockImplementationOnce(() => new Promise((r) => (resolveSlow = r))); // subject 1 (slow)
    const chips = screen.getByRole("tablist", { name: "Focus on a subject" });
    fireEvent.click(within(chips).getByRole("tab", { name: /SPEWI302/ }));
    fireEvent.click(within(chips).getByRole("tab", { name: /SPEWJ302/ }));
    expect(await screen.findByText(/Class average 41% is below the 50% pass mark/)).toBeInTheDocument();
    resolveSlow({ ...overview(null), subjects: [WEB] });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText(/Class average 41% is below the 50% pass mark/)).toBeInTheDocument();
    expect(lastSearch).toContain("subject=2");
  });
});
