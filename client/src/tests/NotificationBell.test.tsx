import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { InstructorOverview } from "../services/instructorOverviewApi";

const getOverview = vi.fn();
vi.mock("../services/instructorOverviewApi", async (orig) => ({
  ...(await orig<typeof import("../services/instructorOverviewApi")>()),
  getInstructorOverview: (...a: unknown[]) => getOverview(...a),
}));

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});

import NotificationBell from "../components/Layout/NotificationBell";
import { publishAlerts, resetAlertState } from "../services/alertStore";

const withAlerts = (alerts: InstructorOverview["alerts"]) => ({ alerts }) as unknown as InstructorOverview;
const ALERTS: InstructorOverview["alerts"] = [
  { id: "grading-overdue", severity: "critical", title: "9 submissions waiting over 7 days", message: "Oldest: Lab", subject_id: 1, action: { label: "Grade now", url: "/assignments/11" } },
  { id: "students-at-risk", severity: "warning", title: "3 students need support", message: "Below 50%", subject_id: null, action: { label: "See list", url: "#students" } },
  { id: "drafts", severity: "info", title: "1 draft not yet published", message: "Publish it.", subject_id: null },
];

let lastPath = "";
const Spy = () => {
  const l = useLocation();
  lastPath = l.pathname + l.hash;
  return null;
};

const renderBell = () =>
  render(
    <MemoryRouter initialEntries={["/courses"]}>
      <NotificationBell loadAlerts={async () => (await getOverview(null)).alerts} />
      <Routes>
        <Route path="*" element={<Spy />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  store.clear();
  resetAlertState();
  getOverview.mockReset();
  getOverview.mockResolvedValue(withAlerts(ALERTS));
  document.title = "TaskMentor";
});

describe("NotificationBell", () => {
  it("counts unread important alerts on the badge and in the tab title", async () => {
    renderBell();
    expect(await screen.findByRole("button", { name: "Notifications, 2 unread" })).toBeInTheDocument();
    expect(getOverview).toHaveBeenCalledWith(null);
    expect(document.title).toBe("(2) TaskMentor");
  });

  it("lists every notification, marks important ones New, and clears the badge when closed", async () => {
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 2 unread" }));
    const panel = screen.getByRole("dialog", { name: "Notifications" });
    expect(panel).toHaveTextContent("9 submissions waiting over 7 days");
    expect(panel).toHaveTextContent("1 draft not yet published");
    expect(screen.getAllByText("New")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Notifications, 2 unread" }));
    expect(await screen.findByRole("button", { name: "Notifications" })).toBeInTheDocument();
    expect(document.title).toBe("TaskMentor");
  });

  it("opens an alert's target, including dashboard anchors", async () => {
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: /Notifications/ }));
    fireEvent.click(screen.getByText("3 students need support"));
    await waitFor(() => expect(lastPath).toBe("/dashboard#students"));
  });

  it("re-alerts when an alert gets worse", async () => {
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: /2 unread/ }));
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    expect(await screen.findByRole("button", { name: "Notifications" })).toBeInTheDocument();
    act(() => publishAlerts([{ ...ALERTS[0], title: "12 submissions waiting over 7 days" }, ALERTS[1]]));
    expect(await screen.findByRole("button", { name: "Notifications, 1 unread" })).toBeInTheDocument();
  });

  it("says so when there is nothing to report", async () => {
    getOverview.mockResolvedValue(withAlerts([{ id: "all-clear", severity: "success", title: "All caught up", message: "", subject_id: null }]));
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: "Notifications" }));
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });

  it("shows a student's reminders with a live countdown, and badges a new mark", async () => {
    const { reminderToAlert } = await import("../services/studentOverviewApi");
    const soon = new Date(Date.now() + 10 * 60000).toISOString();
    getOverview.mockReset();
    const reminders = [
      { id: "running-20", severity: "critical" as const, title: '"JS basics" is in progress', message: "Resume it.", countdown_to: soon, subject_id: 2, action: { label: "Resume", url: "/quizzes/20/take" } },
      { id: "result-assignment-14", severity: "success" as const, title: "New result: 16/20 on HTML basics", message: "80%", countdown_to: null, subject_id: 1 },
      { id: "all-clear", severity: "success" as const, title: "You're on top of things", message: "", countdown_to: null, subject_id: null },
    ];
    render(
      <MemoryRouter>
        <NotificationBell loadAlerts={async () => reminders.map(reminderToAlert)} />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 2 unread" }));
    const panel = screen.getByRole("dialog", { name: "Notifications" });
    expect(within(panel).getByRole("timer")).toHaveTextContent(/(09|10):\d\d left/);
    expect(panel).toHaveTextContent("New result: 16/20 on HTML basics");
    expect(panel).not.toHaveTextContent("You're on top of things");
  });
});
