import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { QuestionBankOverview, SubjectBankStats } from "../services/questionBankHubApi";

// The per-subject list is the existing, separately-used component; here we
// only care that the hub hands it the right subject.
vi.mock("../components/QuestionBank/QuestionBankList", () => ({
  default: ({ courseId, hideCourseCard }: { courseId: number; hideCourseCard?: boolean }) => (
    <div data-testid="bank-list" data-course={courseId} data-hide-card={String(!!hideCourseCard)} />
  ),
}));

const getOverview = vi.fn();
vi.mock("../services/questionBankHubApi", () => ({
  QuestionBankHubApiService: { getOverview: (...a: unknown[]) => getOverview(...a) },
}));

import QuestionBankHubPage from "../pages/QuestionBankHubPage";

const stats = (id: number, name: string, extra: Partial<SubjectBankStats> = {}): SubjectBankStats => ({
  subject_id: id, subject_name: name, subject_code: `C${id}`, total: 0, mine: 0, easy: 0, medium: 0,
  difficult: 0, no_difficulty: 0, with_explanation: 0, blooms_classified: 0, higher_order: 0,
  sow_linked: 0, topics_covered: 0, used_in_quizzes: 0, added_7d: 0, added_30d: 0,
  last_added_at: null, health_score: 0, ...extra,
});

const web = stats(9, "Web UI", { total: 12, mine: 10, easy: 4, medium: 6, difficult: 2, with_explanation: 12, blooms_classified: 12, sow_linked: 6, used_in_quizzes: 3, added_7d: 2, added_30d: 5, health_score: 88 });
const gfx = stats(10, "Graphic Design");

const overview = (subjectId: number | null = null): QuestionBankOverview => ({
  generated_at: "2026-09-27T10:00:00.000Z",
  subject_id: subjectId,
  available_subjects: [
    { id: 9, name: "Web UI", code: "C9" },
    { id: 10, name: "Graphic Design", code: "C10" },
  ],
  totals: { ...web, health_score: 44 },
  subjects: subjectId === 9 ? [web] : [web, gfx],
  by_type: [{ type: "single_choice", count: 12 }],
  by_blooms: [{ level_id: 1, name: "Remember", level_order: 1, count: 12 }],
  top_topics: [{ title: "HTML basics", count: 6 }],
  most_used: [{ id: 1, subject_id: 9, question_text: "<p>What is the web?</p>", question_type: "single_choice", uses: 3 }],
  trend: Array.from({ length: 12 }, (_, i) => ({ week_start: `2026-07-${String(i + 1).padStart(2, "0")}`, count: i === 11 ? 2 : 0 })),
  alerts: [
    { id: "empty:10", severity: "critical", subject_id: 10, title: "C10 · Graphic Design has no questions", message: "Start its bank." },
    { id: "activity:9", severity: "success", subject_id: 9, title: "2 new questions in C9 · Web UI this week", message: "Nice." },
  ],
});

let lastSearch = "";
const LocationSpy = () => {
  lastSearch = useLocation().search;
  return null;
};

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/question-bank" element={<><QuestionBankHubPage /><LocationSpy /></>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  getOverview.mockReset();
  getOverview.mockImplementation(async (id?: number | null) => overview(id ?? null));
});

describe("QuestionBankHubPage", () => {
  it("shows the cross-subject dashboard with alerts and the subject report", async () => {
    renderAt("/question-bank");
    expect(await screen.findByText("C10 · Graphic Design has no questions")).toBeInTheDocument();
    expect(getOverview).toHaveBeenCalledWith(null);
    expect(screen.getByText("Subject report")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Dashboard/ })).toHaveAttribute("aria-selected", "true");
    // one critical alert -> badge on the Dashboard tab
    expect(within(screen.getByRole("tab", { name: /Dashboard/ })).getByText("1")).toBeInTheDocument();
    expect(screen.getByText("What is the web?")).toBeInTheDocument();
  });

  it("filters the dashboard by subject through the URL", async () => {
    renderAt("/question-bank");
    await screen.findByText("Subject report");
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "9" } });
    await waitFor(() => expect(getOverview).toHaveBeenLastCalledWith(9));
    expect(lastSearch).toContain("subject=9");
    // the per-subject report table is replaced by that subject's own view
    await waitFor(() => expect(screen.queryByText("Subject report")).not.toBeInTheDocument());
  });

  it("jumps from an alert to that subject's questions", async () => {
    renderAt("/question-bank");
    fireEvent.click(await screen.findByRole("button", { name: /Open questions/ }));
    const list = await screen.findByTestId("bank-list");
    expect(list).toHaveAttribute("data-course", "10");
    expect(list).toHaveAttribute("data-hide-card", "true");
    expect(lastSearch).toContain("tab=questions");
    expect(lastSearch).toContain("subject=10");
  });

  it("asks for a subject on the Questions tab when none is chosen", async () => {
    renderAt("/question-bank?tab=questions");
    expect(await screen.findByText("Pick a subject to see and manage its questions.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Web UI/ }));
    expect((await screen.findByTestId("bank-list")).getAttribute("data-course")).toBe("9");
  });

  it("falls back to all subjects when the URL names a subject the teacher doesn't teach", async () => {
    getOverview.mockImplementation(async (id?: number | null) => {
      if (id === 77) throw { response: { status: 404, data: { message: "nope" } } };
      return overview(null);
    });
    renderAt("/question-bank?subject=77");
    await screen.findByText("Subject report");
    expect(lastSearch).not.toContain("subject=");
  });

  it("shows a skeleton (not the previous subject's data) while switching subject", async () => {
    renderAt("/question-bank");
    await screen.findByText("Subject report");

    let resolve!: (v: QuestionBankOverview) => void;
    getOverview.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "9" } });

    // stale dashboard gone, skeleton + busy select + progress bar instead
    await waitFor(() => expect(screen.queryByText("Subject report")).not.toBeInTheDocument());
    expect(screen.queryByText("C10 · Graphic Design has no questions")).not.toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByLabelText("Subject")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("progressbar", { name: "Loading question bank" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading Web UI…");

    resolve(overview(9));
    expect(await screen.findByText("Bank health")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Subject")).toHaveAttribute("aria-busy", "false");
  });

  it("ignores a slow response for a subject the user already switched away from", async () => {
    renderAt("/question-bank");
    await screen.findByText("Subject report");

    let resolveSlow!: (v: QuestionBankOverview) => void;
    getOverview.mockImplementationOnce(() => new Promise((r) => (resolveSlow = r))); // subject 9
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "9" } });
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "" } }); // back to all
    await screen.findByText("Subject report");

    resolveSlow(overview(9)); // arrives late -- must not replace "all subjects"
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText("Subject report")).toBeInTheDocument();
  });

  it("keeps the dashboard visible (dimmed) during a manual refresh", async () => {
    renderAt("/question-bank");
    await screen.findByText("Subject report");
    let resolve!: (v: QuestionBankOverview) => void;
    getOverview.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    expect(screen.getByText("Subject report")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Loading question bank" })).toBeInTheDocument();
    resolve(overview(null));
    await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
  });
});
