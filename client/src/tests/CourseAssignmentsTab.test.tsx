import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * The course page's Assignments tab. The badge said "1" while the tab opened
 * empty: admins got the student view (drafts hidden), and a warm cache kept
 * an old empty list after an assignment was created elsewhere.
 */

const get = vi.fn();
vi.mock("../utils/axiosConfig", () => ({ default: { get: (...a: unknown[]) => get(...a), patch: vi.fn() } }));
let perms: string[] = [];
vi.mock("../hooks/usePermissions", () => ({ usePermissions: () => ({ can: (p: string) => perms.includes(p) }) }));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "1", currentAcademicTerm: { name: "Term 1" } } }),
}));
vi.mock("../components/Assignments/AssignmentCard", () => ({
  default: ({ assignment }: { assignment: { title: string; status: string } }) => (
    <div data-testid="card">
      {assignment.title} ({assignment.status})
    </div>
  ),
}));

import Assignments from "../components/Assignments/Assignments";

const ADMIN = ["SUBMISSIONS_CREATE", "ASSIGNMENTS_VIEW_SUBMISSIONS", "ASSIGNMENTS_CREATE"];
const STUDENT = ["SUBMISSIONS_CREATE"];
const row = (id: number, title: string, status: string) => ({ id, title, status });
const course = { id: "11", code: "SPEPE301", title: "Programming Fundamentals Using C" };

const renderTab = () =>
  render(
    <MemoryRouter>
      <Assignments courseId="11" courseData={course} showCreateButton />
    </MemoryRouter>,
  );

beforeEach(() => {
  get.mockReset();
  cleanup();
});

describe("course Assignments tab", () => {
  it("shows an admin the subject's draft (they were treated as a student before)", async () => {
    perms = ADMIN;
    get.mockResolvedValue({ data: { data: [row(1, "Pointers lab", "draft")] } });
    renderTab();
    expect(await screen.findByText("Pointers lab (draft)")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/courses/11/assignments");
  });

  it("re-fetches on every visit, so work created elsewhere appears", async () => {
    perms = ADMIN;
    get.mockResolvedValueOnce({ data: { data: [] } });
    renderTab();
    expect(await screen.findByText("No assignments yet")).toBeInTheDocument();
    cleanup();

    get.mockResolvedValueOnce({ data: { data: [row(2, "Loops quiz", "published")] } });
    renderTab();
    expect(await screen.findByText("Loops quiz (published)")).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("keeps removed work out of 'All' but reachable through its filter", async () => {
    perms = ADMIN;
    get.mockResolvedValue({ data: { data: [row(3, "Live", "published"), row(4, "Old", "removed")] } });
    renderTab();
    expect(await screen.findByText("Live (published)")).toBeInTheDocument();
    expect(screen.queryByText("Old (removed)")).toBeNull();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "removed" } });
    expect(screen.getByText("Old (removed)")).toBeInTheDocument();
  });

  it("tells a student nothing is published yet, without the old 'enrol' message", async () => {
    perms = STUDENT;
    get.mockResolvedValue({ data: { data: [] } });
    renderTab();
    expect(await screen.findByText(/hasn't published any assignments for this subject in Term 1/)).toBeInTheDocument();
    expect(screen.queryByText(/enrolled/)).toBeNull();
    expect(screen.queryByText(/Create First Assignment/)).toBeNull();
  });

  it("says when a search finds nothing", async () => {
    perms = ADMIN;
    get.mockResolvedValue({ data: { data: [row(5, "Arrays", "published")] } });
    renderTab();
    await screen.findByText("Arrays (published)");
    fireEvent.change(screen.getByPlaceholderText(/Search assignments/), { target: { value: "zzz" } });
    expect(screen.getByText("No assignments match your search")).toBeInTheDocument();
  });
});
