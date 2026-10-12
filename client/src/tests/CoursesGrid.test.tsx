import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const perms = vi.hoisted(() => ({ list: ["SUBMISSIONS_CREATE"] as string[] }));
vi.mock("../hooks/usePermissions", () => ({ usePermissions: () => ({ can: (p: string) => perms.list.includes(p) }) }));

const COURSES = [
  { id: 1, title: "Web Application Development Using JavaScript", code: "SPEWJ302", credits: 3 },
  { id: 2, title: "Biology", code: "BIO", credits: 3 },
];
vi.mock("react-redux", () => ({
  useSelector: (pick: (s: unknown) => unknown) => pick({ course: { courses: COURSES, loading: {}, error: {} } }),
  useDispatch: () => vi.fn(),
  shallowEqual: () => false,
}));

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

import Courses from "../components/Courses/Courses";

const summary = (subject_id: number, over: object) => ({
  subject_id, subject_name: "", subject_code: null, total: 0, todo: 0, due_soon: 0, missed: 0, awaiting: 0, graded: 0,
  completion: null, recent_average: null, next_task: null, ...over,
});

beforeEach(() => {
  store.clear();
  perms.list = ["SUBMISSIONS_CREATE"];
  getOverview.mockReset();
  getOverview.mockResolvedValue({ subjects: [summary(1, { total: 3, todo: 1, recent_average: 80 }), summary(2, {})] });
});

const renderCourses = () =>
  render(
    <MemoryRouter>
      <Courses />
    </MemoryRouter>,
  );

describe("Courses grid", () => {
  it("is a grid by default with each student's own numbers", async () => {
    renderCourses();
    expect(screen.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "true");
    const web = screen.getByRole("button", { name: "Open Web Application Development Using JavaScript" });
    expect(await within(web).findByText("80%")).toBeInTheDocument();
    expect(within(web).getByText("1 due")).toBeInTheDocument();
    expect(within(web).getByText("SPEWJ302")).toBeInTheDocument();
    expect(screen.getByText(/with work set/)).toBeInTheDocument();
  });

  it("switches to a list and remembers it", () => {
    renderCourses();
    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    expect(store.get("tm.courses.view")).toBe("list");
    expect(screen.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "true");
  });

  it("searches by name or code", () => {
    renderCourses();
    fireEvent.change(screen.getByRole("textbox", { name: "Search subjects" }), { target: { value: "bio" } });
    expect(screen.getByRole("button", { name: "Open Biology" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open Web Application/ })).toBeNull();
  });

  it("doesn't ask for a student overview for staff", () => {
    perms.list = ["COURSES_VIEW_STUDENTS"];
    renderCourses();
    expect(getOverview).not.toHaveBeenCalled();
  });
});
