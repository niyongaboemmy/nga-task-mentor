import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { StudentRankingSummary } from "../services/rankingApi";

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 7, currentAcademicYear: { name: "2026 - 2027" }, currentAcademicTerm: { name: "Term 1" } },
  }),
}));
const get = vi.fn();
// Node's own (path-less) localStorage shadows jsdom's here, so use a plain one.
const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = String(v); },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});
vi.mock("../utils/axiosConfig", () => ({ default: { get: (...a: unknown[]) => get(...a) } }));

import RankStandingChip from "../components/Layout/RankStandingChip";
import { clearRankingSummaryCache } from "../services/rankingApi";

const summary = (over: Partial<StudentRankingSummary> = {}): StudentRankingSummary => ({
  view: "student_summary",
  rank: 18,
  ranked_count: 18,
  class_group_name: "L5 SOD A",
  score: 40,
  band: "Bottom quarter",
  status: "at_risk",
  class_average: 74.6,
  gap: -34.6,
  points_to_next: 13.3,
  subject_count: 15,
  at_risk_subjects: [{ course_id: "12", name: "Web Application Development Using JavaScript", score: 40 }],
  at_risk_count: 1,
  overdue_count: 1,
  top_suggestion: {
    id: "overdue-5", priority: "high", category: "deadline", title: 'Submit "Nouns and adjectives"',
    detail: "", action: { label: "Open assignment", href: "/assignments/5" },
  },
  ...over,
});
const ok = (data: unknown) => ({ data: { success: true, data } });
const renderChip = () => render(<MemoryRouter><RankStandingChip /></MemoryRouter>);

beforeEach(() => {
  get.mockReset();
  clearRankingSummaryCache();
  localStorage.clear();
});

describe("RankStandingChip", () => {
  it("asks only for the summary", async () => {
    get.mockResolvedValue(ok(summary()));
    renderChip();
    await screen.findByRole("button", { name: /overall position/ });
    expect(get).toHaveBeenCalledWith("/rankings", { params: { summary: 1 } });
  });

  it("flags an at-risk student and stops pulsing once they've looked", async () => {
    get.mockResolvedValue(ok(summary()));
    const { container } = renderChip();
    const chip = await screen.findByRole("button", { name: /18th of 18 in L5 SOD A, average 40%, at risk/ });
    expect(container.querySelector(".animate-ping")).not.toBeNull();

    fireEvent.click(chip);
    const dialog = screen.getByRole("dialog", { name: "Your overall standing" });
    expect(dialog).toHaveTextContent("Bottom quarter");
    expect(dialog).toHaveTextContent("-34.6");
    expect(dialog).toHaveTextContent("Below 50% in 1 subject");
    expect(screen.getByRole("link", { name: /Web Application Development Using JavaScript/ })).toHaveAttribute("href", "/courses/12");
    expect(screen.getByRole("link", { name: /Open assignment/ })).toHaveAttribute("href", "/assignments/5");
    expect(screen.getByRole("link", { name: /Full ranking/ })).toHaveAttribute("href", "/ranking");
    expect(container.querySelector(".animate-ping")).toBeNull();

    // Acknowledged for the day: a fresh mount doesn't pulse again.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the acknowledgement across mounts but pulses again if things change", async () => {
    get.mockResolvedValue(ok(summary()));
    const first = renderChip();
    fireEvent.click(await screen.findByRole("button", { name: /overall position/ }));
    first.unmount();

    clearRankingSummaryCache();
    const again = renderChip();
    await screen.findByRole("button", { name: /overall position/ });
    expect(again.container.querySelector(".animate-ping")).toBeNull();
    again.unmount();

    clearRankingSummaryCache();
    get.mockResolvedValue(ok(summary({ at_risk_count: 2 })));
    const changed = renderChip();
    await screen.findByRole("button", { name: /overall position/ });
    expect(changed.container.querySelector(".animate-ping")).not.toBeNull();
  });

  it("encourages a student who is doing well, with no alert", async () => {
    get.mockResolvedValue(ok(summary({
      rank: 1, score: 88, band: "Top of the cohort", status: "excelling", gap: 13.4,
      points_to_next: null, at_risk_subjects: [], at_risk_count: 0, overdue_count: 0, top_suggestion: null,
    })));
    const { container } = renderChip();
    fireEvent.click(await screen.findByRole("button", { name: /1st of 18 in L5 SOD A, average 88%$/ }));
    expect(container.querySelector(".animate-ping")).toBeNull();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("+13.4");
    expect(dialog).toHaveTextContent("You're in 1st place.");
    expect(dialog).not.toHaveTextContent("Below 50%");
  });

  it("shows 'Not ranked' when nothing is marked yet", async () => {
    get.mockResolvedValue(ok(summary({
      rank: null, score: null, band: null, status: "no_marks", gap: null, class_average: null,
      points_to_next: null, at_risk_subjects: [], at_risk_count: 0,
    })));
    renderChip();
    expect(await screen.findByText("Not ranked")).toBeInTheDocument();
  });

  it("renders nothing for staff or when the standing can't load", async () => {
    get.mockResolvedValue(ok({ view: "none" }));
    const staff = renderChip();
    await waitFor(() => expect(staff.container).toBeEmptyDOMElement());
    staff.unmount();

    clearRankingSummaryCache();
    get.mockImplementation(() => Promise.reject(Object.assign(new Error("boom"), { response: { status: 500 } })));
    const failed = renderChip();
    await waitFor(() => expect(failed.container).toBeEmptyDOMElement());
  });

  it("shares one request between mounts within the cache window", async () => {
    get.mockResolvedValue(ok(summary()));
    renderChip();
    renderChip();
    await waitFor(() => expect(screen.getAllByRole("button", { name: /overall position/ })).toHaveLength(2));
    expect(get).toHaveBeenCalledTimes(1);
  });
});
