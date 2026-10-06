import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { pageWindow } from "../utils/pagination";
import Pagination from "../components/ui/Pagination";
import type { QuestionBankOverview } from "../services/questionBankHubApi";

vi.mock("../components/QuestionBank/QuestionBankList", () => ({
  default: (p: { courseId: number; hideCourseCard?: boolean; hideHeading?: boolean }) => (
    <div data-testid="bank-list" data-course={p.courseId} data-card={String(!!p.hideCourseCard)} data-heading={String(!!p.hideHeading)} />
  ),
}));

const getCourseOverview = vi.fn();
vi.mock("../services/questionBankHubApi", () => ({
  QuestionBankHubApiService: { getCourseOverview: (...a: unknown[]) => getCourseOverview(...a) },
}));

import QuestionBankView from "../components/QuestionBank/QuestionBankView";
import { pickOption, selectValue, optionValues } from "./helpers/select";

const zero = {
  total: 0, mine: 0, easy: 0, medium: 0, difficult: 0, no_difficulty: 0, with_explanation: 0,
  blooms_classified: 0, higher_order: 0, sow_linked: 0, topics_covered: 0, used_in_quizzes: 0,
  added_7d: 0, added_30d: 0, last_added_at: null, health_score: 0,
};
const overview: QuestionBankOverview = {
  generated_at: "2026-09-27T10:00:00.000Z",
  subject_id: 8,
  available_subjects: [{ id: 8, name: "Graphic User Interface Design", code: "SPEGI302" }],
  totals: { ...zero, total: 3, easy: 3, health_score: 40 },
  subjects: [{ subject_id: 8, subject_name: "Graphic User Interface Design", subject_code: "SPEGI302", ...zero, total: 3, easy: 3, health_score: 40 }],
  by_type: [{ type: "single_choice", count: 3 }],
  by_blooms: [],
  top_topics: [],
  most_used: [],
  trend: Array.from({ length: 12 }, (_, i) => ({ week_start: `2026-07-${String(i + 1).padStart(2, "0")}`, count: 0 })),
  alerts: [{ id: "thin:8", severity: "warning", subject_id: 8, title: "SPEGI302 · Graphic User Interface Design has only 3 questions", message: "Aim for 10." }],
};

const renderView = (url = "/courses/8/question-bank") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/courses/:courseId/question-bank" element={<QuestionBankView courseId={8} />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  getCourseOverview.mockReset();
  getCourseOverview.mockResolvedValue(overview);
});

describe("QuestionBankView (a subject's own bank)", () => {
  it("opens on Questions without repeating the subject card or heading", async () => {
    renderView();
    const list = screen.getByTestId("bank-list");
    expect(list).toHaveAttribute("data-card", "true");
    expect(list).toHaveAttribute("data-heading", "true");
    // badges arrive with the overview: 3 questions, 1 urgent alert
    const questionsTab = await screen.findByRole("tab", { name: /Questions/ });
    await waitFor(() => expect(within(questionsTab).getByText("3")).toBeInTheDocument());
    expect(within(screen.getByRole("tab", { name: /Dashboard/ })).getByText("1")).toBeInTheDocument();
  });

  it("shows the modern single-subject dashboard and jumps back to the questions from an alert", async () => {
    renderView();
    fireEvent.click(screen.getByRole("tab", { name: /Dashboard/ }));
    expect(await screen.findByText("Bank health")).toBeInTheDocument();
    expect(screen.queryByText("Subject report")).not.toBeInTheDocument(); // multi-subject only
    expect(screen.getByRole("button", { name: /Export CSV/ })).toBeInTheDocument();
    expect(getCourseOverview).toHaveBeenCalledWith(8);

    fireEvent.click(screen.getByRole("button", { name: /Open questions/ }));
    expect(screen.getByRole("tab", { name: /Questions/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("bank-list")).toBeVisible();
  });

  it("keeps the list mounted while the dashboard is open (filters and page survive)", async () => {
    renderView("/courses/8/question-bank?tab=dashboard");
    await screen.findByText("Bank health");
    const list = screen.getByTestId("bank-list");
    expect(list).not.toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: /Questions/ }));
    expect(screen.getByTestId("bank-list")).toBe(list);
  });

  it("shows a skeleton until the dashboard data arrives", async () => {
    let resolve!: (v: QuestionBankOverview) => void;
    getCourseOverview.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    renderView("/courses/8/question-bank?tab=dashboard");
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText("Bank health")).not.toBeInTheDocument();
    resolve(overview);
    expect(await screen.findByText("Bank health")).toBeInTheDocument();
  });

  it("switches tabs with the arrow keys", async () => {
    renderView();
    fireEvent.keyDown(screen.getByRole("tab", { name: /Questions/ }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Dashboard/ })).toHaveAttribute("aria-selected", "true");
  });
});

describe("pagination", () => {
  it("windows long page lists with gaps", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, "gap", 20]);
    expect(pageWindow(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
    expect(pageWindow(20, 20)).toEqual([1, "gap", 17, 18, 19, 20]);
  });

  it("summarises the range, changes page and page size", () => {
    const onPage = vi.fn();
    const onSize = vi.fn();
    render(
      <Pagination page={2} totalPages={6} totalItems={57} pageSize={10} onPageChange={onPage} onPageSizeChange={onSize} itemLabel="questions" />,
    );
    expect(screen.getByText("11–20")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPage).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole("button", { name: "Page 6" }));
    expect(onPage).toHaveBeenCalledWith(6);
    pickOption(screen.getByLabelText("Rows per page"), "50");
    expect(onSize).toHaveBeenCalledWith(50);
  });

  it("stays visible on a single page (so rows-per-page is reachable) but hides page buttons", () => {
    render(<Pagination page={1} totalPages={1} totalItems={4} pageSize={10} onPageChange={() => {}} onPageSizeChange={() => {}} />);
    expect(screen.getByText("1–4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Rows per page")).toBeInTheDocument();
  });
});
